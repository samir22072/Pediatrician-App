import os
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Avg, Count
from dotenv import load_dotenv

# LangChain Imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

import json
import base64
import re
import random
from datetime import date
from .models import Patient, Visit, Attachment, ChatSession, ChatMessage, Vaccination, ScanResult
from .serializers import (
    PatientSerializer, PatientDetailSerializer, 
    VisitSerializer, AttachmentSerializer
)

# Load env variables
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# --- Authentication Views ---
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            role = 'doctor' if user.is_staff else 'patient'
            patient_id = None
            if role == 'patient' and hasattr(user, 'patient_profile'):
                 patient_id = user.patient_profile.id
            
            return Response({
                'token': token.key,
                'role': role,
                'username': user.username,
                'patientId': patient_id
            })
        return Response({'error': 'Invalid Credentials'}, status=status.HTTP_400_BAD_REQUEST)

class PatientListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_staff:
            patients = Patient.objects.all().order_by('-created_at')
        else:
            # Patients can only see their own profile
            patients = Patient.objects.filter(user=request.user)
            
        serializer = PatientSerializer(patients, many=True, context={'request': request})
        return Response(serializer.data)

from rest_framework.permissions import IsAuthenticated, IsAdminUser

class PatientCreateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            patient = serializer.save()
            
            # Auto-create User
            try:
                username = patient.name.lower().replace(" ", "")
                # Simple uniquifier if needed
                if User.objects.filter(username=username).exists():
                    username = f"{username}{random.randint(100, 999)}"
                
                user = User.objects.create_user(username=username, password='password123')
                patient.user = user
                patient.save()
                
                # Update response data to include creds (optional but helpful)
                data = serializer.data
                data['username'] = username
                data['temp_password'] = 'password123'
                return Response(data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                print(f"Error creating user: {e}")
                # Return success for patient but warn about user
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PatientDetailView(APIView):
    def post(self, request):
        patient_id = request.data.get('id')
        if not patient_id:
             return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            patient = Patient.objects.get(pk=patient_id)
            serializer = PatientDetailSerializer(patient, context={'request': request})
            return Response(serializer.data)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)

