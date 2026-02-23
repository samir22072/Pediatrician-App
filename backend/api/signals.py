from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import timedelta
from .models import Patient, Vaccination
from .constants import VACCINE_SCHEDULE_DATA

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
