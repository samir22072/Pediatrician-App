import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Visit, Patient } from './types';

export const generateVisitPDF = (visit: Visit, patient: Patient) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let yPos = 20;

    // --- Header ---
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("pediaTrack", margin, yPos);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Pediatric Visit Report", pageWidth - margin, yPos, { align: 'right' });

    yPos += 10;
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // --- Patient Details ---
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Patient: ${patient.name}`, margin, yPos);
    doc.text(`Date: ${visit.date}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`DOB: ${patient.dob} (${visit.age} yrs)`, margin, yPos);
    doc.text(`Visit Type: ${visit.visit_type}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 15;

    // --- Vitals Table ---
    const vitalsData = [
        ['Weight', `${visit.weight} kg`],
        ['Height', `${visit.height} cm`],
        ['Head Circ.', visit.head_circumference ? `${visit.head_circumference} cm` : 'N/A'],
        ['Temp', visit.temperature ? `${visit.temperature}°F` : 'N/A'],
        ['BP', visit.blood_pressure || 'N/A'],
        ['Heart Rate', visit.heart_rate ? `${visit.heart_rate} bpm` : 'N/A'],
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Vital Sign', 'Value']],
        body: vitalsData,
        theme: 'striped',
        headStyles: { fillColor: [66, 133, 244] }, // Google Blue-ish
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: margin, right: margin }
    });

    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 15;

    // --- Diagnosis & Notes ---
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Diagnosis", margin, yPos);
    yPos += 7;
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(visit.diagnosis || "No diagnosis recorded.", margin, yPos);

    yPos += 15;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Clinical Notes", margin, yPos);
    yPos += 7;
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    const splitNotes = doc.splitTextToSize(visit.notes || "No notes recorded.", pageWidth - (margin * 2));
    doc.text(splitNotes, margin, yPos);
    yPos += (splitNotes.length * 5) + 10;

    // --- Prescription (if any) ---
    if (visit.prescription) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Prescription / Plan", margin, yPos);
        yPos += 7;
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);

        const splitRx = doc.splitTextToSize(visit.prescription, pageWidth - (margin * 2));
        doc.text(splitRx, margin, yPos);
        yPos += (splitRx.length * 5) + 10;
    }

    // --- Vaccines Given (if any) ---
    // Note: We need to pass given_vaccines_display from the visit object if available
    // Assuming 'given_vaccines_display' might be on the visit object based on serializer
    // If not, we skip.
    if ((visit as any).given_vaccines_display && (visit as any).given_vaccines_display.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Vaccines Administered", margin, yPos);
        yPos += 7;
        doc.setFontSize(11);
        doc.text((visit as any).given_vaccines_display.join(", "), margin, yPos);
        yPos += 15;
    }

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });
    }

    // Save
    doc.save(`VisitReport_${patient.name.replace(/\s+/g, '_')}_${visit.date}.pdf`);
};
