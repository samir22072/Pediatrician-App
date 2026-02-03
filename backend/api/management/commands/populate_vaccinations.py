from django.core.management.base import BaseCommand
from api.models import Patient, Vaccination, VACCINE_SCHEDULE_DATA
from datetime import timedelta

class Command(BaseCommand):
    help = 'Populates vaccination schedule for existing patients'

    def handle(self, *args, **kwargs):
        patients = Patient.objects.all()
        count = 0
        for patient in patients:
            # Check each scheduled item
            created_count = 0
            for item in VACCINE_SCHEDULE_DATA:
                due_date = patient.dob + timedelta(days=item['age_days'])
                for v_name in item['vaccines']:
                    # Check if this specific vaccine record exists
                    if not Vaccination.objects.filter(patient=patient, vaccine_name=v_name).exists():
                         Vaccination.objects.create(
                            patient=patient,
                            vaccine_name=v_name,
                            due_date=due_date
                        )
                         created_count += 1
            
            if created_count > 0:
                self.stdout.write(f"Added {created_count} missing vaccines for {patient.name}")
                count += 1
            else:
                 self.stdout.write(f"Schedule complete for {patient.name}")
        
        self.stdout.write(self.style.SUCCESS(f'Successfully populated schedule for {count} patients'))
