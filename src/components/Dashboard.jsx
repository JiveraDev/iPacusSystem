import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Home,
  ListTodo,
  LogOut,
  Menu,
  PawPrint,
  Plus,
  User,
  Video,
  X,
  FileText,
} from "lucide-react";

import logo from "../assets/circular_logo.png";
import { DashboardRouterProvider, getRouteMatch, normalizePath } from "./PetOwnerDashboard/dashboardRouter.jsx";
import { ToastViewport } from "../reusecomponent/toast.jsx";
import HomeScreen from "./PetOwnerDashboard/Home.jsx";
import ConsultScreen from "./PetOwnerDashboard/Consult.jsx";
import ConsultBookingScreen from "./PetOwnerDashboard/ConsultBooking.jsx";
import ConsultPaymentScreen from "./PetOwnerDashboard/ConsultPayment.jsx";
import ConsultConfirmationScreen from "./PetOwnerDashboard/ConsultConfirmation.jsx";
import VideoConsultationScreen from "./PetOwnerDashboard/VideoConsultation.jsx";
import ServicesScreen from "./PetOwnerDashboard/Services.jsx";
import GeneralCheckupScreen from "./PetOwnerDashboard/GeneralCheckup.jsx";
import ParasiteControlScreen from "./PetOwnerDashboard/ParasiteControl.jsx";
import SurgeryScreen from "./PetOwnerDashboard/Surgery.jsx";
import VaccinationScreen from "./PetOwnerDashboard/Vaccination.jsx";
import GroomingScreen from "./PetOwnerDashboard/Grooming.jsx";
import DentalCheckupScreen from "./PetOwnerDashboard/DentalCheckup.jsx";
import HomeServicesScreen from "./PetOwnerDashboard/HomeServices.jsx";
import HomeServiceConfirmationScreen from "./PetOwnerDashboard/HomeServiceConfirmation.jsx";
import PetHotelScreen from "./PetOwnerDashboard/PetHotel.jsx";
import SpecialServicesScreen from "./PetOwnerDashboard/SpecialServices.jsx";
import MyPetsScreen from "./PetOwnerDashboard/MyPets.jsx";
import AddPetScreen from "./PetOwnerDashboard/AddPet.jsx";
import PetProfileScreen from "./PetOwnerDashboard/PetProfile.jsx";
import MedicalRecordsScreen from "./PetOwnerDashboard/MedicalRecords.jsx";
import RequestUpdateRecordScreen from "./PetOwnerDashboard/RequestUpdateRecord.jsx";
import TodosScreen from "./PetOwnerDashboard/Todos.jsx";
import PetOwnerProfileScreen from "./PetOwnerDashboard/PetOwnerProfile.jsx";
import BookingManagement from "./AdminDashboardsComponent/BookingManagement.jsx";
import QueueManagement from "./AdminDashboardsComponent/QueueManagement.jsx";
import ConsentFilesManagement from "./AdminDashboardsComponent/ConsentFileManagement.jsx";
import PetRegister from "./AdminDashboardsComponent/PetRegister.jsx";
import AccountManagement from "./SuperAdminDashboardComponent/AccountManagement.jsx";
import QueueDashboard from "./PetOwnerDashboard/Self-Service_QUEUE.jsx";

const ALL_ROLES = ["Pet Owner", "pet_owner", "Admin", "Veterinarian", "Super Admin"];

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/dashboard", roles: ALL_ROLES },
  { id: "consult", label: "Consult", icon: Video, path: "/dashboard/consult", roles: ALL_ROLES },
  { id: "services", label: "Services", icon: Calendar, path: "/dashboard/services", roles: ALL_ROLES },
  { id: "pets", label: "My Pets", icon: PawPrint, path: "/dashboard/my-pets", roles: ALL_ROLES },
  { id: "pet-register", label: "Pet Register", icon: Plus, path: "/dashboard/pet-register", roles: ALL_ROLES },
  { id: "bookings", label: "Bookings", icon: Calendar, path: "/dashboard/bookings", roles: ALL_ROLES },
  { id: "queue", label: "Queue", icon: ListTodo, path: "/dashboard/queue", roles: ALL_ROLES },
  { id: "self-service-queue", label: "Self-Service Queue", icon: ListTodo, path: "/dashboard/self-service-queue", roles: ALL_ROLES },
  { id: "consent", label: "Consent Files", icon: FileText, path: "/dashboard/consent" , roles: ALL_ROLES },
  { id: "accounts", label: "Accounts", icon: User, path: "/dashboard/accounts", roles: ALL_ROLES },
  { id: "todos", label: "TODOs", icon: ListTodo, path: "/dashboard/todos", roles: ALL_ROLES },
  { id: "profile", label: "Profile", icon: User, path: "/dashboard/profile" , roles: ALL_ROLES },
];

