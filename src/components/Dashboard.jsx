import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  BookOpenCheck,
  Boxes,
  BriefcaseMedical,
  CalendarCheck2,
  CalendarDays,
  ChartColumnIncreasing,
  CircleDollarSign,
  Home,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPenLine,
  ClipboardPlus,
  FileClock,
  FilePenLine,
  Images,
  ListChecks,
  LogOut,
  Menu,
  MonitorPlay,
  NotebookTabs,
  PawPrint,
  ScanLine,
  Video,
  X,
  Stethoscope,
  History,
  Hotel,
  ChevronLeft,
  ChevronRight,
  UserCog,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";

import logo from "../assets/circular_logo.png";
import { DashboardRouterProvider, getRouteMatch, normalizePath } from "./dashboardRouter.jsx";
import { resolveImageUrl } from "../lib/image";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { ToastViewport } from "../reusecomponent/toast.jsx";
import { toast } from "../reusecomponent/toast.jsx";
import NotificationBell from "./shared/NotificationBell.jsx";
import { VideoCallProvider } from "../context/VideoCallProvider.jsx";

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
const BookingManagement = lazy(() => import("./AdminDashboardsComponent/BookingManagement.jsx"));
const RecordUpdateRequestsManagement = lazy(() => import("./AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx"));
const PetBoardingManagement = lazy(() => import("./AdminDashboardsComponent/PetBoardingManagement.jsx"));
const QueueManagement = lazy(() => import("./AdminDashboardsComponent/QueueManagement.jsx"));
const POSManagement = lazy(() => import("./AdminDashboardsComponent/POSmanagement.jsx"));
const ServiceCatalogManagement = lazy(() => import("./AdminDashboardsComponent/ServiceCatalogManagement.jsx"));
const ConsentFilesManagement = lazy(() => import("./AdminDashboardsComponent/ConsentFileManagement.jsx"));
const PetRegister = lazy(() => import("./AdminDashboardsComponent/PetRegister.jsx"));
const PetProfileEdit = lazy(() => import("./AdminDashboardsComponent/PetProfileEdit.jsx"));
const AccountManagement = lazy(() => import("./SuperAdminDashboardComponent/AccountManagement.jsx"));
const PaymentMethodsManagement = lazy(() => import("./SuperAdminDashboardComponent/PaymentMethodsManagement.jsx"));
const SuperAdminReportsDashboard = lazy(() => import("./SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx"));
const SuperAdminReportCenter = lazy(() => import("./SuperAdminDashboardComponent/SuperAdminReportCenter.jsx"));
const PetOwnerAccountsManagement = lazy(() => import("./SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx"));
const PetMediaMonitoring = lazy(() => import("./SuperAdminDashboardComponent/PetMediaMonitoring.jsx"));
const QueueDashboard = lazy(() => import("./PetOwnerDashboard/Self-Service_QUEUE.jsx"));
const AllItemsPage = lazy(() => import("./AdminDashboardsComponent/AllItemsPage.jsx"));
const AddNewItemPage = lazy(() => import("./AdminDashboardsComponent/AddNewItemPage.jsx"));
const StockInPage = lazy(() => import("./AdminDashboardsComponent/StockInPage.jsx"));
const LowStockPage = lazy(() => import("./AdminDashboardsComponent/LowStockPage.jsx"));
const NearExpiryPage = lazy(() => import("./AdminDashboardsComponent/NearExpiryPage.jsx"));
const DisposalLogsPage = lazy(() => import("./AdminDashboardsComponent/DisposalLogsPage.jsx"));
const AdminProfile = lazy(() => import("./AdminDashboardsComponent/adminprofile.jsx"));
const VetProfile = lazy(() => import("./VetrinarianComponents/VetProfile.jsx"));
const ApprovedQueueList = lazy(() => import("./VetrinarianComponents/ApprovedQueueList.jsx"));
const VetMylistinService = lazy(() => import("./VetrinarianComponents/VetMylistinService.jsx"));
const VetDiagnosis = lazy(() => import("./VetrinarianComponents/VetDiagnosis.jsx"));
const VetDiagnosisHistory = lazy(() => import("./VetrinarianComponents/VetDiagnosisHistory.jsx"));
const VetPetsEMR = lazy(() => import("./VetrinarianComponents/VetPetsEMR.jsx"));
const VetRecordUpdateRequests = lazy(() => import("./VetrinarianComponents/VetRecordUpdateRequests.jsx"));
const ApprovedOnlineConsultation = lazy(() => import("./VetrinarianComponents/ApprovedOnlineConsultation.jsx"));
const VetOnlineConsultDiagnosis = lazy(() => import("./VetrinarianComponents/VetOnlineConsultDiagnosis.jsx"));
const PetOwnerProfile = lazy(() => import("./PetOwnerDashboard/PetOwnerProfile.jsx"));
const NotificationsPage = lazy(() => import("./shared/NotificationsPage.jsx"));



