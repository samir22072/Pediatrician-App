import axios from 'axios';

const api = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Request Interceptor for Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Token ${token}`;
    }
    return config;
});

export const AuthService = {
    login: (credentials: any) => api.post('login/', credentials),
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        localStorage.removeItem('patientId');
        window.location.href = '/login';
    }
};


export const PatientService = {
    list: () => api.get('patients/list/'),
    create: (data: any) => api.post('patients/create/', data),
    detail: (id: string) => api.post('patients/detail/', { id }),
};

export const VisitService = {
    create: (data: any) => api.post('visits/create/', data),
    update: (data: any) => api.post('visits/update/', data),
};

export const AIService = {
    chat: (data: any) => api.post('ai/chat/', data),
    summarize: (data: any) => api.post('ai/summarize/', data),
    historySummary: (data: any) => api.post('ai/history-summary/', data),
    listSessions: (data: any) => api.post('ai/sessions/list/', data),
    createSession: (data: any) => api.post('ai/sessions/create/', data),
    getSessionMessages: (data: any) => api.post('ai/sessions/messages/', data),
    deleteSession: (data: any) => api.post('ai/sessions/delete/', data),
    scanAnalysis: (data: any) => api.post('ai/scan-analysis/', data),
};

export const AttachmentService = {
    create: (params: { visitId?: string, sessionId?: string, file: File }) => {
        const { visitId, sessionId, file } = params;
        console.log("AttachmentService.create called", params);
        const formData = new FormData();
        if (visitId) formData.append('visit_id', visitId);
        if (sessionId) formData.append('session_id', sessionId);
        formData.append('file', file);

        return api.post('attachments/create/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }
};

export default api;
