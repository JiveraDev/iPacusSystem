import logoImg from '../assets/logo-no-bg.png';
import { resolveConsentTemplate } from '../lib/consentTemplateCodes';

function resolveText(value, fallback = '') {
    return String(value || fallback).trim();
}

function loadCanvasImage(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

function drawImageContain(context, image, x, y, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    const centeredX = x + (maxWidth - width) / 2;
    const centeredY = y + (maxHeight - height) / 2;

    context.drawImage(image, centeredX, centeredY, width, height);
}

function wrapCanvasText(context, text, maxWidth) {
    const wrappedLines = [];
    const sourceLines = String(text || '').split('\n');

    sourceLines.forEach((sourceLine) => {
        const words = sourceLine.split(/\s+/).filter(Boolean);

        if (words.length === 0) {
            wrappedLines.push('');
            return;
        }

        let line = '';
        words.forEach((word) => {
            const testLine = line ? `${line} ${word}` : word;
            if (context.measureText(testLine).width > maxWidth && line) {
                wrappedLines.push(line);
                line = word;
            } else {
                line = testLine;
            }
        });

        wrappedLines.push(line);
    });

    return wrappedLines;
}

export async function createConsentDocumentImage({
    title,
    content,
    signatureImage,
    signerName,
    signedAt,
    veterinarianName,
    veterinarianLicense,
    templateContext = {}
}) {
    const width = 900;
    const padding = 76;
    const textWidth = width - padding * 2;
    const bodyStartY = 330;
    const bodyLineHeight = 25;
    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d');

    if (!measureContext) {
        throw new Error('Could not prepare the complete consent document.');
    }

    const resolvedContext = {
        ...templateContext,
        signerName,
        signedAt,
        veterinarianName,
        veterinarianLicense
    };
    const resolvedContent = resolveConsentTemplate(content, resolvedContext);

    measureContext.font = '16px Georgia, serif';
    const lines = wrapCanvasText(
        measureContext,
        resolveText(resolvedContent, 'No content available for this form.'),
        textWidth
    );
    const bodyEndY = bodyStartY + (Math.max(lines.length, 1) * bodyLineHeight);
    const signatureY = Math.max(1010, bodyEndY + 135);
    const height = Math.max(1275, signatureY + 265);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not create the complete consent document.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#f1f5f9';
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    const logo = await loadCanvasImage(logoImg);
    if (logo) {
        context.globalAlpha = 0.04;
        drawImageContain(context, logo, 250, 380, 400, 360);
        context.globalAlpha = 1;
        drawImageContain(context, logo, canvas.width / 2 - 60, 48, 120, 86);
    }

    context.textAlign = 'center';
    context.fillStyle = '#111827';
    context.font = '700 25px Georgia, serif';
    context.fillText('Vetfocus Animal Care Clinic', width / 2, 156);
    context.font = '11px Arial, sans-serif';
    context.fillStyle = '#4b5563';
    context.fillText('EXCELLENCE IN PET HEALTHCARE & SPECIALIZED SURGERY', width / 2, 178);
    context.strokeStyle = '#111827';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, 212);
    context.lineTo(width - padding, 212);
    context.stroke();

    context.font = '700 22px Georgia, serif';
    context.fillStyle = '#111827';
    context.fillText(resolveText(title, 'Consent Form'), width / 2, 270);

    context.textAlign = 'left';
    context.fillStyle = '#1f2937';
    context.font = '16px Georgia, serif';
    let y = bodyStartY;
    lines.forEach((line) => {
        context.fillText(line, padding, y);
        y += bodyLineHeight;
    });

    const signature = await loadCanvasImage(signatureImage);
    if (signature) {
        const maxWidth = 210;
        const maxHeight = 85;
        const ratio = Math.min(maxWidth / signature.width, maxHeight / signature.height);
        const width = signature.width * ratio;
        const height = signature.height * ratio;
        context.drawImage(signature, padding + (maxWidth - width) / 2, signatureY - height - 8, width, height);
    }

    context.strokeStyle = '#9ca3af';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding, signatureY);
    context.lineTo(padding + 230, signatureY);
    context.moveTo(width - padding - 250, signatureY);
    context.lineTo(width - padding, signatureY);
    context.stroke();

    context.textAlign = 'center';
    context.fillStyle = '#111827';
    context.font = '700 9px Arial, sans-serif';
    context.fillText("OWNER'S ELECTRONIC SIGNATURE", padding + 115, signatureY + 20);
    context.fillText('OVER PRINTED NAME', padding + 115, signatureY + 33);
    context.font = '700 11px Arial, sans-serif';
    context.fillText('VETERINARIAN NAME AND LICENSE', width - padding - 125, signatureY + 22);

    context.fillStyle = '#4b5563';
    context.font = '12px Arial, sans-serif';
    context.fillText(signerName || 'Printed owner name', padding + 115, signatureY + 51);
    if (signedAt) context.fillText(signedAt, padding + 115, signatureY + 68);
    context.font = '700 12px Arial, sans-serif';
    context.fillText(veterinarianName || 'Veterinarian', width - padding - 125, signatureY - 34);
    context.font = '700 11px Arial, sans-serif';
    context.fillText(veterinarianLicense ? `License: ${veterinarianLicense}` : 'License: N/A', width - padding - 125, signatureY - 15);

    context.strokeStyle = '#f3f4f6';
    context.beginPath();
    context.moveTo(padding, height - 115);
    context.lineTo(width - padding, height - 115);
    context.stroke();

    context.fillStyle = '#9ca3af';
    context.font = '11px Arial, sans-serif';
    context.fillText('2026 Vetfocus Animal Care Clinic. All rights reserved.', width / 2, height - 87);

    return canvas.toDataURL('image/png');
}
