import {
    Activity,
    ArrowUpRight,
    Bug,
    Check,
    FlaskConical,
    Heart,
    Home as HomeIcon,
    Hotel,
    Info,
    Scissors,
    Sparkles,
    Stethoscope,
    Syringe,
} from 'lucide-react';
import { useNavigate } from '../dashboardRouter.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import MyBookings from './MyBookings.jsx';
import ServicePetPeek from '../shared/ServicePetPeek.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

const services = [
    {
        id: 'general-checkup',
        title: 'General Check-up',
        description: 'A complete wellness examination and care recommendation.',
        icon: Stethoscope,
        pet: 'dog',
        path: '/dashboard/services/general-checkup',
    },
    {
        id: 'parasite-control',
        title: 'Parasite Control',
        description: 'Prevention and treatment plans for common parasites.',
        icon: Bug,
        pet: 'cat',
        path: '/dashboard/services/parasite-control',
    },
    {
        id: 'laboratory-testing',
        title: 'Laboratory Testing',
        description: 'Diagnostic testing in the clinic or during a veterinarian visit.',
        icon: FlaskConical,
        pet: 'bunny',
        path: '/dashboard/services/laboratory-testing',
    },
    {
        id: 'surgery',
        title: 'Surgery',
        description: 'Surgical assessment, procedures, and post-operative care.',
        icon: Activity,
        pet: 'dog',
        path: '/dashboard/services/surgery',
    },
    {
        id: 'vaccination',
        title: 'Vaccination',
        description: 'Essential immunizations and scheduled booster doses.',
        icon: Syringe,
        pet: 'cat',
        path: '/dashboard/services/vaccination',
    },
    {
        id: 'grooming',
        title: 'Grooming',
        description: 'Professional coat, nail, ear, and hygiene care.',
        icon: Scissors,
        pet: 'bunny',
        path: '/dashboard/services/grooming',
    },
    {
        id: 'dental-checkup',
        title: 'Dental Check-up',
        description: 'Oral health assessment and preventive dental care.',
        icon: Heart,
        pet: 'dog',
        path: '/dashboard/services/dental-checkup',
    },
    {
        id: 'home-services',
        title: 'Home Services',
        description: 'Selected veterinary services delivered at your address.',
        icon: HomeIcon,
        pet: 'cat',
        path: '/dashboard/services/home-services',
    },
    {
        id: 'pet-hotel',
        title: 'Pet Hotel & Boarding',
        description: 'Supervised accommodation and daily care for your pet.',
        icon: Hotel,
        pet: 'bunny',
        path: '/dashboard/services/pet-hotel',
    },
    {
        id: 'special-services',
        title: 'Special Services',
        description: 'Specialized care packages based on your pet’s needs.',
        icon: Sparkles,
        pet: 'parrot',
        path: '/dashboard/services/special-services',
    },
];

const bookingNotes = [
    'Clinic approval is required before a service is confirmed.',
    'Payment is collected after the booking has been reviewed.',
    'Status changes and next steps appear in your notifications.',
    'Cancel at least 24 hours before the scheduled appointment.',
];

export default function Services({ user }) {
    const navigate = useNavigate();
    const role = String(user?.role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    const canViewPersonalBookings = role === 'pet owner' || role === 'super admin';

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <DashboardPageHeader
                title="Pet Services"
                description="Choose the care your pet needs, review the details, and continue to a guided booking flow."
                actions={canViewPersonalBookings ? <MyBookings user={user} /> : null}
            />

            <section aria-labelledby="services-heading">
                <div className="mb-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Care directory</p>
                    <h2 id="services-heading" className="mt-1 text-lg font-black text-slate-950 dark:text-white">Select a service</h2>
                </div>

                <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    {services.map((service) => {
                        const Icon = service.icon;

                        return (
                            <button
                                key={service.id}
                                type="button"
                                data-motion="card"
                                onClick={() => navigate(service.path)}
                                className="dashboard-service-card group relative isolate flex h-full min-h-48 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-950/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
                            >
                                <span className="flex w-full items-start justify-between gap-4">
                                    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-blue-50 to-blue-100 shadow-sm shadow-blue-950/10 transition-[border-color,box-shadow] duration-200 group-hover:border-blue-300 group-hover:shadow-md group-hover:shadow-blue-900/15 dark:border-blue-900/70 dark:from-slate-900 dark:via-blue-950/50 dark:to-blue-900/40">
                                        <span className="pointer-events-none absolute -right-3 -top-3 size-8 rounded-full bg-blue-300/35 blur-sm dark:bg-blue-500/20" aria-hidden="true" />
                                        <span className="relative flex size-10 items-center justify-center rounded-xl bg-[#155dfc] text-white shadow-md shadow-blue-900/20 transition-transform duration-200 ease-out group-hover:-rotate-3 group-hover:scale-105 motion-reduce:transform-none">
                                            <Icon className="size-5" strokeWidth={2.1} aria-hidden="true" />
                                        </span>
                                        <span className="absolute bottom-1.5 right-1.5 size-1.5 rounded-full border border-white bg-sky-400 dark:border-slate-900" aria-hidden="true" />
                                    </span>
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-[border-color,background-color,color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700 motion-reduce:transform-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:border-blue-800 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-300">
                                        <ArrowUpRight className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                                    </span>
                                </span>
                                <span className="mt-5 block text-base font-black text-slate-950 group-hover:text-blue-800 dark:text-white dark:group-hover:text-blue-300">
                                    {service.title}
                                </span>
                                <span className="mt-2 block text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                                    {service.description}
                                </span>
                                <ServicePetPeek kind={service.pet} accent="blue" />
                                <span className="mt-auto pt-4 text-xs font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                                    View & book
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <Card className="border-blue-100 bg-blue-50/60 shadow-none dark:border-blue-900/60 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
                        <Info className="size-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                        Before you book
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300 md:grid-cols-2">
                        {bookingNotes.map((note) => (
                            <li key={note} className="flex items-start gap-2.5">
                                <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#155dfc] text-white">
                                    <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                                </span>
                                <span>{note}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
