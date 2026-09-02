import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
    ArrowRight, CalendarCheck, Check, ChevronRight, Clock, ExternalLink, FileHeart,
    HeartPulse, Mail, MapPin, Menu, MessageCircleHeart, PawPrint, Phone, Play,
    Scissors, ShieldCheck, Sparkles, Stethoscope, Syringe, Video, X,
} from 'lucide-react';

import consultImage from '../consultimage.png';
import vetImage from '../vetImage.png';
import logoImage from '../circular_logo.png';
import PwaInstallButton from '../../pwa/PwaInstallButton.jsx';
import ClinicAvailabilityCalendar from '../../components/shared/ClinicAvailabilityCalendar.jsx';
import ServicePetPeek from '../../components/shared/ServicePetPeek.jsx';
import { saveBookingAvailabilitySelection } from '../../lib/bookingAvailabilityNavigation.js';

const PetStage = lazy(() => import('./PetStage.jsx'));

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MOTION = Object.freeze({
    menu: 0.24,
    control: 0.2,
    showcase: 0.38,
    reveal: 0.52,
    hero: 0.62,
    microStagger: 0.03,
    contentStagger: 0.04,
    heroStagger: 0.065,
});

const clinic = {
    name: 'Vetfocus Care Animal Clinic', product: 'iPawcus', hours: '8:00 AM - 6:00 PM',
    openDays: 'Monday - Saturday', phone: '(042) 421-9086 / 0933 476 8522', email: 'support@ipawcus.com',
};

const locations = [
    { code: 'MAIN', name: 'VFC Pharmacy / Main Clinic', type: 'Main clinic and pharmacy', address: 'Oakbrook Avenue corner Clayton Street, Phase 3, Pleasantville Subdivision, Barangay Ilayang Iyam, Lucena City, Quezon 4301, Philippines' },
    { code: 'ENRIQUEZ', name: 'VFC Pet Corner Main Enriquez St.', type: 'Pet Corner', address: 'Enriquez St. corner Barcelona St., Barangay 2, Lucena City, Quezon 4301, Philippines' },
].map((item) => ({ ...item, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${item.address}`)}` }));

const navigation = [
    { label: 'Care', href: '#services' }, { label: 'Book', href: '#availability' },
    { label: 'How it works', href: '#journey' }, { label: 'Locations', href: '#contact' },
];

const services = [
    { id: 'consultation', pet: 'dog', eyebrow: 'Clinic consultation', title: 'A calmer check-up, from nose to tail.', description: 'Book general check-ups, dental care, laboratory testing, surgery review, and other clinic services around your pet’s needs.', detail: 'In-clinic care', Icon: Stethoscope, media: '/landing-media/vet-consultation.mp4', poster: vetImage, accent: 'mint' },
    { id: 'vaccination', pet: 'cat', eyebrow: 'Preventive care', title: 'Vaccination records that remember the next step.', description: 'Plan vaccines and parasite-control visits, then keep the date given, veterinarian, and next due date with the pet profile.', detail: 'Vaccines & prevention', Icon: Syringe, media: '/landing-media/pet-vaccination.mp4', poster: vetImage, accent: 'coral' },
    { id: 'grooming', pet: 'bunny', eyebrow: 'Grooming', title: 'Fresh coats, tidy paws, happier pets.', description: 'Request a grooming schedule with pet details and notes so the care team can prepare before confirming the visit.', detail: 'Coat, paw & hygiene care', Icon: Scissors, media: '/landing-media/pet-grooming.mp4', poster: vetImage, accent: 'sun' },
    { id: 'online', pet: 'parrot', eyebrow: 'Online consultation', title: 'Talk to a doctor without leaving your pet’s side.', description: 'For non-emergency concerns, choose a veterinary schedule, complete the PHP 500 consultation flow, and receive notes afterward.', detail: 'Video consult · PHP 500', Icon: Video, image: consultImage, accent: 'blue' },
];

