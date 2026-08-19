const PAGE_MARGIN = 48;
const FOOTER_LIMIT = 782;

function text(value, fallback = '') {
    return String(value || fallback)
        .replace(/\u00a0/g, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
        .replace(/[\u2022\u25cf\u25e6]/g, '-')
        .replace(/\u2026/g, '...')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\t/g, '    ')
        .split('\n')
        .map(line => line.replace(/[^\x20-\x7e]/g, '?'))
        .join('\n')
        .trim();
}

function displayDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString();
}

function prescriptionTitle(prescription = {}) {
    return text(
        prescription.medicineName
        || prescription.medicine
        || prescription.medication
        || prescription.name,
        'Medication'
    );
}

function prescriptionDetails(prescription = {}) {
    const schedule = prescription.times
        ? `${prescription.times} time(s) ${text(prescription.frequency, 'per day')}`
        : text(prescription.frequency);
    const duration = prescription.duration
        || (prescription.durationNumber !== undefined
            ? `${prescription.durationNumber} ${text(prescription.durationUnit, 'day')}`
            : '');

    return text([
        prescription.dosage ? `Dosage: ${prescription.dosage}` : '',
        schedule ? `Schedule: ${schedule}` : '',
        duration ? `Duration: ${duration}` : '',
        prescription.quantity ? `Quantity: ${prescription.quantity}` : ''
    ].filter(Boolean).join('  |  '));
}

function addHeader(doc, title, continued = false) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(21, 93, 252);
    doc.rect(0, 0, pageWidth, continued ? 66 : 104, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(continued ? 15 : 19);
    doc.text('Vetfocus Animal Care Clinic', PAGE_MARGIN, continued ? 31 : 42);
    doc.setFontSize(continued ? 9 : 11);
    doc.setFont('helvetica', 'normal');
    doc.text(continued ? `${title} - continued` : title, PAGE_MARGIN, continued ? 48 : 65);
    if (!continued) {
        doc.setFontSize(9);
        doc.text('Official prescription record', pageWidth - PAGE_MARGIN, 43, { align: 'right' });
        doc.text(displayDate(), pageWidth - PAGE_MARGIN, 62, { align: 'right' });
    }
}

function addFooters(doc) {
    const pages = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(PAGE_MARGIN, 802, pageWidth - PAGE_MARGIN, 802);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Generated from the finalized diagnosis record.', PAGE_MARGIN, 818);
        doc.text(`Page ${page} of ${pages}`, pageWidth - PAGE_MARGIN, 818, { align: 'right' });
    }
}

