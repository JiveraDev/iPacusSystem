export const TRANSACTION_NUMBER_LENGTH = 18;
export const TRANSACTION_NUMBER_MESSAGE = `Transaction number must contain exactly ${TRANSACTION_NUMBER_LENGTH} digits.`;

export function normalizeTransactionNumber(value) {
    return String(value || '')
        .replace(/\D/g, '')
        .slice(0, TRANSACTION_NUMBER_LENGTH);
}

export function isValidTransactionNumber(value) {
    return new RegExp(`^\\d{${TRANSACTION_NUMBER_LENGTH}}$`).test(String(value || '').trim());
}
