import os
import json
import random
from datetime import date
from dotenv import load_dotenv

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Avg, Count

# LangChain Imports
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from .models import Patient, Visit, Attachment, ChatSession, ChatMessage, Vaccination, ScanResult
from .utils import (
    analyze_scan_helper, get_ai_response, get_llm_chain_response,
    get_pediatric_system_prompt, get_vitals_summary,
    generate_chat_summary, generate_history_summary
)
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
            # Gather context-dependent system prompt via helper
            patient_id = request.data.get('patientId')
            patient_stats = request.data.get('patientStats', {})
            mode = request.data.get('mode', 'patient')
            attachment_id = request.data.get('attachmentId')
            
            system_prompt_content = get_pediatric_system_prompt(
                patient_id=patient_id,
                patient_stats=patient_stats,
                mode=mode,
                history=history,
                attachment_id=attachment_id
            )

            # Get structured findings if needed for response
            structured_findings = None
            if attachment_id:
                try:
                    attachment = Attachment.objects.get(id=attachment_id)
                    structured_findings = analyze_scan_helper(attachment)
                except Exception:
                    pass

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
                        session = ChatSession.objects.filter(patient=patient_obj).order_by('-updated_at').first()
                        if not session:
                             session = ChatSession.objects.create(patient=patient_obj)

                    ChatMessage.objects.create(
                        session=session,
                        sender='user',
                        text=current_message,
                        attachment=Attachment.objects.get(id=attachment_id) if attachment_id else None
                    )
                except Patient.DoesNotExist:
                    patient_obj = None
                    session = None

            # Get AI response
            response = get_ai_response(messages)
            content = response.content
            
            # Extract text content safely if using Gemini (LangChain response)
            if isinstance(content, str) and content.strip().startswith('['):
                try:
                    parsed_content = json.loads(content)
                    if isinstance(parsed_content, list):
                        content = parsed_content
                except json.JSONDecodeError:
                    pass

            if isinstance(content, list):
                text_blocks = [block.get('text', '') for block in content if isinstance(block, dict) and block.get('type') == 'text']
                content = "\n".join(text_blocks) if text_blocks else " ".join([str(c) for c in content])
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

                current_msg_count = len(history) 
                
                if session.summary and session.cached_message_count == current_msg_count:
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
        
        try:
            cleaned_result = generate_chat_summary(history, patient_id, session)
            
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
            
            summary = generate_history_summary(last_visits)
            return Response({'summary': summary})

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
            
        messages = ChatMessage.objects.filter(session_id=session_id).order_by('timestamp').select_related('attachment')
        data = []
        for m in messages:
            msg_data = {
                'id': str(m.id), 
                'sender': m.sender, 
                'text': m.text, 
                'timestamp': m.timestamp,
                'structured_data': None # Add if we start storing it on message level
            }
            if m.attachment:
                msg_data['imageUrl'] = m.attachment.file.url
                # Also include scan analysis if any
                if hasattr(m.attachment, 'scan_analysis'):
                     msg_data['structured_data'] = {
                         'modality': m.attachment.scan_analysis.modality,
                         'findings': m.attachment.scan_analysis.findings,
                         'impression': m.attachment.scan_analysis.impression
                     }
            
            data.append(msg_data)
        return Response(data)

class ChatSessionCreateView(APIView):
    def post(self, request):
        patient_id = request.data.get('patientId')
        name = request.data.get('name', 'New Chat')
        
        if not patient_id:
            return Response({'error': 'Patient ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
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


class AttachmentCreateView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        
        visit_id = request.data.get('visit_id')
        session_id = request.data.get('session_id')
        
        if not visit_id and not session_id:
             return Response({'error': 'Either Visit ID or Session ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        visit = None
        session = None
        
        if visit_id:
            try:
                visit = Visit.objects.get(pk=visit_id)
            except Visit.DoesNotExist:
                 return Response({'error': 'Visit not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if session_id:
            try:
                session = ChatSession.objects.get(pk=session_id)
            except ChatSession.DoesNotExist:
                 return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get('file')
        if not file:
             return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            attachment = Attachment.objects.create(visit=visit, session=session, file=file, name=file.name)
            serializer = AttachmentSerializer(attachment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
            return Response({'error': str(e)}, status=500)
