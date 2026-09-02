const APP_NAME = 'iPawcus';

const PUBLIC_PAGE_TITLES = Object.freeze({
    landing: 'Home',
    login: 'Login',
    register: 'Create Account',
    registerProfile: 'Complete Pet Owner Profile',
    verifyEmail: 'Verify Email',
    forgotPassword: 'Reset Password',
    statusDisplay: 'Queue Status'
});

const DASHBOARD_PAGE_TITLES = Object.freeze({
    '/dashboard/consult': 'Online Consultations',
    '/dashboard/notifications': 'Notifications',
    '/dashboard/consult/booking': 'Book Online Consultation',
    '/dashboard/consult/payment': 'Consultation Payment',
    '/dashboard/consult/confirmation/:bookingId': 'Consultation Details',
    '/dashboard/consult/video/:consultationId': 'Online Consultation Call',
    '/dashboard/services': 'Services',
    '/dashboard/services/general-checkup': 'General Check-up',
    '/dashboard/services/laboratory-testing': 'Laboratory Testing',
    '/dashboard/services/parasite-control': 'Parasite Control',
    '/dashboard/services/surgery': 'Surgery',
    '/dashboard/services/vaccination': 'Vaccination',
    '/dashboard/services/grooming': 'Grooming',
    '/dashboard/services/dental-checkup': 'Dental Check-up',
    '/dashboard/services/home-services': 'Home Services',
    '/dashboard/consult/confirmation/home-service': 'Home Service Consent',
    '/dashboard/services/pet-hotel': 'Pet Hotel and Boarding',
    '/dashboard/services/special-services': 'Special Services',
    '/dashboard/my-pets': 'My Pets',
    '/dashboard/my-pets/add': 'Add Pet',
    '/dashboard/my-pets/:petId': 'Pet Profile',
    '/dashboard/my-pets/:petId/medical-records': 'Pet Health History',
    '/dashboard/my-pets/:petId/request-update': 'Request Record Update',
    '/dashboard/pet-register': 'Pet Register',
    '/dashboard/pet-register/:petId': 'Edit Pet Profile',
    '/dashboard/bookings': 'Booking Management',
    '/dashboard/record-requests': 'Record Update Requests',
    '/dashboard/boarding': 'Boarding Management',
    '/dashboard/queue': 'Queue Management',
    '/dashboard/pos': 'Point-of-Sale',
    '/dashboard/service-catalog': 'Service Catalog',
    '/dashboard/consent': 'Consent Files',
    '/dashboard/vet/approved-queue': 'Approved Queue',
    '/dashboard/vet/my-list': 'Veterinarian Service List',
    '/dashboard/vet/diagnosis': 'Veterinary Diagnosis',
    '/dashboard/vet/medical-records': 'Clinical Medical Records',
    '/dashboard/vet/record-requests': 'Record Update Requests',
    '/dashboard/vet/histories': 'Diagnosis History',
    '/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis': 'Consultation Diagnosis',
    '/dashboard/vet/online-consultations': 'Online Consultation Management',
    '/dashboard/reports': 'Reports Dashboard',
    '/dashboard/reports/export': 'Report Center',
    '/dashboard/pet-media-monitoring': 'Pet Media Monitoring',
    '/dashboard/accounts': 'Account Management',
    '/dashboard/pet-owner-accounts': 'Pet Owner Accounts',
    '/dashboard/payment-methods': 'Payment Methods',
    '/dashboard/self-service-queue': 'Self-Service Queue',
    '/dashboard/todos': 'Schedule and TODOs',
    '/dashboard/profile': 'Profile',
    '/dashboard/inventory': 'Inventory',
    '/dashboard/inventory/add': 'Add Inventory Item',
    '/dashboard/inventory/stock-in': 'Stock In',
    '/dashboard/inventory/low-stock': 'Low Stock',
    '/dashboard/inventory/near-expiry': 'Near Expiry',
    '/dashboard/inventory/disposal': 'Disposal Logs'
});

export function getPublicPageTitle(view) {
    return PUBLIC_PAGE_TITLES[view] || '';
}

export function getDashboardPageTitle(routePattern, role) {
    if (routePattern === '/dashboard') {
        const normalizedRole = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        return ['super_admin', 'superadmin'].includes(normalizedRole) ? 'Reports Dashboard' : 'Dashboard';
    }

    return DASHBOARD_PAGE_TITLES[routePattern] || 'Dashboard';
}

export function setDocumentPageTitle(pageTitle) {
    if (typeof document === 'undefined') return;
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
}
