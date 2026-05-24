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
  { pattern: "/dashboard/services/general-checkup", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/parasite-control", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/surgery", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/vaccination", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/grooming", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/dental-checkup", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/home-services", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/pet-hotel", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services/special-services", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/services", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/todos", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/profile", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/bookings", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/queue", allowedRoles:  ALL_ROLES},
  { pattern: "/dashboard/self-service-queue", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/consent", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/pet-register", allowedRoles: ALL_ROLES },
  { pattern: "/dashboard/accounts", allowedRoles: ALL_ROLES },
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

  useUserUpdate,

  useDashboardUser
};
