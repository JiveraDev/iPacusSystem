import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Heart,
  Home,
  ListTodo,
  LogOut,
  Menu,
  PawPrint,
  User,
  Video,
  X,
} from "lucide-react";

import logo from "../assets/circular_logo.png";
import { DashboardRouterProvider, getRouteMatch, normalizePath } from "./PetOwnerDashboard/dashboardRouter.jsx";
import { ToastViewport } from "./PetOwnerDashboard/toast.jsx";
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
import PetHotelScreen from "./PetOwnerDashboard/PetHotel.jsx";
import SpecialServicesScreen from "./PetOwnerDashboard/SpecialServices.jsx";
import MyPetsScreen from "./PetOwnerDashboard/MyPets.jsx";
import AddPetScreen from "./PetOwnerDashboard/AddPet.jsx";
import PetProfileScreen from "./PetOwnerDashboard/PetProfile.jsx";
import MedicalRecordsScreen from "./PetOwnerDashboard/MedicalRecords.jsx";
import RequestUpdateRecordScreen from "./PetOwnerDashboard/RequestUpdateRecord.jsx";
import TodosScreen from "./PetOwnerDashboard/Todos.jsx";
import ProfileScreen from "./PetOwnerDashboard/Profile.jsx";

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/dashboard" },
  { id: "consult", label: "Consult", icon: Video, path: "/dashboard/consult" },
  { id: "services", label: "Services", icon: Calendar, path: "/dashboard/services" },
  { id: "pets", label: "My Pets", icon: PawPrint, path: "/dashboard/my-pets" },
  { id: "todos", label: "TODOs", icon: ListTodo, path: "/dashboard/todos" },
  { id: "profile", label: "Profile", icon: User, path: "/dashboard/profile" },
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
  "/dashboard/services/pet-hotel": PetHotelScreen,
  "/dashboard/services/special-services": SpecialServicesScreen,
  "/dashboard/my-pets": MyPetsScreen,
  "/dashboard/my-pets/add": AddPetScreen,
  "/dashboard/my-pets/:petId": PetProfileScreen,
  "/dashboard/my-pets/:petId/medical-records": MedicalRecordsScreen,
  "/dashboard/my-pets/:petId/request-update": RequestUpdateRecordScreen,
  "/dashboard/todos": TodosScreen,
  "/dashboard/profile": ProfileScreen,
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
  if (path.startsWith("/dashboard/consult")) {
    return "consult";
  }
  if (path.startsWith("/dashboard/services")) {
    return "services";
  }
  if (path.startsWith("/dashboard/my-pets")) {
    return "pets";
  }
  if (path.startsWith("/dashboard/todos")) {
    return "todos";
  }
  if (path.startsWith("/dashboard/profile")) {
    return "profile";
  }
  return "home";
}

export default function Dashboard({ user, onLogout }) {
  const [historyStack, setHistoryStack] = useState(["/dashboard"]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => window.innerWidth < 960);

  useEffect(() => {
    const storedUser = buildStoredUser(user);
    const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const existingIndex = existingUsers.findIndex((entry) => entry.id === storedUser.id);

    if (existingIndex === -1) {
      existingUsers.push(storedUser);
    } else {
      existingUsers[existingIndex] = {
        ...existingUsers[existingIndex],
        ...storedUser,
        pets: existingUsers[existingIndex].pets ?? storedUser.pets,
        todos: existingUsers[existingIndex].todos ?? storedUser.todos,
        consultations: existingUsers[existingIndex].consultations ?? storedUser.consultations,
        serviceBookings: existingUsers[existingIndex].serviceBookings ?? storedUser.serviceBookings,
      };
    }

    localStorage.setItem("users", JSON.stringify(existingUsers));
    localStorage.setItem("currentUser", JSON.stringify(existingUsers.find((entry) => entry.id === storedUser.id)));
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
  const ScreenComponent = screenMap[routeMatch.path] ?? HomeScreen;
  const activeTab = getActiveTab(currentPath);

  const displayName = useMemo(() => {
    const firstName = getUserValue(user, ["firstName", "FirstName", "first_name"]);
    const lastName = getUserValue(user, ["lastName", "LastName", "last_name"]);
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || getUserValue(user, ["email"], "Pet Owner");
  }, [user]);

  const navigate = (target) => {
    if (typeof target === "number") {
      setHistoryStack((current) => {
        if (target >= 0 || current.length <= 1) {
          return current;
        }

        const nextLength = Math.max(1, current.length + target);
        return current.slice(0, nextLength);
      });
      setIsMobileNavOpen(false);
      return;
    }

    const nextPath = normalizePath(target);
    setHistoryStack((current) => {
      if (current[current.length - 1] === nextPath) {
        return current;
      }

      return [...current, nextPath];
    });
    setIsMobileNavOpen(false);
  };

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

      <div className="flex h-full flex-col p-4">
        <nav className="space-y-2">
          {navItems.map((item) => {
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

        <div className="mt-auto pt-6">
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
    <DashboardRouterProvider value={{ currentPath, navigate, params: routeMatch.params }}>
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
            <ScreenComponent />
          </main>
        </div>
      </div>
    </DashboardRouterProvider>
  );
}