// debug bypas starts here

const DEBUG_BYPASS = false;

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
const MEDIA_MONITORING_ROLES = [...new Set([...SUPERADMIN_ROLES, ...VETERINARIAN_ROLES])];
const TODO_ROLES = [...new Set([...PETOWNER_ROLES, ...VETERINARIAN_ROLES])];
const PETS_DIRECTORY_LABEL_ROLES = ["admin", "veterinarian", "super admin"];
const SUPERADMIN_NAV_GROUPS = [
  { id: "superadmin", label: "Super Admin Navs" },
  { id: "admin", label: "Admin Navs" },
  { id: "veterinarian", label: "Veterinarian Navs" },
  { id: "petowner", label: "Pet Owner Navs" },
];

function getNavItemLabel(item, userRole) {
  if (item.id === "home" && ["super admin", "super_admin", "superadmin"].includes(String(userRole || "").toLowerCase())) {
    return "Reports Dashboard";
  }

  if (item.id === "pets" && PETS_DIRECTORY_LABEL_ROLES.includes(String(userRole || "").toLowerCase())) {
    return "Pets Directory";
  }

  return item.label;
}

function getNavItemIcon(item, userRole) {
  if (item.id === "home" && ["super admin", "super_admin", "superadmin"].includes(String(userRole || "").toLowerCase())) {
    return ChartColumnIncreasing;
  }

  return item.icon;
}

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/dashboard", roles: ALL_ROLES, navGroup: "superadmin" },
  { id: "consult", label: "Consult", icon: MonitorPlay, path: "/dashboard/consult", roles: PETOWNER_ROLES, navGroup: "petowner" },
  { id: "services", label: "Services", icon: BriefcaseMedical, path: "/dashboard/services", roles: SERVICE_ROLES, navGroup: "admin" },
  { id: "pets", label: "My Pets", icon: PawPrint, path: "/dashboard/my-pets", roles: ALL_ROLES, navGroup: "admin" },
  { id: "pet-register", label: "Pet Register", icon: ClipboardPlus, path: "/dashboard/pet-register", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "bookings", label: "Bookings", icon: CalendarCheck2, path: "/dashboard/bookings", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "record-requests", label: "Record Requests", icon: ClipboardPenLine, path: "/dashboard/record-requests", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "boarding", label: "Boarding", icon: Hotel, path: "/dashboard/boarding", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "queue", label: "Queue", icon: ListChecks, path: "/dashboard/queue", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "pos", label: "Point-Of-Sale", icon: CircleDollarSign, path: "/dashboard/pos", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "service-catalog", label: "Service Catalog", icon: BookOpenCheck, path: "/dashboard/service-catalog", roles: ADMIN_ROLES, navGroup: "admin" },
  { 
    id: "inventory", 
    label: "Inventory", 
    icon: Boxes,
    path: "/dashboard/inventory",
    subItems: [
      { id: "all-items", label: "All Items", path: "/dashboard/inventory" },
      { id: "add-item", label: "Add New Item", path: "/dashboard/inventory/add" },
      { id: "stock-in", label: "Stock In", path: "/dashboard/inventory/stock-in" },
    ], roles: ADMIN_ROLES,
    navGroup: "admin"
  },
  { id: "self-service-queue", label: "Self-Service Queue", icon: ScanLine, path: "/dashboard/self-service-queue", roles: PETOWNER_ROLES, navGroup: "petowner" },
  { id: "consent", label: "Consent Files", icon: FilePenLine, path: "/dashboard/consent" , roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "vet-approved-queue", label: "Approved List", icon: ClipboardCheck, path: "/dashboard/vet/approved-queue", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "vet-my-list", label: "My List", icon: Stethoscope, path: "/dashboard/vet/my-list", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "vet-medical-records", label: "Medical Records", icon: NotebookTabs, path: "/dashboard/vet/medical-records", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "vet-record-requests", label: "Record Requests", icon: FileClock, path: "/dashboard/vet/record-requests", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "vet-online-consults", label: "Online Consults", icon: Video, path: "/dashboard/vet/online-consultations", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "vet-histories", label: "Histories", icon: History, path: "/dashboard/vet/histories", roles: VETERINARIAN_ROLES, navGroup: "veterinarian" },
  { id: "pet-media-monitoring", label: "Pet Media Monitoring", icon: Images, path: "/dashboard/pet-media-monitoring", roles: MEDIA_MONITORING_ROLES, navGroup: "superadmin" },
  { id: "accounts", label: "Accounts", icon: UserCog, path: "/dashboard/accounts", roles: SUPERADMIN_ROLES, navGroup: "superadmin" },
  { id: "pet-owner-accounts", label: "Pet Owners", icon: UserRoundCheck, path: "/dashboard/pet-owner-accounts", roles: SUPERADMIN_ROLES, navGroup: "superadmin" },
  { id: "payment-methods", label: "Payment Methods", icon: WalletCards, path: "/dashboard/payment-methods", roles: SUPERADMIN_ROLES, navGroup: "superadmin" },
  { id: "todos", label: "Schedule / TODOs", icon: CalendarDays, path: "/dashboard/todos", roles: TODO_ROLES, navGroup: "veterinarian" },
];

