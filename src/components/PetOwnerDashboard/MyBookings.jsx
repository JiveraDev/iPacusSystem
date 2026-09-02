import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Clock3,
    CreditCard,
    FileText,
    Loader2,
    MapPin,
    PawPrint,
    RefreshCw,
    Stethoscope,
    X,
} from 'lucide-react';

import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { formatPhpCurrency } from '../../lib/currency';
import { formatDisplayDate, formatDisplayTime } from '../../lib/date';
import { fetchUserBookings } from '../../services/bookingService';
import { useNavigate } from '../dashboardRouter.jsx';

gsap.registerPlugin(useGSAP);

function userIdFrom(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function normalizedStatus(value) {
    return String(value || 'pending').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function statusMeta(value) {
    const status = normalizedStatus(value);

    if (status.includes('cancel') || status.includes('reject')) {
        return { label: status || 'Cancelled', variant: 'destructive' };
    }
    if (status.includes('complete') || status.includes('done')) {
        return { label: status, variant: 'success' };
    }
    if (status.includes('confirm') || status.includes('approve') || status.includes('progress')) {
        return { label: status, variant: 'default' };
    }

    return { label: status || 'Pending', variant: 'warning' };
}

function bookingDateValue(booking) {
    const date = String(booking?.date || '').slice(0, 10);
    const time = String(booking?.time || '00:00:00');
    const value = date ? new Date(`${date}T${time}`) : null;

    return value && !Number.isNaN(value.getTime()) ? value.getTime() : 0;
}

function titleCase(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function BookingDetail({ booking, onBack, onViewPet }) {
    const status = statusMeta(booking.status);
    const total = Number(booking.price || 0) + Number(booking.transportFee || 0);
    const boardingDates = booking.checkInDate || booking.checkOutDate
        ? `${formatDisplayDate(booking.checkInDate)} to ${formatDisplayDate(booking.checkOutDate)}`
        : '';

    const details = [
        {
            label: 'Service',
            value: booking.service || titleCase(booking.type) || 'Service not specified',
            icon: <Stethoscope className="size-4" />,
        },
        {
            label: boardingDates ? 'Stay dates' : 'Appointment date',
            value: boardingDates || formatDisplayDate(booking.date, { fallback: 'Not scheduled' }),
            icon: <CalendarDays className="size-4" />,
        },
        ...(!boardingDates ? [{
            label: 'Appointment time',
            value: formatDisplayTime(booking.time, { fallback: 'Not scheduled' }),
            icon: <Clock3 className="size-4" />,
        }] : []),
        {
            label: 'Clinic',
            value: [booking.branchName, booking.branchAddress].filter(Boolean).join(' - ') || 'Clinic location to be confirmed',
            icon: <MapPin className="size-4" />,
        },
        {
            label: 'Veterinarian',
            value: booking.veterinarian || 'Unassigned',
            icon: <Stethoscope className="size-4" />,
        },
        {
            label: 'Payment',
            value: total > 0 ? formatPhpCurrency(total) : 'To be confirmed',
            icon: <CreditCard className="size-4" />,
        },
        {
            label: 'Notes',
            value: booking.notes || 'No additional notes.',
            icon: <FileText className="size-4" />,
        },
    ];

    return (
        <div data-booking-motion-item>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <Button type="button" variant="ghost" size="icon" onClick={onBack} className="size-9" aria-label="Back to booking list">
                    <ArrowLeft />
                </Button>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-slate-950 dark:text-white">{booking.bookingNumber || `Booking #${booking.id}`}</p>
                    <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">Booking details</p>
                </div>
                <Badge variant={status.variant} className="capitalize">{status.label}</Badge>
            </div>

            <div className="max-h-[min(31rem,calc(100vh-13rem))] space-y-4 overflow-y-auto p-4">
                <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">
                        <PawPrint className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950 dark:text-white">{booking.petName || 'Pet not specified'}</p>
                        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {[booking.petSpecies, booking.petBreed].filter(Boolean).join(' - ') || 'Pet details unavailable'}
                        </p>
                    </div>
                    {booking.petId && (
                        <Button type="button" variant="outline" size="sm" onClick={onViewPet} className="shrink-0">
                            View pet
                        </Button>
                    )}
                </div>

                <dl className="space-y-2">
                    {details.map((detail) => (
                        <div key={detail.label} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                {detail.icon}
                            </span>
                            <div className="min-w-0">
                                <dt className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{detail.label}</dt>
                                <dd className="mt-0.5 break-words text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">{detail.value}</dd>
                            </div>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    );
}

export default function MyBookings({ user }) {
    const navigate = useNavigate();
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const userId = userIdFrom(user);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [panelStyle, setPanelStyle] = useState({ top: 96, left: 16, width: 432, maxHeight: 560 });

    const positionPanel = useCallback(() => {
        if (!triggerRef.current || typeof window === 'undefined') return;

        const trigger = triggerRef.current.getBoundingClientRect();
        const width = Math.min(432, window.innerWidth - 32);
        const top = Math.min(trigger.bottom + 8, window.innerHeight - 216);
        const left = Math.max(16, Math.min(trigger.right - width, window.innerWidth - width - 16));

        setPanelStyle({
            top: Math.max(16, top),
            left,
            width,
            maxHeight: Math.max(200, window.innerHeight - Math.max(16, top) - 16),
        });
    }, []);

    const loadBookings = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!userId) {
            setIsLoading(false);
            setErrorMessage('Your account could not be identified. Please sign in again.');
            return;
        }

        if (!isAutoRefresh && !hasLoaded) {
            setIsLoading(true);
        }

        try {
            const response = await fetchUserBookings(userId, { apiPrefix: true });
            const records = Array.isArray(response) ? response : response?.bookings;
            setBookings(Array.isArray(records) ? records : []);
            setHasLoaded(true);
            setErrorMessage('');
        } catch (error) {
            if (!isAutoRefresh || !hasLoaded) {
                setErrorMessage(error.message || 'Your bookings could not be loaded.');
            }
            throw error;
        } finally {
            if (!isAutoRefresh) setIsLoading(false);
        }
    }, [hasLoaded, userId]);

    useAutoRefresh(loadBookings, {
        enabled: isOpen,
        refreshKey: `my-bookings-viewer:${userId}:${isOpen}`,
    });

    useLayoutEffect(() => {
        if (isOpen) positionPanel();
    }, [isOpen, positionPanel]);

    useGSAP(() => {
        const panel = panelRef.current;
        if (!isOpen || !panel) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            gsap.set(panel, { clearProps: 'transform,opacity,visibility,transformOrigin' });
            return;
        }

        const content = panel.querySelectorAll('[data-booking-motion-item]');
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        timeline.fromTo(panel, {
            autoAlpha: 0,
            y: -10,
            scale: 0.975,
            transformOrigin: 'top right',
        }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.26,
            clearProps: 'transform,opacity,visibility,transformOrigin',
        });

        if (content.length) {
            timeline.fromTo(content, {
                autoAlpha: 0,
                y: 6,
            }, {
                autoAlpha: 1,
                y: 0,
                duration: 0.18,
                stagger: 0.035,
                clearProps: 'transform,opacity,visibility',
            }, '-=0.13');
        }
    }, { dependencies: [isOpen], scope: panelRef, revertOnUpdate: true });

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event) => {
            const clickedTrigger = triggerRef.current?.contains(event.target);
            const clickedPanel = panelRef.current?.contains(event.target);
            if (!clickedTrigger && !clickedPanel) setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('resize', positionPanel);
        window.addEventListener('scroll', positionPanel, true);
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('resize', positionPanel);
            window.removeEventListener('scroll', positionPanel, true);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, positionPanel]);

    const sortedBookings = useMemo(() => [...bookings].sort((left, right) => {
        const scheduleDifference = bookingDateValue(right) - bookingDateValue(left);
        return scheduleDifference || Number(right?.id || 0) - Number(left?.id || 0);
    }), [bookings]);

    const closeViewer = () => {
        setIsOpen(false);
        setSelectedBooking(null);
    };

    const viewer = isOpen ? (
        <div
            ref={panelRef}
            id="my-bookings-viewer"
            data-motion="off"
            role="dialog"
            aria-label="My bookings viewer"
            style={panelStyle}
            className="fixed z-[1200] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900"
        >
            <div className="flex flex-col" style={{ maxHeight: panelStyle.maxHeight }}>
                <div data-booking-motion-item className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <p className="text-lg font-black text-slate-950 dark:text-white">My Bookings</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {hasLoaded ? `${bookings.length} booking${bookings.length === 1 ? '' : 's'}` : 'Your clinic appointments'}
                        </p>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={closeViewer} className="size-8 rounded-full" aria-label="Close bookings viewer">
                        <X />
                    </Button>
                </div>

                {selectedBooking ? (
                    <BookingDetail
                        booking={selectedBooking}
                        onBack={() => setSelectedBooking(null)}
                        onViewPet={() => {
                            closeViewer();
                            navigate(`/dashboard/my-pets/${selectedBooking.petId}`);
                        }}
                    />
                ) : (
                    <div data-booking-motion-item className="min-h-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                <Loader2 className="size-4 animate-spin text-blue-600" />
                                Loading bookings...
                            </div>
                        ) : errorMessage ? (
                            <div className="px-4 py-8 text-center">
                                <CalendarDays className="mx-auto size-8 text-red-500" />
                                <p className="mt-2 font-black text-slate-950 dark:text-white">Bookings are unavailable</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{errorMessage}</p>
                                <Button type="button" onClick={() => loadBookings().catch(() => {})} className="mt-4 gap-2">
                                    <RefreshCw />
                                    Retry
                                </Button>
                            </div>
                        ) : sortedBookings.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <PawPrint className="mx-auto size-8 text-slate-400" />
                                <p className="mt-2 font-black text-slate-950 dark:text-white">No bookings yet</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Your service bookings will appear here.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedBookings.map((booking) => {
                                    const status = statusMeta(booking.status);

                                    return (
                                        <button
                                            key={booking.id}
                                            type="button"
                                            onClick={() => setSelectedBooking(booking)}
                                            className="group block w-full px-4 py-3 text-left transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 dark:hover:bg-blue-950/20"
                                        >
                                            <span className="flex items-start gap-3">
                                                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                                    <PawPrint className="size-5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className="truncate text-sm font-black text-slate-950 group-hover:text-blue-800 dark:text-white dark:group-hover:text-blue-300">
                                                            {booking.bookingNumber || `Booking #${booking.id}`}
                                                        </span>
                                                        <Badge variant={status.variant} className="shrink-0 capitalize">{status.label}</Badge>
                                                    </span>
                                                    <span className="mt-1 block truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                                                        {booking.petName || 'Pet not specified'}
                                                    </span>
                                                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <CalendarDays className="size-3.5 text-blue-600 dark:text-blue-300" />
                                                            {formatDisplayDate(booking.date, { fallback: 'Not scheduled' })}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Clock3 className="size-3.5 text-blue-600 dark:text-blue-300" />
                                                            {formatDisplayTime(booking.time, { fallback: 'Time pending' })}
                                                        </span>
                                                    </span>
                                                </span>
                                                <ArrowRight className="mt-3 size-4 shrink-0 text-blue-600 transition-transform group-hover:translate-x-0.5 dark:text-blue-300" />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    ) : null;

    return (
        <>
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                className="gap-2 border-blue-200 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                onClick={() => {
                    setSelectedBooking(null);
                    if (!isOpen) positionPanel();
                    setIsOpen((current) => !current);
                }}
                aria-expanded={isOpen}
                aria-controls="my-bookings-viewer"
            >
                <CalendarDays className="size-4" />
                My bookings
            </Button>
            {typeof document !== 'undefined' ? createPortal(viewer, document.body) : viewer}
        </>
    );
}