const journey = [
    { number: '01', title: 'Tell us about your pet', text: 'Create a profile for a dog, cat, bird, rabbit, or other companion and choose the care they need.', Icon: PawPrint },
    { number: '02', title: 'Choose a real opening', text: 'Check available dates before signing in, then continue with the service and schedule already selected.', Icon: CalendarCheck },
    { number: '03', title: 'Keep care connected', text: 'Follow booking updates and return to diagnosis notes, vaccinations, prescriptions, and receipts after the visit.', Icon: FileHeart },
];

function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);

    useGSAP(() => {
        const element = ref.current;
        if (!element) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set(element, { autoAlpha: 1, clearProps: 'transform' });
            return;
        }

        gsap.fromTo(element, {
            autoAlpha: 0,
            y: 18,
            scale: 0.99,
            willChange: 'transform,opacity',
        }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: MOTION.reveal,
            delay: delay / 1000,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility,willChange',
            scrollTrigger: {
                trigger: element,
                start: 'top 88%',
                once: true,
            },
        });
    }, { scope: ref });

    return <div ref={ref} className={`landing-reveal ${className}`}>{children}</div>;
}

Reveal.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string, delay: PropTypes.number };

function ServiceCard({ service, active, onSelect }) {
    const Icon = service.Icon;
    const tilt = (event) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--tilt-x', `${(((event.clientY - box.top) / box.height) - 0.5) * -5}deg`);
        event.currentTarget.style.setProperty('--tilt-y', `${(((event.clientX - box.left) / box.width) - 0.5) * 7}deg`);
    };
    const reset = (event) => { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg'); };
    return (
        <button type="button" onClick={onSelect} onPointerEnter={onSelect} onPointerMove={tilt} onPointerLeave={reset} aria-pressed={active} className={`landing-service-card landing-service-card--${service.accent} ${active ? 'is-active' : ''}`}>
            <span className="landing-service-card__orb" aria-hidden="true"><Icon className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">{service.eyebrow}</span><span className="mt-1.5 block text-left text-base font-black leading-tight text-slate-950 sm:text-lg">{service.title}</span></span>
            <ServicePetPeek kind={service.pet} accent={service.accent} />
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
    );
}

ServiceCard.propTypes = {
    service: PropTypes.shape({ accent: PropTypes.string.isRequired, pet: PropTypes.string.isRequired, eyebrow: PropTypes.string.isRequired, title: PropTypes.string.isRequired, Icon: PropTypes.elementType.isRequired }).isRequired,
    active: PropTypes.bool.isRequired, onSelect: PropTypes.func.isRequired,
};

