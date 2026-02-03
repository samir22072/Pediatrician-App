import os
import google.generativeai as genai
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

class AIChatView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        message = request.data.get('message', '')
        
        try:
            model = genai.GenerativeModel('gemini-pro')
            
            # Construct chat history for context
            # System prompt trick: Add it as the first user message or use system instructions if supported
            system_instruction = "You are an AI assistant for a Pediatrician intake form. Your goal is to verify the patient's condition by asking 1-2 relevant follow-up questions (one at a time) to clarify symptoms, duration, and severity. Be professional, empathetic, and concise. Do not give medical advice. Just gather facts for the doctor."
            
            chat = model.start_chat(history=[])
            
            # Seed with system context if empty history (or just prepend)
            # Simple approach: Append system instruction to history logic
            
            formatted_history = []
            # Add system instruction as 'user' context? 
            # Or just send it in the current prompt if it's stateless.
            # Let's rely on standard prompt engineering in the message.
            
            context = f"{system_instruction}\n\nConversation so far:\n"
            for msg in history:
                role = "Parent" if msg['role'] == 'user' else "Assistant"
                context += f"{role}: {msg['text']}\n"
            
            context += f"Parent: {message}\nAssistant:"
            
            response = model.generate_content(context)
            
            return Response({'text': response.text})
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AISummarizeView(APIView):
    def post(self, request):
        if not API_KEY:
             return Response({'error': 'Gemini API Key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        history = request.data.get('history', [])
        
        conversation_text = ""
        for msg in history:
            role = "Parent" if msg['role'] == 'user' else "Assistant"
            conversation_text += f"{role}: {msg['text']}\n"
            
        prompt = f"""
        Act as a professional pediatrician. Summarize the following intake conversation into a concise clinical note.
        Also suggest a short 'Diagnosis' or 'Chief Complaint' title.
        
        Conversation:
        {conversation_text}
        
        Return the output in valid JSON format:
        {{
            "diagnosis": "Subject / Chief Complaint",
            "notes": "Patient reports..."
        }}
        Do not include markdown code blocks, just raw JSON.
        """
        
        try:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(prompt)
            
            # Clean response if it contains markdown
            text = response.text.replace('```json', '').replace('```', '').strip()
            
            return Response({'summary': text})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
