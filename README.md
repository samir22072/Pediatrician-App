# PediaCare AI

PediaCare AI is an intelligent pediatric clinic management system and AI triage application. It is designed to modernize the workflow of pediatricians by providing an AI medical scribe, smart charting, integrated growth curves, vaccination scheduling, and a patient-facing AI triage assistant.

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Django, Django REST Framework, PostgreSQL (Supabase)
- **AI Integration**: LangChain, Google Gemini Pro / Gemini Vision

## Features

### 🧑‍⚕️ For Doctors
- **AI Medical Scribe**: Continuously listens (via voice/text) during patient visits, automatically records vitals, diagnoses, and prescriptions, and generates structured medical notes.
- **Scan Analyzer**: Upload X-rays, MRIs, or lab reports and have the Gemini Vision model identify modalities and highlight key findings.
- **Smart Patient Profiles**: Automatically plots WHO growth charts (weight, height, head circumference) and manages vaccination schedules (generating pending vaccine lists based on the child's age).
- **Session Management**: AI automatically groups interactions and attachments by `ChatSessions`, summarizing conversations into concrete medical `Visits`.

### 👶 For Patients & Parents
- **AI Triage Assistant**: Before the visit, parents interact with the AI assistant. The AI asks concise, age-appropriate questions to gather vitals, symptom history, and medication history.
- **Pre-filled Visit Charts**: The triage data is directly accessible to the doctor and instantly pre-fills the visit creation form, saving time during the consultation.

---

## Local Setup Instructions

### Prerequisites
You need **Node.js** (v18+) and **Python** (3.9+) installed on your machine.

### 1. Database & Environment Variables
The application uses PostgreSQL. Create a `.env` file in the `backend/` directory using `.env.example` as a template:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
GEMINI_API_KEY="your-google-gemini-api-key"
```

Create a `.env` file in the `frontend/` directory using `.env.example` as a template:

```env
NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8000"
```

### 2. Backend Setup (Django)

Navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment and activate it:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install the required Python packages:
```bash
pip install -r requirements.txt
```

Run database migrations:
```bash
python manage.py migrate
```

Create a superuser to log into the application as a Doctor:
```bash
python manage.py createsuperuser
```

Start the Django development server:
```bash
python manage.py runserver
```

### 3. Frontend Setup (Next.js)

Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

Install the Node dependencies:
```bash
npm install
```

Start the Next.js development server:
```bash
npm run dev
```

### 4. Access the Application
- The frontend will be running at [http://localhost:3000](http://localhost:3000)
- The backend API will be running at [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Use the credentials you created in the `createsuperuser` step to log into the application.
