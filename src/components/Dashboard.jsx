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
  Loader2,
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
  ChevronDown,
  UserCog,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";

import logo from "../assets/circular_logo.png";
import { DashboardRouterProvider, getRouteMatch, normalizePath } from "./dashboardRouter.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "../reusecomponent/toast.jsx";
import NotificationBell from "./shared/NotificationBell.jsx";
import ProtectedImage from "./shared/ProtectedImage.jsx";
import { VideoCallProvider } from "../context/VideoCallProvider.jsx";
import { clearSessionFormDraftsForUser, useSessionFormPersistence } from "../hooks/useSessionFormPersistence.js";
import { useAutoRefresh } from "../hooks/useAutoRefresh.js";
import { formatRoleLabel } from "../lib/roleLabel.js";
import { getDashboardPageTitle, setDocumentPageTitle } from '../lib/pageTitle.js';
import { defaultAdminFeaturePermissions, getAdminFeatureForDashboardPath, normalizeAdminFeaturePermissions } from '../lib/adminFeatureAccess.js';
import { fetchAdminFeatureAccess } from '../services/adminFeatureAccessService.js';

function DashboardBrand({ compact = false }) {
  return (
    <div data-slot="dashboard-brand" className="flex min-w-0 items-center gap-3 overflow-hidden">
      <span className="relative shrink-0">
        <span className="absolute -inset-1 rounded-full bg-blue-200/0 blur transition-colors group-hover:bg-blue-200/50 dark:group-hover:bg-blue-700/20" aria-hidden="true" />
        <img
          src={logo}
          alt="iPawcus logo"
          className={`relative object-contain ${compact ? 'size-10' : 'size-11'}`}
        />
      </span>
      <span className="min-w-0 max-w-[9.5rem] whitespace-nowrap leading-none">
        <span className={`block truncate font-black tracking-tight text-[#155dfc] dark:text-blue-300 ${compact ? 'text-lg' : 'text-xl'}`}>
          iPawcus
        </span>
        <span className={`mt-0.5 block truncate font-bold uppercase text-slate-500 dark:text-slate-400 ${compact ? 'text-[6px] tracking-[0.04em]' : 'text-[7px] tracking-[0.06em]'}`}>
          Vetfocus Care
        </span>
      </span>
    </div>
  );
}

function DashboardAccessState({ loading = false, message, details = '', onGoHome }) {
  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-10 text-center">
        <Loader2 className="mb-4 size-8 animate-spin text-blue-600" />
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Checking feature access</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Your Admin permissions are being verified.</p>
      </div>
    );
  }

  return (
    <div className="flex h-64 flex-col items-center justify-center p-10 text-center">
      <X className="mb-4 size-12 text-red-500" />
      <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
      <p className="mb-6 text-slate-600 dark:text-slate-300">{message}</p>
      {details ? <p className="mb-6 text-xs text-slate-400">{details}</p> : null}
      <button
        type="button"
        onClick={onGoHome}
        className="rounded-xl bg-[#155dfc] px-6 py-2 font-medium text-white"
      >
        Go to Home
      </button>
    </div>
  );
}

// Lazy load screens
const HomeScreen = lazy(() => import("./PetOwnerDashboard/Home.jsx"));
const ConsultScreen = lazy(() => import("./PetOwnerDashboard/Consult.jsx"));
const ConsultBookingScreen = lazy(() => import("./PetOwnerDashboard/ConsultBooking.jsx"));
const ConsultPaymentScreen = lazy(() => import("./PetOwnerDashboard/ConsultPayment.jsx"));
const ConsultConfirmationScreen = lazy(() => import("./PetOwnerDashboard/ConsultConfirmation.jsx"));
const VideoConsultationScreen = lazy(() => import("./PetOwnerDashboard/VideoConsultation.jsx"));
const ServicesScreen = lazy(() => import("./PetOwnerDashboard/Services.jsx"));
const GeneralCheckupScreen = lazy(() => import("./PetOwnerDashboard/GeneralCheckup.jsx"));
const LaboratoryTestingScreen = lazy(() => import("./PetOwnerDashboard/LaboratoryTesting.jsx"));
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
  { id: "services", featureKey: "services", label: "Services", icon: BriefcaseMedical, path: "/dashboard/services", roles: SERVICE_ROLES, navGroup: "admin" },
  { id: "pets", featureKey: "pets", label: "My Pets", icon: PawPrint, path: "/dashboard/my-pets", roles: ALL_ROLES, navGroup: "admin" },
  { id: "pet-register", featureKey: "pet_register", label: "Pet Register", icon: ClipboardPlus, path: "/dashboard/pet-register", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "bookings", featureKey: "bookings", label: "Bookings", icon: CalendarCheck2, path: "/dashboard/bookings", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "record-requests", featureKey: "record_requests", label: "Record Requests", icon: ClipboardPenLine, path: "/dashboard/record-requests", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "boarding", featureKey: "boarding", label: "Boarding", icon: Hotel, path: "/dashboard/boarding", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "queue", featureKey: "queue", label: "Queue", icon: ListChecks, path: "/dashboard/queue", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "pos", featureKey: "pos", label: "Point-Of-Sale", icon: CircleDollarSign, path: "/dashboard/pos", roles: ADMIN_ROLES, navGroup: "admin" },
  { id: "service-catalog", featureKey: "service_catalog", label: "Service Catalog", icon: BookOpenCheck, path: "/dashboard/service-catalog", roles: ADMIN_ROLES, navGroup: "admin" },
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
    featureKey: "inventory",
    navGroup: "admin"
  },
  { id: "self-service-queue", label: "Self-Service Queue", icon: ScanLine, path: "/dashboard/self-service-queue", roles: PETOWNER_ROLES, navGroup: "petowner" },
  { id: "consent", featureKey: "consent", label: "Consent Files", icon: FilePenLine, path: "/dashboard/consent" , roles: ADMIN_ROLES, navGroup: "admin" },
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
  "/dashboard/services/laboratory-testing": LaboratoryTestingScreen,
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
  "/dashboard/services/laboratory-testing": SERVICE_ROLES,
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
    .map((role) => formatRoleLabel(role))
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

