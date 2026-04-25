import { createContext, useContext } from "react";

const DashboardRouterContext = createContext(null);

const routePatterns = [
  { pattern: "/dashboard/consult/video/:consultationId" },
  { pattern: "/dashboard/consult/confirmation/:bookingId" },
  { pattern: "/dashboard/my-pets/:petId/request-update" },
  { pattern: "/dashboard/my-pets/:petId/medical-records" },
  { pattern: "/dashboard/my-pets/:petId" },
  { pattern: "/dashboard/consult/payment" },
  { pattern: "/dashboard/consult/booking" },
  { pattern: "/dashboard/consult" },
  { pattern: "/dashboard/services/general-checkup" },
  { pattern: "/dashboard/services/parasite-control" },
  { pattern: "/dashboard/services/surgery" },
  { pattern: "/dashboard/services/vaccination" },
  { pattern: "/dashboard/services/grooming" },
  { pattern: "/dashboard/services/dental-checkup" },
  { pattern: "/dashboard/services/home-services" },
  { pattern: "/dashboard/services/pet-hotel" },
  { pattern: "/dashboard/services/special-services" },
  { pattern: "/dashboard/services" },
  { pattern: "/dashboard/my-pets/add" },
  { pattern: "/dashboard/my-pets" },
  { pattern: "/dashboard/todos" },
  { pattern: "/dashboard/profile" },
  { pattern: "/dashboard" },
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
      return { path: route.pattern, params };
    }
  }

  return { path: "/dashboard", params: {} };
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

export { DashboardRouterProvider, getRouteMatch, normalizePath, useNavigate, useParams };

