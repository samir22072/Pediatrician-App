from django.urls import path, include
from .views import (
    LoginView,
    PatientListView, PatientCreateView, PatientDetailView,
    VisitCreateView, VisitUpdateView, VisitDeleteView, DashboardView,
    AIChatView, AISummarizeView, AIHistorySummaryView,
    ChatSessionListView, ChatSessionCreateView, ChatSessionMessagesView, ChatSessionDeleteView,
    AttachmentCreateView, ScanAnalysisView, ScanResultUpdateView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('patients/list/', PatientListView.as_view(), name='patient-list'),
    path('patients/create/', PatientCreateView.as_view(), name='patient-create'),
    path('patients/detail/', PatientDetailView.as_view(), name='patient-detail'),
    path('visits/create/', VisitCreateView.as_view(), name='visit-create'),
    path('visits/update/', VisitUpdateView.as_view(), name='visit-update'),
    path('visits/delete/', VisitDeleteView.as_view(), name='visit-delete'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('ai/chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai/summarize/', AISummarizeView.as_view(), name='ai-summarize'),
    path('ai/history-summary/', AIHistorySummaryView.as_view(), name='ai-history-summary'),
    path('ai/sessions/list/', ChatSessionListView.as_view(), name='chat-session-list'),
    path('ai/sessions/create/', ChatSessionCreateView.as_view(), name='chat-session-create'),
    path('ai/sessions/messages/', ChatSessionMessagesView.as_view(), name='chat-session-messages'),
    path('ai/sessions/delete/', ChatSessionDeleteView.as_view(), name='chat-session-delete'),
    path('attachments/create/', AttachmentCreateView.as_view(), name='attachment-create'),
    path('ai/scan-results/update/', ScanResultUpdateView.as_view(), name='scan-result-update'),
    path('ai/scan-analysis/', ScanAnalysisView.as_view(), name='scan-analysis'),
]
