import logoImg from '../assets/logo-no-bg.png';

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
    veterinarianLicense
}) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1275;
    const context = canvas.getContext('2d');
    const padding = 76;
    const textWidth = canvas.width - padding * 2;

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
    context.fillText('Vetfocus Animal Care Clinic', canvas.width / 2, 156);
    context.font = '11px Arial, sans-serif';
    context.fillStyle = '#4b5563';
    context.fillText('EXCELLENCE IN PET HEALTHCARE & SPECIALIZED SURGERY', canvas.width / 2, 178);
    context.strokeStyle = '#111827';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, 212);
    context.lineTo(canvas.width - padding, 212);
    context.stroke();

    context.font = '700 22px Georgia, serif';
    context.fillStyle = '#111827';
    context.fillText(resolveText(title, 'Consent Form'), canvas.width / 2, 270);

    context.textAlign = 'left';
    context.fillStyle = '#1f2937';
    context.font = '16px Georgia, serif';
    const lines = wrapCanvasText(context, resolveText(content, 'No content available for this form.'), textWidth);
    let y = 330;
    lines.slice(0, 34).forEach((line) => {
        context.fillText(line, padding, y);
        y += 25;
    });

    const signatureY = 1010;
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
    context.moveTo(canvas.width - padding - 250, signatureY);
    context.lineTo(canvas.width - padding, signatureY);
    context.stroke();

    context.textAlign = 'center';
    context.fillStyle = '#111827';
    context.font = '700 11px Arial, sans-serif';
    context.fillText("OWNER'S SIGNATURE", padding + 115, signatureY + 22);
    context.fillText('VETERINARIAN NAME AND LICENSE', canvas.width - padding - 125, signatureY + 22);

    context.fillStyle = '#4b5563';
    context.font = '12px Arial, sans-serif';
    if (signerName) context.fillText(signerName, padding + 115, signatureY + 42);
    if (signedAt) context.fillText(signedAt, padding + 115, signatureY + 60);
    context.font = '700 12px Arial, sans-serif';
    context.fillText(veterinarianName || 'Veterinarian', canvas.width - padding - 125, signatureY - 34);
    context.font = '700 11px Arial, sans-serif';
    context.fillText(veterinarianLicense ? `License: ${veterinarianLicense}` : 'License: N/A', canvas.width - padding - 125, signatureY - 15);

    context.strokeStyle = '#f3f4f6';
    context.beginPath();
    context.moveTo(padding, 1160);
    context.lineTo(canvas.width - padding, 1160);
    context.stroke();

    context.fillStyle = '#9ca3af';
    context.font = '11px Arial, sans-serif';
    context.fillText('2026 Vetfocus Animal Care Clinic. All rights reserved.', canvas.width / 2, 1188);

    return canvas.toDataURL('image/png');
}
