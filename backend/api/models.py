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
    attachment = models.ForeignKey('Attachment', on_delete=models.SET_NULL, null=True, blank=True, related_name='chat_messages')

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
    visit = models.ForeignKey(Visit, related_name='attachments', on_delete=models.CASCADE, null=True, blank=True)
    session = models.ForeignKey(ChatSession, related_name='attachments', on_delete=models.SET_NULL, null=True, blank=True)
    file = models.FileField(upload_to='attachments/')
    name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.name and self.file:
            self.name = self.file.name
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class ScanResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attachment = models.OneToOneField(Attachment, related_name='scan_analysis', on_delete=models.CASCADE)
    modality = models.CharField(max_length=50, blank=True, help_text="X-Ray, MRI, CT, etc.")
    findings = models.TextField(blank=True, help_text="Detailed findings from the scan.")
    impression = models.TextField(blank=True, help_text="Overall impression or conclusion.")
    analyzed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis for {self.attachment.name}"

# End of models
