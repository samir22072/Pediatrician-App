import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
    },
});


export const PatientService = {
    list: () => api.post('patients/list/'),
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
};

export default api;
