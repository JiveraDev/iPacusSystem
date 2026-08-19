import { useEffect, useState } from 'react';
import { fetchPaymentMethods } from '../services/paymentMethodService';

export const PAYMENT_METHOD_FALLBACK = [
    {
        methodKey: 'qrph',
        value: 'qrph',
        label: 'QRPH',
        methodType: 'ewallet',
        accountName: 'Vetfocus Animal Care Clinic',
        accountNumber: '',
        instructions: 'Scan the QRPH code, then upload a clear screenshot of the successful transaction.',
        qrImageUrl: '',
        requiresProof: true
    },
    {
        methodKey: 'maya',
        value: 'maya',
        label: 'Maya',
        methodType: 'ewallet',
        accountName: 'Vetfocus Animal Care Clinic',
        accountNumber: '',
        instructions: 'Send payment to the Maya account, then upload a clear screenshot of the successful transaction.',
        qrImageUrl: '',
        requiresProof: true
    },
    {
        methodKey: 'gcash',
        value: 'gcash',
        label: 'GCash',
        methodType: 'ewallet',
        accountName: 'Vetfocus Animal Care Clinic',
        accountNumber: '',
        instructions: 'Send payment to the GCash account, then upload a clear screenshot of the successful transaction.',
        qrImageUrl: '',
        requiresProof: true
    },
    {
        methodKey: 'bank_transfer',
        value: 'bank_transfer',
        label: 'Bank Transfer',
        methodType: 'bank_transfer',
        accountName: 'Vetfocus Animal Care Clinic',
        accountNumber: '',
        instructions: 'Transfer to the clinic bank account, then upload a clear screenshot or receipt.',
        qrImageUrl: '',
        requiresProof: true
    }
];

function normalizeMethod(method) {
    const key = method.methodKey || method.key || method.value;

    return {
        ...method,
        methodKey: key,
        value: key,
        requiresProof: method.requiresProof !== false
    };
}

export function usePaymentMethods() {
    const [paymentMethods, setPaymentMethods] = useState(PAYMENT_METHOD_FALLBACK);
    const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

    useEffect(() => {
        let isMounted = true;

        fetchPaymentMethods()
            .then((data) => {
                if (!isMounted) return;
                const methods = Array.isArray(data.methods) && data.methods.length > 0
                    ? data.methods.map(normalizeMethod)
                    : PAYMENT_METHOD_FALLBACK;
                setPaymentMethods(methods);
            })
            .catch(() => {
                if (isMounted) {
                    setPaymentMethods(PAYMENT_METHOD_FALLBACK);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingPaymentMethods(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    return { paymentMethods, isLoadingPaymentMethods };
}

export function paymentMethodRequiresProof(method) {
    return method?.requiresProof !== false;
}

export function paymentMethodInstruction(method) {
    if (!method) return '';

    return [
        method.instructions,
        method.accountName ? `Account name: ${method.accountName}` : '',
        method.accountNumber ? `Account number/details: ${method.accountNumber}` : ''
    ].filter(Boolean).join('\n');
}