export default function Dashboard({ user, onLogout, onUserUpdate, onForgotPassword }) {
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
  const [openSuperAdminNavGroup, setOpenSuperAdminNavGroup] = useState(() => {
    const initialTab = getActiveTab(normalizePath(window.location.pathname));
    return groupNavItemsForSuperAdmin(navItems)
      .find((group) => group.items.some((item) => item.id === initialTab))?.id || 'superadmin';
  });
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

  const navigate = useCallback((target, options = {}) => {
    if (typeof target === "number") {
      window.history.go(target);
      return;
    }

    const nextPath = normalizePath(target);
    const nextTab = getActiveTab(nextPath);
    const nextGroup = groupNavItemsForSuperAdmin(navItems)
      .find((group) => group.items.some((item) => item.id === nextTab));
    if (nextGroup) {
      setOpenSuperAdminNavGroup(nextGroup.id);
    }
    if (window.location.pathname !== nextPath) {
      if (options.replace) {
        window.history.replaceState({}, "", nextPath);
      } else {
        window.history.pushState({}, "", nextPath);
      }
    }
    
    setHistoryStack((current) => {
      if (current[current.length - 1] === nextPath) {
        return current;
      }

      if (options.replace) {
        return [...current.slice(0, -1), nextPath];
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

  useSessionFormPersistence({ user, path: currentPath });

  const userRole = getUserValue(user, ["role"]);
  const normalizedUserRole = normalizeRole(userRole);
  const isRestrictedAdmin = normalizedUserRole === 'admin';
  const [adminFeaturePermissions, setAdminFeaturePermissions] = useState(null);
  const [adminFeatureAccessError, setAdminFeatureAccessError] = useState('');

  const refreshAdminFeatureAccess = useCallback(async () => {
    if (!isRestrictedAdmin) {
      setAdminFeaturePermissions(defaultAdminFeaturePermissions());
      setAdminFeatureAccessError('');
      return;
    }

    try {
      const response = await fetchAdminFeatureAccess();
      setAdminFeaturePermissions(normalizeAdminFeaturePermissions(response?.permissions));
      setAdminFeatureAccessError('');
    } catch (error) {
      setAdminFeatureAccessError(error?.message || 'Feature access could not be verified.');
      if (import.meta.env.DEV) {
        console.warn('Admin feature access could not be refreshed.', error);
      }
    }
  }, [isRestrictedAdmin]);

  useAutoRefresh(refreshAdminFeatureAccess, {
    enabled: isRestrictedAdmin,
    refreshKey: `admin-feature-access-${getUserValue(user, ['id', 'userId', 'user_id'], 'unknown')}`,
  });

  useEffect(() => {
    setDocumentPageTitle(getDashboardPageTitle(routeMatch.path, userRole));
  }, [routeMatch.path, userRole]);

  // Filter nav items based on roles if specified
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (!item.roles) return true;
      if (!roleIsAllowed(userRole, item.roles)) return false;
      if (isRestrictedAdmin && item.featureKey) {
        return adminFeaturePermissions?.[item.featureKey] === true;
      }
      return true;
    });
  }, [adminFeaturePermissions, isRestrictedAdmin, userRole]);

  const groupedNavItems = useMemo(() => {
    if (!isSuperAdminRole(userRole)) {
      return [{ id: "default", label: "", items: filteredNavItems }];
    }

    return groupNavItemsForSuperAdmin(filteredNavItems);
  }, [filteredNavItems, userRole]);

  const ScreenComponent = useMemo(() => screenMap[routeMatch.path] ?? HomeScreen, [routeMatch.path]);
  const allowedRouteRoles = getDashboardRouteRoles(routeMatch.path);
  const requiredAdminFeature = getAdminFeatureForDashboardPath(currentPath);
  const featureAccessIsLoading = Boolean(
    isRestrictedAdmin
    && requiredAdminFeature
    && adminFeaturePermissions === null
    && !adminFeatureAccessError
  );
  const featureIsDenied = Boolean(
    isRestrictedAdmin
    && requiredAdminFeature
    && (adminFeatureAccessError || adminFeaturePermissions?.[requiredAdminFeature] !== true)
  );
  const routeRoleIsDenied = !roleIsAllowed(userRole, allowedRouteRoles);

  const displayName = useMemo(() => {
    const firstName = getUserValue(user, ["firstName", "FirstName", "first_name"]);
    const lastName = getUserValue(user, ["lastName", "LastName", "last_name"]);
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || getUserValue(user, ["email"], "Pet Owner");
  }, [user]);

  const profileImageSrc = useMemo(() => getUserValue(user, ["profileImage", "profile_image", "setProfilePic_url"]), [user]);
  const logoutAccountLabel = displayName || "Pet Owner";
  const requestLogout = () => {
    setIsMobileNavOpen(false);
    setIsLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutDialogOpen(false);
    clearSessionFormDraftsForUser(user);
    toast.success("Logged out successfully.");
    onLogout?.();
  };

  const renderSidebarContent = ({ isMobileDrawer = false } = {}) => {
    const isCollapsed = !isMobileDrawer && isSidebarCollapsed;

    return (
    <div className="flex h-full flex-col" data-slot="dashboard-sidebar-content">
      {!isMobileDrawer && (
        <div className={`flex h-[82px] items-center border-b border-slate-200/80 px-4 py-4 transition-all duration-300 dark:border-slate-800 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="group relative flex size-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <img
                src={logo}
                alt="iPawcus logo"
                className="size-10 object-contain transition duration-200 group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0"
              />
              <ChevronRight className="absolute size-5 text-blue-700 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-blue-300" strokeWidth={2.75} />
            </button>
          ) : (
            <>
              <div className="group max-w-xs opacity-100 transition-all duration-500 ease-in-out">
                <DashboardBrand />
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-800 transition hover:border-blue-200 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
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
         <div className="group flex-shrink-0 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
           <DashboardBrand />
         </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
          <nav data-slot="dashboard-navigation" aria-label="Dashboard navigation" className={isSuperAdminRole(userRole) ? "space-y-4" : "space-y-2"}>
            {groupedNavItems.map((group, groupIndex) => {
              const isGroupOpen = openSuperAdminNavGroup === group.id;

              return (
              <div key={group.id} className="space-y-2">
                {isSuperAdminRole(userRole) && (
                  isCollapsed ? (
                    groupIndex > 0 ? <div className="mx-auto h-px w-8 bg-slate-200" aria-hidden="true" /> : null
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenSuperAdminNavGroup((current) => current === group.id ? '' : group.id)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-expanded={isGroupOpen}
                      aria-controls={`superadmin-nav-group-${group.id}`}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  )
                )}
                {(isCollapsed || !isSuperAdminRole(userRole) || isGroupOpen) && (
                <div id={`superadmin-nav-group-${group.id}`} className="space-y-2">
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
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex min-h-11 items-center rounded-xl py-2.5 text-left transition-all duration-200 ${
                            isCollapsed ? "justify-center px-0 w-12 mx-auto" : "gap-3 px-4 w-full"
                          } ${
                            isActive ? "bg-[#155dfc] text-white shadow-sm shadow-blue-950/15" : "text-slate-700 hover:bg-blue-50 hover:text-blue-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
                                      ? "bg-blue-50 text-blue-800 font-bold dark:bg-blue-950/40 dark:text-blue-200"
                                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
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
                )}
              </div>
              );
            })}
          </nav>
        </div>

        <div
          data-slot="dashboard-account-dock"
          className={`shrink-0 border-t border-slate-200/80 bg-slate-50/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 ${
            isCollapsed ? "p-2" : "p-3"
          }`}
        >
          <div className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${isCollapsed ? "p-1" : "p-2"}`}>
            <NotificationBell
              user={user}
              navigate={navigate}
              variant="nav"
              collapsed={isCollapsed}
              label="Notifications"
            />

            <button
              type="button"
              onClick={() => navigate("/dashboard/profile")}
              title={isCollapsed ? `${displayName} profile` : ""}
              className={`group mt-1 flex min-h-12 w-full items-center rounded-xl text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                isCollapsed ? "justify-center px-1" : "gap-3 px-2.5 py-2"
              } ${
                activeTab === "profile"
                  ? "bg-[#155dfc] text-white shadow-sm shadow-blue-950/15"
                  : "text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <div className="relative shrink-0">
                  {profileImageSrc ? (
                    <ProtectedImage
                      src={profileImageSrc}
                      alt={displayName}
                      className={`size-10 rounded-xl border object-cover shadow-sm transition duration-200 ${
                        activeTab === "profile" ? "border-white/30" : "border-slate-200 dark:border-slate-700"
                      }`}
                      fallbackClassName={`size-10 rounded-xl border shadow-sm ${
                        activeTab === "profile" ? "border-white/30" : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                  ) : (
                    <div className={`flex size-10 items-center justify-center rounded-xl text-sm font-black shadow-sm ${
                      activeTab === "profile" ? "bg-white text-blue-800" : "bg-[#155dfc] text-white"
                    }`}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 ${
                    activeTab === "profile" ? "border-blue-700 bg-blue-200" : "border-white bg-emerald-500 dark:border-slate-900"
                  }`} aria-hidden="true" />
              </div>

              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-black ${activeTab === "profile" ? "text-white" : "text-slate-950 dark:text-white"}`}>
                      {displayName}
                    </span>
                    <span className={`mt-0.5 block truncate text-[10px] font-black uppercase tracking-[0.12em] ${
                      activeTab === "profile" ? "text-blue-100" : "text-blue-700 dark:text-blue-300"
                    }`}>
                      {formatRoleLabel(getUserValue(user, ["role"]), 'Account')}
                    </span>
                  </span>
                  <ChevronRight className={`size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
                    activeTab === "profile" ? "text-blue-100" : "text-slate-400"
                  }`} aria-hidden="true" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={requestLogout}
              title={isCollapsed ? "Log out" : ""}
              className={`group mt-1 flex min-h-11 w-full items-center rounded-xl text-left text-slate-600 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 dark:focus:ring-offset-slate-900 ${
                isCollapsed ? "justify-center px-1" : "gap-3 px-2.5"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-rose-100 dark:bg-slate-800 dark:group-hover:bg-rose-950/50">
                <LogOut className="size-4" aria-hidden="true" />
              </span>
              {!isCollapsed && <span className="text-sm font-bold">Log out</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <DashboardRouterProvider value={{ currentPath, navigate, params: routeMatch.params, onUserUpdate, user }}>
      <VideoCallProvider>
        <div
          data-slot="dashboard-shell"
          data-dashboard-role={normalizeRole(userRole) || 'unknown'}
          className="min-h-screen min-w-0 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        >
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
            <header data-slot="dashboard-mobile-header" className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
              <div className="group min-w-0">
                <DashboardBrand compact />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen((current) => !current)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                  data-slot="dashboard-sidebar"
                  className={`mobile-dashboard-drawer fixed left-0 top-0 z-50 flex h-full w-[18rem] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 ${
                    isMobileNavOpen ? "open" : ""
                  }`}
                >
                  {renderSidebarContent({ isMobileDrawer: true })}
                </aside>
              </>
            ) : (
              <aside
                data-slot="dashboard-sidebar"
                className={`fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 ${
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
              <main data-dashboard-content data-dashboard-role={normalizeRole(userRole) || 'unknown'} className="mx-auto w-full max-w-[112rem] min-w-0 p-3 sm:p-5 lg:p-8 2xl:p-10">
                <Suspense fallback={
                  <div className="flex h-64 w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent"></div>
                      <p className="text-sm font-medium text-slate-500">Loading page...</p>
                    </div>
                  </div>
                }>
                  {featureAccessIsLoading ? (
                    <DashboardAccessState loading onGoHome={() => navigate('/dashboard')} />
                  ) : routeRoleIsDenied || featureIsDenied ? (
                    <DashboardAccessState
                      message={featureIsDenied
                        ? adminFeatureAccessError || 'This feature is not enabled for your Admin account.'
                        : 'You do not have permission to access this page.'}
                      details={routeRoleIsDenied
                        ? `Required: ${formatRoleList(allowedRouteRoles)} | Your Role: ${formatRoleLabel(userRole, 'Unknown')}`
                        : ''}
                      onGoHome={() => navigate('/dashboard')}
                    />
                  ) : (
                    <ScreenComponent
                      user={user}
                      onUserUpdate={onUserUpdate}
                      onLogout={onLogout}
                      onForgotPassword={onForgotPassword}
                    />
                  )}
                </Suspense>
              </main>
            </div>
          </div>
        </div>
      </VideoCallProvider>
    </DashboardRouterProvider>
  );
}
