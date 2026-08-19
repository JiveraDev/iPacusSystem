import logoImg from '../assets/logo-no-bg.png';
import { resolveConsentTemplate } from '../lib/consentTemplateCodes';
import { uploadDocumentFile } from './uploadService';

const PAGE_MARGIN = 54;
const FOOTER_LIMIT = 780;
const BODY_LINE_HEIGHT = 15;

function cleanText(value, fallback = '') {
    const source = String(value || fallback);
    const markupWithBreaks = source
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
    let plainText = markupWithBreaks.replace(/<[^>]+>/g, '');

    if (typeof document !== 'undefined') {
        const container = document.createElement('div');
        container.innerHTML = markupWithBreaks;
        plainText = String(container.textContent || container.innerText || plainText);
    }

    return plainText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
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

function safeFileToken(value, fallback = 'signed-consent') {
    const token = String(value || fallback)
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    return token || fallback;
}

function displayDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('The document image could not be read.'));
        reader.readAsDataURL(blob);
    });
}

async function imageDataUrl(source) {
    const value = String(source || '').trim();
    if (!value) return '';
    if (value.startsWith('data:image/')) return value;

    try {
        const response = await fetch(value);
        if (!response.ok) return '';
        const blob = await response.blob();
        return blob.type.startsWith('image/') ? await blobToDataUrl(blob) : '';
    } catch {
        return '';
    }
}

function addPageHeader(doc, logoData, title, continued = false) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(21, 93, 252);
    doc.rect(0, 0, pageWidth, continued ? 72 : 112, 'F');

    if (logoData) {
        try {
            doc.addImage(logoData, 'PNG', PAGE_MARGIN, continued ? 14 : 20, 44, 44, undefined, 'FAST');
        } catch {
            // The clinic name remains as an accessible header if the logo cannot be embedded.
        }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(continued ? 14 : 18);
    doc.text('Vetfocus Animal Care Clinic', logoData ? 108 : PAGE_MARGIN, continued ? 35 : 48);
    doc.setFontSize(continued ? 9 : 10);
    doc.setFont('helvetica', 'normal');
    doc.text(continued ? `${title} - continued` : 'Excellence in Pet Healthcare & Specialized Surgery', logoData ? 108 : PAGE_MARGIN, continued ? 51 : 68);

    if (!continued) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('SIGNED CONSENT DOCUMENT', pageWidth - PAGE_MARGIN, 48, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Digitally generated clinic record', pageWidth - PAGE_MARGIN, 66, { align: 'right' });
    }
}

function addFooters(doc) {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setDrawColor(226, 232, 240);
        doc.line(PAGE_MARGIN, 802, pageWidth - PAGE_MARGIN, 802);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Vetfocus Animal Care Clinic - confidential patient record', PAGE_MARGIN, 818);
        doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - PAGE_MARGIN, 818, { align: 'right' });
    }
}

