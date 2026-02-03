from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet, VisitViewSet, AttachmentViewSet, DashboardView
from .ai_views import AIChatView, AISummarizeView

router = DefaultRouter()
router.register(r'patients', PatientViewSet)
router.register(r'visits', VisitViewSet)
router.register(r'attachments', AttachmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('ai/chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai/summarize/', AISummarizeView.as_view(), name='ai-summarize'),
]
