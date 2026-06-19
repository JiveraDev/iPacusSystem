import { createContext, useContext } from "react";

const DashboardRouterContext = createContext(null);


// debug bypas starts here

const DEBUG_BYPASS = true;

const ALL_ROLES = ["Pet Owner", "pet_owner", "Admin", "Veterinarian", "Super Admin"];

const PETOWNER_ROLES = DEBUG_BYPASS
    ? ALL_ROLES
    : ["Pet Owner", "pet_owner", "Super Admin"];

const VETERINARIAN_ROLES = DEBUG_BYPASS
    ? ALL_ROLES
    : ["Veterinarian", "Super Admin"];

const ADMIN_ROLES = DEBUG_BYPASS
    ? ALL_ROLES
    : ["Admin", "Super Admin"];

const SUPERADMIN_ROLES = DEBUG_BYPASS
    ? ALL_ROLES
    : ["Super Admin"];
// const ALL_ROLES = ["Pet Owner", "pet_owner", "Admin", "Veterinarian", "Super Admin"];
// const PETOWNER_ROLES = ["Pet Owner", "pet_owner", "Super Admin"];
// const VETERINARIAN_ROLES = ["Veterinarian", "Super Admin"];
// const ADMIN_ROLES = ["Admin", "Super Admin"];
// const SUPERADMIN_ROLES = [ "Super Admin"];

// ends here

const SERVICE_ROLES = [...new Set([...PETOWNER_ROLES, ...ADMIN_ROLES])];

const routePatterns = [
  { pattern: "/dashboard/consult/confirmation/home-service", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consult/video/:consultationId", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consult/confirmation/:bookingId", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/my-pets/add", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/my-pets/:petId/request-update", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/my-pets/:petId/medical-records", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/my-pets/:petId", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/my-pets", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consult/payment", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consult/booking", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consult", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/general-checkup", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/parasite-control", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/surgery", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/vaccination", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/grooming", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/dental-checkup", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/home-services", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/pet-hotel", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services/special-services", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/services", allowedRoles: SERVICE_ROLES },
  { pattern: "/dashboard/todos", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/profile", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/bookings", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/record-requests", allowedRoles: ADMIN_ROLES },
  { pattern: "/dashboard/boarding", allowedRoles: ADMIN_ROLES },
  { pattern: "/dashboard/queue", allowedRoles:  ALL_ROLES},
  { pattern: "/dashboard/pos", allowedRoles: ADMIN_ROLES },
  { pattern: "/dashboard/service-catalog", allowedRoles: ADMIN_ROLES },
  { pattern: "/dashboard/self-service-queue", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consent", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/vet/approved-queue", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/my-list", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/diagnosis", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/medical-records", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/record-requests", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/histories", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/vet/online-consultations", allowedRoles: VETERINARIAN_ROLES },
  { pattern: "/dashboard/reports/export", allowedRoles: SUPERADMIN_ROLES },
  { pattern: "/dashboard/reports", allowedRoles: SUPERADMIN_ROLES },
  { pattern: "/dashboard/pet-media-monitoring", allowedRoles: SUPERADMIN_ROLES },
  { pattern: "/dashboard/pet-owner-accounts", allowedRoles: SUPERADMIN_ROLES },
  { pattern: "/dashboard/pet-register/:petId", allowedRoles: ADMIN_ROLES },
  { pattern: "/dashboard/pet-register", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/accounts", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/payment-methods", allowedRoles: SUPERADMIN_ROLES },
  { pattern: "/dashboard/inventory/add", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/inventory/stock-in", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/inventory/low-stock", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/inventory/near-expiry", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/inventory/disposal", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/inventory", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard", allowedRoles: ALL_ROLES },
];

function normalizePath(path) {
  if (!path || path === "/dashboard/home") {
    return "/dashboard";
  }

  return path;
}

function matchPattern(path, pattern) {
  const pathParts = normalizePath(path).split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

function getRouteMatch(path) {
  for (const route of routePatterns) {
    const params = matchPattern(path, route.pattern);

    if (params) {
      return { 
        path: route.pattern, 
        params, 
        allowedRoles: route.allowedRoles || ALL_ROLES 
      };
    }
  }

  return { path: "/dashboard", params: {}, allowedRoles: ALL_ROLES };
}

function DashboardRouterProvider({ value, children }) {
  return <DashboardRouterContext.Provider value={value}>{children}</DashboardRouterContext.Provider>;
}

function useNavigate() {
  const context = useContext(DashboardRouterContext);
  return context.navigate;
}

function useParams() {
  const context = useContext(DashboardRouterContext);
  return context.params;
}

function useUserUpdate() {
  const context = useContext(DashboardRouterContext);
  return context.onUserUpdate;
}

function useDashboardUser() {
  const context = useContext(DashboardRouterContext);
  return context.user;
}

export {
  DashboardRouterProvider,
  // eslint-disable-next-line react-refresh/only-export-components
  getRouteMatch,
  // eslint-disable-next-line react-refresh/only-export-components
  normalizePath,
  // eslint-disable-next-line react-refresh/only-export-components
  useNavigate,
  // eslint-disable-next-line react-refresh/only-export-components
  useParams,

  // eslint-disable-next-line react-refresh/only-export-components
  useUserUpdate,
  // eslint-disable-next-line react-refresh/only-export-components
  useDashboardUser
};
