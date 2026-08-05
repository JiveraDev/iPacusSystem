import { useEffect, useState } from 'react';
import { fetchProtectedImageObjectUrl } from '../lib/image';
import { createConsentDocumentImage } from '../services/consentDocumentImage';

function firstValue(...values) {
    return values.find(value => String(value || '').trim()) || '';
}

export function consentDocumentPath(value) {
    const record = value && typeof value === 'object' ? value : {};

    return firstValue(
        record.documentPath,
        record.document_path,
        record.consentDocumentPath,
        record.consent_document_path,
        record.signedDocumentPath,
        record.signed_document_path,
        record.signedConsentDocumentPath,
        record.signed_consent_document_path,
        record.signedFilePath,
        record.signed_file_path,
        record.physicalConsentPath,
        record.physical_consent_path
    );
}

export function normalizeConsentForms(value) {
    return (Array.isArray(value) ? value : [])
        .filter(form => form && typeof form === 'object')
        .map((form, index) => ({
            ...form,
            id: form.id || form.fileId || form.file_id || `consent-${index + 1}`,
            title: firstValue(form.title, form.fileName, form.file_name, form.name, 'Consent Form'),
            content: firstValue(form.content, form.formContent, form.form_content, form.description),
            signerName: firstValue(form.signerName, form.signer_name, form.ownerName, form.owner_name),
            signedAt: firstValue(form.signedAt, form.signed_at, form.createdAt, form.created_at),
            veterinarianName: firstValue(form.veterinarianName, form.veterinarian_name),
            veterinarianLicense: firstValue(form.veterinarianLicense, form.veterinarian_license),
            documentPath: consentDocumentPath(form),
            signaturePath: firstValue(
                form.signaturePath,
                form.signature_path,
                form.signatureImage,
                form.signature_image,
                form.legacySignaturePath,
                form.legacy_signature_path
            ),
            legacySignaturePath: firstValue(form.legacySignaturePath, form.legacy_signature_path)
        }));
}

export function canReconstructConsentDocument(value, fallbackSignaturePath = '') {
    const record = value && typeof value === 'object' ? value : {};
    const content = firstValue(record.content, record.formContent, record.form_content, record.description);
    const signaturePath = firstValue(
        record.signaturePath,
        record.signature_path,
        record.signatureImage,
        record.signature_image,
        record.legacySignaturePath,
        record.legacy_signature_path,
        fallbackSignaturePath
    );

    return Boolean(content && signaturePath);
}

export async function downloadConsentDocument(source, fileName = 'signed-consent-form.png') {
    const downloadSource = await fetchProtectedImageObjectUrl(source);
    if (!downloadSource) {
        throw new Error('The complete consent document is unavailable.');
    }

    const link = document.createElement('a');
    link.href = downloadSource;
    link.download = String(fileName || 'signed-consent-form.png')
        .replace(/[<>:"/\\|?*]/g, '-');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (downloadSource.startsWith('blob:')) {
        window.setTimeout(() => URL.revokeObjectURL(downloadSource), 1000);
    }
}

export async function openProtectedDocument(source) {
    const viewSource = await fetchProtectedImageObjectUrl(source);
    if (!viewSource) {
        throw new Error('The requested document is unavailable.');
    }

    const link = document.createElement('a');
    link.href = viewSource;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (viewSource.startsWith('blob:')) {
        window.setTimeout(() => URL.revokeObjectURL(viewSource), 60000);
    }
}

export function useConsentDocumentSource(value, fallbackSignaturePath = '') {
    const record = value && typeof value === 'object' ? value : {};
    const explicitPath = consentDocumentPath(record);
    const title = firstValue(record.title, record.fileName, record.file_name, record.name, 'Consent Form');
    const content = firstValue(record.content, record.formContent, record.form_content, record.description);
    const signaturePath = firstValue(
        record.signaturePath,
        record.signature_path,
        record.signatureImage,
        record.signature_image,
        record.legacySignaturePath,
        record.legacy_signature_path,
        fallbackSignaturePath
    );
    const signerName = firstValue(record.signerName, record.signer_name, record.ownerName, record.owner_name);
    const signedAt = firstValue(record.signedAt, record.signed_at, record.createdAt, record.created_at);
    const veterinarianName = firstValue(record.veterinarianName, record.veterinarian_name, 'Veterinarian');
    const veterinarianLicense = firstValue(record.veterinarianLicense, record.veterinarian_license);
    const petName = firstValue(record.petName, record.pet_name, record.patientName, record.patient_name);
    const petSpecies = firstValue(record.petSpecies, record.pet_species, record.species);
    const petBreed = firstValue(record.petBreed, record.pet_breed, record.breed);
    const serviceName = firstValue(record.serviceName, record.service_name, record.serviceType, record.service_type);
    const branchName = firstValue(record.branchName, record.branch_name);
    const bookingNumber = firstValue(record.bookingNumber, record.booking_number);
    const queueNumber = firstValue(record.queueNumber, record.queue_number);
    const canReconstruct = Boolean(!explicitPath && content && signaturePath);
    const generationKey = [
        title,
        content,
        signaturePath,
        signerName,
        signedAt,
        veterinarianName,
        veterinarianLicense,
        petName,
        petSpecies,
        petBreed,
        serviceName,
        branchName,
        bookingNumber,
        queueNumber
    ].join('\u001f');
    const [generated, setGenerated] = useState({
        key: '',
        source: '',
        failed: false
    });

    useEffect(() => {
        if (!canReconstruct) {
            return undefined;
        }

        let isActive = true;
        let temporarySignatureUrl = '';

        async function reconstructDocument() {
            try {
                const resolvedSignature = await fetchProtectedImageObjectUrl(signaturePath);
                temporarySignatureUrl = resolvedSignature?.startsWith('blob:') ? resolvedSignature : '';
                const source = await createConsentDocumentImage({
                    title,
                    content,
                    signatureImage: resolvedSignature,
                    signerName,
                    signedAt,
                    veterinarianName,
                    veterinarianLicense,
                    templateContext: {
                        ownerName: signerName,
                        petName,
                        petSpecies,
                        petBreed,
                        serviceName,
                        branchName,
                        bookingNumber,
                        queueNumber
                    }
                });

                if (isActive) {
                    setGenerated({
                        key: generationKey,
                        source,
                        failed: false
                    });
                }
            } catch {
                if (isActive) {
                    setGenerated({
                        key: generationKey,
                        source: '',
                        failed: true
                    });
                }
            } finally {
                if (temporarySignatureUrl) {
                    URL.revokeObjectURL(temporarySignatureUrl);
                }
            }
        }

        reconstructDocument();

        return () => {
            isActive = false;
        };
    }, [
        canReconstruct,
        content,
        bookingNumber,
        branchName,
        generationKey,
        petBreed,
        petName,
        petSpecies,
        queueNumber,
        serviceName,
        signaturePath,
        signedAt,
        signerName,
        title,
        veterinarianLicense,
        veterinarianName
    ]);

    const generatedForCurrentRecord = generated.key === generationKey;
    const source = explicitPath || (generatedForCurrentRecord ? generated.source : '');

    return {
        source,
        isLoading: canReconstruct && !generatedForCurrentRecord,
        isReconstructed: Boolean(!explicitPath && source),
        isUnavailable: Boolean(!explicitPath && (!canReconstruct || (generatedForCurrentRecord && generated.failed)))
    };
}
