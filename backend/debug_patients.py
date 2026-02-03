import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Patient
from api.serializers import PatientSerializer, PatientDetailSerializer

patients = Patient.objects.all()
print(f"Total Patients in DB: {patients.count()}")

if patients.exists():
    p = patients.first()
    print(f"First Patient: {p.name}")
    print("Serializer Output (List View):")
    print(PatientSerializer(p).data)
    print("Visits count:", p.visits.count())
