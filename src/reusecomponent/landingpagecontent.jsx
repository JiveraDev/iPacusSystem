import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
    ArrowRight,
    CalendarCheck,
    Check,
    ChevronRight,
    ClipboardList,
    Clock,
    ExternalLink,
    FileText,
    Hotel,
    ListTodo,
    Mail,
    MapPin,
    Menu,
    MonitorSmartphone,
    Package,
    PawPrint,
    Phone,
    Receipt,
    Scissors,
    ShieldCheck,
    Sparkles,
    Stethoscope,
    Syringe,
    Video,
    X,
} from 'lucide-react';

import vetImage from '../assets/vetImage.png';
import consultImage from '../assets/consultimage.png';
import logoImage from '../assets/circular_logo.png';
import PwaInstallButton from '../pwa/PwaInstallButton.jsx';
import ClinicAvailabilityCalendar from '../components/shared/ClinicAvailabilityCalendar.jsx';
import { saveBookingAvailabilitySelection } from '../lib/bookingAvailabilityNavigation.js';

const clinicDetails = {
    name: 'Vetfocus Care Animal Clinic',
    product: 'iPawcus',
    hours: '8:00 AM - 6:00 PM',
    openDays: 'Monday - Saturday',
    phone: '(042) 421-9086 / 0933 476 8522',
    email: 'support@ipawcus.com',
};

const clinicLocations = [
    {
        code: 'MAIN',
        name: 'VFC Pharmacy / Main Clinic',
        type: 'Main clinic and pharmacy',
        address: 'Oakbrook Avenue corner Clayton Street, Phase 3, Pleasantville Subdivision, Barangay Ilayang Iyam, Lucena City, Quezon 4301, Philippines',
    },
    {
        code: 'ENRIQUEZ',
        name: 'VFC Pet Corner Main Enriquez St.',
        type: 'Pet Corner',
        address: 'Enriquez St. corner Barcelona St., Barangay 2, Lucena City, Quezon 4301, Philippines',
    },
].map(location => ({
    ...location,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}`)}`,
}));

