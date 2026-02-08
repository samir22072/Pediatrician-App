import os
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Count
from dotenv import load_dotenv

# LangChain Imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

from .models import Patient, Visit, Attachment
from .serializers import (
    PatientSerializer, PatientDetailSerializer, 
    VisitSerializer, AttachmentSerializer
)

# Load env variables
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

class PatientListView(APIView):
    def post(self, request):
        patients = Patient.objects.all().order_by('-created_at')
        serializer = PatientSerializer(patients, many=True)
        return Response(serializer.data)

class PatientCreateView(APIView):
    def post(self, request):
        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PatientDetailView(APIView):
    def post(self, request):
        patient_id = request.data.get('id')
        if not patient_id:
             return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            patient = Patient.objects.get(pk=patient_id)
            serializer = PatientDetailSerializer(patient)
            return Response(serializer.data)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)

class VisitCreateView(APIView):
    def post(self, request):
        serializer = VisitSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VisitUpdateView(APIView):
    def post(self, request):
        visit_id = request.data.get('id')
        if not visit_id:
            return Response({'error': 'Visit ID required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            visit = Visit.objects.get(pk=visit_id)
            serializer = VisitSerializer(visit, data=request.data, partial=True)
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
            
            if mode == 'doctor':
                 system_prompt_content = f"""You are an efficient AI Medical Scribe assisting a physician.
                 
                 Goal: Structure clinical notes from the doctor's input and ask ONLY critical clarifying questions if data is missing for a complete record.
                 
                 Guidelines:
                 1. **Professional Tone**: Use standard medical terminology. Be brief.
                 2. **No Triage**: Do NOT ask "How long has he had this?" or "Is he eating well?" unless the doctor explicitly asks you to remind them.
                 3. **Structure**: If the doctor dictates findings (e.g., "Otitis media right ear"), acknowledge simply: "Noted. Right OM."
                 4. **Assistance**: If the doctor asks for a differential or dosage, provide it concisely.
                 {missing_prompt}
                 
                 Your output should be ready for pasting into an EMR or a brief confirmation of recorded data."""
            else:
                # Default "Patient/Parent" Mode
                system_prompt_content = f"""You are an expert AI Pediatric Triage Assistant. Your goal is to briefly gather key symptoms for the doctor.

                Guidelines:
                1. **Relevance is Key**: Ask only questions directly related to the reported symptoms. Do NOT follow a rigid checklist for unrelated issues (e.g., don't ask about diapers if the complaint is a scraped knee).
                2. **Respect Uncertainty**: If the user says "I don't know", "unsure", or doesn't have the info, accept it immediately and move on. Do NOT press for details.
                3. **Conciseness**: Keep your responses short (max 2 sentences).
                4. **Pacing**: Ask only 1 question at a time.
                {missing_prompt}
                {vaccine_prompt}

                Be empathetic but efficient. Do NOT provide medical diagnoses or treatment advice. Just gather the facts."""

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
                from .models import ChatMessage, ChatSession
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
                    import json
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
                    text=content
                )
            
            return Response({
                'text': content, 
                'sessionId': session.id if session else None
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
        
        pending_vaccines = []
        if patient_id:
            from .models import Vaccination
            from datetime import date
            pending_vaccines = list(Vaccination.objects.filter(
                patient_id=patient_id, 
                status='Pending', 
                due_date__lte=date.today()
            ).values_list('vaccine_name', flat=True))
        
        latest_vitals = "None"
        if patient_id:
            from .models import Visit
            last_visit = Visit.objects.filter(patient_id=patient_id).order_by('-date').first()
            if last_visit:
                latest_vitals = f"Weight: {last_visit.weight} kg, Height: {last_visit.height} cm"
        
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
            
            # Define Prompt - Using standard string (not f-string) to avoid escaping issues
            template = """
            Act as a medical assistant. Based on the conversation below, generate a JSON summary for a visit record.
            
            Context:
            - Latest recorded Vitals: {latest_vitals}
            
            Instructions:
            1. Extract 'diagnosis' (short clinical term).
            2. Extract 'notes' (detailed summary of symptoms/advice).
            3. Extract 'weight' and 'height' if mentioned in chat. IF NOT MENTIONED, attempt to use 'Latest recorded Vitals'. If unknown, use null.
            4. DETERMINE 'visit_type':
               - "Sick": if symptoms (fever, cough, pain, etc.) are discussed.
               - "Vaccination": if vaccines are mentioned or administered.
               - "Growth Check": if only weight/height/feeding is discussed.
               - "General": if routine checkup or unclear.
               - Return a LIST of matching tags. Example: ["Sick", "Vaccination"].
            5. Extract 'given_vaccines' (list of strings) if administered.
            6. Return ONLY valid JSON. Do not write "json" or backticks.

            Conversation:
            {conversation_text}
            
            JSON Structure:
            {{
                "diagnosis": "string",
                "notes": "string",
                "weight": number or null,
                "height": number or null,
                "visit_type": ["Sick", "Vaccination"],
                "given_vaccines": ["vaccine1"]
            }}
            Do not include markdown code blocks, just raw JSON.
            """
            
            prompt = PromptTemplate(
                template=template,
                input_variables=["conversation_text", "latest_vitals"]
            )
            
            # Create Chain: Prompt -> LLM -> String Parser
            chain = prompt | llm | StrOutputParser()
            
            # Run Chain
            result = chain.invoke({
                "conversation_text": conversation_text,
                "latest_vitals": latest_vitals
            })
            
            # Clean result of any markdown if LangChain didn't catch it
            cleaned_result = result.replace('```json', '').replace('```', '').strip()
            
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
            from .models import Visit
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
        
        from .models import ChatSession
        # Annotate with message count and filter > 0
        sessions = ChatSession.objects.filter(patient_id=patient_id).annotate(msg_count=Count('messages')).filter(msg_count__gt=0).order_by('-updated_at')
        data = [{'id': str(s.id), 'name': s.name, 'updated_at': s.updated_at} for s in sessions]
        return Response(data)

class ChatSessionMessagesView(APIView):
    def post(self, request):
        session_id = request.data.get('sessionId')
        if not session_id:
            return Response({'error': 'Session ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import ChatMessage
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
        
        from .models import ChatSession
        try:
             session = ChatSession.objects.get(pk=session_id)
             session.delete()
             return Response({'message': 'Session deleted'}, status=status.HTTP_200_OK)
        except ChatSession.DoesNotExist:
             return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

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
