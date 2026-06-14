import { apiFetch, readJsonResponse } from './apiClient';

export async function fetchPublicWanIp() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch public WAN IP.');
    }

    return data?.ip || '';
}

export async function checkSelfServiceAccess(publicWanIp = '') {
    const response = await apiFetch('/self-service/access', {
        headers: publicWanIp ? { 'X-Client-Public-IP': publicWanIp } : {}
    });
    const data = await readJsonResponse(response);

    return {
        ...data,
        ok: response.ok
    };
}