const screenMap = {
  "/dashboard": (props = {}) => {
    const role = normalizeRole(getUserValue(props.user, ["role"]));

    if (role === "super_admin" || role === "superadmin") {
      return <SuperAdminReportsDashboard {...props} />;
    }

    return <HomeScreen {...props} />;
  },
  "/dashboard/consult": ConsultScreen,
  "/dashboard/notifications": NotificationsPage,
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
  "/dashboard/pet-register/:petId": PetProfileEdit,
  "/dashboard/bookings": BookingManagement,
  "/dashboard/record-requests": RecordUpdateRequestsManagement,
  "/dashboard/boarding": PetBoardingManagement,
  "/dashboard/queue": QueueManagement,
  "/dashboard/pos": POSManagement,
  "/dashboard/service-catalog": ServiceCatalogManagement,
  "/dashboard/consent": ConsentFilesManagement,
  "/dashboard/vet/approved-queue": ApprovedQueueList,
  "/dashboard/vet/my-list": VetMylistinService,
  "/dashboard/vet/diagnosis": VetDiagnosis,
  "/dashboard/vet/medical-records": VetPetsEMR,
  "/dashboard/vet/record-requests": VetRecordUpdateRequests,
  "/dashboard/vet/histories": VetDiagnosisHistory,
  "/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis": VetOnlineConsultDiagnosis,
  "/dashboard/vet/online-consultations": ApprovedOnlineConsultation,
  "/dashboard/reports": SuperAdminReportsDashboard,
  "/dashboard/reports/export": SuperAdminReportCenter,
  "/dashboard/pet-media-monitoring": PetMediaMonitoring,
  "/dashboard/accounts": AccountManagement,
  "/dashboard/pet-owner-accounts": PetOwnerAccountsManagement,
  "/dashboard/payment-methods": PaymentMethodsManagement,
  "/dashboard/self-service-queue": QueueDashboard,
  "/dashboard/todos": TodosScreen,
  "/dashboard/profile": (props = {}) => {
    const role = normalizeRole(getUserValue(props.user, ["role"]));

    if (role === "veterinarian" || role === "vet") {
      return <VetProfile {...props} />;
    }

    if (role === "admin" || role === "super_admin" || role === "superadmin") {
      return <AdminProfile {...props} />;
    }

    return <PetOwnerProfile {...props} />;
  },
  "/dashboard/inventory": AllItemsPage,
  "/dashboard/inventory/add": AddNewItemPage,
  "/dashboard/inventory/stock-in": StockInPage,
  "/dashboard/inventory/low-stock": LowStockPage,
  "/dashboard/inventory/near-expiry": NearExpiryPage,
  "/dashboard/inventory/disposal": DisposalLogsPage,
};