const navigationItems = [
    { label: 'Services', href: '#services' },
    { label: 'Availability', href: '#availability' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Records', href: '#records' },
    { label: 'Boarding', href: '#boarding' },
    { label: 'Contact', href: '#contact' },
];

const serviceGroups = [
    {
        id: 'owner',
        label: 'Owner Portal',
        Icon: PawPrint,
        title: 'Pet profiles, service requests, and status updates in one account',
        description:
            'Owners can register pets, book services, view queue or booking progress, and return to medical records after the visit.',
        items: ['Pet profiles', 'My Pets records', 'Booking updates', 'Self-service queue'],
        note: 'Best for owners who need a clear path from registration to clinic follow-up.',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    {
        id: 'clinic',
        label: 'Clinic Care',
        Icon: Stethoscope,
        title: 'General check-ups, dental care, surgery requests, and lab work',
        description:
            'Clinic services route through booking review or queue management so the team can prepare the right visit flow.',
        items: ['General check-up', 'Dental check-up', 'Surgery request', 'Laboratory testing'],
        note: 'Diagnosis records, notes, prescriptions, and charges are connected after the visit.',
        tone: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
        id: 'preventive',
        label: 'Preventive Care',
        Icon: Syringe,
        title: 'Vaccination and parasite-control records that stay readable',
        description:
            'Preventive visits can create simple vaccination rows and keep due dates visible from the pet profile.',
        items: ['Vaccination', 'Parasite control', 'Deworming notes', 'Due-date tracking'],
        note: 'Vaccine charges can be billed while materials and stock usage stay managed internally.',
        tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    },
    {
        id: 'comfort',
        label: 'Care Services',
        Icon: Scissors,
        title: 'Grooming, home service, special services, and boarding requests',
        description:
            'Service bookings collect pet details, notes, schedules, and owner requests before the admin confirms the final service.',
        items: ['Grooming', 'Home service', 'Special services', 'Pet hotel and boarding'],
        note: 'Pending bookings can be reviewed by the admin before confirmation.',
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
        id: 'online',
        label: 'Online Consult',
        Icon: Video,
        title: 'Online consultation for non-emergency concerns',
        description:
            'Owners can request a scheduled video consultation, submit the PHP 500 payment flow, and receive vet notes afterward.',
        items: ['Vet schedule selection', 'Payment submission', 'Video session', 'Consult summary'],
        note: 'If the admin books it directly, the payment can still be completed through POS.',
        tone: 'border-rose-200 bg-rose-50 text-rose-700',
    },
];

const workflowSteps = [
    {
        title: 'Register the pet',
        text: 'Create an owner account, add pet details, and keep pet-specific records in the dashboard.',
        Icon: PawPrint,
    },
    {
        title: 'Book or queue',
        text: 'Choose a service booking, request online consultation, or join the self-service queue when available.',
        Icon: CalendarCheck,
    },
    {
        title: 'Admin review',
        text: 'Pending bookings can be reviewed, adjusted before confirmation, assigned, or moved into the clinic queue.',
        Icon: ClipboardList,
    },
    {
        title: 'Diagnosis and prescription',
        text: 'Veterinarians record findings, notes, vaccination details, and prescriptions into the pet history.',
        Icon: Stethoscope,
    },
    {
        title: 'Invoice and receipt',
        text: 'POS uses service catalog pricing, inventory items, prescriptions, and visit charges for the final bill.',
        Icon: Receipt,
    },
];

const systemFeatures = [
    {
        title: 'Booking management',
        text: 'Admin-reviewed requests for general services, home service, special services, boarding, and online consults.',
        Icon: CalendarCheck,
    },
    {
        title: 'Queue management',
        text: 'Pet queues connect front-desk intake to veterinarian work lists and completed diagnosis records.',
        Icon: ListTodo,
    },
    {
        title: 'Service catalog',
        text: 'Catalog services hold base prices and related materials so estimates and invoice lines stay consistent.',
        Icon: ClipboardList,
    },
    {
        title: 'Inventory-aware POS',
        text: 'Medication and product charges come from inventory while consumed materials can be deducted internally.',
        Icon: Package,
    },
    {
        title: 'Medical records',
        text: 'Diagnosis summaries, vaccination rows, prescription PDF documents, and attachments stay with the pet.',
        Icon: FileText,
    },
    {
        title: 'Receipt preview',
        text: 'The POS supports invoice preview and print-ready receipts for completed clinic transactions.',
        Icon: Receipt,
    },
];

const recordCards = [
    {
        title: 'Vaccination rows',
        text: 'Vaccine name, date given, next due date, and veterinarian are shown in a compact mobile-friendly record.',
        Icon: Syringe,
    },
    {
        title: 'Diagnosis summaries',
        text: 'Vet notes, findings, treatment, follow-up dates, and charges can be reviewed after the visit.',
        Icon: ShieldCheck,
    },
    {
        title: 'Prescription documents',
        text: 'Finished prescriptions are saved as image documents and can also be added to draft invoices when needed.',
        Icon: FileText,
    },
];

const boardingStatuses = [
    { label: 'Available', text: 'Ready for a booking', className: 'bg-emerald-500 text-white' },
    { label: 'Staying in', text: 'Pet currently checked in', className: 'bg-blue-500 text-white' },
    { label: 'Maintenance', text: 'Temporarily unavailable', className: 'bg-red-500 text-white' },
];

const updates = [
    {
        title: 'Catalog-based estimates',
        text: 'Boarding and invoice estimates can use service catalog prices instead of separate hard-coded amounts.',
        Icon: ClipboardList,
    },
    {
        title: 'Prescription-ready records',
        text: 'Diagnosis prescriptions are preserved for the pet and can be pulled into the invoice when appropriate.',
        Icon: FileText,
    },
    {
        title: 'Monday-Saturday clinic access',
        text: `The clinic is open ${clinicDetails.openDays} from ${clinicDetails.hours}. All locations are closed on Sunday.`,
        Icon: Clock,
    },
];

const guidelines = [
    'Arrive 10 minutes before your scheduled visit.',
    'Bring previous vaccination or medical records for first-time visits.',
    'Use a leash, carrier, or secure handling while inside the clinic.',
    'Tell the team about behavior concerns before handling.',
    'For urgent symptoms, contact the clinic before relying on online booking.',
];

const quickStats = [
    { label: 'Clinic hours', value: 'Mon-Sat, 8AM-6PM' },
    { label: 'Online consult', value: 'PHP 500' },
    { label: 'Billing source', value: 'Catalog' },
];

export default function LandingPageContent({ onLogin, onRegister }) {
    const [activeServiceId, setActiveServiceId] = useState(serviceGroups[0].id);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeService = useMemo(
        () => serviceGroups.find((service) => service.id === activeServiceId) || serviceGroups[0],
        [activeServiceId],
    );

    const ActiveServiceIcon = activeService.Icon;

    const closeMobileMenu = () => setIsMobileMenuOpen(false);
    const handleLogin = () => {
        closeMobileMenu();
        onLogin?.();
    };
    const handleRegister = () => {
        closeMobileMenu();
        onRegister?.();
    };
    const handleAvailabilityBooking = (selection) => {
        saveBookingAvailabilitySelection(selection);
        handleLogin();
    };
    const handleHashNavigation = (event, href) => {
        event.preventDefault();
        closeMobileMenu();

        const targetId = String(href || '').replace(/^#/, '');
        const target = targetId === 'top'
            ? document.getElementById('top')
            : document.getElementById(targetId);

        if (!target) {
            return;
        }

        window.history.pushState({}, '', href);

        window.requestAnimationFrame(() => {
            const headerOffset = (document.querySelector('header')?.offsetHeight || 76) + 8;
            const top = targetId === 'top'
                ? 0
                : target.getBoundingClientRect().top + window.scrollY - headerOffset;

            window.scrollTo({
                top: Math.max(top, 0),
                behavior: 'smooth',
            });
        });
    };

    return (
        <div className="min-w-0 overflow-x-hidden bg-[#f6f8fb] text-slate-950">
            <header className="sticky top-0 z-40 border-b border-slate-200  backdrop-blur">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                    <a href="#top" className="flex min-w-0 items-center gap-3" aria-label={`${clinicDetails.name} home`} onClick={(event) => handleHashNavigation(event, '#top')}>
                        <img src={logoImage} alt={`${clinicDetails.name} logo`} className="h-11 w-11 shrink-0 object-contain" />
                        <div className="min-w-0">
                            <div className="text-[13px] font-bold leading-tight text-slate-950 sm:text-base lg:text-lg">{clinicDetails.name}</div>
                            <div className="mt-0.5 text-[10px] font-medium text-slate-500 sm:text-xs">Powered by {clinicDetails.product}</div>
                        </div>
                    </a>

                    <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
                        {navigationItems.map((item) => (
                            <a key={item.href} href={item.href} onClick={(event) => handleHashNavigation(event, item.href)} className="transition hover:text-slate-950">
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden items-center gap-2 sm:flex">
                            <div className="hidden lg:block">
                                <PwaInstallButton collapsible className="h-10" />
                            </div>
                            <button
                                type="button"
                                onClick={handleLogin}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                                Login
                            </button>
                            <button
                                type="button"
                                onClick={handleRegister}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#155dfc] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d4acf]"
                            >
                                Register
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <button
                            type="button"
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="landing-mobile-menu"
                            aria-label={isMobileMenuOpen ? 'Hide navigation menu' : 'Show navigation menu'}
                            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 lg:hidden"
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                        </button>
                    </div>
                </div>

                {isMobileMenuOpen && (
                    <div id="landing-mobile-menu" className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden">
                        <nav className="mx-auto grid w-full max-w-7xl gap-2">
                            {navigationItems.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    onClick={(event) => handleHashNavigation(event, item.href)}
                                    className="rounded-lg px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                                >
                                    {item.label}
                                </a>
                            ))}
                            <PwaInstallButton className="mt-1 h-11 w-full justify-center lg:hidden" />
                        </nav>
                        <div className="mx-auto mt-3 grid w-full max-w-7xl grid-cols-2 gap-2 sm:hidden">
                            <button
                                type="button"
                                onClick={handleLogin}
                                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
                            >
                                Login
                            </button>
                            <button
                                type="button"
                                onClick={handleRegister}
                                className="rounded-lg bg-[#155dfc] px-4 py-3 text-sm font-bold text-white"
                            >
                                Register
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main id="top">
                <section
                    className="relative flex min-h-[76svh] items-center overflow-hidden bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8"
                    style={{
                        backgroundImage: `url(${vetImage})`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                    }}
                >
                    <div className="absolute inset-0 bg-slate-950/65" aria-hidden="true" />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/70 to-transparent" aria-hidden="true" />
                    <div className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
                        <div className="max-w-3xl">
                            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                                <MonitorSmartphone className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                                Connected pet care for owners and clinic staff
                            </div>
                            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                                {clinicDetails.name}
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-white/[0.86] sm:text-lg">
                                Book clinic services, online consultation, grooming, home service, and pet hotel or
                                boarding while keeping pet records, prescriptions, queue updates, and receipts easier to follow.
                            </p>
                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={handleRegister}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-slate-100"
                                >
                                    Create Pet Profile
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <a
                                    href="#workflow"
                                    onClick={(event) => handleHashNavigation(event, '#workflow')}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.35] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                                >
                                    See Clinic Flow
                                    <PawPrint className="h-4 w-4" aria-hidden="true" />
                                </a>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            {quickStats.map((stat) => (
                                <div key={stat.label} className="rounded-lg border border-white/20 bg-white/[0.12] p-4 backdrop-blur">
                                    <div className="text-xl font-bold text-white sm:text-2xl">{stat.value}</div>
                                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-b border-slate-200 bg-white">
                    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-3 lg:px-8">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                <Clock className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-950">Open Monday-Saturday</div>
                                <div className="mt-1 text-sm text-slate-600">{clinicDetails.hours} · Sunday closed</div>
                            </div>
                        </div>
                        <a
                            href="#contact"
                            onClick={(event) => handleHashNavigation(event, '#contact')}
                            className="group flex items-start gap-3 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <MapPin className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-950 transition group-hover:text-emerald-700">
                                    {clinicLocations.length} Lucena locations
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div className="mt-1 text-sm text-slate-600 underline-offset-4 group-hover:underline">Main clinic and VFC Pet Corner Main, Enriquez St.</div>
                            </div>
                        </a>
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                <Video className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-950">Online consults</div>
                                <div className="mt-1 text-sm text-slate-600">PHP 500 non-emergency video consultation</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="services" className="bg-[#f6f8fb] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <div className="max-w-3xl">
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Services</div>
                            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                                Clear choices that match the current system.
                            </h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                The landing page now reflects the real service categories and the records, booking, and billing flows available in the app.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                {serviceGroups.map((service) => {
                                    const ServiceIcon = service.Icon;
                                    const isActive = service.id === activeService.id;

                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => setActiveServiceId(service.id)}
                                            className={`flex min-h-20 items-center justify-between gap-4 rounded-lg border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                                                isActive ? 'border-blue-300 shadow-sm ring-2 ring-blue-100' : 'border-slate-200'
                                            }`}
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${service.tone}`}>
                                                    <ServiceIcon className="h-5 w-5" aria-hidden="true" />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-bold text-slate-950">{service.label}</span>
                                                    <span className="mt-1 block text-xs font-medium text-slate-500">{service.items[0]}</span>
                                                </span>
                                            </span>
                                            <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} aria-hidden="true" />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg border ${activeService.tone}`}>
                                            <ActiveServiceIcon className="h-6 w-6" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-5 text-2xl font-bold text-slate-950">{activeService.title}</h3>
                                        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{activeService.description}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 md:max-w-xs">
                                        {activeService.note}
                                    </div>
                                </div>
                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    {activeService.items.map((item) => (
                                        <div key={item} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                                            <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="availability" className="bg-white px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <div className="mb-8 max-w-3xl">
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Live availability</div>
                            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Check a date before starting your booking.</h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                Pending requests already reserve their time. Select a service and date to see available appointments or boarding room counts.
                            </p>
                        </div>
                        <ClinicAvailabilityCalendar
                            title="Appointment and room availability"
                            description="Select an available time or room to continue through the secure owner login."
                            onSelectSlot={handleAvailabilityBooking}
                            onSelectRoom={handleAvailabilityBooking}
                        />
                    </div>
                </section>

                <section id="workflow" className="bg-[#102a43] px-4 py-14 text-white sm:px-6 lg:px-8">
                    <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-center">
                        <div>
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200">Workflow</div>
                            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                                From owner request to final receipt.
                            </h2>
                            <div className="mt-8 grid gap-4">
                                {workflowSteps.map((step, index) => {
                                    const StepIcon = step.Icon;

                                    return (
                                        <div key={step.title} className="flex gap-4 rounded-lg border border-white/[0.15] bg-white/[0.08] p-4">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-200 text-slate-950">
                                                <StepIcon className="h-5 w-5" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Step {index + 1}</div>
                                                <h3 className="mt-1 font-bold text-white">{step.title}</h3>
                                                <p className="mt-1 text-sm leading-6 text-white/75">{step.text}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-white/[0.15] bg-white/10 shadow-2xl">
                            <img src={consultImage} alt="Veterinarian online consultation" className="aspect-[4/3] h-full w-full object-cover" />
                            <div className="p-5">
                                <div className="flex items-center gap-2 text-sm font-bold text-cyan-100">
                                    <Video className="h-5 w-5" aria-hidden="true" />
                                    Online consultation
                                </div>
                                <p className="mt-2 text-sm leading-6 text-white/75">
                                    PHP 500 session flow with schedule selection, payment submission, and consultation summary records.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="records" className="bg-[#f6f8fb] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <div className="max-w-3xl">
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Records and billing</div>
                            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                                Medical details and invoice details stay aligned.
                            </h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                The system supports diagnosis notes, vaccination records, prescription PDF documents,
                                service catalog prices, inventory products, and receipt preview in the POS.
                            </p>
                        </div>

                        <div className="mt-9 grid gap-5 md:grid-cols-3">
                            {recordCards.map((record) => {
                                const RecordIcon = record.Icon;

                                return (
                                    <article key={record.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                            <RecordIcon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-5 text-lg font-bold text-slate-950">{record.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{record.text}</p>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {systemFeatures.map((feature) => {
                                const FeatureIcon = feature.Icon;

                                return (
                                    <div key={feature.title} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                            <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-950">{feature.title}</h3>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">{feature.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section id="boarding" className="bg-white px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
                        <div>
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">Pet hotel and boarding</div>
                            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                                Boarding stays use availability and catalog-based pricing.
                            </h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                Owners can request pet hotel or boarding dates. Admin staff can search pets, assign rooms,
                                check pets in, and use catalog pricing for estimates.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-2">
                                {['Room search', 'Check-in tracking', 'Add-on services', 'Estimated total'].map((item) => (
                                    <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                    <Hotel className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-950">Room status colors</h3>
                                    <p className="mt-1 text-sm text-slate-600">The boarding board uses clear room states.</p>
                                </div>
                            </div>
                            <div className="mt-5 grid gap-3">
                                {boardingStatuses.map((status) => (
                                    <div key={status.label} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
                                        <div>
                                            <div className="text-sm font-bold text-slate-950">{status.label}</div>
                                            <div className="mt-1 text-sm text-slate-600">{status.text}</div>
                                        </div>
                                        <span className={`h-8 min-w-24 rounded-lg px-3 py-1.5 text-center text-xs font-bold ${status.className}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="updates" className="bg-[#f6f8fb] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                            <div>
                                <div className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Current system notes</div>
                                <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                                    Information is focused on what the app supports now.
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleRegister}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 md:w-auto"
                            >
                                Start Booking
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mt-8 grid gap-5 md:grid-cols-3">
                            {updates.map((update) => {
                                const UpdateIcon = update.Icon;

                                return (
                                    <article key={update.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                            <UpdateIcon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-5 text-lg font-bold text-slate-950">{update.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{update.text}</p>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section id="contact" className="bg-white px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                        <div>
                            <div className="text-sm font-bold uppercase tracking-[0.16em] text-rose-700">VFC locations</div>
                            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Find the location nearest to you.</h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                {clinicDetails.name} currently connects two Lucena locations through {clinicDetails.product}: the VFC Pharmacy / Main Clinic and VFC Pet Corner Main Enriquez St.
                                Select a location below to open its address in Google Maps.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {clinicLocations.map(location => (
                                    <a
                                        key={location.code}
                                        href={location.mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Open ${location.name} in Google Maps`}
                                        className="group flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                                            <MapPin className="h-4.5 w-4.5" aria-hidden="true" />
                                        </div>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-bold text-slate-950 group-hover:text-rose-800">{location.name}</span>
                                                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-rose-700" aria-hidden="true" />
                                            </span>
                                            <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{location.type}</span>
                                            <span className="mt-2 block text-sm leading-5 text-slate-600 underline-offset-4 group-hover:underline">{location.address}</span>
                                        </span>
                                    </a>
                                ))}
                            </div>

                            <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                                <div className="flex items-start gap-3 text-sm text-slate-700">
                                    <Clock className="h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                                    <span><strong className="block text-slate-950">Clinic hours</strong>{clinicDetails.openDays}, {clinicDetails.hours}<span className="block text-slate-500">Sunday closed</span></span>
                                </div>
                                <div className="flex items-start gap-3 text-sm text-slate-700">
                                    <Phone className="h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                                    <span><strong className="block text-slate-950">Contact</strong>{clinicDetails.phone}</span>
                                </div>
                                <div className="flex items-start gap-3 text-sm text-slate-700">
                                    <Mail className="h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                                    <span className="min-w-0"><strong className="block text-slate-950">Email</strong><span className="break-all">{clinicDetails.email}</span></span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-950">Before your visit</h3>
                            </div>
                            <ul className="mt-5 grid gap-3">
                                {guidelines.map((guideline) => (
                                    <li key={guideline} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                        <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                        <span>{guideline}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <img src={logoImage} alt={`${clinicDetails.name} logo`} className="h-10 w-10 object-contain" />
                        <div>
                            <div className="font-bold">{clinicDetails.name}</div>
                            <div className="text-sm text-white/60">Powered by {clinicDetails.product}</div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                        {navigationItems.map((item) => (
                            <a key={item.href} href={item.href} onClick={(event) => handleHashNavigation(event, item.href)} className="hover:text-white">
                                {item.label}
                            </a>
                        ))}
                    </div>
                    <div className="text-sm text-white/60">(c) 2026 {clinicDetails.name}</div>
                </div>
            </footer>
        </div>
    );
}

LandingPageContent.propTypes = {
    onLogin: PropTypes.func,
    onRegister: PropTypes.func,
};