class VisitCreateView(APIView):
    def post(self, request):
        serializer = VisitSerializer(data=request.data)
        if serializer.is_valid():
            visit = serializer.save()
            
            # --- Link Session Attachments ---
            session_id = request.data.get('sessionId') # Note camelCase from frontend usually
            
            if session_id:
                try:
                    session = ChatSession.objects.get(pk=session_id)
                    # Find attachments for this session that have NO visit
                    attachments = Attachment.objects.filter(session=session, visit__isnull=True)
                    
                    if attachments.exists():
                        updated = attachments.update(visit=visit)
                except Exception as e:
                    print(f"Error linking session attachments: {e}")

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VisitUpdateView(APIView):
    def post(self, request):
        visit_id = request.data.get('id')
        if not visit_id:
            return Response({'error': 'Visit ID required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            visit = Visit.objects.get(pk=visit_id)
            serializer = VisitSerializer(visit, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Visit.DoesNotExist:
             return Response({'error': 'Visit not found'}, status=status.HTTP_404_NOT_FOUND)




class DashboardView(APIView):
    def post(self, request):
        total_patients = Patient.objects.count()
        total_visits = Visit.objects.count()
        
        # Average age of all visits recorded is simple:
        avg_visit_age = Visit.objects.aggregate(Avg('age'))['age__avg'] or 0
        
        return Response({
            'total_patients': total_patients,
            'total_visits': total_visits,
            'avg_patient_age': round(avg_visit_age, 1)
        })

class AIChatView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        current_message = request.data.get('message', '')
        if not current_message:
            return Response({'error': 'Message content is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Initialize LangChain Chat Model
            chat = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-lite",
                google_api_key=API_KEY,
                temperature=0.7
            )
            
            # Check for missing stats
            patient_stats = request.data.get('patientStats', {})
            missing_info = []
            if not patient_stats.get('age'): missing_info.append("Age")
            if not patient_stats.get('weight'): missing_info.append("Weight")
            if not patient_stats.get('height'): missing_info.append("Height")
            
            missing_prompt = ""
            if missing_info:
                missing_prompt = f"\n\nCRITICAL: The following patient data is MISSING from the record: {', '.join(missing_info)}. You MUST ask the parent for these specific values."

            # Check for pending vaccines via ORM
            patient_id = request.data.get('patientId')
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
            
            # Retrieve mode from request, default to 'patient'
            mode = request.data.get('mode', 'patient')

            system_prompt_content = ""
            
            # Age Context
            age_val = patient_stats.get('age')
            age_prompt = ""
            if age_val:
                age_prompt = f"\n\n**Patient Age**: {age_val}. Adjust your questions to be appropriate for a child of this age."

            if mode == 'doctor':
                 system_prompt_content = f"""You are an efficient AI Medical Scribe assisting a physician.
                 
                 Goal: Structure clinical notes from the doctor's input and ask ONLY critical clarifying questions if data is missing for a complete record.
                 
                 Guidelines:
                 1. **Professional Tone**: Use standard medical terminology. Be brief.
                 2. **No Triage**: Do NOT ask "How long has he had this?" or "Is he eating well?" unless the doctor explicitly asks you to remind them.
                 3. **Structure**: If the doctor dictates findings (e.g., "Otitis media right ear"), acknowledge simply: "Noted. Right OM."
                 4. **Comprehensive Capture**: Actively listen for and record Vitals (Temp, HR, BP), Treatment Plan (Prescription), and Follow-up Date.
                 5. **Assistance**: If the doctor asks for a differential or dosage, provide it concisely.
                 {age_prompt}
                 {missing_prompt}
                 
                 Your output should be ready for pasting into an EMR or a brief confirmation of recorded data."""
            else:
                # Default "Patient/Parent" Mode
                # Count previous AI messages to limit questions
                ai_msg_count = sum(1 for m in history if m.get('role') == 'ai' or m.get('sender') == 'ai')
                
                limit_prompt = ""
                if ai_msg_count >= 10:
                    limit_prompt = "\n\n**LIMIT REACHED**: You have asked enough questions. Do NOT ask any more. Provide a polite summary of what you have gathered so far and advise the parent to see the doctor."
                else:
                    limit_prompt = f"\n\n**Question Limit**: You have asked {ai_msg_count}/10 allowed questions. If you reach 10, you must stop and summarize."

                system_prompt_content = f"""You are an expert AI Pediatric Triage Assistant. Your goal is to briefly gather key symptoms for the doctor.

                Guidelines:
                1. **Goal**: You must gather all necessary information within a **maximum of 10 questions**. Be efficient.
                2. **MANDATORY FIRST STEP**: If this is the BEGINNING of the conversation (you have not asked any questions yet) and the user has not provided vitals, you MUST ask for the patient's current **Height, Weight, and Head Circumference**. Do this IMMEDIATELY after acknowledging their first message. Do not proceed with detailed triage until you request these.
                3. **Medication Check**: You MUST ask if any medications (e.g., Tylenol, Ibuprofen) have already been administered.
                4. **Relevance is Key**: Ask only questions directly related to the reported symptoms. Do NOT follow a rigid checklist for unrelated issues.
                5. **Respect Uncertainty**: If the user says "I don't know", accept it immediately and move on.
                6. **Conciseness**: Keep your responses short (max 2 sentences).
                7. **Pacing**: Ask only 1 question at a time.
                {age_prompt}
                {missing_prompt}
                {vaccine_prompt}
                {limit_prompt}

                Be empathetic but efficient. Do NOT provide medical diagnoses or treatment advice. Just gather the facts."""

            # Handle Attachment Analysis
            attachment_id = request.data.get('attachmentId')
            analysis_context = ""
            structured_findings = None
            
            if attachment_id:
                try:
                    attachment = Attachment.objects.get(id=attachment_id)
                    # Analyze
                    analysis_result = analyze_scan_helper(attachment)
                    
                    if analysis_result:
                        analysis_context = f"""
                        \n\n**ATTACHED SCAN ANALYSIS**:
                        The user has uploaded a medical scan.
                        **Modality**: {analysis_result.get('modality')}
                        **Findings**: {analysis_result.get('findings')}
                        **Impression**: {analysis_result.get('impression')}
                        
                        **INSTRUCTION**: Review these findings. 
                        1. Explain the findings to the user in simple terms. 
                        2. If the prompt is just describing the image, confirm the findings.
                        3. If there are concerning findings, advise seeing a specialist.
                        """
                        structured_findings = analysis_result
                except Exception as e:
                    print(f"Attachment Context Error: {e}")
            
            # Append validation prompt to system prompt
            system_prompt_content += analysis_context

            # Construct Message History
            messages = [
                SystemMessage(content=system_prompt_content)
            ]
            
            for msg in history:
                if msg.get('role') == 'user':
                    messages.append(HumanMessage(content=msg.get('text', '')))
                elif msg.get('role') == 'ai':
                    messages.append(AIMessage(content=msg.get('text', '')))
            
            # Add current user message
            messages.append(HumanMessage(content=current_message))
            
            # Save User Message to DB
            if patient_id:
                try:
                    patient_obj = Patient.objects.get(pk=patient_id)
                    
                    # Find or convert session
                    session_id = request.data.get('sessionId')
                    if session_id:
                        try:
                            session = ChatSession.objects.get(pk=session_id)
                        except ChatSession.DoesNotExist:
                             # Fallback create
                             session = ChatSession.objects.create(patient=patient_obj)
                    else:
                        # Temporary: If no session ID, try to get the latest one or create new
                        # For now, let's just use the latest one to keep context, or create if none.
                        session = ChatSession.objects.filter(patient=patient_obj).order_by('-updated_at').first()
                        if not session:
                             session = ChatSession.objects.create(patient=patient_obj)

                    ChatMessage.objects.create(
                        session=session,
                        sender='user',
                        text=current_message
                    )
                except Patient.DoesNotExist:
                    patient_obj = None
                    session = None

            # Invoke Model
            response = chat.invoke(messages)
            
            # Extract text content safely
            content = response.content
            
            # If content is a string that looks like a JSON list, try to parse it
            if isinstance(content, str) and content.strip().startswith('['):
                try:
                    # Replace single quotes with double quotes for valid JSON if needed (though risky)
                    # Better to just try loading if it's valid JSON. 
                    # If it's a python repr string (single quotes), json.loads might fail. 
                    # Let's try ast.literal_eval for safety if json fails, or just strict json.
                    # Actually, Gemini might return a string representation of a list.
                    # Let's try to parse it.
                    parsed_content = json.loads(content)
                    if isinstance(parsed_content, list):
                        content = parsed_content
                except json.JSONDecodeError:
                    pass

            if isinstance(content, list):
                # Handle list of blocks (e.g. [{'type': 'text', 'text': '...'}])
                text_blocks = [block.get('text', '') for block in content if isinstance(block, dict) and block.get('type') == 'text']
                if text_blocks:
                    content = "\n".join(text_blocks)
                else:
                    # Fallback: join any string elements
                    content = " ".join([str(c) for c in content])
            elif hasattr(content, 'text'):
                 content = content.text
            elif not isinstance(content, str):
                 content = str(content)

            # Save AI Response to DB
            if session:
                ChatMessage.objects.create(
                    session=session,
                    sender='ai',
                    text=response.content
                )
            
            return Response({
                'text': content, 
                'sessionId': session.id if session else None,
                'structured_findings': structured_findings # Include structured_findings in the response
            })
            
        except Exception as e:
            print(f"LangChain Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AISummarizeView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        patient_id = request.data.get('patientId')
        session_id = request.data.get('sessionId')
        
        # --- Caching Logic ---
        session = None
        if session_id:
            try:
                session = ChatSession.objects.get(pk=session_id)
                # Check if cache is valid (same message count)
                # Note: 'history' includes the latest user message usually, but let's trust the length passed from frontend
                current_msg_count = len(history) 
                
                if session.summary and session.cached_message_count == current_msg_count:
                    print(f"Returning CACHED summary for session {session_id}")
                    return Response({'summary': session.summary})
            except ChatSession.DoesNotExist:
                pass
        
        pending_vaccines = []
        if patient_id:
            pending_vaccines = list(Vaccination.objects.filter(
                patient_id=patient_id, 
                status='Pending', 
                due_date__lte=date.today()
            ).values_list('vaccine_name', flat=True))
        
        latest_vitals = "None"
        if patient_id:
            last_visit = Visit.objects.filter(patient_id=patient_id).order_by('-date').first()
            if last_visit:
                latest_vitals = f"Weight: {last_visit.weight} kg, Height: {last_visit.height} cm"
                if last_visit.head_circumference:
                     latest_vitals += f", Head Circumference: {last_visit.head_circumference} cm"
        
        try:
            # Initialize Model
            llm = ChatGoogleGenerativeAI(
                model="gemini-flash-latest",
                google_api_key=API_KEY,
                temperature=0.2
            )

            # --- Incremental Logic ---
            previous_summary = None
            new_messages_text = ""
            current_msg_count = len(history)

            if session and session.summary and session.cached_message_count < current_msg_count:
                print(f"Incremental Update: {session.cached_message_count} -> {current_msg_count}")
                previous_summary = session.summary
                # Get only new messages
                new_msgs = history[session.cached_message_count:]
                for msg in new_msgs:
                    role = "Parent" if msg.get('role') == 'user' else "Assistant"
                    new_messages_text += f"{role}: {msg.get('text')}\n"
            else:
                # Full Generation
                for msg in history:
                    role = "Parent" if msg.get('role') == 'user' else "Assistant"
                    new_messages_text += f"{role}: {msg.get('text')}\n"

            
            from datetime import date
            current_date_str = date.today().strftime("%Y-%m-%d")

            if previous_summary:
                # Incremental Prompt
                template = """
                Act as a medical assistant. You have a PREVIOUS SUMMARY of a patient visit and some NEW MESSAGES.
                Your task is to UPDATE the summary to include any new information from the new messages.
                
                Previous Summary (JSON):
                {previous_summary}
                
                New Messages:
                {new_messages_text}
                
                Context:
                - Latest recorded Vitals: {latest_vitals}
                - Today's Date: {current_date}
                
                Instructions:
                1. Update 'diagnosis' if new symptoms clarify it.
                2. Append important new details to 'notes'.
                3. Update 'weight', 'height', 'head_circumference', 'temperature', 'heart_rate', 'blood_pressure' ONLY if explicitly mentioned in NEW messages.
                4. Update 'prescription' and 'follow_up_date' if mentioned. CALCULATE 'follow_up_date' based on Today's Date if a relative time (e.g. "in 5 days") is given.
                5. Merge 'visit_type' (add new tags if relevant).
                6. Merge 'given_vaccines'.
                7. Return the FULL updated JSON in the same format.
                
                JSON Structure:
                {{
                    "diagnosis": "string",
                    "notes": "string",
                    "weight": number or null,
                    "height": number or null,
                    "head_circumference": number or null,
                    "temperature": number or null,
                    "heart_rate": number or null,
                    "blood_pressure": "string" or null,
                    "prescription": "string" or null,
                    "follow_up_date": "YYYY-MM-DD" or null,
                    "visit_type": ["Sick", "Vaccination"],
                    "given_vaccines": ["vaccine1"]
                }}
                Do not include markdown code blocks, just raw JSON.
                """
                
                prompt = PromptTemplate(
                    template=template,
                    input_variables=["previous_summary", "new_messages_text", "latest_vitals", "current_date"]
                )
                
                chain = prompt | llm | StrOutputParser()
                result = chain.invoke({
                    "previous_summary": previous_summary,
                    "new_messages_text": new_messages_text,
                    "latest_vitals": latest_vitals,
                    "current_date": current_date_str
                })

            else:
                # Standard Full Prompt (Existing Logic)
                template = """
                Act as a medical assistant. Based on the conversation below, generate a JSON summary for a visit record.
                
                Context:
                - Latest recorded Vitals: {latest_vitals}
                - Today's Date: {current_date}
                
                Instructions:
                1. Extract 'diagnosis' (short clinical term).
                2. Extract 'notes' (detailed summary of symptoms/advice).
                3. Extract 'weight', 'height', and 'head_circumference' if mentioned. Use null if unknown.
                4. Extract Optional Vitals if mentioned: 'temperature', 'heart_rate', 'blood_pressure'.
                5. Extract 'prescription' (medications, dosage, instructions).
                6. Extract 'follow_up_date' (YYYY-MM-DD or null). CALCULATE based on Today's Date if relative (e.g. "next week").
                7. DETERMINE 'visit_type':
                   - "Sick": if symptoms (fever, cough, pain, etc.) are discussed.
                   - "Vaccination": if vaccines are mentioned or administered.
                   - "Growth Check": if only weight/height/feeding is discussed.
                   - "General": if routine checkup or unclear.
                   - Return a LIST of matching tags. Example: ["Sick", "Vaccination"].
                8. Extract 'given_vaccines' (list of strings) if administered.
                9. Return ONLY valid JSON.
    
                Conversation:
                {new_messages_text}
                
                JSON Structure:
                {{
                    "diagnosis": "string",
                    "notes": "string",
                    "weight": number or null,
                    "height": number or null,
                    "head_circumference": number or null,
                    "temperature": number or null,
                    "heart_rate": number or null,
                    "blood_pressure": "string" or null,
                    "prescription": "string" or null,
                    "follow_up_date": "YYYY-MM-DD" or null,
                    "visit_type": ["Sick", "Vaccination"],
                    "given_vaccines": ["vaccine1"]
                }}
                Do not include markdown code blocks, just raw JSON.
                """
                
                prompt = PromptTemplate(
                    template=template,
                    input_variables=["new_messages_text", "latest_vitals", "current_date"]
                )
                
                chain = prompt | llm | StrOutputParser()
                result = chain.invoke({
                    "new_messages_text": new_messages_text,
                    "latest_vitals": latest_vitals,
                    "current_date": current_date_str
                })
            
            # Clean result of any markdown if LangChain didn't catch it
            cleaned_result = result.replace('```json', '').replace('```', '').strip()
            
            # --- Save to Cache ---
            if session:
                session.summary = cleaned_result
                session.cached_message_count = len(history)
                session.save()
            
            return Response({'summary': cleaned_result})
            
        except Exception as e:
            print(f"LangChain Summary Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AIHistorySummaryView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        patient_id = request.data.get('patientId')
        
        if not patient_id:
            return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch last 3 visits
            last_visits = Visit.objects.filter(patient_id=patient_id).order_by('-date')[:3]
            
            if not last_visits:
                return Response({'summary': "No previous visits recorded."})

            visits_text = ""
            for visit in last_visits:
                visits_text += f"Date: {visit.date}, Type: {visit.visit_type}\n"
                visits_text += f"Diagnosis: {visit.diagnosis}\n"
                visits_text += f"Notes: {visit.notes}\n---\n"

            # Initialize Model
            llm = ChatGoogleGenerativeAI(
                model="gemini-flash-latest",
                google_api_key=API_KEY,
                temperature=0.4
            )

            # Define Prompt
            template = f"""
            Act as a senior pediatrician reviewing a patient's chart.
            Analyze the following 3 most recent visits and provide a brief, high-level summary of the patient's recent medical history. 
            Focus on recurring issues, progress of ongoing treatments, or key observations.
            Keep it under 3-4 sentences.

            Recent Visits:
            {visits_text}
            
            Summary:
            """
            
            prompt = PromptTemplate.from_template(template)
            chain = prompt | llm | StrOutputParser()
            result = chain.invoke({})
            
            return Response({'summary': result.strip()})

        except Exception as e:
            print(f"AI History Summary Error: {e}")
            # Fallback instead of 500 to keep UI smooth
            return Response({'summary': "Could not generate AI summary at this time."})
            
class ChatSessionListView(APIView):
    def post(self, request):
        patient_id = request.data.get('patientId')
        if not patient_id:
            return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Annotate with message count and filter > 0
        sessions = ChatSession.objects.filter(patient_id=patient_id).annotate(msg_count=Count('messages')).filter(msg_count__gt=0).order_by('-updated_at')
        data = [{'id': str(s.id), 'name': s.name, 'updated_at': s.updated_at} for s in sessions]
        return Response(data)

class ChatSessionMessagesView(APIView):
    def post(self, request):
        session_id = request.data.get('sessionId')
        if not session_id:
            return Response({'error': 'Session ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        messages = ChatMessage.objects.filter(session_id=session_id).order_by('timestamp')
        data = [{'id': str(m.id), 'sender': m.sender, 'text': m.text, 'timestamp': m.timestamp} for m in messages]
        return Response(data)

class ChatSessionCreateView(APIView):
    def post(self, request):
        patient_id = request.data.get('patientId')
        name = request.data.get('name', 'New Chat')
        
        if not patient_id:
            return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import ChatSession
        
        try:
             patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
             return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)

        session = ChatSession.objects.create(patient=patient, name=name)
        return Response({'id': str(session.id), 'name': session.name, 'created_at': session.created_at}, status=status.HTTP_201_CREATED)

class ChatSessionDeleteView(APIView):
    def post(self, request):
        session_id = request.data.get('sessionId')
        if not session_id:
            return Response({'error': 'Session ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
             session = ChatSession.objects.get(pk=session_id)
             session.delete()
             return Response({'message': 'Session deleted'}, status=status.HTTP_200_OK)
        except ChatSession.DoesNotExist:
             return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)



from rest_framework.parsers import MultiPartParser, FormParser

class AttachmentCreateView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        print("DEBUG: Attachment Create Called")
        print(f"DEBUG: Data: {request.data}")
        print(f"DEBUG: Files: {request.FILES}")
        
        visit_id = request.data.get('visit_id')
        session_id = request.data.get('session_id')
        
        if not visit_id and not session_id:
             print("DEBUG: Missing visit_id and session_id")
             return Response({'error': 'Either Visit ID or Session ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        visit = None
        session = None
        
        if visit_id:
            try:
                visit = Visit.objects.get(pk=visit_id)
            except Visit.DoesNotExist:
                 print("DEBUG: Visit not found")
                 return Response({'error': 'Visit not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if session_id:
            try:
                session = ChatSession.objects.get(pk=session_id)
            except ChatSession.DoesNotExist:
                 print("DEBUG: Session not found")
                 return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get('file')
        if not file:
             print("DEBUG: No file provided")
             return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            attachment = Attachment.objects.create(visit=visit, session=session, file=file, name=file.name)
            print(f"DEBUG: Attachment created: {attachment.id}")
            serializer = AttachmentSerializer(attachment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"DEBUG: Error creating attachment: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def analyze_scan_helper(attachment):
    """
    Helper function to analyze a scan attachment using Gemini Vision.
    Returns a dict with 'findings', 'impression', 'modality'.
    """
    try:
        # Check if already analyzed
        if hasattr(attachment, 'scan_analysis'):
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
                    {"type": "text", "text": "Analyze this medical scan. Identify the modality (X-Ray, MRI, CT, etc.), allow detailed findings, and an overall impression. Output ONLY JSON."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
            ),
            HumanMessage(
                content="Return JSON with keys: 'modality', 'findings', 'impression'. Do not use markdown."
            )
        ]
        
        response = llm.invoke(messages)
        content = response.content
        print(f"DEBUG: Gemini Vision Response: {content}")
        
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
        scan_result = ScanResult.objects.create(
            attachment=attachment,
            modality=data.get('modality', 'Unknown'),
            findings=data.get('findings', ''),
            impression=data.get('impression', '')
        )
        return data

    except Exception as e:
        print(f"Analysis Helper Error: {e}")
        return None


class ScanAnalysisView(APIView):
    def post(self, request):
        try:
            attachment_id = request.data.get('attachment_id')
            if not attachment_id:
                return Response({'error': 'Attachment ID required'}, status=400)
            
            try:
                attachment = Attachment.objects.get(id=attachment_id)
            except Attachment.DoesNotExist:
                 return Response({'error': 'Attachment not found'}, status=404)

            data = analyze_scan_helper(attachment)
            if not data:
                 return Response({'error': 'Analysis failed'}, status=500)
            
            return Response(data)

        except Exception as e:
            print(f"Scan Analysis Error: {e}")
            return Response({'error': str(e)}, status=500)