const dashboardRouteRoles = {
  "/dashboard": ALL_ROLES,
  "/dashboard/consult": PETOWNER_ROLES,
  "/dashboard/consult/booking": PETOWNER_ROLES,
  "/dashboard/consult/payment": PETOWNER_ROLES,
  "/dashboard/consult/confirmation/:bookingId": PETOWNER_ROLES,
  "/dashboard/consult/confirmation/home-service": PETOWNER_ROLES,
  "/dashboard/consult/video/:consultationId": PETOWNER_ROLES,
  "/dashboard/services": SERVICE_ROLES,
  "/dashboard/services/general-checkup": SERVICE_ROLES,
  "/dashboard/services/parasite-control": SERVICE_ROLES,
  "/dashboard/services/surgery": SERVICE_ROLES,
  "/dashboard/services/vaccination": SERVICE_ROLES,
  "/dashboard/services/grooming": SERVICE_ROLES,
  "/dashboard/services/dental-checkup": SERVICE_ROLES,
  "/dashboard/services/home-services": SERVICE_ROLES,
  "/dashboard/services/pet-hotel": SERVICE_ROLES,
  "/dashboard/services/special-services": SERVICE_ROLES,
  "/dashboard/my-pets": ALL_ROLES,
  "/dashboard/my-pets/add": PETOWNER_ROLES,
  "/dashboard/my-pets/:petId": ALL_ROLES,
  "/dashboard/my-pets/:petId/medical-records": ALL_ROLES,
  "/dashboard/my-pets/:petId/request-update": PETOWNER_ROLES,
  "/dashboard/pet-register": ADMIN_ROLES,
  "/dashboard/pet-register/:petId": ADMIN_ROLES,
  "/dashboard/bookings": ADMIN_ROLES,
  "/dashboard/record-requests": ADMIN_ROLES,
  "/dashboard/boarding": ADMIN_ROLES,
  "/dashboard/queue": ADMIN_ROLES,
  "/dashboard/pos": ADMIN_ROLES,
  "/dashboard/service-catalog": ADMIN_ROLES,
  "/dashboard/consent": ADMIN_ROLES,
  "/dashboard/vet/approved-queue": VETERINARIAN_ROLES,
  "/dashboard/vet/my-list": VETERINARIAN_ROLES,
  "/dashboard/vet/diagnosis": VETERINARIAN_ROLES,
  "/dashboard/vet/medical-records": VETERINARIAN_ROLES,
  "/dashboard/vet/record-requests": VETERINARIAN_ROLES,
  "/dashboard/vet/histories": VETERINARIAN_ROLES,
  "/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis": VETERINARIAN_ROLES,
  "/dashboard/vet/online-consultations": VETERINARIAN_ROLES,
  "/dashboard/reports": SUPERADMIN_ROLES,
  "/dashboard/reports/export": SUPERADMIN_ROLES,
  "/dashboard/pet-media-monitoring": MEDIA_MONITORING_ROLES,
  "/dashboard/accounts": SUPERADMIN_ROLES,
  "/dashboard/pet-owner-accounts": SUPERADMIN_ROLES,
  "/dashboard/payment-methods": SUPERADMIN_ROLES,
  "/dashboard/self-service-queue": PETOWNER_ROLES,
  "/dashboard/todos": TODO_ROLES,
  "/dashboard/profile": ALL_ROLES,
  "/dashboard/notifications": ALL_ROLES,
  "/dashboard/inventory": ADMIN_ROLES,
  "/dashboard/inventory/add": ADMIN_ROLES,
  "/dashboard/inventory/stock-in": ADMIN_ROLES,
  "/dashboard/inventory/low-stock": ADMIN_ROLES,
  "/dashboard/inventory/near-expiry": ADMIN_ROLES,
  "/dashboard/inventory/disposal": ADMIN_ROLES,
};

function getUserValue(user, keys, fallback = "") {
  for (const key of keys) {
    if (user?.[key]) {
      return user[key];
    }
  }

  return fallback;
}

function normalizeRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalizedRole === "vet") {
    return "veterinarian";
  }

  if (normalizedRole === "superadmin") {
    return "super_admin";
  }

  if (normalizedRole === "petowner" || normalizedRole === "owner") {
    return "pet_owner";
  }

  return normalizedRole;
}

function isSuperAdminRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "super_admin" || normalizedRole === "superadmin";
}

