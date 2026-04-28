import { createContext, useContext } from "react";

const DashboardRouterContext = createContext(null);

// Centralized role definitions for easy reconfiguration later
const DEFAULT_ROLES = ["Pet Owner", "pet_owner"];

const routePatterns = [
  { pattern: "/dashboard/consult/video/:consultationId", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/consult/confirmation/:bookingId", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/my-pets/add", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/my-pets/:petId/request-update", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/my-pets/:petId/medical-records", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/my-pets/:petId", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/my-pets", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/consult/payment", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/consult/booking", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/consult", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/general-checkup", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/parasite-control", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/surgery", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/vaccination", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/grooming", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/dental-checkup", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/home-services", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/pet-hotel", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services/special-services", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/services", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/todos", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/profile", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard/pet-register", allowedRoles: DEFAULT_ROLES },
  { pattern: "/dashboard", allowedRoles: DEFAULT_ROLES },
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
        allowedRoles: route.allowedRoles || DEFAULT_ROLES 
      };
    }
  }

  return { path: "/dashboard", params: {}, allowedRoles: DEFAULT_ROLES };
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

export {
  DashboardRouterProvider,
  // eslint-disable-next-line react-refresh/only-export-components
  getRouteMatch,
  // eslint-disable-next-line react-refresh/only-export-components
  normalizePath,
  // eslint-disable-next-line react-refresh/only-export-components
  useNavigate,
  // eslint-disable-next-line react-refresh/only-export-components
  useParams
};
