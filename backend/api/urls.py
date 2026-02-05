from django.urls import path, include
from .views import (
    PatientListView, PatientCreateView, PatientDetailView,
    VisitCreateView, VisitUpdateView, DashboardView,
    AIChatView, AISummarizeView, AIHistorySummaryView,
    ChatSessionListView, ChatSessionCreateView
)


urlpatterns = [
    path('patients/list/', PatientListView.as_view(), name='patient-list'),
    path('patients/create/', PatientCreateView.as_view(), name='patient-create'),
    path('patients/detail/', PatientDetailView.as_view(), name='patient-detail'),
    path('visits/create/', VisitCreateView.as_view(), name='visit-create'),
    path('visits/update/', VisitUpdateView.as_view(), name='visit-update'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('ai/chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai/summarize/', AISummarizeView.as_view(), name='ai-summarize'),
    path('ai/history-summary/', AIHistorySummaryView.as_view(), name='ai-history-summary'),
    path('ai/sessions/list/', ChatSessionListView.as_view(), name='chat-session-list'),
    path('ai/sessions/create/', ChatSessionCreateView.as_view(), name='chat-session-create'),
]