export async function createPrescriptionDocumentPdfBlob({
    context = {},
    veterinarianName,
    veterinarianLicense,
    diagnosisText,
    notes,
    rows = []
}) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (PAGE_MARGIN * 2);
    const title = 'Prescription Record';

    doc.setProperties({
        title: `${text(context.petName, 'Patient')} - Prescription`,
        subject: 'Veterinary prescription record',
        author: text(veterinarianName, 'Vetfocus Animal Care Clinic'),
        creator: 'iPawcus'
    });

    addHeader(doc, title);
    let y = 132;
    const nextPage = () => {
        doc.addPage();
        addHeader(doc, title, true);
        y = 92;
    };
    const ensureSpace = (height) => {
        if (y + height > FOOTER_LIMIT) nextPage();
    };
    const addLabelValue = (label, value, x, lineY, maxWidth) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(label, x, lineY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(doc.splitTextToSize(text(value, 'Not recorded'), maxWidth), x, lineY + 15);
    };

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, 104, 5, 5, 'FD');
    doc.setFontSize(9);
    const columnWidth = (contentWidth - 32) / 2;
    addLabelValue('PATIENT', context.petName || context.patientName, PAGE_MARGIN + 16, y + 20, columnWidth);
    addLabelValue('OWNER', context.ownerName, PAGE_MARGIN + 16, y + 64, columnWidth);
    addLabelValue('SERVICE', context.serviceName || 'Diagnosis', PAGE_MARGIN + 32 + columnWidth, y + 20, columnWidth);
    addLabelValue('VETERINARIAN', veterinarianLicense
        ? `${text(veterinarianName, 'Clinic veterinarian')} - License ${veterinarianLicense}`
        : text(veterinarianName, 'Clinic veterinarian'), PAGE_MARGIN + 32 + columnWidth, y + 64, columnWidth);
    y += 132;

    const writeSection = (heading, value) => {
        const cleanValue = text(value);
        if (!cleanValue) return;
        const lines = doc.splitTextToSize(cleanValue, contentWidth);
        ensureSpace(34 + (lines.length * 14));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(heading, PAGE_MARGIN, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        lines.forEach((line) => {
            if (y + 14 > FOOTER_LIMIT) nextPage();
            doc.text(line, PAGE_MARGIN, y);
            y += 14;
        });
        y += 14;
    };

    writeSection('Diagnosis summary', diagnosisText);

    ensureSpace(34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Prescriptions', PAGE_MARGIN, y);
    y += 22;

    rows.forEach((row, index) => {
        const medication = prescriptionTitle(row.prescription);
        const details = prescriptionDetails(row.prescription);
        const instructions = text(row.prescription?.instructions);
        const section = text(row.section, 'Diagnosis');
        const medicationLines = doc.splitTextToSize(medication, contentWidth - 42);
        const detailLines = details ? doc.splitTextToSize(details, contentWidth - 42) : [];
        const instructionLines = instructions ? doc.splitTextToSize(`Instructions: ${instructions}`, contentWidth - 42) : [];
        const bodyLines = [
            ...medicationLines.map(line => ({ line, kind: 'medicine' })),
            ...detailLines.map(line => ({ line, kind: 'detail' })),
            ...instructionLines.map(line => ({ line, kind: 'detail' }))
        ];
        let lineIndex = 0;
        let continued = false;

        while (lineIndex < bodyLines.length) {
            ensureSpace(72);
            const blockTop = y;
            doc.setFillColor(248, 250, 252);
            doc.rect(PAGE_MARGIN, blockTop, contentWidth, 38, 'F');
            doc.setFillColor(21, 93, 252);
            doc.rect(PAGE_MARGIN, blockTop, 3, 38, 'F');
            doc.circle(PAGE_MARGIN + 18, blockTop + 19, 9, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(String(index + 1), PAGE_MARGIN + 18, blockTop + 22, { align: 'center' });
            doc.setTextColor(21, 93, 252);
            doc.text(`${section.toUpperCase()}${continued ? ' - CONTINUED' : ''}`, PAGE_MARGIN + 36, blockTop + 22);
            y += 50;

            while (lineIndex < bodyLines.length) {
                const entry = bodyLines[lineIndex];
                const lineHeight = entry.kind === 'medicine' ? 15 : 13;
                if (y + lineHeight > FOOTER_LIMIT) break;

                doc.setFont('helvetica', entry.kind === 'medicine' ? 'bold' : 'normal');
                doc.setFontSize(entry.kind === 'medicine' ? 10.5 : 8.8);
                doc.setTextColor(...(entry.kind === 'medicine' ? [15, 23, 42] : [71, 85, 105]));
                doc.text(entry.line, PAGE_MARGIN + 18, y);
                y += lineHeight;
                lineIndex += 1;
            }

            doc.setDrawColor(226, 232, 240);
            doc.line(PAGE_MARGIN, y + 3, pageWidth - PAGE_MARGIN, y + 3);
            y += 15;

            if (lineIndex < bodyLines.length) {
                nextPage();
                continued = true;
            }
        }
    });

    writeSection('Notes', notes);
    addFooters(doc);
    return doc.output('blob');
}

export async function createPrescriptionDocumentPdfFile(payload) {
    const blob = await createPrescriptionDocumentPdfBlob(payload);
    return new File([blob], `prescription-${Date.now()}.pdf`, { type: 'application/pdf' });
}
