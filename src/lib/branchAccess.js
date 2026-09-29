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

// Use the account assignment even when that branch has no operational records.
// Never fall back to an all-branches scope for an account with no assignment.
export function resolveAssignedBranch(branches, user) {
    const assigned = Array.isArray(branches) ? branches : [];
    const preferredId = assignedBranchId(user);
    return assigned.find((branch) => String(branch.id) === preferredId) || assigned[0] || null;
}

export function isBranchSelectionLocked(user = storedDashboardUser()) {
    const role = normalizeUserRole(user?.role);
    if (role === 'super_admin') return false;
    if (role === 'admin') return true;
    return role === 'veterinarian' || role === 'vet';
}
