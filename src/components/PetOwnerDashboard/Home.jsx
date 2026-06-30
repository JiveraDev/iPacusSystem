import PropTypes from "prop-types";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Hotel,
  ListTodo,
  Loader2,
  MapPin,
  Package,
  PawPrint,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Video,
} from "lucide-react";

import { useNavigate } from "../dashboardRouter.jsx";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchBookings, fetchUserBookings } from "../../services/bookingService";
import { fetchInventoryItems } from "../../services/inventoryApi";
import { fetchOnlineConsultations } from "../../services/onlineConsultationService";
import { fetchUserPets } from "../../services/petService";
import { fetchQueues } from "../../services/queueService";
import { fetchRecordUpdateRequests } from "../../services/recordUpdateRequestService";
import { fetchPetOwnerTodos } from "../../services/todoService";
import { fetchVisits } from "../../services/visitBillingService";
import consultImage from "../../assets/consultimage.png";

const CLINIC_DETAILS = {
  hours: "8:00 AM - 6:00 PM",
  address: "Oakbrook Avenue, Phase 3, Pleasantville Subdivision, Corner Clayton, Ilayang Iyam, Lucena City",
  phone: "(042) 373-5678",
};

const emptyHomeData = {
  bookings: [],
  queues: [],
  visits: [],
  inventoryItems: [],
  pets: [],
  todos: [],
  onlineConsultations: [],
  recordRequests: [],
  errors: [],
};

const ownerActions = [
  {
    title: "Online Consultation",
    description: "Book a PHP 500 non-emergency video consult.",
    icon: Video,
    path: "/dashboard/consult",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    title: "Pet Services",
    description: "Request check-ups, vaccination, grooming, home service, or boarding.",
    icon: Calendar,
    path: "/dashboard/services",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "My Pets",
    description: "Review profiles, vaccination rows, diagnosis records, and prescriptions.",
    icon: PawPrint,
    path: "/dashboard/my-pets",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "Self-Service Queue",
    description: "Join the clinic queue when this device is connected to the clinic network.",
    icon: ListTodo,
    path: "/dashboard/self-service-queue",
    tone: "bg-rose-50 text-rose-700",
  },
];

const adminActions = [
  {
    title: "Bookings",
    description: "Review pending requests, adjust services before confirmation, and receive bookings.",
    icon: ClipboardList,
    path: "/dashboard/bookings",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    title: "Queue Management",
    description: "Manage walk-ins, booking arrivals, and veterinarian assignment flow.",
    icon: ListTodo,
    path: "/dashboard/queue",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Boarding",
    description: "Search pets, assign rooms, check stays in, and track availability colors.",
    icon: Hotel,
    path: "/dashboard/boarding",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "POS",
    description: "Create draft invoices from visits, prescriptions, services, medication, and products.",
    icon: Receipt,
    path: "/dashboard/pos",
    tone: "bg-rose-50 text-rose-700",
  },
];

const vetActions = [
  {
    title: "Approved List",
    description: "Review patients assigned from the clinic queue.",
    icon: ListTodo,
    path: "/dashboard/vet/approved-queue",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    title: "My List",
    description: "Continue accepted cases and complete diagnosis records.",
    icon: Stethoscope,
    path: "/dashboard/vet/my-list",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Online Consults",
    description: "Handle approved online consultations and record outcomes.",
    icon: Video,
    path: "/dashboard/vet/online-consultations",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "Schedule / TODOs",
    description: "Review online appointments, follow-up recording, and personal tasks.",
    icon: Calendar,
    path: "/dashboard/todos",
    tone: "bg-violet-50 text-violet-700",
  },
  {
    title: "Histories",
    description: "Search previous diagnosis records and follow-up details.",
    icon: FileText,
    path: "/dashboard/vet/histories",
    tone: "bg-rose-50 text-rose-700",
  },
];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getRoleKey(role) {
  const normalized = normalizeRole(role);

  if (normalized.includes("veterinarian") || normalized === "vet") return "veterinarian";
  if (normalized.includes("admin") && !normalized.includes("super")) return "admin";
  if (normalized.includes("super")) return "superadmin";

  return "petowner";
}

function getUserId(user) {
  return user?.id || user?.user_id || user?.userId || "";
}

function getDisplayName(user) {
  const firstName = user?.firstName || user?.FirstName || user?.first_name || "";
  const lastName = user?.lastName || user?.LastName || user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user?.name || user?.email || "there";
}

