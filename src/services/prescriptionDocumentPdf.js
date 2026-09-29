const PAPER_WIDTHS_MM = {
    '58mm': 58,
    '80mm': 80
};

const DEFAULT_PAPER_WIDTH = '58mm';
const MIN_PAGE_HEIGHT_MM = 150;
const MAX_PAGE_HEIGHT_MM = 1200;

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

function safeFilePart(value, fallback = 'patient') {
    return text(value, fallback)
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || fallback;
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
    ].filter(Boolean).join(' | '));
}

function drawRule(doc, y, left, right, render, dashed = false) {
    if (!render) return;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern(dashed ? [1.2, 1.2] : [], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
}

function drawMetaRow(doc, y, left, right, label, value, render) {
    const valueLines = doc.splitTextToSize(text(value, '-'), right - left - 18);
    if (render) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(71, 85, 105);
        doc.text(label.toUpperCase(), left, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(valueLines, right, y, { align: 'right' });
    }

    return Math.max(4.2, valueLines.length * 3.2);
}

function drawSection(doc, y, left, right, heading, value, render) {
    const cleanValue = text(value);
    if (!cleanValue) return y;

    const contentWidth = right - left;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    const lines = doc.splitTextToSize(cleanValue, contentWidth);

    if (render) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(heading.toUpperCase(), left, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.6);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, left, y + 4);
    }

    return y + 6 + (lines.length * 3.2);
}

function renderPrescription(doc, input, paperWidth, render = true) {
    const left = 5;
    const right = paperWidth - 5;
    const contentWidth = right - left;
    const rows = Array.isArray(input.rows) ? input.rows : [];
    const context = input.context || {};
    let y = 0;

    if (render) {
        doc.setFillColor(21, 93, 252);
        doc.rect(0, 0, paperWidth, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(paperWidth <= 58 ? 12 : 15);
        doc.text('IPAWCUS', paperWidth / 2, 9, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text('VETERINARY CLINIC', paperWidth / 2, 14, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('OFFICIAL PRESCRIPTION RECORD', paperWidth / 2, 19, { align: 'center' });
    }
    y = 31;

    if (render) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('PRESCRIPTION', paperWidth / 2, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text(displayDate(input.createdAt), paperWidth / 2, y + 5, { align: 'center' });
    }
    y += 10;
    drawRule(doc, y, left, right, render, true);
    y += 5;

    y += drawMetaRow(doc, y, left, right, 'Patient', context.petName || context.patientName, render);
    y += drawMetaRow(doc, y, left, right, 'Owner', context.ownerName, render);
    y += drawMetaRow(
        doc,
        y,
        left,
        right,
        'Pet',
        [context.petSpecies, context.petBreed].filter(Boolean).join(' / ') || 'Not recorded',
        render
    );
    y += drawMetaRow(doc, y, left, right, 'Service', context.serviceName || 'Diagnosis', render);
    y += drawMetaRow(doc, y, left, right, 'Veterinarian', input.veterinarianName || 'Clinic veterinarian', render);
    y += drawMetaRow(doc, y, left, right, 'License', input.veterinarianLicense || 'Not recorded', render);
    y += 1;
    drawRule(doc, y, left, right, render, true);
    y += 5;

    y = drawSection(doc, y, left, right, 'Diagnosis Summary', input.diagnosisText, render);
    if (text(input.diagnosisText)) {
        drawRule(doc, y, left, right, render, true);
        y += 5;
    }

    if (render) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text('PRESCRIPTIONS', left, y);
    }
    y += 5;

    rows.forEach((row, index) => {
        const medication = prescriptionTitle(row.prescription);
        const details = prescriptionDetails(row.prescription);
        const instructions = text(row.prescription?.instructions);
        const section = text(row.section, 'Diagnosis').toUpperCase();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        const medicationLines = doc.splitTextToSize(medication, contentWidth);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        const detailLines = details ? doc.splitTextToSize(details, contentWidth) : [];
        const instructionLines = instructions
            ? doc.splitTextToSize(`Instructions: ${instructions}`, contentWidth)
            : [];

        if (render) {
            doc.setFillColor(239, 246, 255);
            doc.roundedRect(left, y, contentWidth, 7, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.2);
            doc.setTextColor(21, 93, 252);
            doc.text(`${String(index + 1).padStart(2, '0')} / ${section}`, left + 2, y + 4.5);
        }
        y += 10;

        if (render) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.4);
            doc.setTextColor(15, 23, 42);
            doc.text(medicationLines, left, y);
        }
        y += medicationLines.length * 3.5;

        if (detailLines.length > 0) {
            if (render) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.4);
                doc.setTextColor(71, 85, 105);
                doc.text(detailLines, left, y);
            }
            y += detailLines.length * 3.1;
        }

        if (instructionLines.length > 0) {
            if (render) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.2);
                doc.setTextColor(51, 65, 85);
                doc.text(instructionLines, left, y);
            }
            y += instructionLines.length * 3.1;
        }

        y += 2;
        drawRule(doc, y, left, right, render, true);
        y += 4;
    });

    y = drawSection(doc, y, left, right, 'Notes', input.notes, render);
    if (text(input.notes)) y += 2;

    y += 9;
    drawRule(doc, y, left, right, render);
    if (render) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(71, 85, 105);
        doc.text('Veterinarian signature', paperWidth / 2, y + 3.5, { align: 'center' });
    }
    y += 13;
    drawRule(doc, y, left, right, render);
    if (render) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(71, 85, 105);
        doc.text("Owner's electronic signature over printed name", paperWidth / 2, y + 3.5, {
            align: 'center',
            maxWidth: contentWidth
        });
    }
    y += 10;
    drawRule(doc, y, left, right, render, true);
    y += 5;

    if (render) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(71, 85, 105);
        doc.text('Keep this prescription for your records.', paperWidth / 2, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.6);
        doc.text('Generated by iPawcus from the finalized diagnosis record.', paperWidth / 2, y + 3.5, {
            align: 'center',
            maxWidth: contentWidth
        });
    }

    return y + 9;
}

export async function createPrescriptionDocumentPdfBlob(input = {}) {
    const { jsPDF } = await import('jspdf');
    const paperWidthKey = input.paperWidth || DEFAULT_PAPER_WIDTH;
    const paperWidth = PAPER_WIDTHS_MM[paperWidthKey] || PAPER_WIDTHS_MM[DEFAULT_PAPER_WIDTH];
    const sizingDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [paperWidth, 200] });
    const requiredHeight = renderPrescription(sizingDocument, input, paperWidth, false);
    const pageHeight = Math.min(MAX_PAGE_HEIGHT_MM, Math.max(MIN_PAGE_HEIGHT_MM, Math.ceil(requiredHeight)));
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [paperWidth, pageHeight],
        compress: true,
        putOnlyUsedFonts: true
    });

    doc.setProperties({
        title: `${text(input.context?.petName, 'Patient')} - Prescription`,
        subject: 'Veterinary prescription record',
        author: text(input.veterinarianName, 'Vetfocus Animal Care Clinic'),
        creator: 'iPawcus'
    });

    renderPrescription(doc, input, paperWidth, true);
    return doc.output('blob');
}

export async function createPrescriptionDocumentPdfFile(payload = {}) {
    const blob = await createPrescriptionDocumentPdfBlob(payload);
    const petName = safeFilePart(payload.context?.petName, 'patient');
    return new File([blob], `prescription-${petName}-${Date.now()}.pdf`, {
        type: 'application/pdf',
        lastModified: Date.now()
    });
}
