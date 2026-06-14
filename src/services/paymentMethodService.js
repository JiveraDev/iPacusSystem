import { apiRequest, patchJson, postJson } from './apiClient';

function queryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, value);
        }
    });

    const value = query.toString();
    return value ? `?${value}` : '';
}

export function fetchPaymentMethods(params = {}) {
    return apiRequest(`/payment-methods${queryString(params)}`, { apiPrefix: true });
}

export function requestPaymentMethodsOtp(payload) {
    return postJson('/payment-methods/otp', payload, { apiPrefix: true });
}

export function updatePaymentMethods(payload) {
    return patchJson('/payment-methods', payload, { apiPrefix: true });
}
