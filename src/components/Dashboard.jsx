import { useEffect, useMemo, useState, lazy, Suspense } from "react";
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
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import logo from "../assets/circular_logo.png";
import { DashboardRouterProvider, getRouteMatch, normalizePath } from "./PetOwnerDashboard/dashboardRouter.jsx";
import { ToastViewport } from "../reusecomponent/toast.jsx";

// Lazy load screens
const HomeScreen = lazy(() => import("./PetOwnerDashboard/Home.jsx"));
const ConsultScreen = lazy(() => import("./PetOwnerDashboard/Consult.jsx"));
const ConsultBookingScreen = lazy(() => import("./PetOwnerDashboard/ConsultBooking.jsx"));
const ConsultPaymentScreen = lazy(() => import("./PetOwnerDashboard/ConsultPayment.jsx"));
const ConsultConfirmationScreen = lazy(() => import("./PetOwnerDashboard/ConsultConfirmation.jsx"));
const VideoConsultationScreen = lazy(() => import("./PetOwnerDashboard/VideoConsultation.jsx"));
const ServicesScreen = lazy(() => import("./PetOwnerDashboard/Services.jsx"));
const GeneralCheckupScreen = lazy(() => import("./PetOwnerDashboard/GeneralCheckup.jsx"));
const ParasiteControlScreen = lazy(() => import("./PetOwnerDashboard/ParasiteControl.jsx"));
const SurgeryScreen = lazy(() => import("./PetOwnerDashboard/Surgery.jsx"));
const VaccinationScreen = lazy(() => import("./PetOwnerDashboard/Vaccination.jsx"));
const GroomingScreen = lazy(() => import("./PetOwnerDashboard/Grooming.jsx"));
const DentalCheckupScreen = lazy(() => import("./PetOwnerDashboard/DentalCheckup.jsx"));
const HomeServicesScreen = lazy(() => import("./PetOwnerDashboard/HomeServices.jsx"));
const HomeServiceConfirmationScreen = lazy(() => import("./PetOwnerDashboard/HomeServiceConfirmation.jsx"));
const PetHotelScreen = lazy(() => import("./PetOwnerDashboard/PetHotel.jsx"));
const SpecialServicesScreen = lazy(() => import("./PetOwnerDashboard/SpecialServices.jsx"));
const MyPetsScreen = lazy(() => import("./PetOwnerDashboard/MyPets.jsx"));
const AddPetScreen = lazy(() => import("./PetOwnerDashboard/AddPet.jsx"));
const PetProfileScreen = lazy(() => import("./PetOwnerDashboard/PetProfile.jsx"));
const MedicalRecordsScreen = lazy(() => import("./PetOwnerDashboard/MedicalRecords.jsx"));
const RequestUpdateRecordScreen = lazy(() => import("./PetOwnerDashboard/RequestUpdateRecord.jsx"));
const TodosScreen = lazy(() => import("./PetOwnerDashboard/Todos.jsx"));
const PetOwnerProfileScreen = lazy(() => import("./PetOwnerDashboard/PetOwnerProfile.jsx"));
const BookingManagement = lazy(() => import("./AdminDashboardsComponent/BookingManagement.jsx"));
const QueueManagement = lazy(() => import("./AdminDashboardsComponent/QueueManagement.jsx"));
const ConsentFilesManagement = lazy(() => import("./AdminDashboardsComponent/ConsentFileManagement.jsx"));
const PetRegister = lazy(() => import("./AdminDashboardsComponent/PetRegister.jsx"));
const AccountManagement = lazy(() => import("./SuperAdminDashboardComponent/AccountManagement.jsx"));
const QueueDashboard = lazy(() => import("./PetOwnerDashboard/Self-Service_QUEUE.jsx"));