const screenMap = {
  "/dashboard": HomeScreen,
  "/dashboard/consult": ConsultScreen,
  "/dashboard/consult/booking": ConsultBookingScreen,
  "/dashboard/consult/payment": ConsultPaymentScreen,
  "/dashboard/consult/confirmation/:bookingId": ConsultConfirmationScreen,
  "/dashboard/consult/video/:consultationId": VideoConsultationScreen,
  "/dashboard/services": ServicesScreen,
  "/dashboard/services/general-checkup": GeneralCheckupScreen,
  "/dashboard/services/parasite-control": ParasiteControlScreen,
  "/dashboard/services/surgery": SurgeryScreen,
  "/dashboard/services/vaccination": VaccinationScreen,
  "/dashboard/services/grooming": GroomingScreen,
  "/dashboard/services/dental-checkup": DentalCheckupScreen,
  "/dashboard/services/home-services": HomeServicesScreen,
  "/dashboard/consult/confirmation/home-service": HomeServiceConfirmationScreen,
  "/dashboard/services/pet-hotel": PetHotelScreen,
  "/dashboard/services/special-services": SpecialServicesScreen,
  "/dashboard/my-pets": MyPetsScreen,
  "/dashboard/my-pets/add": AddPetScreen,
  "/dashboard/my-pets/:petId": PetProfileScreen,
  "/dashboard/my-pets/:petId/medical-records": MedicalRecordsScreen,
  "/dashboard/my-pets/:petId/request-update": RequestUpdateRecordScreen,
  "/dashboard/pet-register": PetRegister,
  "/dashboard/bookings": BookingManagement,
  "/dashboard/queue": QueueManagement,
  "/dashboard/consent": ConsentFilesManagement,
  "/dashboard/accounts": AccountManagement,
  "/dashboard/self-service-queue": QueueDashboard,
  "/dashboard/todos": TodosScreen,
  "/dashboard/profile": PetOwnerProfileScreen,
};

function getUserValue(user, keys, fallback = "") {
  for (const key of keys) {
    if (user?.[key]) {
      return user[key];
    }
  }

  return fallback;
}

function buildStoredUser(user) {
  const id = getUserValue(user, ["id", "userId", "user_id"], Date.now().toString());
  const email = getUserValue(user, ["email"]);
  const firstName = getUserValue(user, ["firstName", "FirstName", "first_name"]);
  const lastName = getUserValue(user, ["lastName", "LastName", "last_name"]);
  const phone = getUserValue(user, ["phone", "phoneNumber"]);
  const address = getUserValue(user, ["address"]);

  return {
    ...user,
    id,
    email,
    firstName,
    lastName,
    phone,
    address,
    pets: Array.isArray(user?.pets) ? user.pets : [],
    todos: Array.isArray(user?.todos) ? user.todos : [],
    consultations: Array.isArray(user?.consultations) ? user.consultations : [],
    serviceBookings: Array.isArray(user?.serviceBookings) ? user.serviceBookings : [],
  };
}

