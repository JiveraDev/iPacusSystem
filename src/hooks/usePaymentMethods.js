import { useCallback, useEffect, useState } from 'react';
import { fetchPaymentMethods } from '../services/paymentMethodService';

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
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
    const [paymentMethodsError, setPaymentMethodsError] = useState('');
    const [retryKey, setRetryKey] = useState(0);

    const retryPaymentMethods = useCallback(() => {
        setIsLoadingPaymentMethods(true);
        setPaymentMethodsError('');
        setRetryKey((current) => current + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        fetchPaymentMethods({}, { signal: controller.signal })
            .then((data) => {
                if (!isMounted) return;
                const methods = Array.isArray(data.methods) && data.methods.length > 0
                    ? data.methods.map(normalizeMethod)
                    : [];
                setPaymentMethods(methods);
            })
            .catch((error) => {
                if (isMounted && !controller.signal.aborted) {
                    setPaymentMethods([]);
                    setPaymentMethodsError(error.message || 'Payment methods are temporarily unavailable.');
                }
            })
            .finally(() => {
                if (isMounted && !controller.signal.aborted) {
                    setIsLoadingPaymentMethods(false);
                }
            });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [retryKey]);

    return {
        paymentMethods,
        isLoadingPaymentMethods,
        paymentMethodsError,
        retryPaymentMethods,
    };
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
