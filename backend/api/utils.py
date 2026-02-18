import os
import base64
import json
import re
from dotenv import load_dotenv
from datetime import date
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .models import ScanResult, Vaccination, Patient, Visit, Attachment
from .prompts import (
    SCAN_ANALYSIS_PROMPT, SCAN_JSON_FORMAT_PROMPT,
    DOCTOR_MODE_SYSTEM_PROMPT, PATIENT_MODE_SYSTEM_PROMPT,
    ATTACHMENT_ANALYSIS_CONTEXT, FULL_SUMMARY_TEMPLATE,
    INCREMENTAL_SUMMARY_TEMPLATE, HISTORY_SUMMARY_TEMPLATE
)

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

# Utilities for Pediatrician App

def analyze_scan_helper(attachment):
    """
    Helper function to analyze a scan attachment using Gemini Vision.
    Returns a dict with 'findings', 'impression', 'modality'.
    """
    try:
        # Check if already analyzed
        if hasattr(attachment, 'scan_analysis') and attachment.scan_analysis:
            return {
                'modality': attachment.scan_analysis.modality,
                'findings': attachment.scan_analysis.findings,
                'impression': attachment.scan_analysis.impression
            }

        image_path = attachment.file.path
        
        # Gemini Vision Model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=API_KEY,
            temperature=0.2
        )
        
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode("utf-8")
            
        messages = [
            HumanMessage(
                content=[
                    {"type": "text", "text": SCAN_ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
            ),
            HumanMessage(
                content=SCAN_JSON_FORMAT_PROMPT
            )
        ]
        
        response = llm.invoke(messages)
        content = response.content
        
        # Parse JSON
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            data = json.loads(json_str)
        else:
            # Fallback
            data = {
                'modality': 'Unknown',
                'findings': content,
                'impression': 'See findings.'
            }

        # Save Result
        ScanResult.objects.create(
            attachment=attachment,
            modality=data.get('modality', 'Unknown'),
            findings=data.get('findings', ''),
            impression=data.get('impression', '')
        )
        return data

    except Exception as e:
        print(f"Analysis Helper Error: {e}")
        return None

def get_ai_response(messages, model="gemini-2.5-flash-lite", temperature=0.7):
    """
    Helper to get a response from a chat model.
    """
    llm = ChatGoogleGenerativeAI(
        model=model,
        google_api_key=API_KEY,
        temperature=temperature
    )
    return llm.invoke(messages)

def get_llm_chain_response(template, variables, model="gemini-flash-latest", temperature=0.2):
    """
    Helper to get a response from a prompt template chain.
    """
    llm = ChatGoogleGenerativeAI(
        model=model,
        google_api_key=API_KEY,
        temperature=temperature
    )
    prompt = PromptTemplate(
        template=template,
        input_variables=list(variables.keys())
    )
    chain = prompt | llm | StrOutputParser()
    return chain.invoke(variables)

def get_vitals_summary(patient_id):
    """
    Returns a string summary of the latest vitals for a patient.
    """
    if not patient_id:
        return "None"
    
    last_visit = Visit.objects.filter(patient_id=patient_id).order_by('-date').first()
    if not last_visit:
        return "None"
        
    vitals = f"Weight: {last_visit.weight} kg, Height: {last_visit.height} cm"
    if last_visit.head_circumference:
        vitals += f", Head Circumference: {last_visit.head_circumference} cm"
    return vitals

def get_pediatric_system_prompt(patient_id, patient_stats, mode, history, attachment_id=None):
    """
    Builds the complete system prompt for AIChat based on patient context.
    """
    # 1. Missing Stats Check
    missing_info = []
    if not patient_stats.get('age'): missing_info.append("Age")
    if not patient_stats.get('weight'): missing_info.append("Weight")
    if not patient_stats.get('height'): missing_info.append("Height")
    
    missing_prompt = ""
    if missing_info:
        missing_prompt = f"\n\nCRITICAL: The following patient data is MISSING from the record: {', '.join(missing_info)}. You MUST ask the parent for these specific values."

    # 2. Vaccination Check
    vaccine_prompt = ""
    if patient_id:
        pending_vax_qs = Vaccination.objects.filter(
            patient_id=patient_id, 
            status='Pending', 
            due_date__lte=date.today()
        ).values_list('vaccine_name', flat=True)
        
        pending_vaccines = list(pending_vax_qs)
        if pending_vaccines:
            vaccine_list = ", ".join(pending_vaccines)
            vaccine_prompt = f"\n\n**Vaccination Check**: The patient is due/overdue for the following vaccines: {vaccine_list}. Ask if any of these have been administered recently by another doctor."

    # 3. Age Context
    age_val = patient_stats.get('age')
    age_prompt = ""
    if age_val:
        age_prompt = f"\n\n**Patient Age**: {age_val}. Adjust your questions to be appropriate for a child of this age."

    # 4. Mode Logic
    if mode == 'doctor':
        system_prompt_content = DOCTOR_MODE_SYSTEM_PROMPT.format(
            age_prompt=age_prompt,
            missing_prompt=missing_prompt
        )
    else:
        # Default "Patient/Parent" Mode
        ai_msg_count = sum(1 for m in history if m.get('role') == 'ai' or m.get('sender') == 'ai')
        
        limit_prompt = ""
        if ai_msg_count >= 10:
            limit_prompt = "\n\n**LIMIT REACHED**: You have asked enough questions. Do NOT ask any more. Provide a polite summary of what you have gathered so far and advise the parent to see the doctor."
        else:
            limit_prompt = f"\n\n**Question Limit**: You have asked {ai_msg_count}/10 allowed questions. If you reach 10, you must stop and summarize."

        system_prompt_content = PATIENT_MODE_SYSTEM_PROMPT.format(
            age_prompt=age_prompt,
            missing_prompt=missing_prompt,
            vaccine_prompt=vaccine_prompt,
            limit_prompt=limit_prompt
        )

    # 5. Attachment Context
    if attachment_id:
        try:
            attachment = Attachment.objects.get(id=attachment_id)
            analysis_result = analyze_scan_helper(attachment)
            
            if analysis_result:
                analysis_context = ATTACHMENT_ANALYSIS_CONTEXT.format(
                    modality=analysis_result.get('modality'),
                    findings=analysis_result.get('findings'),
                    impression=analysis_result.get('impression')
                )
                system_prompt_content += analysis_context
        except Exception as e:
            print(f"Attachment Prompt Context Error: {e}")

    return system_prompt_content

def generate_chat_summary(history, patient_id, session):
    """
    Handles incremental or full chat summarization.
    """
    latest_vitals = get_vitals_summary(patient_id)
    previous_summary = None
    new_messages_text = ""
    current_msg_count = len(history)

    if session and session.summary and session.cached_message_count < current_msg_count:
        previous_summary = session.summary
        new_msgs = history[session.cached_message_count:]
        for msg in new_msgs:
            role = "Parent" if msg.get('role') == 'user' else "Assistant"
            new_messages_text += f"{role}: {msg.get('text')}\n"
    else:
        for msg in history:
            role = "Parent" if msg.get('role') == 'user' else "Assistant"
            new_messages_text += f"{role}: {msg.get('text')}\n"

    current_date_str = date.today().strftime("%Y-%m-%d")

    if previous_summary:
        result = get_llm_chain_response(INCREMENTAL_SUMMARY_TEMPLATE, {
            "previous_summary": previous_summary,
            "new_messages_text": new_messages_text,
            "latest_vitals": latest_vitals,
            "current_date": current_date_str
        })
    else:
        result = get_llm_chain_response(FULL_SUMMARY_TEMPLATE, {
            "new_messages_text": new_messages_text,
            "latest_vitals": latest_vitals,
            "current_date": current_date_str
        })
    
    return result.replace('```json', '').replace('```', '').strip()

def generate_history_summary(last_visits):
    """
    Generates a high-level summary of recent medical visits.
    """
    if not last_visits:
        return "No previous visits recorded."

    visits_text = ""
    for visit in last_visits:
        visits_text += f"Date: {visit.date}, Type: {visit.visit_type}\n"
        visits_text += f"Diagnosis: {visit.diagnosis}\n"
        visits_text += f"Notes: {visit.notes}\n---\n"

    return get_llm_chain_response(HISTORY_SUMMARY_TEMPLATE, {"visits_text": visits_text}, temperature=0.4).strip()