function getActiveTab(path) {
  if (path.startsWith("/dashboard/consult/confirmation/home-service")) {
    return "services";
  }
  if (path.startsWith("/dashboard/consult")) {
    return "consult";
  }
  if (path.startsWith("/dashboard/services")) {
    return "services";
  }
  if (path.startsWith("/dashboard/my-pets")) {
    return "pets";
  }
  if (path.startsWith("/dashboard/pet-register")) {
    return "pet-register";
  }
  if (path.startsWith("/dashboard/bookings")) {
    return "bookings";
  }
  if (path.startsWith("/dashboard/queue")) {
    return "queue";
  }
  if (path.startsWith("/dashboard/self-service-queue")) {
    return "self-service-queue";
  }
  if (path.startsWith("/dashboard/consent")) {
    return "consent";
  }
  if (path.startsWith("/dashboard/accounts")) {
    return "accounts";
  }
  if (path.startsWith("/dashboard/todos")) {
    return "todos";
  }
  if (path.startsWith("/dashboard/profile")) {
    return "profile";
  }
  return "home";
}

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  // Session control check
  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser && !user) {
      window.location.href = "/landing/login";
    }
  }, [user]);

  const [historyStack, setHistoryStack] = useState(() => [normalizePath(window.location.pathname)]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => window.innerWidth < 960);

  useEffect(() => {
    const handlePopState = () => {
      setHistoryStack((current) => {
        const nextPath = normalizePath(window.location.pathname);
        if (current[current.length - 1] === nextPath) {
          return current;
        }
        return [...current, nextPath];
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (target) => {
    if (typeof target === "number") {
      window.history.go(target);
      return;
    }

    const nextPath = normalizePath(target);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    
    setHistoryStack((current) => {
      if (current[current.length - 1] === nextPath) {
        return current;
      }

      return [...current, nextPath];
    });
    setIsMobileNavOpen(false);
  };

  useEffect(() => {
    // Ensure the initial user exists in the local 'users' array for compatibility,
    // but don't constantly overwrite the 'currentUser' from that list.
    if (user) {
      const storedUser = buildStoredUser(user);
      const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
      const existingIndex = existingUsers.findIndex((entry) => (entry.id === storedUser.id || entry.user_id === storedUser.id));

      if (existingIndex === -1) {
        existingUsers.push(storedUser);
        localStorage.setItem("users", JSON.stringify(existingUsers));
      }
    }
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 960;
      setIsCompactLayout(compact);

      if (!compact) {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentPath = historyStack[historyStack.length - 1];
  const routeMatch = getRouteMatch(currentPath);
  const activeTab = getActiveTab(currentPath);

  const userRole = getUserValue(user, ["role"]);

  // Filter nav items based on roles if specified
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (!item.roles) return true;
      return item.roles.includes(userRole);
    });
  }, [userRole]);

  // Authorization check for the current route
  const ScreenComponent = useMemo(() => {
    const Component = screenMap[routeMatch.path] ?? HomeScreen;
    
    // Check if the current user role is allowed for this route
    if (routeMatch.allowedRoles && !routeMatch.allowedRoles.includes(userRole)) {
      return () => (
        <div className="flex flex-col items-center justify-center h-full text-center p-10">
          <X className="size-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">You do not have permission to access this page.</p>
          <p className="text-xs text-slate-400 mb-6">Required: {routeMatch.allowedRoles.join(", ")} | Your Role: {userRole}</p>
          <button 
            onClick={() => navigate("/dashboard")}
            className="bg-[#155dfc] text-white px-6 py-2 rounded-xl font-medium"
          >
            Go to Home
          </button>
        </div>
      );
    }
    
    return Component;
  }, [routeMatch.path, routeMatch.allowedRoles, userRole, navigate]);

  const displayName = useMemo(() => {
    const firstName = getUserValue(user, ["firstName", "FirstName", "first_name"]);
    const lastName = getUserValue(user, ["lastName", "LastName", "last_name"]);
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || getUserValue(user, ["email"], "Pet Owner");
  }, [user]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {!isCompactLayout && (
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
          <img src={logo} alt="iPawcus logo" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-lg font-bold text-[#155dfc]">iPawcus</p>
            <p className="text-sm text-slate-500">Pet owner dashboard</p>
          </div>
        </div>
      )}

      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <nav className="space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeTab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                    isActive ? "bg-[#155dfc] text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="mb-4 rounded-2xl bg-slate-100 p-4">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-semibold">{displayName}</p>
            <p className="text-sm text-slate-600">{getUserValue(user, ["role"])}</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-red-200 px-4 py-3 text-left text-red-600 transition hover:bg-red-50 hover:text-red-700 active:bg-red-100"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardRouterProvider value={{ currentPath, navigate, params: routeMatch.params, onUserUpdate, user }}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <ToastViewport />
        <div
          className={`mx-auto flex min-h-screen max-w-7xl ${isCompactLayout ? "" : "pl-72"}`}
          style={{ flexDirection: isCompactLayout ? "column" : "row" }}
        >
          {isCompactLayout ? (
            <>
              <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <img src={logo} alt="iPawcus logo" className="h-10 w-10 object-contain" />
                  <div>
                    <p className="text-base font-bold text-[#155dfc]">iPawcus</p>
                    <p className="text-xs text-slate-500">Dashboard</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen((current) => !current)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
                  aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
                >
                  {isMobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </header>

              <div
                className={`fixed inset-0 z-40 bg-slate-950/25 transition-opacity duration-300 ${
                  isMobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setIsMobileNavOpen(false)}
              />

              <aside
                className={`mobile-dashboard-drawer fixed left-0 top-0 z-50 h-full w-[18rem] max-w-[85vw] border-r border-slate-200 bg-white shadow-2xl ${
                  isMobileNavOpen ? "open" : ""
                }`}
              >
                {sidebarContent}
              </aside>
            </>
          ) : (
            <aside className="fixed left-0 top-0 h-screen w-72 border-r border-slate-200 bg-white">{sidebarContent}</aside>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-10">
            {/* eslint-disable-next-line react-hooks/static-components */}
            <ScreenComponent />
          </main>
        </div>
      </div>
    </DashboardRouterProvider>
  );
}
