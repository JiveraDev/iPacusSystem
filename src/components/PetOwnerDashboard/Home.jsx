import PropTypes from "prop-types";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Hotel,
  ListTodo,
  MapPin,
  Package,
  PawPrint,
  Plus,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Video,
} from "lucide-react";

import { useNavigate } from "../dashboardRouter.jsx";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import consultImage from "../../assets/consultimage.png";

const CLINIC_DETAILS = {
  hours: "8:00 AM - 6:00 PM",
  address: "Oakbrook Avenue, Phase 3, Pleasantville Subdivision, Corner Clayton, Ilayang Iyam, Lucena City",
  phone: "(042) 373-5678",
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
    title: "Queue",
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
    title: "Histories",
    description: "Search previous diagnosis records and follow-up details.",
    icon: FileText,
    path: "/dashboard/vet/histories",
    tone: "bg-rose-50 text-rose-700",
  },
];

const systemHighlights = [
  {
    title: "Booking to Queue",
    description: "Approved bookings can move into the clinic queue when the pet arrives.",
    icon: ClipboardList,
  },
  {
    title: "Diagnosis Records",
    description: "Vet notes, vaccination details, prescriptions, and follow-up dates stay with the pet.",
    icon: Stethoscope,
  },
  {
    title: "Catalog Pricing",
    description: "Service catalog prices feed boarding estimates and POS invoice lines.",
    icon: Receipt,
  },
  {
    title: "Inventory Usage",
    description: "Medication and products are billable, while internal materials can be deducted from stock.",
    icon: Package,
  },
];

const careRecords = [
  {
    title: "Vaccination",
    detail: "Compact vaccine rows show date given, next due date, and veterinarian.",
    icon: Syringe,
  },
  {
    title: "Prescription",
    detail: "Prescription image documents are saved with the pet after diagnosis.",
    icon: FileText,
  },
  {
    title: "Receipt",
    detail: "POS invoice preview and print-ready receipt support the final billing step.",
    icon: Receipt,
  },
];

const visitGuidelines = [
  "Arrive 10 minutes before the scheduled visit.",
  "Bring previous vaccination or medical records for first-time visits.",
  "Use a leash, carrier, or secure handling while inside the clinic.",
  "For urgent symptoms, contact the clinic before using online booking.",
];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function getDisplayName(user) {
  const firstName = user?.firstName || user?.FirstName || user?.first_name || "";
  const lastName = user?.lastName || user?.LastName || user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user?.name || user?.email || "there";
}

function getActionsForRole(role) {
  if (role.includes("admin") || role.includes("super")) {
    return {
      eyebrow: "Admin focus",
      heading: "Keep front-desk operations moving.",
      actions: adminActions,
    };
  }

  if (role.includes("veterinarian") || role === "vet") {
    return {
      eyebrow: "Veterinarian focus",
      heading: "Continue patient care from queue to diagnosis.",
      actions: vetActions,
    };
  }

  return {
    eyebrow: "Pet owner focus",
    heading: "Book care and review your pet records.",
    actions: ownerActions,
  };
}

export default function Home({ user }) {
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);
  const dashboardFocus = getActionsForRole(role);
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-blue-50 text-blue-700">{dashboardFocus.eyebrow}</Badge>
              <Badge className="border-0 bg-emerald-50 text-emerald-700">Open daily {CLINIC_DETAILS.hours}</Badge>
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
              iPawcus connects booking, queue intake, diagnosis records, prescriptions, boarding, inventory, and POS billing
              so the next clinic step is easier to understand.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => navigate(dashboardFocus.actions[0].path)} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                <Plus className="mr-2 h-4 w-4" />
                Start Main Task
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard/my-pets")}>
                <PawPrint className="mr-2 h-4 w-4" />
                View Pet Records
              </Button>
            </div>
          </div>
          <div className="relative min-h-56 bg-slate-950 lg:min-h-full">
            <img src={consultImage} alt="Online veterinary consultation" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-slate-950/35" aria-hidden="true" />
            <div className="relative flex h-full min-h-56 flex-col justify-end p-5 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-100">Online consultation</p>
              <p className="mt-2 text-2xl font-black">PHP 500</p>
              <p className="mt-1 text-sm font-semibold text-white/80">Scheduled video care for non-emergency concerns.</p>
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
              <ShieldCheck className="h-5 w-5 text-[#155dfc]" />
              Current System Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {systemHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-black text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black text-slate-950">Pet Record Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {careRecords.map((record) => {
              const Icon = record.icon;

              return (
                <div key={record.title} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-black text-slate-950">{record.title}</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{record.detail}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black text-slate-950">Before Your Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {visitGuidelines.map((guideline) => (
                <div key={guideline} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{guideline}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
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

InfoBlock.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};