// Inventory Components
const AllItemsPage = lazy(() => import("./AdminDashboardsComponent/AllItemsPage.jsx"));
const AddNewItemPage = lazy(() => import("./AdminDashboardsComponent/AddNewItemPage.jsx"));
const StockInPage = lazy(() => import("./AdminDashboardsComponent/StockInPage.jsx"));
const LowStockPage = lazy(() => import("./AdminDashboardsComponent/LowStockPage.jsx"));
const NearExpiryPage = lazy(() => import("./AdminDashboardsComponent/NearExpiryPage.jsx"));
const DisposalLogsPage = lazy(() => import("./AdminDashboardsComponent/DisposalLogsPage.jsx"));

const ALL_ROLES = ["Pet Owner", "pet_owner", "Admin", "Veterinarian", "Super Admin"];
const ADMIN_ROLES = ["Admin", "Super Admin"];

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/dashboard", roles: ALL_ROLES },
  { id: "consult", label: "Consult", icon: Video, path: "/dashboard/consult", roles: ALL_ROLES },
  { id: "services", label: "Services", icon: Calendar, path: "/dashboard/services", roles: ALL_ROLES },
  { id: "pets", label: "My Pets", icon: PawPrint, path: "/dashboard/my-pets", roles: ALL_ROLES },
  { id: "pet-register", label: "Pet Register", icon: Plus, path: "/dashboard/pet-register", roles: ALL_ROLES },
  { id: "bookings", label: "Bookings", icon: Calendar, path: "/dashboard/bookings", roles: ALL_ROLES },
  { id: "queue", label: "Queue", icon: ListTodo, path: "/dashboard/queue", roles: ALL_ROLES },
  { 
    id: "inventory", 
    label: "Inventory", 
    icon: Package, 
    path: "/dashboard/inventory",
    subItems: [
      { id: "all-items", label: "All Items", path: "/dashboard/inventory" },
      { id: "add-item", label: "Add New Item", path: "/dashboard/inventory/add" },
      { id: "stock-in", label: "Stock In", path: "/dashboard/inventory/stock-in" },
    ]
  },
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
  "/dashboard/inventory": AllItemsPage,
  "/dashboard/inventory/add": AddNewItemPage,
  "/dashboard/inventory/stock-in": StockInPage,
  "/dashboard/inventory/low-stock": LowStockPage,
  "/dashboard/inventory/near-expiry": NearExpiryPage,
  "/dashboard/inventory/disposal": DisposalLogsPage,
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
  if (path.startsWith("/dashboard/inventory")) {
    return "inventory";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        <div className={`flex items-center border-b border-slate-200 px-4 py-5 h-[89px] transition-all duration-500 ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <div className={`flex items-center transition-all duration-500 ease-in-out overflow-hidden ${isSidebarCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-xs opacity-100 gap-3"}`}>
            <img src={logo} alt="iPawcus logo" className="h-10 w-10 min-w-10 object-contain" />
            <div className="whitespace-nowrap">
              <p className="text-lg font-bold text-[#155dfc]">iPawcus</p>
              <p className="text-xs text-slate-500">Dashboard</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      )}

      {isCompactLayout && (
         <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 flex-shrink-0">
           <img src={logo} alt="iPawcus logo" className="h-12 w-12 object-contain" />
           <div>
             <p className="text-lg font-bold text-[#155dfc]">iPawcus</p>
             <p className="text-sm text-slate-500">Pet owner dashboard</p>
           </div>
         </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <nav className="space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeTab;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    title={isSidebarCollapsed ? item.label : ""}
                    className={`flex items-center rounded-xl py-3 text-left transition-all duration-300 ease-in-out ${
                      isSidebarCollapsed ? "justify-center px-0 w-12 mx-auto" : "gap-3 px-4 w-full"
                    } ${
                      isActive ? "bg-[#155dfc] text-white shadow-md shadow-blue-200" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-5 w-5 min-w-5 flex-shrink-0 transition-transform duration-300 ${isActive ? "scale-110" : ""}`} />
                    <span className={`font-medium whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden ${
                      isSidebarCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3"
                    }`}>
                      {item.label}
                    </span>
                  </button>
                  
                  {hasSubItems && !isSidebarCollapsed && (
                    <div className={`ml-12 space-y-1 overflow-hidden transition-all duration-500 ${
                      isActive ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
                    }`}>
                      {item.subItems.map((subItem) => {
                        const isSubActive = currentPath === normalizePath(subItem.path);
                        return (
                          <button
                            key={subItem.id}
                            type="button"
                            onClick={() => navigate(subItem.path)}
                            className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm transition-colors duration-200 ${
                              isSubActive 
                                ? "bg-blue-50 text-[#155dfc] font-bold" 
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate">{subItem.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className={`mb-4 transition-all duration-500 ease-in-out ${
            isSidebarCollapsed ? "w-12 mx-auto bg-transparent" : "rounded-2xl bg-slate-100 p-4 w-full"
          }`}>
            <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : ""}`}>
              <div className="relative flex-shrink-0">
                {getUserValue(user, ["profileImage", "profile_image", "setProfilePic_url"]) ? (
                  <img 
                    src={getUserValue(user, ["profileImage", "profile_image", "setProfilePic_url"])} 
                    alt={displayName}
                    className={`rounded-full object-cover border-2 transition-all duration-500 shadow-sm ${
                      isSidebarCollapsed ? "h-10 w-10 border-[#155dfc]" : "h-12 w-12 border-white"
                    }`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=155dfc&color=fff`;
                    }}
                  />
                ) : (
                  <div className={`rounded-full bg-[#155dfc] flex items-center justify-center text-white font-bold shadow-sm transition-all duration-500 ${
                    isSidebarCollapsed ? "h-10 w-10 text-base" : "h-12 w-12 text-lg"
                  }`}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className={`min-w-0 transition-all duration-500 overflow-hidden whitespace-nowrap ${
                isSidebarCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3 flex-1"
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
                <p className="font-bold truncate text-slate-900">{displayName}</p>
                <p className="text-xs font-medium text-[#155dfc] truncate">{getUserValue(user, ["role"])}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title={isSidebarCollapsed ? "Log Out" : ""}
            className={`flex w-full items-center rounded-xl border border-red-200 py-3 text-left text-red-600 transition-all duration-500 hover:bg-red-50 hover:text-red-700 active:bg-red-100 px-4`}
          >
            <LogOut className="h-5 w-5 min-w-5 flex-shrink-0" />
            <span className={`font-medium whitespace-nowrap transition-all duration-500 overflow-hidden ${
              isSidebarCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3"
            }`}>
              Log Out
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardRouterProvider value={{ currentPath, navigate, params: routeMatch.params, onUserUpdate, user }}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <ToastViewport />
        
        {isCompactLayout && (
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
        )}

        <div className="flex min-h-screen">
          {isCompactLayout ? (
            <>
              <div
                className={`fixed inset-0 z-40 bg-slate-950/25 transition-opacity duration-300 ${
                  isMobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setIsMobileNavOpen(false)}
              />

              <aside
                className={`mobile-dashboard-drawer fixed left-0 top-0 z-50 h-full w-[18rem] max-w-[85vw] border-r border-slate-200 bg-white shadow-2xl transition-all duration-300 flex flex-col ${
                  isMobileNavOpen ? "open" : ""
                }`}
              >
                {sidebarContent}
              </aside>
            </>
          ) : (
            <aside 
              className={`fixed left-0 top-0 h-screen transition-all duration-300 border-r border-slate-200 bg-white z-40 ${
                isSidebarCollapsed ? "w-20" : "w-72"
              }`}
            >
              {sidebarContent}
            </aside>
          )}

          <div 
            className={`flex-1 transition-all duration-300 ${
              !isCompactLayout ? (isSidebarCollapsed ? "pl-20" : "pl-72") : ""
            }`}
          >
            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
              <Suspense fallback={
                <div className="flex h-64 w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
                    <p className="text-sm font-medium text-slate-500">Loading page...</p>
                  </div>
                </div>
              }>
                {/* eslint-disable-next-line react-hooks/static-components */}
                <ScreenComponent />
              </Suspense>
            </main>
          </div>
        </div>
      </div>
    </DashboardRouterProvider>
  );
}