export default function ModernLandingPageContent({ onLogin, onRegister }) {
    const rootRef = useRef(null);
    const showcaseRef = useRef(null);
    const [activeId, setActiveId] = useState(services[0].id);
    const [menuOpen, setMenuOpen] = useState(false);
    const activeService = useMemo(() => services.find((service) => service.id === activeId) || services[0], [activeId]);
    const ActiveIcon = activeService.Icon;
    const login = () => { setMenuOpen(false); onLogin?.(); };
    const register = () => { setMenuOpen(false); onRegister?.(); };
    const bookSelection = (selection) => { saveBookingAvailabilitySelection(selection); login(); };

    useGSAP(() => {
        const introElements = gsap.utils.toArray('.landing-enter');

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set(introElements, { autoAlpha: 1, clearProps: 'transform' });
            return;
        }

        gsap.timeline({ defaults: { ease: 'power3.out' } })
            .fromTo('.landing-header', { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.34 })
            .fromTo(introElements, { autoAlpha: 0, y: 22, willChange: 'transform,opacity' }, {
                autoAlpha: 1,
                y: 0,
                duration: MOTION.hero,
                stagger: MOTION.heroStagger,
                clearProps: 'transform,opacity,visibility,willChange',
            }, '-=0.14');
    }, { scope: rootRef });

    useGSAP(() => {
        const showcase = showcaseRef.current;
        if (!showcase || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        gsap.fromTo(
            showcase.querySelectorAll('.landing-service-showcase__media, .landing-service-showcase__copy > *'),
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: MOTION.showcase, stagger: MOTION.contentStagger, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
        );
    }, { scope: showcaseRef, dependencies: [activeId], revertOnUpdate: true });

    useGSAP(() => {
        if (!menuOpen) return undefined;

        const mobileMenu = rootRef.current?.querySelector('#landing-mobile-menu');
        const menuItems = mobileMenu?.querySelectorAll('nav > *');
        if (!mobileMenu || !menuItems?.length) return undefined;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set([mobileMenu, ...menuItems], { clearProps: 'all' });
            return undefined;
        }

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline.fromTo(mobileMenu, {
            autoAlpha: 0,
            y: -10,
        }, {
            autoAlpha: 1,
            y: 0,
            duration: MOTION.menu,
            clearProps: 'transform,opacity,visibility',
        }).fromTo(menuItems, {
            autoAlpha: 0,
            x: -8,
        }, {
            autoAlpha: 1,
            x: 0,
            duration: MOTION.control,
            stagger: MOTION.microStagger,
            clearProps: 'transform,opacity,visibility',
        }, '<0.06');

        return undefined;
    }, { scope: rootRef, dependencies: [menuOpen], revertOnUpdate: true });

    const navigate = (event, href) => {
        event.preventDefault(); setMenuOpen(false);
        const target = document.getElementById(href.replace('#', ''));
        if (!target) return;
        window.history.pushState({}, '', href);
        const offset = (document.querySelector('header')?.offsetHeight || 76) + 8;
        window.scrollTo({ top: Math.max(target.getBoundingClientRect().top + window.scrollY - offset, 0), behavior: 'smooth' });
    };

    return (
        <div ref={rootRef} data-motion-scope="self" className="landing-modern min-w-0 overflow-x-hidden bg-[#f5f9ff] text-slate-950">
            <header className="landing-header sticky top-0 z-50 border-b border-white/60 bg-[#f5f9ff]/90 backdrop-blur-xl">
                <div className="mx-auto flex min-h-[4.75rem] w-full max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
                    <a href="#top" className="group flex min-w-0 items-center gap-3" aria-label={`${clinic.name} home`} onClick={(event) => navigate(event, '#top')}>
                        <span className="relative"><span className="absolute -inset-1 rounded-full bg-blue-200/0 blur transition group-hover:bg-blue-200/60" /><img src={logoImage} alt="" className="relative h-11 w-11 object-contain" /></span>
                        <span><span className="block text-[13px] font-black leading-tight text-[#123b45] sm:text-base lg:text-lg">{clinic.name}</span><span className="mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500 sm:text-[0.68rem] sm:tracking-[0.13em]">Powered by {clinic.product}</span></span>
                    </a>
                    <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">{navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)} className="landing-nav-link">{item.label}</a>)}</nav>
                    <div className="flex items-center gap-2">
                        <div className="hidden items-center gap-2 sm:flex"><div className="hidden xl:block"><PwaInstallButton collapsible className="h-10" /></div><button type="button" onClick={login} className="rounded-full px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-white">Log in</button><button type="button" onClick={register} className="landing-primary-button px-5 py-2.5">Book a visit <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>
                        <button type="button" aria-expanded={menuOpen} aria-controls="landing-mobile-menu" aria-label={menuOpen ? 'Hide navigation menu' : 'Show navigation menu'} onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
                    </div>
                </div>
                {menuOpen && <div id="landing-mobile-menu" className="landing-mobile-menu border-t border-slate-200/70 bg-[#f5f9ff] px-4 py-5 lg:hidden"><nav className="mx-auto grid max-w-3xl gap-1">{navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)} className="rounded-2xl px-4 py-3 text-sm font-black text-slate-700 hover:bg-white">{item.label}</a>)}<PwaInstallButton className="mt-2 h-11 w-full justify-center" /></nav><div className="mx-auto mt-3 grid max-w-3xl grid-cols-2 gap-2 sm:hidden"><button type="button" onClick={login} className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-black">Log in</button><button type="button" onClick={register} className="landing-primary-button justify-center px-4 py-3">Book now</button></div></div>}
            </header>

            <main id="top">
                <section className="landing-hero relative isolate overflow-hidden bg-[#102a56] text-white">
                    <video className="landing-hero-video" src="/landing-media/vet-consultation.mp4" poster={vetImage} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
                    <div className="landing-hero-wash" aria-hidden="true" /><div className="landing-aurora landing-aurora--one" aria-hidden="true" /><div className="landing-aurora landing-aurora--two" aria-hidden="true" />
                    <div className="relative mx-auto grid min-h-[calc(100svh-4.75rem)] w-full max-w-[90rem] items-center gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)] lg:px-10 lg:py-20">
                        <div className="relative z-10 max-w-3xl">
                            <div className="landing-enter landing-enter--1 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[0.68rem] font-black uppercase tracking-[0.17em] text-blue-100 backdrop-blur-xl"><Sparkles className="h-4 w-4" />Veterinary care in Lucena City</div>
                            <h1 className="landing-enter landing-enter--2 mt-7 text-[clamp(2.75rem,7vw,6.9rem)] font-black leading-[0.9] tracking-[-0.055em]">Better care.<br /><span className="landing-hero-script">Happier tails.</span></h1>
                            <p className="landing-enter landing-enter--3 mt-7 max-w-xl text-base font-medium leading-7 text-white/75 sm:text-lg sm:leading-8">Clinic visits, vaccinations, grooming, and online consultations—thoughtfully connected around your pet, not paperwork.</p>
                            <div className="landing-enter landing-enter--4 mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={register} className="landing-primary-button landing-primary-button--light justify-center px-6 py-3.5 text-base">Find care for my pet <ArrowRight className="h-5 w-5" /></button><a href="#services" onClick={(event) => navigate(event, '#services')} className="landing-ghost-button justify-center px-6 py-3.5 text-base"><Play className="h-4 w-4 fill-current" />Explore services</a></div>
                            <div className="landing-enter landing-enter--5 mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-6">{['Pet-specific medical history', 'Non-emergency online consults', 'Two connected Lucena locations'].map((point) => <div key={point} className="flex items-center gap-2 text-xs font-bold text-white/75 sm:text-sm"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-300 text-[#102a56]"><Check className="h-3 w-3" /></span>{point}</div>)}</div>
                        </div>
                        <div className="landing-enter landing-enter--visual relative z-10 min-h-[24rem] lg:min-h-[39rem]"><Suspense fallback={<div className="landing-pet-stage"><img src="/landing-media/pet-ensemble.png" alt="Dogs, a cat, a parrot, and a rabbit" className="landing-pet-fallback" /></div>}><PetStage activePet={activeService.pet} /></Suspense><div className="landing-floating-note landing-floating-note--consult"><Video className="h-4 w-4 text-[#e05a47]" /><span><strong>Online vet</strong><small>PHP 500 consultation</small></span></div></div>
                    </div>
                    <div className="relative z-10 mx-auto grid w-full max-w-[90rem] gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">{[['Monday–Saturday', 'Clinic days'], ['2 Lucena locations', 'Connected care'], ['Dogs, cats, birds +', 'Companion pets']].map(([value, label]) => <div key={label} className="bg-[#102a56]/80 px-5 py-4 backdrop-blur-xl sm:px-8"><div className="text-sm font-black">{value}</div><div className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.15em] text-blue-200/70">{label}</div></div>)}</div>
                </section>

                <section id="services" className="landing-section bg-[#f5f9ff] px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-32">
                    <div className="mx-auto w-full max-w-[90rem]">
                        <Reveal className="max-w-3xl"><div className="landing-kicker text-blue-700">Care in motion</div><h2 className="landing-display mt-4">Choose the moment your pet needs.</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg sm:leading-8">Real care deserves more than a list. Explore each service, see the experience, and start with a clear next step.</p></Reveal>
                        <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] xl:items-stretch">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{services.map((service, index) => <Reveal key={service.id} delay={index * 70}><ServiceCard service={service} active={service.id === activeService.id} onSelect={() => setActiveId(service.id)} /></Reveal>)}</div>
                            <Reveal delay={120} className="h-full"><article ref={showcaseRef} className={`landing-service-showcase landing-service-showcase--${activeService.accent}`}><div className="landing-service-showcase__media">{activeService.media ? <video key={activeService.media} src={activeService.media} poster={activeService.poster} autoPlay muted loop playsInline preload="metadata" /> : <img src={activeService.image} alt="Doctor providing an online consultation" className="landing-media-kenburns" />}<div className="landing-service-showcase__scrim" /><div className="landing-service-showcase__badge"><span className="landing-service-showcase__badge-icon"><ActiveIcon className="h-5 w-5" /></span>{activeService.detail}</div></div><div className="landing-service-showcase__copy"><div className="landing-kicker text-blue-700">{activeService.eyebrow}</div><h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.03em] sm:text-3xl">{activeService.title}</h3><p className="mt-4 text-base font-medium leading-7 text-slate-600">{activeService.description}</p><button type="button" onClick={register} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-blue-700 transition hover:gap-3">Start this care request <ArrowRight className="h-4 w-4" /></button></div></article></Reveal>
                        </div>
                    </div>
                </section>

                <section id="availability" className="landing-section relative overflow-hidden bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-32">
                    <div className="landing-booking-blob" /><div className="relative mx-auto grid w-full max-w-[90rem] gap-10 xl:grid-cols-[minmax(18rem,0.55fr)_minmax(0,1.45fr)] xl:items-start">
                        <Reveal className="xl:sticky xl:top-28"><div className="landing-kicker text-[#e05a47]">Live availability</div><h2 className="landing-display mt-4">Pick a day that works for both of you.</h2><p className="mt-5 text-base font-medium leading-7 text-slate-600 sm:text-lg">See real openings before you sign in. Your selected service and schedule will carry into the secure booking flow.</p><div className="mt-7 rounded-[1.75rem] border border-orange-100 bg-orange-50/70 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#e05a47]" /><p className="text-sm font-semibold leading-6 text-slate-700">Pending requests already reserve their time, helping avoid double-booking.</p></div></div></Reveal>
                        <Reveal delay={100} className="landing-calendar-shell"><ClinicAvailabilityCalendar title="Appointment and room availability" description="Choose an available clinic time or boarding room to continue." onSelectSlot={bookSelection} onSelectRoom={bookSelection} /></Reveal>
                    </div>
                </section>

                <section id="journey" className="landing-section overflow-hidden bg-[#f2f8f5] px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-32">
                    <div className="mx-auto w-full max-w-[90rem]">
                        <Reveal className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="landing-kicker text-blue-700">A gentler journey</div><h2 className="landing-display mt-4">Care that follows your pet home.</h2></div><button type="button" onClick={register} className="landing-primary-button w-full justify-center px-6 py-3.5 lg:w-auto">Create a pet profile <ArrowRight className="h-4 w-4" /></button></Reveal>
                        <div className="relative mt-12 grid gap-5 lg:grid-cols-3"><div className="landing-journey-line" />{journey.map((step, index) => { const Icon = step.Icon; return <Reveal key={step.number} delay={index * 100} className="relative"><article className="landing-journey-card"><div className="flex items-center justify-between"><span className="landing-journey-card__icon"><Icon className="h-6 w-6" /></span><span className="text-5xl font-black tracking-[-0.08em] text-blue-900/10">{step.number}</span></div><h3 className="mt-8 text-xl font-black">{step.title}</h3><p className="mt-3 text-sm font-medium leading-7 text-slate-600">{step.text}</p></article></Reveal>; })}</div>
                        <Reveal delay={160} className="mt-8"><div className="landing-consult-strip"><div className="landing-consult-strip__image"><img src={consultImage} alt="Online consultation from home" /></div><div className="p-6 sm:p-8 lg:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-800"><MessageCircleHeart className="h-6 w-6" /></div><h3 className="mt-6 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">Some questions can begin from home.</h3><p className="mt-4 max-w-xl text-sm font-medium leading-7 text-white/70 sm:text-base">Online consultations help with suitable non-emergency concerns while preserving the doctor’s notes in your pet’s connected record.</p><button type="button" onClick={register} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-blue-200">Explore online consultation <ArrowRight className="h-4 w-4" /></button></div></div></Reveal>
                    </div>
                </section>

                <section className="landing-section bg-[#fff4ed] px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-28"><div className="mx-auto grid w-full max-w-[90rem] gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center"><Reveal><div className="landing-kicker text-[#d65343]">One connected record</div><h2 className="landing-display mt-4">The details stay. The paperwork feels lighter.</h2><p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-600">Diagnosis notes, vaccine history, prescriptions, booking updates, and receipts remain easier to find after the care moment is over.</p></Reveal><div className="grid gap-4 sm:grid-cols-3">{[{ title: 'Medical history', text: 'Visit findings and follow-up notes stay with the right pet.', Icon: HeartPulse }, { title: 'Vaccination timeline', text: 'See what was given and when the next dose is due.', Icon: Syringe }, { title: 'Prescription files', text: 'Return to finished prescription documents when needed.', Icon: FileHeart }].map((item, index) => { const Icon = item.Icon; return <Reveal key={item.title} delay={index * 80}><article className="landing-record-card"><span className="landing-record-card__icon"><Icon className="h-5 w-5" /></span><h3 className="mt-6 text-lg font-black">{item.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{item.text}</p></article></Reveal>; })}</div></div></section>

                <section id="contact" className="landing-section bg-[#f5f9ff] px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-32"><div className="mx-auto w-full max-w-[90rem]"><Reveal><div className="landing-kicker text-[#d65343]">Two Lucena locations</div><h2 className="landing-display mt-4">Care is closer than you think.</h2></Reveal><div className="mt-10 grid gap-5 lg:grid-cols-2">{locations.map((location, index) => <Reveal key={location.code} delay={index * 90}><a href={location.mapsUrl} target="_blank" rel="noopener noreferrer" className="landing-location-card"><span className="landing-location-card__pin"><MapPin className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#d65343]">{location.type}</span><span className="mt-2 block text-xl font-black">{location.name}</span><span className="mt-3 block text-sm font-medium leading-6 text-slate-600">{location.address}</span><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-800">Open in Maps <ExternalLink className="h-4 w-4" /></span></span></a></Reveal>)}</div><Reveal delay={120} className="mt-6"><div className="landing-contact-bar"><div className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 text-blue-600" /><span><strong>Clinic hours</strong><small>{clinic.openDays}, {clinic.hours}</small></span></div><div className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-blue-600" /><span><strong>Call us</strong><small>{clinic.phone}</small></span></div><div className="flex min-w-0 items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-blue-600" /><span className="min-w-0"><strong>Email</strong><small className="break-all">{clinic.email}</small></span></div></div></Reveal></div></section>

                <section className="bg-[#102a56] px-4 py-16 text-white sm:px-6 lg:px-10 lg:py-20"><Reveal className="mx-auto flex w-full max-w-[90rem] flex-col justify-between gap-8 lg:flex-row lg:items-center"><div><div className="landing-kicker text-blue-200">Ready when they are</div><h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">Make the next care moment easier.</h2></div><button type="button" onClick={register} className="landing-primary-button landing-primary-button--light w-full justify-center px-7 py-4 text-base lg:w-auto">Book a visit <ArrowRight className="h-5 w-5" /></button></Reveal></section>
            </main>

            <footer className="border-t border-white/10 bg-[#08252c] px-4 py-8 text-white sm:px-6 lg:px-10"><div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><img src={logoImage} alt="" className="h-10 w-10" /><div><div className="font-black">{clinic.name}</div><div className="mt-1 text-xs text-white/50">Powered by {clinic.product}</div></div></div><div className="flex flex-wrap gap-5 text-xs font-bold text-white/60">{navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)}>{item.label}</a>)}</div><div className="text-xs text-white/45">© 2026 {clinic.name}</div></div></footer>
        </div>
    );
}

ModernLandingPageContent.propTypes = { onLogin: PropTypes.func, onRegister: PropTypes.func };