function getActionsForRole(roleKey) {
  if (roleKey === "admin") {
    return {
      eyebrow: "Admin focus",
      heading: "Keep front-desk operations moving.",
      actions: adminActions,
      secondary: { label: "Pets Directory", path: "/dashboard/my-pets", icon: PawPrint },
    };
  }

  if (roleKey === "veterinarian") {
    return {
      eyebrow: "Veterinarian focus",
      heading: "Continue patient care from queue to diagnosis.",
      actions: vetActions,
      secondary: { label: "Medical Records", path: "/dashboard/vet/medical-records", icon: FileText },
    };
  }

  return {
    eyebrow: "Pet owner focus",
    heading: "Book care and review your pet records.",
    actions: ownerActions,
    secondary: { label: "View Pet Records", path: "/dashboard/my-pets", icon: PawPrint },
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateTime(dateValue, timeValue = "") {
  if (!dateValue) return null;

  const raw = String(dateValue).includes("T") || !timeValue
    ? String(dateValue)
    : `${dateValue} ${timeValue}`;
  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isToday(dateValue, timeValue = "") {
  const date = parseDateTime(dateValue, timeValue);
  if (!date) return false;

  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function formatShortDate(dateValue, timeValue = "") {
  const date = parseDateTime(dateValue, timeValue);
  if (!date) return "No schedule";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: timeValue || String(dateValue).includes(":") ? "numeric" : undefined,
    minute: timeValue || String(dateValue).includes(":") ? "2-digit" : undefined,
  }).format(date);
}

function valueArray(response, key) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  return [];
}

function formatCount(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value) || 0);
}

function formatPeso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function isActiveBooking(booking) {
  return !["completed", "cancelled", "canceled", "rejected", "declined"].includes(normalizeStatus(booking.status));
}

function isPendingBooking(booking) {
  return ["pending", "for_confirmation", "requested"].includes(normalizeStatus(booking.status));
}

function isActiveQueue(queue) {
  return !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(queue.status));
}

function isInventoryAlert(item) {
  return ["low_stock", "low-stock", "out_of_stock", "out-of-stock", "near_expiry", "near-expiry", "expired"].includes(normalizeStatus(item.status));
}

function isOpenRecordRequest(request) {
  return !["completed", "cancelled", "canceled", "rejected"].includes(normalizeStatus(request.status));
}

function isAssignedToVet(item, userId) {
  if (!userId) return false;
  return String(item.veterinarian_user_id || item.assignedVeterinarianUserId || item.assigned_veterinarian_user_id || "") === String(userId);
}

function buildAttentionItems(roleKey, data, userId) {
  if (roleKey === "admin") {
    const pendingBookings = data.bookings.filter(isPendingBooking);
    const activeQueues = data.queues.filter(isActiveQueue);
    const unpaidVisits = data.visits.filter(visit => ["unpaid", "partial"].includes(normalizeStatus(visit.billingStatus)));
    const inventoryAlerts = data.inventoryItems.filter(isInventoryAlert);

    return [
      ...pendingBookings.slice(0, 2).map(item => ({
        title: item.bookingNumber || `Booking #${item.id}`,
        detail: `${item.petName || "Pet"} - ${item.service || item.type || "Service"} on ${formatShortDate(item.date, item.time)}`,
        badge: "Booking",
        path: "/dashboard/bookings",
      })),
      ...activeQueues.slice(0, 2).map(item => ({
        title: item.queue_reference || `Queue #${item.queue_number || item.queue_id}`,
        detail: `${item.pet_name || "Pet"} - ${item.service_name || "Queue service"}`,
        badge: normalizeStatus(item.status).replace(/_/g, " ") || "Queue",
        path: "/dashboard/queue",
      })),
      ...unpaidVisits.slice(0, 2).map(item => ({
        title: item.petName || item.pet_name || "Unpaid visit",
        detail: `Balance ${formatPeso(item.totals?.balance || 0)}`,
        badge: "POS",
        path: "/dashboard/pos",
      })),
      ...inventoryAlerts.slice(0, 2).map(item => ({
        title: item.name || "Inventory item",
        detail: `${formatCount(item.quantity)} ${item.unit || "unit"} remaining`,
        badge: normalizeStatus(item.status).replace(/_/g, " "),
        path: "/dashboard/inventory",
      })),
    ].slice(0, 6);
  }

  if (roleKey === "veterinarian") {
    const approvedQueues = data.queues.filter(item => normalizeStatus(item.status) === "in_progress" && !Number(item.has_active_assignment || 0));
    const receivedQueues = data.queues.filter(item => isAssignedToVet(item, userId) && normalizeStatus(item.assignment_status) === "received");
    const consultations = data.onlineConsultations.filter(item => !["completed", "cancelled", "canceled"].includes(normalizeStatus(item.status)));
    const requests = data.recordRequests.filter(isOpenRecordRequest);
    const openTodos = data.todos.filter(task => !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(task.status)) && !task.completedAt);

    return [
      ...receivedQueues.slice(0, 2).map(item => ({
        title: item.pet_name || "Assigned patient",
        detail: item.service_name || "Continue diagnosis",
        badge: "My List",
        path: "/dashboard/vet/my-list",
      })),
      ...approvedQueues.slice(0, 2).map(item => ({
        title: item.pet_name || "Queue patient",
        detail: item.service_name || "Ready to receive",
        badge: "Approved",
        path: "/dashboard/vet/approved-queue",
      })),
      ...consultations.slice(0, 2).map(item => ({
        title: item.petName || "Online consult",
        detail: formatShortDate(item.scheduledStart || item.createdAt),
        badge: "Online",
        path: "/dashboard/vet/online-consultations",
      })),
      ...openTodos.slice(0, 2).map(item => ({
        title: item.title || "Schedule item",
        detail: formatShortDate(item.startAt),
        badge: item.category || "TODO",
        path: item.redirectPath || "/dashboard/todos",
      })),
      ...requests.slice(0, 2).map(item => ({
        title: item.petName || "Record request",
        detail: item.requestNumber || item.status,
        badge: "Record",
        path: "/dashboard/vet/record-requests",
      })),
    ].slice(0, 6);
  }

  const activeBookings = data.bookings.filter(isActiveBooking);
  const openTodos = data.todos.filter(task => !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(task.status)) && !task.completedAt);

  return [
    ...activeBookings.slice(0, 3).map(item => ({
      title: item.petName || "Booked pet",
      detail: `${item.service || item.type || "Service"} - ${formatShortDate(item.date, item.time)}`,
      badge: item.status || "Booking",
      path: "/dashboard/my-pets",
    })),
    ...openTodos.slice(0, 3).map(item => ({
      title: item.title || "To-do",
      detail: formatShortDate(item.startAt),
      badge: item.sourceLabel || "TODO",
      path: item.redirectPath || "/dashboard/todos",
    })),
  ].slice(0, 6);
}

