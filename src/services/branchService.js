import { apiRequest, patchJson, postJson } from './apiClient';

export const VISIBLE_BRANCH_CODES = Object.freeze(['MAIN', 'ENRIQUEZ']);

function normalizeBranchText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function getVisibleBranchCode(branch) {
    const rawCode = typeof branch === 'object' && branch !== null
        ? branch.code ?? branch.branchCode ?? branch.branch_code
        : branch;
    const normalizedCode = String(rawCode || '').trim().toUpperCase();

    if (VISIBLE_BRANCH_CODES.includes(normalizedCode)) {
        return normalizedCode;
    }

    if (typeof branch !== 'object' || branch === null) {
        return '';
    }

    if (branch.isMain === true || branch.is_main === true || Number(branch.isMain ?? branch.is_main) === 1) {
        return 'MAIN';
    }

    const normalizedName = normalizeBranchText(
        branch.name ?? branch.branchName ?? branch.branch_name
    );

    if (normalizedName.includes('enriquez')) {
        return 'ENRIQUEZ';
    }

    if (
        normalizedName === 'main'
        || normalizedName === 'main clinic'
        || normalizedName.includes('pharmacy main clinic')
        || normalizedName === 'vetfocus care animal clinic'
    ) {
        return 'MAIN';
    }

    return '';
}

export function isVisibleBranch(branch) {
    return getVisibleBranchCode(branch) !== '';
}

export function filterVisibleBranches(branches) {
    return (Array.isArray(branches) ? branches : []).filter(isVisibleBranch);
}

export function normalizeVisibleBranchCode(branch, fallback = 'MAIN') {
    return getVisibleBranchCode(branch) || fallback;
}

export function getBranchDisplayName(branches, branchId, fallback = '') {
    const selectedBranch = filterVisibleBranches(branches).find(
        branch => String(branch.id) === String(branchId ?? '')
            || String(branch.code) === String(branchId ?? '')
    );

    return selectedBranch?.name || fallback;
}

export async function fetchBranches({ service, date, assignedOnly = false } = {}) {
    const query = new URLSearchParams();
    if (service) query.set('service', service);
    if (date) query.set('date', date);
    if (assignedOnly) query.set('assigned', '1');
    const suffix = query.toString();
    const data = await apiRequest(`/branches${suffix ? `?${suffix}` : ''}`);

    if (Array.isArray(data)) {
        return filterVisibleBranches(data);
    }

    return {
        ...data,
        branches: filterVisibleBranches(data?.branches),
    };
}

export async function fetchVeterinarianBranchSchedules(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const suffix = query.toString();
    const data = await apiRequest(`/veterinarian-branch-schedules${suffix ? `?${suffix}` : ''}`);

    if (Array.isArray(data)) {
        return data.filter(isVisibleBranch);
    }

    return {
        ...data,
        schedules: (Array.isArray(data?.schedules) ? data.schedules : []).filter(isVisibleBranch),
    };
}

export function saveVeterinarianBranchSchedule(payload) {
    return payload?.id
        ? patchJson('/veterinarian-branch-schedules', payload)
        : postJson('/veterinarian-branch-schedules', payload);
}

export function relocateBooking(bookingId, payload) {
    return patchJson(`/bookings/${bookingId}/branch`, payload);
}
