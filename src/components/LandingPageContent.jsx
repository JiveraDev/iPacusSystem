import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
    ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, FileHeart, Heart,
    MapPin, Menu, PawPrint, Phone, Scissors, Stethoscope, Syringe, Video, X,
} from 'lucide-react';
import logoImage from '../assets/circular_logo.png';
import vetImage from '../assets/vetImage.png';
import consultImage from '../assets/consultimage.png';
import ClinicAvailabilityCalendar from './shared/ClinicAvailabilityCalendar.jsx';
import { PetHotelLandingRooms } from './shared/PetHotelRoomShowcase.jsx';
import VetPresenceSign from './shared/VetPresenceSign.jsx';
import PwaInstallButton from '../pwa/PwaInstallButton.jsx';
import ThemeSelector from './shared/ThemeSelector.jsx';
import { clearLandingBookingIntent, saveLandingBookingIntent } from '../lib/landingBookingIntent.js';
import './landingpage.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const navigation = [
    { label: 'Our care', href: '#services' },
    { label: 'Pet Hotel', href: '#boarding' },
    { label: 'How it works', href: '#journey' },
    { label: 'Find us', href: '#contact' },
];

const services = [
    {
        id: 'consultation', label: 'Vet care', title: 'A little check-up. A lot of care.',
        description: 'From everyday check-ups to dental care, laboratory testing, and surgery reviews, find the right next step for your companion.',
        detail: 'Clinic consultations', bookingKey: 'general-checkup', Icon: Stethoscope,
        media: '/landing-media/vet-consultation.mp4', poster: vetImage,
    },
    {
        id: 'vaccination', label: 'Vaccinations', title: 'Stay a step ahead, together.',
        description: 'Plan vaccination and parasite-control visits. Keep the date, veterinarian, and next due date in your pet’s connected record.',
        detail: 'Vaccines & preventive care', bookingKey: 'vaccination', Icon: Syringe,
        media: '/landing-media/pet-vaccination.mp4', poster: vetImage,
    },
    {
        id: 'grooming', label: 'Grooming', title: 'Good hair days. Happy little paws.',
        description: 'Make time for a fresh coat and tidy paws. Share your pet’s details and grooming notes so the team can prepare for their visit.',
        detail: 'Coat, paw & hygiene care', bookingKey: 'grooming', Icon: Scissors,
        media: '/landing-media/pet-grooming.mp4', poster: vetImage,
    },
    {
        id: 'online', label: 'Online vet', title: 'Care can start on your sofa.',
        description: 'For suitable non-emergency concerns, choose a veterinary schedule and speak with a doctor online. Consultation notes stay with your pet’s profile.',
        detail: 'Online consultation · PHP 500', bookingKey: 'online-consultation', Icon: Video,
        image: consultImage,
    },
];

const journey = [
    { title: 'Meet your pet', text: 'Create a profile with the little details that help us care for your companion.', Icon: PawPrint },
    { title: 'Find your moment', text: 'Choose a service, clinic, and available time. Your selection follows you into booking.', Icon: CalendarDays },
    { title: 'Keep care close', text: 'Return to visit notes, vaccination history, prescriptions, and receipts in one place.', Icon: FileHeart },
];

const locations = [
    {
        name: 'VFC Pharmacy / Main Clinic', label: 'Main clinic & pharmacy',
        address: 'Oakbrook Avenue corner Clayton Street, Phase 3, Pleasantville Subdivision, Barangay Ilayang Iyam, Lucena City, Quezon 4301, Philippines',
    },
    {
        name: 'VFC Pet Corner Main Enriquez St.', label: 'Pet Corner',
        address: 'Enriquez St. corner Barcelona St., Barangay 2, Lucena City, Quezon 4301, Philippines',
    },
];

