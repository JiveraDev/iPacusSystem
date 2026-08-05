import { apiRequest, patchJson, postJson } from './apiClient';

export function getBranchDisplayName(branches, branchId, fallback = '') {
    const selectedBranch = (Array.isArray(branches) ? branches : []).find(
        branch => String(branch.id) === String(branchId ?? '')
    );

    return selectedBranch?.name || fallback;
}

export function fetchBranches({ service, date, assignedOnly = false } = {}) {
    const query = new URLSearchParams();
    if (service) query.set('service', service);
    if (date) query.set('date', date);
    if (assignedOnly) query.set('assigned', '1');
    const suffix = query.toString();
    return apiRequest(`/branches${suffix ? `?${suffix}` : ''}`);
}

export function fetchVeterinarianBranchSchedules(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const suffix = query.toString();
    return apiRequest(`/veterinarian-branch-schedules${suffix ? `?${suffix}` : ''}`);
}

export function saveVeterinarianBranchSchedule(payload) {
    return payload?.id
        ? patchJson('/veterinarian-branch-schedules', payload)
        : postJson('/veterinarian-branch-schedules', payload);
}

export function relocateBooking(bookingId, payload) {
    return patchJson(`/bookings/${bookingId}/branch`, payload);
}