function buildRoleSummary(roleKey, data, userId) {
  if (roleKey === "admin") {
    const pendingBookings = data.bookings.filter(isPendingBooking);
    const activeQueues = data.queues.filter(isActiveQueue);
    const unpaidVisits = data.visits.filter(visit => ["unpaid", "partial"].includes(normalizeStatus(visit.billingStatus)));
    const inventoryAlerts = data.inventoryItems.filter(isInventoryAlert);

    return {
      title: "Admin Live Overview",
      description: "Operational counts from bookings, queue, POS, inventory, and record requests.",
      cards: [
        { label: "Pending Bookings", value: pendingBookings.length, detail: `${data.bookings.filter(item => isToday(item.date, item.time)).length} scheduled today`, icon: ClipboardList, tone: "bg-blue-50 text-blue-700", path: "/dashboard/bookings" },
        { label: "Active Queue", value: activeQueues.length, detail: `${data.queues.filter(item => normalizeStatus(item.status) === "waiting").length} waiting`, icon: ListTodo, tone: "bg-emerald-50 text-emerald-700", path: "/dashboard/queue" },
        { label: "POS Unpaid", value: unpaidVisits.length, detail: `${formatPeso(unpaidVisits.reduce((sum, visit) => sum + Number(visit.totals?.balance || 0), 0))} balance`, icon: Receipt, tone: "bg-rose-50 text-rose-700", path: "/dashboard/pos" },
        { label: "Inventory Alerts", value: inventoryAlerts.length, detail: "Low, expired, or near-expiry stock", icon: Package, tone: "bg-amber-50 text-amber-700", path: "/dashboard/inventory" },
      ],
      attentionTitle: "Needs Attention",
      attentionItems: buildAttentionItems(roleKey, data, userId),
    };
  }

  if (roleKey === "veterinarian") {
    const approvedQueues = data.queues.filter(item => normalizeStatus(item.status) === "in_progress" && !Number(item.has_active_assignment || 0));
    const receivedQueues = data.queues.filter(item => isAssignedToVet(item, userId) && normalizeStatus(item.assignment_status) === "received");
    const openConsultations = data.onlineConsultations.filter(item => !["completed", "cancelled", "canceled"].includes(normalizeStatus(item.status)));
    const assignedRequests = data.recordRequests.filter(isOpenRecordRequest);
    const openTodos = data.todos.filter(task => !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(task.status)) && !task.completedAt);

    return {
      title: "Veterinarian Live Overview",
      description: "Patient work synced from assigned queues, online consults, and record requests.",
      cards: [
        { label: "Approved Queue", value: approvedQueues.length, detail: "Waiting to be received", icon: ListTodo, tone: "bg-blue-50 text-blue-700", path: "/dashboard/vet/approved-queue" },
        { label: "My List", value: receivedQueues.length, detail: "Accepted and in progress", icon: Stethoscope, tone: "bg-emerald-50 text-emerald-700", path: "/dashboard/vet/my-list" },
        { label: "Online Consults", value: openConsultations.length, detail: "Scheduled or in progress", icon: Video, tone: "bg-amber-50 text-amber-700", path: "/dashboard/vet/online-consultations" },
        { label: "Record Requests", value: assignedRequests.length, detail: "Assigned updates", icon: UserCheck, tone: "bg-rose-50 text-rose-700", path: "/dashboard/vet/record-requests" },
        { label: "Schedule / TODOs", value: openTodos.length, detail: "Appointments and follow-ups", icon: Calendar, tone: "bg-violet-50 text-violet-700", path: "/dashboard/todos" },
      ],
      attentionTitle: "Patient Worklist",
      attentionItems: buildAttentionItems(roleKey, data, userId),
    };
  }

  const activeBookings = data.bookings.filter(isActiveBooking);
  const openTodos = data.todos.filter(task => !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(task.status)) && !task.completedAt);
  const completedBookings = data.bookings.filter(item => normalizeStatus(item.status) === "completed");

  return {
    title: "Pet Owner Live Overview",
    description: "Your pets, bookings, reminders, and completed visits stay synced from clinic records.",
    cards: [
      { label: "My Pets", value: data.pets.length, detail: "Registered under your account", icon: PawPrint, tone: "bg-blue-50 text-blue-700", path: "/dashboard/my-pets" },
      { label: "Active Bookings", value: activeBookings.length, detail: `${data.bookings.filter(item => isToday(item.date, item.time)).length} scheduled today`, icon: Calendar, tone: "bg-emerald-50 text-emerald-700", path: "/dashboard/my-pets" },
      { label: "Open To-dos", value: openTodos.length, detail: "Upcoming care reminders", icon: ListTodo, tone: "bg-amber-50 text-amber-700", path: "/dashboard/todos" },
      { label: "Completed Visits", value: completedBookings.length, detail: "Finished booking records", icon: CheckCircle2, tone: "bg-rose-50 text-rose-700", path: "/dashboard/my-pets" },
    ],
    attentionTitle: "Upcoming For You",
    attentionItems: buildAttentionItems(roleKey, data, userId),
  };
}

