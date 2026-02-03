from django.contrib import admin
from .models import Patient, Visit, Attachment

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('name', 'dob', 'gender', 'created_at')
    search_fields = ('name',)

@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ('patient', 'date', 'visit_type', 'age', 'weight', 'height')
    list_filter = ('visit_type', 'date')
    search_fields = ('patient__name', 'diagnosis')

@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'visit', 'uploaded_at')
    search_fields = ('name', 'visit__patient__name')

from .models import Vaccination

@admin.register(Vaccination)
class VaccinationAdmin(admin.ModelAdmin):
    list_display = ('patient', 'vaccine_name', 'due_date', 'status', 'given_at')
    list_filter = ('status', 'due_date', 'vaccine_name')
    search_fields = ('patient__name', 'vaccine_name')
