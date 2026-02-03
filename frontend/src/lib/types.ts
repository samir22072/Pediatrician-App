export interface Attachment {
    id?: number;
    file?: string; // URL or base64 for upload
    name: string;
    type?: string;
    data?: string; // base64 content for upload
    uploaded_at?: string;
}

export interface Vaccination {
    id: number;
    vaccine_name: string;
    due_date: string;
    status: 'Pending' | 'Given' | 'Missed';
    given_at?: string;
}

export interface Visit {
    id: string;
    date: string;
    age: number;
    weight: number;
    height: number;
    visit_type: string;
    diagnosis: string;
    notes: string;
    vaccines?: string[]; // Names of vaccines given
    given_vaccines_display?: string[]; // Names for display
    attachments: Attachment[];
}

export interface Patient {
    id: string | number;
    name: string;
    dob: string;
    gender: 'Male' | 'Female';
    father_height: number;
    mother_height: number;
    visits?: Visit[];
    vaccinations?: Vaccination[];
    created_at: string;
    calculated_age?: number;
    initial_weight?: number;
    initial_height?: number;
}
