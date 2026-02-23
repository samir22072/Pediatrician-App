from rest_framework import serializers
from .models import Patient, Visit, Attachment, Vaccination, ScanResult

class ScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanResult
        fields = ['id', 'modality', 'findings', 'impression', 'analyzed_at']

class AttachmentSerializer(serializers.ModelSerializer):
    scan_analysis = ScanResultSerializer(read_only=True)
    class Meta:
        model = Attachment
        fields = ['id', 'visit', 'session', 'file', 'name', 'uploaded_at', 'scan_analysis']
        read_only_fields = ['name', 'uploaded_at']
        extra_kwargs = {'visit': {'required': False, 'allow_null': True}}

class VaccinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vaccination
        fields = ['id', 'vaccine_name', 'due_date', 'status', 'given_at']

class VisitSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    vaccines = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    given_vaccines_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Visit
        fields = ['id', 'patient', 'date', 'age', 'height', 'weight', 'visit_type', 'vaccines', 'given_vaccines_display', 'diagnosis', 'notes', 'attachments', 'temperature', 'blood_pressure', 'heart_rate', 'head_circumference', 'prescription', 'follow_up_date']

    def get_given_vaccines_display(self, obj):
        return [v.vaccine_name for v in obj.given_vaccines.all()]

    def create(self, validated_data):
        vaccines_data = validated_data.pop('vaccines', [])
        visit = Visit.objects.create(**validated_data)
        
        if vaccines_data:
            if isinstance(vaccines_data, str):
                vaccines_data = vaccines_data.split(',')
            
            for v_name in vaccines_data:
                v_name = v_name.strip()
                vac_record = Vaccination.objects.filter(patient=visit.patient, vaccine_name=v_name).first()
                if vac_record:
                    vac_record.status = 'Given'
                    vac_record.visit = visit
                    vac_record.given_at = visit.date
                    vac_record.save()
                else:
                    Vaccination.objects.create(
                        patient=visit.patient,
                        vaccine_name=v_name,
                        due_date=visit.date,
                        status='Given',
                        visit=visit,
                        given_at=visit.date
                    )
        return visit

    def update(self, instance, validated_data):
        vaccines_data = validated_data.pop('vaccines', None)
        instance = super().update(instance, validated_data)

        if vaccines_data is not None:
            instance.given_vaccines.update(status='Pending', visit=None, given_at=None)

            if isinstance(vaccines_data, str):
                vaccines_data = vaccines_data.split(',')

            for v_name in vaccines_data:
                v_name = v_name.strip()
                vac_record = Vaccination.objects.filter(patient=instance.patient, vaccine_name=v_name).first()
                if vac_record:
                    vac_record.status = 'Given'
                    vac_record.visit = instance
                    vac_record.given_at = instance.date
                    vac_record.save()
                else:
                    # Create ad-hoc record
                    Vaccination.objects.create(
                        patient=instance.patient,
                        vaccine_name=v_name,
                        due_date=instance.date,
                        status='Given',
                        visit=instance,
                        given_at=instance.date
                    )
        
        return instance

class PatientSerializer(serializers.ModelSerializer):
    visits = VisitSerializer(many=True, read_only=True)
    initial_weight = serializers.FloatField(write_only=True, required=False)
    initial_height = serializers.FloatField(write_only=True, required=False)
    initial_head_circumference = serializers.FloatField(write_only=True, required=False)
    calculated_age = serializers.FloatField(write_only=True, required=False)
    
    class Meta:
        model = Patient
        fields = ['id', 'name', 'dob', 'gender', 'father_height', 'mother_height', 'created_at', 'visits', 'initial_weight', 'initial_height', 'initial_head_circumference', 'calculated_age']
        
    def create(self, validated_data):
        initial_weight = validated_data.pop('initial_weight', None)
        initial_height = validated_data.pop('initial_height', None)
        initial_hc = validated_data.pop('initial_head_circumference', None)
        calculated_age = validated_data.pop('calculated_age', 0)
        
        patient = Patient.objects.create(**validated_data)
        
        # Create Initial Visit if vitals provided
        if initial_weight or initial_height or initial_hc:
             Visit.objects.create(
                 patient=patient,
                 date=patient.created_at.date(), # Use registration date
                 age=calculated_age or 0,
                 weight=initial_weight or 0,
                 height=initial_height or 0,
                 head_circumference=initial_hc,
                 visit_type='Initial', # Special flag
                 diagnosis='Initial Registration',
                 notes='Auto-generated from registration.'
             )
             
        return patient

class PatientDetailSerializer(serializers.ModelSerializer):
    visits = VisitSerializer(many=True, read_only=True)
    vaccinations = VaccinationSerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'dob', 'gender', 'father_height', 'mother_height', 'created_at', 'visits', 'vaccinations']