function roleIsAllowed(userRole, allowedRoles = ALL_ROLES) {
  const normalizedUserRole = normalizeRole(userRole);

  return allowedRoles.some((role) => normalizeRole(role) === normalizedUserRole);
}

function getDashboardRouteRoles(routePath) {
  return dashboardRouteRoles[routePath] || ALL_ROLES;
}

function formatRoleList(roles) {
  return roles
    .map((role) => String(role).replace(/_/g, " "))
    .join(", ");
}

function groupNavItemsForSuperAdmin(items) {
  const grouped = SUPERADMIN_NAV_GROUPS.map((group) => ({ ...group, items: [] }));
  const groupMap = new Map(grouped.map((group) => [group.id, group]));
  const seenItems = new Set();

  items.forEach((item) => {
    if (seenItems.has(item.id)) {
      return;
    }

    const targetGroup = groupMap.get(item.navGroup || "petowner") || groupMap.get("petowner");
    targetGroup.items.push(item);
    seenItems.add(item.id);
  });

  return grouped.filter((group) => group.items.length > 0);
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
  if (path.startsWith("/dashboard/record-requests")) {
    return "record-requests";
  }
  if (path.startsWith("/dashboard/boarding")) {
    return "boarding";
  }
  if (path.startsWith("/dashboard/queue")) {
    return "queue";
  }
  if (path.startsWith("/dashboard/pos")) {
    return "pos";
  }
  if (path.startsWith("/dashboard/service-catalog")) {
    return "service-catalog";
  }
  if (path.startsWith("/dashboard/self-service-queue")) {
    return "self-service-queue";
  }
  if (path.startsWith("/dashboard/consent")) {
    return "consent";
  }
  if (path.startsWith("/dashboard/vet/approved-queue")) {
    return "vet-approved-queue";
  }
  if (path.startsWith("/dashboard/vet/diagnosis")) {
    return "vet-my-list";
  }
  if (path.startsWith("/dashboard/vet/my-list")) {
    return "vet-my-list";
  }
  if (path.startsWith("/dashboard/vet/medical-records")) {
    return "vet-medical-records";
  }
  if (path.startsWith("/dashboard/vet/record-requests")) {
    return "vet-record-requests";
  }
  if (path.startsWith("/dashboard/vet/online-consultations")) {
    return "vet-online-consults";
  }
  if (path.startsWith("/dashboard/vet/histories")) {
    return "vet-histories";
  }
  if (path.startsWith("/dashboard/reports/export")) {
    return "home";
  }
  if (path.startsWith("/dashboard/reports")) {
    return "home";
  }
  if (path.startsWith("/dashboard/pet-media-monitoring")) {
    return "pet-media-monitoring";
  }
  if (path.startsWith("/dashboard/accounts")) {
    return "accounts";
  }
  if (path.startsWith("/dashboard/pet-owner-accounts")) {
    return "pet-owner-accounts";
  }
  if (path.startsWith("/dashboard/payment-methods")) {
    return "payment-methods";
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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

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

  const navigate = useCallback((target) => {
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
  }, []);

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
      return roleIsAllowed(userRole, item.roles);
    });
  }, [userRole]);

  const groupedNavItems = useMemo(() => {
    if (!isSuperAdminRole(userRole)) {
      return [{ id: "default", label: "", items: filteredNavItems }];
    }

    return groupNavItemsForSuperAdmin(filteredNavItems);
  }, [filteredNavItems, userRole]);

  // Authorization check for the current route
  const ScreenComponent = useMemo(() => {
    const Component = screenMap[routeMatch.path] ?? HomeScreen;
    const allowedRoles = getDashboardRouteRoles(routeMatch.path);
    
    // Check if the current user role is allowed for this route.
    if (!roleIsAllowed(userRole, allowedRoles)) {
      return () => (
        <div className="flex flex-col items-center justify-center h-full text-center p-10">
          <X className="size-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">You do not have permission to access this page.</p>
          <p className="text-xs text-slate-400 mb-6">Required: {formatRoleList(allowedRoles)} | Your Role: {userRole || "Unknown"}</p>
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
  }, [routeMatch.path, userRole, navigate]);

  const displayName = useMemo(() => {
    const firstName = getUserValue(user, ["firstName", "FirstName", "first_name"]);
    const lastName = getUserValue(user, ["lastName", "LastName", "last_name"]);
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || getUserValue(user, ["email"], "Pet Owner");
  }, [user]);

  const profileImageSrc = useMemo(() => {
    return resolveImageUrl(getUserValue(user, ["profileImage", "profile_image", "setProfilePic_url"]));
  }, [user]);
  const logoutAccountLabel = displayName || "Pet Owner";

  const requestLogout = () => {
    setIsMobileNavOpen(false);
    setIsLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutDialogOpen(false);
    toast.success("Logged out successfully.");
    onLogout?.();
  };

  const renderSidebarContent = ({ isMobileDrawer = false } = {}) => {
    const isCollapsed = !isMobileDrawer && isSidebarCollapsed;

    return (
    <div className="flex h-full flex-col">
      {!isMobileDrawer && (
        <div className={`flex items-center border-b border-slate-200 px-4 py-5 h-[89px] transition-all duration-500 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="group relative flex size-12 flex-shrink-0 items-center justify-center rounded-full border border-transparent bg-white transition hover:border-blue-100 hover:bg-blue-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <img
                src={logo}
                alt="iPawcus logo"
                className="size-10 object-contain transition duration-200 group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0"
              />
              <ChevronRight className="absolute size-5 text-[#155dfc] opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={2.75} />
            </button>
          ) : (
            <>
              <div className="flex max-w-xs items-center gap-3 overflow-hidden opacity-100 transition-all duration-500 ease-in-out">
                <img src={logo} alt="iPawcus logo" className="h-10 w-10 min-w-10 object-contain" />
                <div className="whitespace-nowrap">
                  <p className="text-lg font-bold text-[#155dfc]">iPawcus</p>
                  <p className="text-xs text-slate-500">Dashboard</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[#155dfc] shadow-sm transition hover:border-blue-200 hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <ChevronLeft className="size-5" strokeWidth={2.75} />
              </button>
            </>
          )}
        </div>
      )}

      {isMobileDrawer && (
         <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 flex-shrink-0">
           <img src={logo} alt="iPawcus logo" className="h-12 w-12 object-contain" />
           <div>
             <p className="text-lg font-bold text-[#155dfc]">iPawcus</p>
             <p className="text-sm text-slate-500">Pet owner dashboard</p>
           </div>
         </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
          <nav className={isSuperAdminRole(userRole) ? "space-y-4" : "space-y-2"}>
            {groupedNavItems.map((group, groupIndex) => (
              <div key={group.id} className="space-y-2">
                {isSuperAdminRole(userRole) && (
                  isCollapsed ? (
                    groupIndex > 0 ? <div className="mx-auto h-px w-8 bg-slate-200" aria-hidden="true" /> : null
                  ) : (
                    <p className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {group.label}
                    </p>
                  )
                )}
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const Icon = getNavItemIcon(item, userRole);
                    const isActive = item.id === activeTab;
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const itemLabel = getNavItemLabel(item, userRole);

                    return (
                      <div key={item.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => navigate(item.path)}
                          title={isCollapsed ? itemLabel : ""}
                          className={`flex items-center rounded-xl py-3 text-left transition-all duration-300 ease-in-out ${
                            isCollapsed ? "justify-center px-0 w-12 mx-auto" : "gap-3 px-4 w-full"
                          } ${
                            isActive ? "bg-[#155dfc] text-white shadow-md shadow-blue-200" : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className={`h-5 w-5 min-w-5 flex-shrink-0 transition-transform duration-300 ${isActive ? "scale-110" : ""}`} />
                          <span className={`font-medium whitespace-nowrap transition-all duration-500 ease-in-out overflow-hidden ${
                            isCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3"
                          }`}>
                            {itemLabel}
                          </span>
                        </button>
                        
                        {hasSubItems && !isCollapsed && (
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
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-4">
          <div className="mb-3">
            <NotificationBell
              user={user}
              navigate={navigate}
              variant="nav"
              collapsed={isCollapsed}
              label="Notifications"
            />
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/profile")}
            title={isCollapsed ? "Profile" : ""}
            className={`mb-4 block text-left transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2 ${
              isCollapsed
                ? `w-12 mx-auto rounded-full ${activeTab === "profile" ? "ring-2 ring-[#155dfc] ring-offset-2" : ""}`
                : `rounded-2xl p-4 w-full ${activeTab === "profile" ? "bg-[#155dfc] text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`
            }`}
          >
            <div className={`flex items-center ${isCollapsed ? "justify-center" : ""}`}>
              <div className="relative flex-shrink-0">
                {profileImageSrc ? (
                  <img 
                    src={profileImageSrc} 
                    alt={displayName}
                    className={`rounded-full object-cover border-2 transition-all duration-500 shadow-sm ${
                      isCollapsed
                        ? "h-10 w-10 border-[#155dfc]"
                        : activeTab === "profile" ? "h-12 w-12 border-blue-200" : "h-12 w-12 border-white"
                    }`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=155dfc&color=fff`;
                    }}
                  />
                ) : (
                  <div className={`rounded-full bg-[#155dfc] flex items-center justify-center text-white font-bold shadow-sm transition-all duration-500 ${
                    isCollapsed ? "h-10 w-10 text-base" : activeTab === "profile" ? "h-12 w-12 text-lg bg-white text-[#155dfc]" : "h-12 w-12 text-lg"
                  }`}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className={`min-w-0 transition-all duration-500 overflow-hidden whitespace-nowrap ${
                isCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3 flex-1"
              }`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === "profile" ? "text-blue-100" : "text-slate-400"}`}>Signed in as</p>
                <p className={`font-bold truncate ${activeTab === "profile" ? "text-white" : "text-slate-900"}`}>{displayName}</p>
                <p className={`text-xs font-medium truncate ${activeTab === "profile" ? "text-blue-100" : "text-[#155dfc]"}`}>{getUserValue(user, ["role"])}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={requestLogout}
            title={isCollapsed ? "Log Out" : ""}
            className={`flex w-full items-center rounded-xl border border-red-200 py-3 text-left text-red-600 transition-all duration-500 hover:bg-red-50 hover:text-red-700 active:bg-red-100 px-4`}
          >
            <LogOut className="h-5 w-5 min-w-5 flex-shrink-0" />
            <span className={`font-medium whitespace-nowrap transition-all duration-500 overflow-hidden ${
              isCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-xs opacity-100 ml-3"
            }`}>
              Log Out
            </span>
          </button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <DashboardRouterProvider value={{ currentPath, navigate, params: routeMatch.params, onUserUpdate, user }}>
      <VideoCallProvider>
        <div className="min-h-screen min-w-0 bg-slate-50 text-slate-900">
          <ToastViewport />
          <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Log out?</DialogTitle>
                <DialogDescription>
                  Log out of {logoutAccountLabel}?
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-6 text-slate-600">
                Any unsaved changes will be lost.
              </p>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsLogoutDialogOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Log Out
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isCompactLayout && (
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <img src={logo} alt="iPawcus logo" className="h-10 w-10 object-contain" />
                <div>
                  <p className="text-base font-bold text-[#155dfc]">iPawcus</p>
                  <p className="text-xs text-slate-500">Dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen((current) => !current)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
                  aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
                >
                  {isMobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </header>
          )}

          <div className="flex min-h-screen min-w-0">
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
                  {renderSidebarContent({ isMobileDrawer: true })}
                </aside>
              </>
            ) : (
              <aside
                className={`fixed left-0 top-0 h-screen transition-all duration-300 border-r border-slate-200 bg-white z-40 ${
                  isSidebarCollapsed ? "w-20" : "w-72"
                }`}
              >
                {renderSidebarContent()}
              </aside>
            )}

            <div
              className={`min-w-0 flex-1 transition-all duration-300 ${
                !isCompactLayout ? (isSidebarCollapsed ? "pl-20" : "pl-72") : ""
              }`}
            >
              <main data-dashboard-content className="mx-auto w-full max-w-[112rem] min-w-0 p-3 sm:p-5 lg:p-8 2xl:p-10">
                <Suspense fallback={
                  <div className="flex h-64 w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
                      <p className="text-sm font-medium text-slate-500">Loading page...</p>
                    </div>
                  </div>
                }>
                  {/* eslint-disable-next-line react-hooks/static-components */}
                  <ScreenComponent user={user} onUserUpdate={onUserUpdate} onLogout={onLogout} />
                </Suspense>
              </main>
            </div>
          </div>
        </div>
      </VideoCallProvider>
    </DashboardRouterProvider>
  );
}
