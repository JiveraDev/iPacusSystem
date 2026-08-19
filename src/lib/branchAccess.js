export function normalizeUserRole(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

export function storedDashboardUser() {
    if (typeof window === 'undefined') return {};

    try {
        return JSON.parse(window.localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

export function assignedBranchId(user = storedDashboardUser()) {
    const value = user?.preferred_branch_id
        ?? user?.preferredBranchId
        ?? user?.branch_id
        ?? user?.branchId;
    return value ? String(value) : '';
}

export function isBranchSelectionLocked(user = storedDashboardUser(), { inventory = false } = {}) {
    const role = normalizeUserRole(user?.role);
    if (role === 'super_admin') return false;
    if (role === 'admin') return !inventory;
    return role === 'veterinarian' || role === 'vet';
}