export async function createConsentDocumentPdfBlob({
    title,
    content,
    signatureImage,
    signerName,
    signedAt,
    veterinarianName,
    veterinarianLicense,
    templateContext = {}
}) {
    const [{ jsPDF }, logoData, signatureData] = await Promise.all([
        import('jspdf'),
        imageDataUrl(logoImg),
        imageDataUrl(signatureImage)
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (PAGE_MARGIN * 2);
    const resolvedTitle = cleanText(title, 'Consent Form');
    const resolvedContent = cleanText(resolveConsentTemplate(content, {
        ...templateContext,
        signerName,
        signedAt,
        veterinarianName,
        veterinarianLicense
    }), 'No consent content was provided.');

    doc.setProperties({
        title: resolvedTitle,
        subject: 'Signed veterinary consent document',
        author: 'Vetfocus Animal Care Clinic',
        creator: 'iPawcus'
    });

    addPageHeader(doc, logoData, resolvedTitle);
    let y = 148;

    const startContinuationPage = () => {
        doc.addPage();
        addPageHeader(doc, logoData, resolvedTitle, true);
        y = 96;
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(51, 65, 85);
    };
    const ensureSpace = (height) => {
        if (y + height > FOOTER_LIMIT) startContinuationPage();
    };

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    const titleLines = doc.splitTextToSize(resolvedTitle, contentWidth);
    titleLines.forEach((line) => {
        ensureSpace(22);
        doc.text(line, PAGE_MARGIN, y);
        y += 21;
    });
    y += 8;

    doc.setDrawColor(203, 213, 225);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += 26;

    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);

    resolvedContent.split('\n').forEach((paragraph) => {
        if (!paragraph.trim()) {
            ensureSpace(BODY_LINE_HEIGHT);
            y += BODY_LINE_HEIGHT;
            return;
        }

        const lines = doc.splitTextToSize(paragraph.trim(), contentWidth);
        lines.forEach((line) => {
            ensureSpace(BODY_LINE_HEIGHT);
            doc.text(line, PAGE_MARGIN, y);
            y += BODY_LINE_HEIGHT;
        });
        y += 5;
    });

    const signatureBlockHeight = 152;
    y += 18;
    ensureSpace(signatureBlockHeight);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, signatureBlockHeight, 5, 5, 'FD');

    const columnGap = 28;
    const columnWidth = (contentWidth - columnGap - 32) / 2;
    const leftX = PAGE_MARGIN + 16;
    const rightX = leftX + columnWidth + columnGap;
    const signatureLineY = y + 93;

    if (signatureData) {
        try {
            const imageProperties = doc.getImageProperties(signatureData);
            const ratio = Math.min(columnWidth / imageProperties.width, 62 / imageProperties.height);
            const renderedWidth = imageProperties.width * ratio;
            const renderedHeight = imageProperties.height * ratio;
            doc.addImage(
                signatureData,
                imageProperties.fileType || 'PNG',
                leftX + ((columnWidth - renderedWidth) / 2),
                signatureLineY - renderedHeight - 4,
                renderedWidth,
                renderedHeight,
                undefined,
                'FAST'
            );
        } catch {
            // Printed signer details remain in the PDF if an old signature image cannot be decoded.
        }
    }

    doc.setDrawColor(100, 116, 139);
    doc.line(leftX, signatureLineY, leftX + columnWidth, signatureLineY);
    doc.line(rightX, signatureLineY, rightX + columnWidth, signatureLineY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(cleanText(signerName, 'Pet owner'), leftX + (columnWidth / 2), signatureLineY + 17, { align: 'center' });
    doc.text(cleanText(veterinarianName, 'Clinic veterinarian'), rightX + (columnWidth / 2), signatureLineY - 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Owner's electronic signature over printed name", leftX + (columnWidth / 2), signatureLineY + 32, { align: 'center' });
    doc.text(displayDate(signedAt) || 'Date recorded by the system', leftX + (columnWidth / 2), signatureLineY + 45, { align: 'center' });
    doc.text('Veterinarian name and license', rightX + (columnWidth / 2), signatureLineY + 17, { align: 'center' });
    doc.text(veterinarianLicense ? `License: ${veterinarianLicense}` : 'License: N/A', rightX + (columnWidth / 2), signatureLineY + 32, { align: 'center' });

    addFooters(doc);
    return doc.output('blob');
}

export async function createConsentDocumentPdfFile(payload, fileNamePrefix = 'signed-consent') {
    const blob = await createConsentDocumentPdfBlob(payload);
    return new File(
        [blob],
        `${safeFileToken(fileNamePrefix)}-${Date.now()}.pdf`,
        { type: 'application/pdf' }
    );
}

export async function createAndUploadConsentDocumentPdf(payload, fileNamePrefix = 'signed-consent', options = {}) {
    const file = await createConsentDocumentPdfFile(payload, fileNamePrefix);
    return uploadDocumentFile(file, 'consent_document', options);
}
