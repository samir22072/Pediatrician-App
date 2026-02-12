from django.db import models
import uuid

class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    dob = models.DateField()
    gender = models.CharField(max_length=10, choices=[('Male', 'Male'), ('Female', 'Female')])
    father_height = models.FloatField(help_text="Height in cm")
    mother_height = models.FloatField(help_text="Height in cm")
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.OneToOneField('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='patient_profile')

    def __str__(self):
        return self.name

class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, related_name='chat_sessions', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    name = models.CharField(max_length=200, default="New Chat")
    summary = models.TextField(blank=True, null=True)
    cached_message_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.patient.name} - {self.name}"

class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, related_name='messages', on_delete=models.CASCADE)
    sender = models.CharField(max_length=10, choices=[('user', 'User'), ('ai', 'AI')])
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.session.id} ({self.sender}): {self.text[:30]}"

class Visit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, related_name='visits', on_delete=models.CASCADE)
    date = models.DateField()
    age = models.FloatField(help_text="Age in years")
    height = models.FloatField(help_text="Height in cm")
    weight = models.FloatField(help_text="Weight in kg")
    visit_type = models.CharField(max_length=200, blank=True, null=True) # Increased for multi-tags
    diagnosis = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Optional Vitals
    temperature = models.FloatField(help_text="Temperature in Fahrenheit", blank=True, null=True)
    blood_pressure = models.CharField(max_length=20, help_text="e.g. 120/80", blank=True, null=True)
    heart_rate = models.IntegerField(help_text="BPM", blank=True, null=True)
    head_circumference = models.FloatField(help_text="Head Circumference in cm", blank=True, null=True)
    
    # Treatment & Plan
    prescription = models.TextField(blank=True, null=True)
    follow_up_date = models.DateField(blank=True, null=True)

    def __str__(self):
        return f"{self.patient.name} - {self.date}"

class Vaccination(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Given', 'Given'),
        ('Missed', 'Missed'),
    ]
    
    patient = models.ForeignKey(Patient, related_name='vaccinations', on_delete=models.CASCADE)
    vaccine_name = models.CharField(max_length=100)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    visit = models.ForeignKey(Visit, related_name='given_vaccines', on_delete=models.SET_NULL, null=True, blank=True)
    given_at = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.patient.name} - {self.vaccine_name}"

class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    visit = models.ForeignKey(Visit, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to='attachments/')
    name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.name and self.file:
            self.name = self.file.name
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

# --- Signals ---
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import timedelta

VACCINE_SCHEDULE_DATA = [
    {'age_days': 0, 'vaccines': ['BCG', 'OPV-0', 'Hep-B1']},
    {'age_days': 42, 'vaccines': ['DTwP-1/DTaP-1', 'IPV-1', 'Hep-B2', 'Hib-1', 'Rotavirus-1', 'PCV-1']},
    {'age_days': 70, 'vaccines': ['DTwP-2/DTaP-2', 'IPV-2', 'Hib-2', 'Rotavirus-2', 'PCV-2']},
    {'age_days': 98, 'vaccines': ['DTwP-3/DTaP-3', 'IPV-3', 'Hep-B3', 'Hib-3', 'Rotavirus-3', 'PCV-3']},
    {'age_days': 180, 'vaccines': ['OPV-1', 'Hep-B4']},
    {'age_days': 210, 'vaccines': ['Influenza-1', 'Typhoid Conjugate Vaccine']}, # 6-7mo logic adjusted nearby
    {'age_days': 240, 'vaccines': ['Influenza-2']}, # Approx 8mo? Frontend says 7mo=210. 6mo=180.
    # Frontend: 6mo=180 [Flu-1, Typhoid], 7mo=210 [Flu-2], 9mo=270 [MMR-1]
    # Let's match frontend days exactly.
    # 6mo
    # {'age_days': 180, 'vaccines': ['OPV-1', 'Hep-B4']}, # Wait, frontend has Flu-1/Typhoid at 6m?
    # Let's align carefully.
]

# ALIGNING EXACTLY WITH FRONTEND:
VACCINE_SCHEDULE_DATA = [
    {'age_days': 0, 'vaccines': ["BCG", "OPV-0", "Hep-B1"]},
    {'age_days': 42, 'vaccines': ["DTwP-1/DTaP-1", "IPV-1", "Hep-B2", "Hib-1", "Rotavirus-1", "PCV-1"]},
    {'age_days': 70, 'vaccines': ["DTwP-2/DTaP-2", "IPV-2", "Hib-2", "Rotavirus-2", "PCV-2"]},
    {'age_days': 98, 'vaccines': ["DTwP-3/DTaP-3", "IPV-3", "Hep-B3", "Hib-3", "Rotavirus-3", "PCV-3"]},
    {'age_days': 180, 'vaccines': ["OPV-1", "Hep-B4", "Influenza-1", "Typhoid Conjugate Vaccine"]}, # Frontend splits 6m/7m?
    # Frontend: 6m (180): Flu-1, Typhoid.
    # Backend old: 6m (180): OPV-1, Hep-B4.
    # IAP 2020 says: 6m: OPV, HepB. Flu is 6m+. TCV is 6-9m.
    # Let's just UNION them to be safe or use separate entries if days differ.
    
    # Let's match Frontend keys for lookup to succeed.
    {'age_days': 180, 'vaccines': ["OPV-1", "Hep-B4", "Influenza-1", "Typhoid Conjugate Vaccine"]},
    {'age_days': 210, 'vaccines': ["Influenza-2"]},
    {'age_days': 270, 'vaccines': ["MMR-1"]},
    {'age_days': 365, 'vaccines': ["Hep-A1"]},
    {'age_days': 450, 'vaccines': ["MMR-2", "Varicella-1", "PCV Booster"]},
    {'age_days': 500, 'vaccines': ["DTwP-B1/DTaP-B1", "IPV-B1", "Hib-B1"]},
    {'age_days': 540, 'vaccines': ["Hep-A2"]},
    {'age_days': 730, 'vaccines': ["Typhoid Booster"]},
    {'age_days': 1825, 'vaccines': ["DTwP-B2/DTaP-B2", "IPV-B2", "Varicella-2", "MMR-3"]},
    {'age_days': 3650, 'vaccines': ["Tdap/Td", "HPV (Girls)"]},
]

@receiver(post_save, sender=Patient)
def create_vaccination_schedule(sender, instance, created, **kwargs):
    if created:
        vaccinations = []
        for item in VACCINE_SCHEDULE_DATA:
            due_date = instance.dob + timedelta(days=item['age_days'])
            for v_name in item['vaccines']:
                vaccinations.append(Vaccination(
                    patient=instance,
                    vaccine_name=v_name,
                    due_date=due_date
                ))
        Vaccination.objects.bulk_create(vaccinations)
