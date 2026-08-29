export function normalizeAccountRole(role = '') {
    return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isArchivedPetOwner(user) {
    const role = normalizeAccountRole(user?.role || user?.user_role || '');
    const status = String(user?.accountStatus || user?.account_status || 'active').trim().toLowerCase();

    return ['pet_owner', 'petowner'].includes(role)
        && ['archived', 'deactivated'].includes(status);
}

export function assertPetOwnerActionAllowed(user, actionLabel = 'request this service') {
    if (!isArchivedPetOwner(user)) return;

    throw new Error(`Your archived account cannot ${actionLabel}. Contact the clinic to restore access, or ask clinic staff for assistance.`);
}
