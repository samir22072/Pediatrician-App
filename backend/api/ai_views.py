import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from dotenv import load_dotenv

# LangChain Imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Load env variables
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

class AIChatView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        current_message = request.data.get('message', '')
        
        try:
            # Initialize LangChain Chat Model
            chat = ChatGoogleGenerativeAI(
                model="gemini-flash-latest",
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
                from .models import Vaccination
                from datetime import date
                
                # Fetch pending vaccines due on or before today (overdue or due now)
                # We can also look ahead slightly if needed, but "due" usually means date <= today.
                # User said "overdue for her age or are pending for her age".
                # effectively due_date <= today AND status = 'Pending'.
                
                pending_vax_qs = Vaccination.objects.filter(
                    patient_id=patient_id, 
                    status='Pending', 
                    due_date__lte=date.today()
                ).values_list('vaccine_name', flat=True)
                
                pending_vaccines = list(pending_vax_qs)
                
                if pending_vaccines:
                    vaccine_list = ", ".join(pending_vaccines)
                    vaccine_prompt = f"\n\n**Vaccination Check**: The patient is due/overdue for the following vaccines: {vaccine_list}. Ask if any of these have been administered recently by another doctor."
            
            # Construct Message History
            messages = [
                SystemMessage(content=f"""You are an expert AI Pediatric Triage Assistant. Your role is to gather a complete clinical picture before the doctor review.
                
                You MUST actively inquire about the following if not already provided:
                1. **Vitals**: Ask about fever (temperature), breathing rate, or heart rate if applicable.
                2. **Feeding**: Ask about recent feeding patterns (decreased appetite, vomiting, fluid intake).
                3. **Excretion**: Ask about wet diapers (urine output) and stool patterns (diarrhea, constipation).
                4. **Activity**: Ask about the child's energy level (lethargic, playful, irritable).
                {missing_prompt}
                {vaccine_prompt}

                Ask 1-2 questions at a time to avoid overwhelming the parent. Be empathetic but clinical. Do NOT provide medical diagnoses or treatment advice. Just gather the facts.""")
            ]
            
            for msg in history:
                if msg.get('role') == 'user':
                    messages.append(HumanMessage(content=msg.get('text', '')))
                elif msg.get('role') == 'ai':
                    messages.append(AIMessage(content=msg.get('text', '')))
            
            # Add current user message
            messages.append(HumanMessage(content=current_message))
            
            # Invoke Model
            response = chat.invoke(messages)
            
            return Response({'text': response.content})
            
        except Exception as e:
            print(f"LangChain Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AISummarizeView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        patient_id = request.data.get('patientId')
        
        pending_vaccines = []
        if patient_id:
            from .models import Vaccination
            from datetime import date
            pending_vaccines = list(Vaccination.objects.filter(
                patient_id=patient_id, 
                status='Pending', 
                due_date__lte=date.today()
            ).values_list('vaccine_name', flat=True))
        
        # Convert history to a string block for the prompt
        conversation_text = ""
        for msg in history:
            role = "Parent" if msg.get('role') == 'user' else "Assistant"
            conversation_text += f"{role}: {msg.get('text')}\n"
            
        try:
            # Initialize Model
            llm = ChatGoogleGenerativeAI(
                model="gemini-flash-latest",
                google_api_key=API_KEY,
                temperature=0.2 # Lower temperature for factual summary
            )
            
            # Define Prompt
            template = f"""
            Act as a professional pediatrician. Summarize the following intake conversation into a concise clinical note.
            Also suggest a short 'Diagnosis' or 'Chief Complaint' title.
            
            If the parent confirmed that any of the following overdue vaccines were given elsewhere, list their exact names in the 'given_vaccines' array: {pending_vaccines}
            
            Conversation:
            {{conversation}}
            
            Return the output in valid JSON format:
            {{{{
                "diagnosis": "Subject / Chief Complaint",
                "notes": "Patient reports...",
                "given_vaccines": ["Vaccine Name 1", "Vaccine Name 2"]
            }}}}
            Do not include markdown code blocks, just raw JSON.
            """
            
            prompt = PromptTemplate.from_template(template)
            
            # Create Chain: Prompt -> LLM -> String Parser
            chain = prompt | llm | StrOutputParser()
            
            # Run Chain
            result = chain.invoke({"conversation": conversation_text})
            
            # Clean result of any markdown if LangChain didn't catch it (though prompt says check)
            cleaned_result = result.replace('```json', '').replace('```', '').strip()
            
            return Response({'summary': cleaned_result})
            
        except Exception as e:
            print(f"LangChain Summary Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
