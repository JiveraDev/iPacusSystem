import { apiFetch, readJsonResponse } from './apiClient';
import { getUserFacingErrorMessage, sanitizeErrorPayload } from '../lib/errorPresentation.js';

export async function fetchPublicWanIp() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new Error(getUserFacingErrorMessage(
            data.message,
            'Failed to fetch public WAN IP.',
            { context: 'Public IP service details were hidden from the user interface.' }
        ));
    }

    return data?.ip || '';
}

export async function checkSelfServiceAccess(publicWanIp = '') {
    const response = await apiFetch('/self-service/access', {
        headers: publicWanIp ? { 'X-Client-Public-IP': publicWanIp } : {}
    });
    const data = await readJsonResponse(response);
    const responseData = response.ok
        ? data
        : sanitizeErrorPayload(data, 'Self-service access could not be verified.');

    return {
        ...responseData,
        ok: response.ok
    };
}
