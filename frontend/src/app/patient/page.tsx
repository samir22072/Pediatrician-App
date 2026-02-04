'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PatientDetailsPage from '@/components/pages/PatientDetailsPage';

export default function Page() {
    const router = useRouter();
    const [patientId, setPatientId] = useState<string | null>(null);

    useEffect(() => {
        // Retrieve ID from session storage to keep URL clean
        const id = sessionStorage.getItem('selectedPatientId');
        if (!id) {
            router.replace('/'); // Redirect if no context
        } else {
            setPatientId(id);
        }
    }, [router]);

    if (!patientId) return null;

    return (
        <div className="container">
            <PatientDetailsPage
                patientId={patientId}
                onBack={() => {
                    sessionStorage.removeItem('selectedPatientId');
                    router.push('/');
                }}
            />
        </div>
    );
}
