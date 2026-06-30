export function prepareNotificationRedirect(redirectPath) {
    if (!redirectPath || typeof window === 'undefined') {
        return redirectPath;
    }

    try {
        const url = new URL(redirectPath, window.location.origin);

        if (url.pathname === '/dashboard/vet/medical-records') {
            const petId = url.searchParams.get('petId');
            const requestId = url.searchParams.get('requestId');

            if (petId) {
                window.sessionStorage.setItem('vet-record-update-pet-id', petId);
            }

            if (requestId) {
                window.sessionStorage.setItem('vet-record-update-request-id', requestId);
            }

            return url.pathname;
        }
    } catch {
        return redirectPath;
    }

    return redirectPath;
}