async function loadTask(label, promise, transform) {
  try {
    return { label, value: transform(await promise), error: null };
  } catch (error) {
    return { label, value: [], error };
  }
}

export default function Home({ user }) {
  const navigate = useNavigate();
  const userRole = user?.role || "";
  const roleKey = getRoleKey(userRole);
  const userId = getUserId(user);
  const dashboardFocus = getActionsForRole(roleKey);
  const displayName = getDisplayName(user);
  const [homeData, setHomeData] = useState(emptyHomeData);
  const [isLoading, setIsLoading] = useState(true);

  const loadHomeData = useCallback(async ({ isAutoRefresh = false } = {}) => {
    if (!isAutoRefresh) {
      setIsLoading(true);
    }

    const today = new Date();
    const todoStart = dateInputValue(today);
    const todoEnd = dateInputValue(addDays(today, 14));
    const tasks = [];

    if (roleKey === "petowner") {
      if (userId) {
        tasks.push(loadTask("pets", fetchUserPets(userId), response => valueArray(response, "pets")));
        tasks.push(loadTask("bookings", fetchUserBookings(userId), response => valueArray(response, "bookings")));
        tasks.push(loadTask("todos", fetchPetOwnerTodos(userId, { start: todoStart, end: todoEnd }), response => valueArray(response, "tasks")));
      }
    } else if (roleKey === "veterinarian") {
      tasks.push(loadTask("queues", fetchQueues(), response => valueArray(response, "queues")));
      tasks.push(loadTask("onlineConsultations", fetchOnlineConsultations({ vetId: userId }), response => valueArray(response, "consultations")));
      tasks.push(loadTask("recordRequests", fetchRecordUpdateRequests({ vetId: userId }), response => valueArray(response, "requests")));
      tasks.push(loadTask("todos", fetchPetOwnerTodos(userId, { start: todoStart, end: todoEnd, role: userRole }), response => valueArray(response, "tasks")));
    } else {
      tasks.push(loadTask("bookings", fetchBookings(), response => valueArray(response, "bookings")));
      tasks.push(loadTask("queues", fetchQueues(), response => valueArray(response, "queues")));
      tasks.push(loadTask("visits", fetchVisits(), response => valueArray(response, "visits")));
      tasks.push(loadTask("inventoryItems", fetchInventoryItems(), response => valueArray(response, "items")));
      tasks.push(loadTask("recordRequests", fetchRecordUpdateRequests(), response => valueArray(response, "requests")));
    }

    const results = await Promise.all(tasks);
    const nextData = {
      ...emptyHomeData,
      errors: results.filter(result => result.error).map(result => result.label),
    };

    results.forEach((result) => {
      nextData[result.label] = result.value;
    });

    setHomeData(nextData);
    setIsLoading(false);
  }, [roleKey, userId, userRole]);

  useAutoRefresh(loadHomeData, {
    enabled: roleKey !== "petowner" || Boolean(userId),
    refreshKey: `home-${roleKey}-${userId || "no-user"}`,
  });

  const roleSummary = useMemo(() => buildRoleSummary(roleKey, homeData, userId), [homeData, roleKey, userId]);
  const SecondaryIcon = dashboardFocus.secondary.icon;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-blue-50 text-blue-700">{dashboardFocus.eyebrow}</Badge>
              <Badge className="border-0 bg-emerald-50 text-emerald-700">Open daily {CLINIC_DETAILS.hours}</Badge>
              {isLoading ? (
                <Badge className="border-0 bg-slate-100 text-slate-600">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Syncing
                </Badge>
              ) : (
                <Badge className="border-0 bg-slate-100 text-slate-600">
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Live
                </Badge>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
              {roleSummary.description}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => navigate(dashboardFocus.actions[0].path)} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                <Plus className="mr-2 h-4 w-4" />
                Start Main Task
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(dashboardFocus.secondary.path)}>
                <SecondaryIcon className="mr-2 h-4 w-4" />
                {dashboardFocus.secondary.label}
              </Button>
            </div>
          </div>
          <div className="relative min-h-56 bg-slate-950 lg:min-h-full">
            <img src={consultImage} alt="Online veterinary consultation" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-slate-950/35" aria-hidden="true" />
            <div className="relative flex h-full min-h-56 flex-col justify-end p-5 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-100">Role home</p>
              <p className="mt-2 text-2xl font-black">{roleSummary.title}</p>
              <p className="mt-1 text-sm font-semibold text-white/80">Synced from the records used by your dashboard pages.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Quick actions</p>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{dashboardFocus.heading}</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardFocus.actions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.title}
                type="button"
                onClick={() => navigate(action.path)}
                className="group rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${action.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-base font-black text-slate-950 group-hover:text-[#155dfc]">{action.title}</span>
                <span className="mt-2 block text-sm font-medium leading-6 text-slate-600">{action.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Live information</p>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{roleSummary.title}</h2>
          </div>
          {homeData.errors.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Some data could not load: {homeData.errors.join(", ")}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {roleSummary.cards.map((item) => (
            <SummaryCard key={item.label} item={item} onOpen={() => navigate(item.path)} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
              <ShieldCheck className="h-5 w-5 text-[#155dfc]" />
              {roleSummary.attentionTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roleSummary.attentionItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                No active items need attention right now.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {roleSummary.attentionItems.map((item) => (
                  <button
                    key={`${item.path}-${item.title}-${item.detail}`}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{item.detail}</p>
                      </div>
                      <Badge className="shrink-0 border-0 bg-white text-slate-600">{item.badge}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
              <Clock className="h-5 w-5 text-[#155dfc]" />
              Clinic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoBlock icon={Clock} label="Hours" value={`Daily, ${CLINIC_DETAILS.hours}`} />
            <InfoBlock icon={MapPin} label="Address" value={CLINIC_DETAILS.address} />
            <InfoBlock icon={CheckCircle2} label="Contact" value={CLINIC_DETAILS.phone} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({ item, onOpen }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-right text-2xl font-black text-slate-950">{formatCount(item.value)}</span>
      </div>
      <span className="mt-4 block text-sm font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</span>
      <span className="mt-2 block text-sm font-semibold leading-5 text-slate-700">{item.detail}</span>
    </button>
  );
}

function InfoBlock({ icon, label, value }) {
  const IconComponent = icon;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
          <IconComponent className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

Home.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.string,
    firstName: PropTypes.string,
    FirstName: PropTypes.string,
    first_name: PropTypes.string,
    lastName: PropTypes.string,
    LastName: PropTypes.string,
    last_name: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
  }),
};

SummaryCard.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    detail: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    tone: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
};

InfoBlock.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};
