const ONLINE_CONSULTATION_SUBMISSION_KEY = 'ipawcus-online-consultation-submission';
const SUBMISSION_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveOnlineConsultationSubmission(receipt) {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(ONLINE_CONSULTATION_SUBMISSION_KEY, JSON.stringify({
            ...receipt,
            savedAt: new Date().toISOString()
        }));
    } catch {
        // The booking is already saved on the server. Storage availability
        // must never turn a successful submission into a client-side error.
    }
}

export function readOnlineConsultationSubmission(bookingId) {
    if (typeof window === 'undefined') return null;

    try {
        const receipt = JSON.parse(window.sessionStorage.getItem(ONLINE_CONSULTATION_SUBMISSION_KEY) || 'null');
        if (!receipt?.savedAt) return null;

        const savedAt = new Date(receipt.savedAt).getTime();
        if (!Number.isFinite(savedAt) || Date.now() - savedAt > SUBMISSION_RECEIPT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(ONLINE_CONSULTATION_SUBMISSION_KEY);
            return null;
        }

        const expectedId = String(bookingId || '');
        const receiptId = String(receipt.bookingId || '');
        if (expectedId !== 'success' && receiptId !== expectedId) {
            return null;
        }

        return receipt;
    } catch {
        return null;
    }
}
