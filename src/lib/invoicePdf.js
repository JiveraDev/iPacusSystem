import { jsPDF } from 'jspdf';

const PAPER_WIDTHS_MM = {
  '58mm': 58,
  '80mm': 80,
};

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `PHP ${numberValue(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeText(value, fallback = '') {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00d7/g, 'x')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .trim();
  return text || fallback;
}

function paymentMethodLabel(value) {
  return safeText(value, 'cash').replace(/_/g, ' ').toUpperCase();
}

function safeFilePart(value) {
  return safeText(value, 'invoice')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'invoice';
}

function lineCount(doc, value, width) {
  return Math.max(1, doc.splitTextToSize(safeText(value, '-'), width).length);
}

function calculatePageHeight(doc, width, input) {
  const contentWidth = width - 10;
  const itemTextWidth = contentWidth * 0.66;
  const charges = Array.isArray(input.charges) ? input.charges : [];
  const prescriptions = Array.isArray(input.prescriptions) ? input.prescriptions : [];
  let height = 67;

  [
    input.visitReference,
    `${safeText(input.petName, 'Patient')} (${safeText(input.petSpecies, 'Pet')})`,
    input.ownerName,
    input.veterinarianName,
    input.visitType,
    input.paymentReference,
  ].forEach((value) => {
    height += Math.max(0, lineCount(doc, value, contentWidth - 18) - 1) * 3.4;
  });

  prescriptions.forEach((prescription) => {
    height += 7 + (lineCount(doc, prescription.summary, contentWidth) * 3.6);
    if (prescription.instructions) {
      height += lineCount(doc, prescription.instructions, contentWidth) * 3.2;
    }
  });

  charges.forEach((charge) => {
    height += 6 + (lineCount(doc, charge.name || charge.description, itemTextWidth) * 3.7);
  });

  return Math.min(1200, Math.max(150, Math.ceil(height)));
}

function drawRule(doc, y, left, right, dashed = false) {
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern(dashed ? [1.2, 1.2] : [], 0);
  doc.line(left, y, right, y);
  doc.setLineDashPattern([], 0);
}

function drawMetaRow(doc, y, left, right, label, value) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(label.toUpperCase(), left, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const valueLines = doc.splitTextToSize(safeText(value, '-'), right - left - 18);
  doc.text(valueLines, right, y, { align: 'right' });

  return Math.max(4.2, valueLines.length * 3.2);
}

/**
 * Builds an immutable, print-ready thermal invoice PDF. The Blob is returned
 * instead of being saved so callers can upload it without forcing a download.
 */
export function createInvoicePdfFile(input) {
  const paperWidth = PAPER_WIDTHS_MM[input.paperWidth] || PAPER_WIDTHS_MM['80mm'];
  const sizingDocument = new jsPDF({ unit: 'mm', format: [paperWidth, 200] });
  const pageHeight = calculatePageHeight(sizingDocument, paperWidth, input);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paperWidth, pageHeight],
    compress: true,
    putOnlyUsedFonts: true,
  });
  const left = 5;
  const right = paperWidth - 5;
  const contentWidth = right - left;
  const invoiceTotal = numberValue(input.invoiceTotal);
  const previouslyPaid = Math.max(0, numberValue(input.previouslyPaid));
  const paymentReceived = Math.max(0, numberValue(input.paymentAmount));
  const totalPaid = Math.min(invoiceTotal, previouslyPaid + paymentReceived);
  const remainingBalance = Math.max(0, invoiceTotal - totalPaid);
  const charges = Array.isArray(input.charges) ? input.charges : [];
  const prescriptions = Array.isArray(input.prescriptions) ? input.prescriptions : [];
  let y = 0;

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
  doc.text('OFFICIAL INVOICE RECEIPT', paperWidth / 2, 19, { align: 'center' });
  y = 31;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(safeText(input.invoiceNumber, 'INVOICE'), paperWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(safeText(input.invoiceDate, new Date().toLocaleString()), paperWidth / 2, y, { align: 'center' });
  y += 5;
  drawRule(doc, y, left, right, true);
  y += 5;

  y += drawMetaRow(doc, y, left, right, 'Reference', input.visitReference);
  y += drawMetaRow(doc, y, left, right, 'Pet', `${safeText(input.petName, 'Patient')} (${safeText(input.petSpecies, 'Pet')})`);
  y += drawMetaRow(doc, y, left, right, 'Owner', input.ownerName);
  y += drawMetaRow(doc, y, left, right, 'Veterinarian', input.veterinarianName);
  y += drawMetaRow(doc, y, left, right, 'Visit', input.visitType);
  y += 1;
  drawRule(doc, y, left, right, true);
  y += 5;

  if (prescriptions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('PRESCRIPTION SUMMARY', left, y);
    y += 4;
    prescriptions.forEach((prescription) => {
      const summaryLines = doc.splitTextToSize(safeText(prescription.summary, 'Prescription'), contentWidth);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(summaryLines, left, y);
      y += summaryLines.length * 3.4;
      if (prescription.instructions) {
        const instructionLines = doc.splitTextToSize(safeText(prescription.instructions), contentWidth);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(instructionLines, left, y);
        y += instructionLines.length * 3.1;
      }
      y += 2;
    });
    drawRule(doc, y, left, right, true);
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('ITEM', left, y);
  doc.text('AMOUNT', right, y, { align: 'right' });
  y += 3;
  drawRule(doc, y, left, right);
  y += 4;

  charges.forEach((charge) => {
    const quantity = Math.max(0, numberValue(charge.quantity));
    const unitPrice = Math.max(0, numberValue(charge.price ?? charge.unitPrice));
    const submittedSubtotal = Number(charge.subtotal);
    const subtotal = Number.isFinite(submittedSubtotal)
      ? Math.max(0, submittedSubtotal)
      : quantity * unitPrice;
    const nameWidth = contentWidth * 0.66;
    const nameLines = doc.splitTextToSize(safeText(charge.name || charge.description, 'Charge'), nameWidth);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(nameLines, left, y);
    doc.text(money(subtotal), right, y, { align: 'right' });
    y += nameLines.length * 3.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(100, 116, 139);
    doc.text(`${safeText(charge.receiptType, 'ITEM')} | ${quantity} x ${money(unitPrice)}`, left, y);
    y += 5;
  });

  drawRule(doc, y, left, right, true);
  y += 5;
  const totalRows = [
    ['Invoice Total', money(invoiceTotal)],
    ['Previously Paid', money(previouslyPaid)],
    ['Payment Received', money(paymentReceived)],
    ['Total Paid', money(totalPaid)],
    ['Remaining Balance', money(remainingBalance)],
  ];
  totalRows.forEach(([label, value], index) => {
    const emphasized = index >= 3;
    doc.setFont('helvetica', emphasized ? 'bold' : 'normal');
    doc.setFontSize(emphasized ? 8.2 : 6.8);
    doc.setTextColor(index === 4 && remainingBalance > 0 ? 180 : 15, index === 4 && remainingBalance > 0 ? 83 : 23, index === 4 && remainingBalance > 0 ? 9 : 42);
    doc.text(label.toUpperCase(), left, y);
    doc.text(value, right, y, { align: 'right' });
    y += emphasized ? 5 : 4;
  });

  drawRule(doc, y, left, right, true);
  y += 5;
  y += drawMetaRow(doc, y, left, right, 'Payment', paymentMethodLabel(input.paymentMethod));
  y += drawMetaRow(doc, y, left, right, 'Txn Reference', safeText(input.paymentReference, 'No transaction number'));
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(71, 85, 105);
  doc.text('Thank you for trusting iPawcus.', paperWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.7);
  doc.text('Generated by iPawcus Point-Of-Sale. Keep this document for your records.', paperWidth / 2, y, {
    align: 'center',
    maxWidth: contentWidth,
  });

  const fileName = `${safeFilePart(input.invoiceNumber)}.pdf`;
  const blob = doc.output('blob');
  return new File([blob], fileName, { type: 'application/pdf', lastModified: Date.now() });
}