export default function LandingPageContent({ onLogin, onRegister }) {
    const rootRef = useRef(null);
    const menuButtonRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeId, setActiveId] = useState(services[0].id);
    const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const activeService = useMemo(() => services.find((service) => service.id === activeId) || services[0], [activeId]);
    const ActiveIcon = activeService.Icon;

    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = (event) => setReduceMotion(event.matches);
        preference.addEventListener('change', update);
        return () => preference.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (reduceMotion) rootRef.current?.querySelector('.lp-service-media video')?.pause();
    }, [reduceMotion, activeId]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        const closeOutside = (event) => {
            if (!rootRef.current?.querySelector('.lp-header')?.contains(event.target)) setMenuOpen(false);
        };
        document.addEventListener('keydown', closeOnEscape);
        document.addEventListener('pointerdown', closeOutside);
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.removeEventListener('pointerdown', closeOutside);
        };
    }, [menuOpen]);

    useGSAP(() => {
        const media = gsap.matchMedia();
        media.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.from('.lp-enter', {
                autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.07, ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
            });
            gsap.utils.toArray('[data-lp-reveal]').forEach((section) => {
                gsap.from(section, {
                    autoAlpha: 0, y: 18, duration: 0.5, ease: 'power3.out',
                    clearProps: 'transform,opacity,visibility',
                    scrollTrigger: { trigger: section, start: 'top 92%', once: true },
                });
            });
        });
        return () => media.revert();
    }, { scope: rootRef });

    const login = () => { clearLandingBookingIntent(); setMenuOpen(false); onLogin?.(); };
    const register = () => { clearLandingBookingIntent(); setMenuOpen(false); onRegister?.(); };
    const bookSelection = (selection) => { saveLandingBookingIntent(selection); setMenuOpen(false); onLogin?.(); };

    const navigate = (event, href) => {
        event.preventDefault();
        setMenuOpen(false);
        const target = rootRef.current?.querySelector(href);
        if (!target) return;
        window.history.pushState({}, '', href);
        const headerHeight = rootRef.current.querySelector('.lp-header')?.offsetHeight || 80;
        window.scrollTo({
            top: Math.max(target.getBoundingClientRect().top + window.scrollY - headerHeight - 20, 0),
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    };

    return (
        <div ref={rootRef} className="ipawcus-landing" data-motion-scope="self">
            <a className="lp-skip" href="#top" onClick={(event) => navigate(event, '#top')}>Skip to content</a>
            <header className="lp-header">
                <div className="lp-container lp-header-inner">
                    <a href="#top" className="lp-brand" aria-label="iPawcus by Vetfocus Care, home" onClick={(event) => navigate(event, '#top')}>
                        <img src={logoImage} alt="" width="44" height="44" />
                        <span><strong>iPawcus<span className="lp-brand-dot">.</span></strong><small>by Vetfocus Care</small></span>
                    </a>
                    <nav className="lp-desktop-nav" aria-label="Main navigation">
                        {navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)}>{item.label}</a>)}
                    </nav>
                    <div className="lp-header-actions">
                        <ThemeSelector />
                        <button type="button" className="lp-login" onClick={login}>Log in</button>
                        <a href="#availability" className="lp-button lp-header-book" onClick={(event) => navigate(event, '#availability')}>Book a visit <ArrowUpRight size={16} aria-hidden="true" /></a>
                        <button ref={menuButtonRef} type="button" className="lp-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="lp-mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
                            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
                        </button>
                    </div>
                </div>
                {menuOpen && (
                    <nav id="lp-mobile-menu" className="lp-mobile-nav lp-container" aria-label="Mobile navigation">
                        {navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)}>{item.label}<ArrowUpRight size={17} aria-hidden="true" /></a>)}
                        <a href="#availability" className="lp-button" onClick={(event) => navigate(event, '#availability')}>Book a visit <ArrowRight size={17} aria-hidden="true" /></a>
                    </nav>
                )}
            </header>

            <main id="top" tabIndex={-1}>
                <section className="lp-hero" aria-labelledby="lp-hero-title">
                    <div className="lp-container lp-hero-grid">
                        <div className="lp-hero-copy">
                            <p className="lp-enter lp-overline"><Heart size={15} aria-hidden="true" />For the ones you call family</p>
                            <h1 id="lp-hero-title" className="lp-enter">Big love.<br />Better <span>pet care.</span></h1>
                            <p className="lp-enter lp-hero-description">Little paws deserve thoughtful care. From check-ups to fresh coats and cozy stays, we’re here for every chapter of their life.</p>
                            <div className="lp-enter lp-hero-actions">
                                <a href="#availability" className="lp-button" onClick={(event) => navigate(event, '#availability')}>Find care for my pet <ArrowUpRight size={19} aria-hidden="true" /></a>
                                <a href="#services" className="lp-text-link" onClick={(event) => navigate(event, '#services')}>Explore our services <ArrowRight size={17} aria-hidden="true" /></a>
                            </div>
                            <div className="lp-enter lp-hero-footnote"><span className="lp-heart-mark"><PawPrint size={20} aria-hidden="true" /></span><p>For dogs, cats, birds, rabbits<br /><strong>and all your little companions.</strong></p></div>
                        </div>
                        <div className="lp-enter lp-pet-scene">
                            <div className="lp-pet-backdrop" aria-hidden="true" />
                            <img className="lp-pet-art" src="/landing-media/pet-trio.webp" alt="A happy golden retriever, a curious gray cat, and a cream rabbit sitting together" width="1536" height="1024" fetchPriority="high" onLoad={() => ScrollTrigger.refresh()} />
                            <div className="lp-pet-caption"><Heart size={18} aria-hidden="true" /><span>A little care.<br /><strong>A whole lot of happy.</strong></span></div>
                            <a href="#boarding" className="lp-pet-hotel-link" onClick={(event) => navigate(event, '#boarding')}><span>Staying a little longer?</span><strong>Meet our Pet Hotel <ArrowUpRight size={16} aria-hidden="true" /></strong></a>
                        </div>
                    </div>
                </section>

                <div className="lp-clinic-strip">
                    <div className="lp-container lp-clinic-strip-inner">
                        <div className="lp-vet-status"><VetPresenceSign variant="landing" scheduleHref="#availability" /></div>
                        <p><Clock3 size={18} aria-hidden="true" /><span>Monday–Saturday<strong>8:00 AM–6:00 PM</strong></span></p>
                        <a href="#contact" onClick={(event) => navigate(event, '#contact')}><MapPin size={18} aria-hidden="true" /><span>Always a little closer<strong>Two Lucena locations</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
                    </div>
                </div>

                <section id="services" className="lp-section" tabIndex={-1} aria-labelledby="lp-services-title">
                    <div className="lp-container">
                        <div className="lp-section-heading" data-lp-reveal>
                            <div><p className="lp-overline">Good care, every day</p><h2 id="lp-services-title">For all their tomorrows.</h2></div>
                            <p>One familiar place for the everyday essentials<br className="lp-desktop-break" /> and the moments that need a little more care.</p>
                        </div>
                        <div className="lp-service-options" aria-label="Choose a pet care service">
                            {services.map((service) => { const Icon = service.Icon; return (
                                <button key={service.id} type="button" className={`lp-service-option${activeId === service.id ? ' is-active' : ''}`} aria-pressed={activeId === service.id} aria-controls="lp-service-panel" onClick={() => setActiveId(service.id)}><Icon size={21} aria-hidden="true" /><span>{service.label}</span><ArrowUpRight size={17} aria-hidden="true" /></button>
                            ); })}
                        </div>
                        <article id="lp-service-panel" className="lp-service-panel" aria-labelledby="lp-service-title">
                            <div className="lp-service-media">
                                {activeService.media ? <video key={activeService.media} src={activeService.media} poster={activeService.poster} autoPlay={!reduceMotion} muted loop={!reduceMotion} playsInline controls preload="metadata" aria-label={activeService.detail} /> : <img src={activeService.image} alt="A veterinarian offering an online consultation" loading="lazy" />}
                                <span className="lp-service-detail"><ActiveIcon size={16} aria-hidden="true" />{activeService.detail}</span>
                            </div>
                            <div className="lp-service-copy">
                                <span className="lp-service-number" aria-hidden="true">0{services.findIndex((service) => service.id === activeId) + 1} / 04</span>
                                <h3 id="lp-service-title">{activeService.title}</h3>
                                <p>{activeService.description}</p>
                                <div className="lp-service-benefit"><Check size={17} aria-hidden="true" />Care notes stay with your pet’s profile.</div>
                                <button type="button" className="lp-button" onClick={() => bookSelection({ service: activeService.bookingKey })}>Book {activeService.label.toLowerCase()} <ArrowUpRight size={18} aria-hidden="true" /></button>
                            </div>
                        </article>
                    </div>
                </section>

                <section id="boarding" className="lp-section lp-boarding" tabIndex={-1} aria-labelledby="lp-boarding-title">
                    <div className="lp-container lp-feature-grid">
                        <div className="lp-feature-copy" data-lp-reveal>
                            <p className="lp-overline">Their home away from home</p>
                            <h2 id="lp-boarding-title">Small paws.<br />Cozy stays.</h2>
                            <p>A comfortable little space while you’re away. Find a room that fits your pet and check today’s availability at your clinic.</p>
                            <ul className="lp-check-list"><li><Check size={17} aria-hidden="true" />Small, medium, and large rooms</li><li><Check size={17} aria-hidden="true" />Clinic observations and feeding updates</li><li><Check size={17} aria-hidden="true" />Care tasks connected to their stay</li></ul>
                            <a href="#availability" className="lp-text-link" onClick={(event) => navigate(event, '#availability')}>Plan their stay <ArrowRight size={17} aria-hidden="true" /></a>
                        </div>
                        <div className="lp-room-selector"><PetHotelLandingRooms onBook={(size, branchId) => bookSelection({ service: 'boarding', branchId, roomType: `hotel-${size}` })} /></div>
                    </div>
                </section>

                <section id="availability" className="lp-section lp-booking" tabIndex={-1} aria-labelledby="lp-booking-title">
                    <div className="lp-container">
                        <div className="lp-section-heading" data-lp-reveal>
                            <div><p className="lp-overline">Let’s make a little time</p><h2 id="lp-booking-title">Their next visit starts here.</h2></div>
                            <p>Check live openings before you sign in.<br className="lp-desktop-break" /> Pick a time and we’ll keep your selection ready.</p>
                        </div>
                        <div className="lp-calendar"><ClinicAvailabilityCalendar title="Find your pet’s next appointment" description="Choose your service and clinic to see available times or Pet Hotel rooms." onSelectSlot={bookSelection} onSelectRoom={bookSelection} /></div>
                    </div>
                </section>

                <section id="journey" className="lp-section lp-journey" tabIndex={-1} aria-labelledby="lp-journey-title">
                    <div className="lp-container">
                        <div className="lp-section-heading" data-lp-reveal><div><p className="lp-overline">Less fuss. More tail wags.</p><h2 id="lp-journey-title">Good care, kept close.</h2></div><button type="button" className="lp-text-link" onClick={register}>Create a pet profile <ArrowUpRight size={18} aria-hidden="true" /></button></div>
                        <ol className="lp-steps">
                            {journey.map((step, index) => { const Icon = step.Icon; return <li key={step.title} data-lp-reveal><div className="lp-step-top"><Icon size={26} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></li>; })}
                        </ol>
                        <div className="lp-record-note"><FileHeart size={21} aria-hidden="true" /><p>From the first visit to the next adventure, their care history stays with them.</p></div>
                    </div>
                </section>

                <section id="contact" className="lp-section lp-contact" tabIndex={-1} aria-labelledby="lp-contact-title">
                    <div className="lp-container">
                        <div className="lp-section-heading" data-lp-reveal><div><p className="lp-overline">Your neighborhood care team</p><h2 id="lp-contact-title">See you in Lucena.</h2></div><a href="tel:+63424219086" className="lp-text-link"><Phone size={17} aria-hidden="true" />Let’s talk <ArrowUpRight size={17} aria-hidden="true" /></a></div>
                        <div className="lp-locations">
                            {locations.map((location) => <a key={location.name} className="lp-location" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}`)}`} target="_blank" rel="noopener noreferrer"><span className="lp-location-icon"><MapPin size={24} aria-hidden="true" /></span><div><p className="lp-overline">{location.label}</p><h3>{location.name}</h3><p className="lp-location-address">{location.address}</p><span className="lp-text-link">Get directions <ArrowUpRight size={16} aria-hidden="true" /></span></div></a>)}
                        </div>
                        <div className="lp-contact-details"><span>Monday–Saturday, 8:00 AM–6:00 PM</span><a href="tel:+639334768522">0933 476 8522</a><a href="mailto:support@ipawcus.com">support@ipawcus.com</a></div>
                    </div>
                </section>

                <section className="lp-final-cta" aria-labelledby="lp-final-title">
                    <div className="lp-container lp-final-inner" data-lp-reveal><div><p>For their everyday. And their everything.</p><h2 id="lp-final-title">A little care goes a long way.</h2></div><a href="#availability" className="lp-button lp-button-light" onClick={(event) => navigate(event, '#availability')}>Let’s find their next visit <ArrowUpRight size={20} aria-hidden="true" /></a></div>
                </section>
            </main>

            <footer className="lp-footer"><div className="lp-container"><div className="lp-footer-top"><a href="#top" className="lp-brand" onClick={(event) => navigate(event, '#top')}><img src={logoImage} alt="" width="44" height="44" /><span><strong>iPawcus<span className="lp-brand-dot">.</span></strong><small>Vetfocus Care Animal Clinic</small></span></a><nav aria-label="Footer navigation">{navigation.map((item) => <a key={item.href} href={item.href} onClick={(event) => navigate(event, item.href)}>{item.label}</a>)}</nav><PwaInstallButton collapsible /></div><div className="lp-footer-bottom"><p>Made for people who love their pets.</p><p>© {new Date().getFullYear()} Vetfocus Care Animal Clinic</p></div></div></footer>
        </div>
    );
}

LandingPageContent.propTypes = { onLogin: PropTypes.func, onRegister: PropTypes.func };
