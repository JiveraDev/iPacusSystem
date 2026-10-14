import PropTypes from 'prop-types';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    Activity,
    Building2,
    Check,
    Clock3,
    DoorOpen,
    Droplets,
    Hotel,
    ListChecks,
    Loader2,
    PawPrint,
    RefreshCw,
    Utensils,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchOwnerBoardingStays } from '../../services/boardingService';
import { fetchBookingAvailability } from '../../services/bookingAvailabilityService';
import ClinicAvailabilityCalendar from './ClinicAvailabilityCalendar.jsx';
import Label from './BookingFieldLabel.jsx';
import BoardingRoomAvailability, { BoardingAvailabilityLegend } from './BoardingRoomAvailability.jsx';

const PET_HOTEL_ROOM_META = Object.freeze([
    {
        id: 'small',
        short: 'S',
        label: 'Small room',
        capacity: '1 pet',
        description: 'A calm, cozy stay for one companion.',
    },
    {
        id: 'medium',
        short: 'M',
        label: 'Medium room',
        capacity: '1–2 pets',
        description: 'More room to stretch, rest, and play.',
    },
    {
        id: 'large',
        short: 'L',
        label: 'Large room',
        capacity: '2–3 pets',
        description: 'A spacious suite for larger companions or groups.',
    },
]);

function roomMeta(size) {
    return PET_HOTEL_ROOM_META.find((room) => room.id === size) || PET_HOTEL_ROOM_META[0];
}

function formatDateTime(value, fallback = 'Not recorded') {
    if (!value) return fallback;
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: String(value).length > 10 ? 'numeric' : undefined,
        minute: String(value).length > 10 ? '2-digit' : undefined,
    }).format(date);
}

function humanize(value, fallback = 'Not recorded') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    return text.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clinicDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
}

function getAvailabilityBranchName(response) {
    const selectedBranchId = response?.selected?.branchId;
    return response?.filters?.branches?.find((branch) => String(branch.id) === String(selectedBranchId))?.name
        || 'Selected clinic';
}

function normalizeHotelRooms(rooms = []) {
    return PET_HOTEL_ROOM_META.map((meta) => {
        const room = rooms.find((item) => (item.type || 'hotel') === 'hotel' && item.size === meta.id);
        const occupied = Math.max(0, Number(room?.occupied || 0));
        const booked = Math.max(0, Number(room?.booked || 0));
        const reserved = Math.max(0, Number(room?.reserved ?? booked - occupied));
        const available = Math.max(0, Number(room?.available ?? 0));
        const total = Math.max(0, Number(room?.total ?? (available + reserved + occupied)));

        return { ...meta, ...room, occupied, reserved, available, total };
    });
}

export function PetHotelRoomIllustration({ size, occupied = false, reserved = false, petName = '', facility = 'hotel' }) {
    const meta = roomMeta(size);
    const isConfinement = facility === 'boarding';
    const bedWidth = size === 'large' ? 'w-[66%]' : size === 'medium' ? 'w-[57%]' : 'w-[48%]';
    const windowWidth = size === 'large' ? 'w-[30%]' : size === 'medium' ? 'w-[27%]' : 'w-[24%]';

    return (
        <div className={`relative isolate aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 sm:aspect-[4/3] sm:rounded-2xl ${isConfinement ? 'bg-emerald-50' : 'bg-[#eaf5ff]'}`} aria-hidden="true">
            <div className={`absolute inset-x-0 top-0 h-[69%] bg-gradient-to-b dark:from-slate-800 dark:to-slate-700 ${isConfinement ? 'from-emerald-50 to-emerald-100' : 'from-[#eff8ff] to-[#dcecff]'}`} />
            <div className="absolute inset-x-0 bottom-0 h-[31%] bg-[#d6b98e] dark:bg-[#66513a]" />
            <div className="absolute inset-x-0 bottom-[30%] h-px bg-slate-900/10" />

            <div className={`absolute right-[9%] top-[12%] ${windowWidth} aspect-square overflow-hidden rounded-[0.35rem] border-[3px] border-white bg-[#9ed6ff] shadow-sm dark:border-slate-600 dark:bg-blue-950`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/80 dark:bg-slate-500" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/80 dark:bg-slate-500" />
                <div className="absolute right-[12%] top-[12%] size-[18%] rounded-full bg-amber-200" />
            </div>

            <div className="absolute left-[8%] top-[12%] flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-1 text-[0.55rem] font-black text-slate-600 shadow-sm dark:bg-slate-900/80 dark:text-slate-200 sm:px-2 sm:text-[0.65rem]">
                <Hotel className="size-2.5 sm:size-3" />
                {isConfinement ? 'C' : 'H'} · {meta.short}
            </div>

            <div className={`absolute bottom-[18%] left-[8%] ${bedWidth} h-[25%] rounded-[0.65rem] border-[3px] border-white bg-[#6ea8ff] shadow-[0_7px_0_rgba(15,23,42,0.12)] dark:border-slate-600 dark:bg-blue-700 sm:rounded-xl`}>
                <div className="absolute inset-x-[6%] top-[12%] h-[38%] rounded-md bg-[#dfeeff] dark:bg-blue-300/70" />
                <div className="absolute bottom-[12%] left-[7%] h-[28%] w-[31%] rounded-full bg-white/80 dark:bg-slate-200/80" />
                {(occupied || reserved) && (
                    <div className="absolute -top-[34%] left-1/2 flex size-[42%] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#f59f82] text-white shadow-md dark:border-slate-700">
                        <PawPrint className="size-[52%]" />
                    </div>
                )}
            </div>

            <div className="absolute bottom-[10%] right-[8%] flex items-end gap-1 sm:gap-1.5">
                <div className="h-2.5 w-5 rounded-b-full rounded-t-sm border border-slate-400/30 bg-[#f4c75e] sm:h-3 sm:w-7" />
                <div className="h-2.5 w-5 rounded-b-full rounded-t-sm border border-slate-400/30 bg-[#75c9d8] sm:h-3 sm:w-7" />
            </div>
            <div className="absolute bottom-[31%] right-[4%] h-[34%] w-[7%] rounded-t-md bg-[#b98a5c] opacity-80 dark:bg-[#886b4c]" />

            <div className={`absolute inset-x-[7%] bottom-[4%] truncate rounded-full px-2 py-1 text-center text-[0.55rem] font-black shadow-sm sm:text-[0.68rem] ${
                occupied
                    ? 'bg-emerald-600 text-white'
                    : reserved
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/95 text-slate-700 dark:bg-slate-900/90 dark:text-slate-100'
            }`}>
                {occupied ? `${petName || 'Pet'} is staying` : reserved ? `${petName || 'Pet'} is reserved` : 'Ready to check'}
            </div>
        </div>
    );
}

PetHotelRoomIllustration.propTypes = {
    size: PropTypes.oneOf(['small', 'medium', 'large']).isRequired,
    occupied: PropTypes.bool,
    reserved: PropTypes.bool,
    petName: PropTypes.string,
    facility: PropTypes.oneOf(['hotel', 'boarding']),
};

export function PetHotelRoomGrid({
    rooms,
    availability = [],
    selectedSize = '',
    onSelect,
    datesReady = true,
    loading = false,
    priceFormatter = (value) => `PHP ${Number(value || 0).toLocaleString('en-US')}`,
    variant = 'booking',
}) {
    const roomBySize = useMemo(() => Object.fromEntries((rooms || []).map((room) => [room.id, room])), [rooms]);
    const availabilityBySize = useMemo(
        () => Object.fromEntries((availability || []).map((room) => [room.room_size || room.roomSize, room])),
        [availability],
    );

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
            {PET_HOTEL_ROOM_META.map((meta) => {
                const room = roomBySize[meta.id] || meta;
                const roomAvailability = availabilityBySize[meta.id];
                const availableCount = Number(roomAvailability?.available_count ?? roomAvailability?.availableCount ?? 0);
                const unavailable = Boolean(roomAvailability && !roomAvailability.available);
                const selected = selectedSize === meta.id;
                const disabled = variant === 'booking' && (!datesReady || loading || unavailable);
                const status = loading
                    ? 'Checking…'
                    : unavailable
                        ? 'Full for these dates'
                        : roomAvailability
                            ? `${availableCount} available`
                            : datesReady
                                ? 'Check this room'
                                : 'Choose dates first';

                return (
                    <button
                        key={meta.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={`${room.name || meta.label}. ${status}`}
                        onClick={() => onSelect?.(meta.id)}
                        className={`group flex min-w-0 flex-col rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-default dark:focus-visible:ring-offset-slate-900 ${
                            selected
                                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/15 dark:border-blue-400 dark:bg-blue-950/30'
                                : unavailable
                                    ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'
                                    : 'border-slate-300 bg-white enabled:hover:border-blue-500 enabled:hover:bg-blue-50/50 enabled:active:bg-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:enabled:hover:bg-blue-950/30 dark:enabled:active:bg-blue-950/60'
                        }`}
                    >
                        <span className="block">
                            <span className="flex min-w-0 items-start gap-2">
                                <DoorOpen className="mt-0.5 size-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{room.name || meta.label}</span>
                                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{room.capacity || meta.capacity}</span>
                                </span>
                                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{selected && <Check className="size-3.5" />}</span>
                            </span>
                            {room.pricePerDay !== undefined && (
                                <span className="mt-4 block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{priceFormatter(room.pricePerDay)}<span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">/day</span></span>
                            )}
                            <span className={`mt-3 flex items-start gap-1.5 text-xs font-medium ${
                                unavailable
                                    ? 'text-slate-500 dark:text-slate-400'
                                    : roomAvailability && datesReady && !loading
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : 'text-slate-500 dark:text-slate-400'
                            }`}>
                                {loading ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" /> : <span className={`mt-1 size-1.5 shrink-0 rounded-full ${roomAvailability && !unavailable && datesReady ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />}
                                <span>{status}</span>
                            </span>
                            {variant !== 'landing' && Array.isArray(room.features) && room.features.length > 0 && (
                                <span className="mt-4 block space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    {room.features.slice(0, 3).map((feature) => (
                                        <span key={feature} className="flex items-start gap-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                            <Check className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />{feature}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

PetHotelRoomGrid.propTypes = {
    rooms: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        capacity: PropTypes.string,
        pricePerDay: PropTypes.number,
        features: PropTypes.arrayOf(PropTypes.string),
    })),
    availability: PropTypes.arrayOf(PropTypes.object),
    selectedSize: PropTypes.string,
    onSelect: PropTypes.func,
    datesReady: PropTypes.bool,
    loading: PropTypes.bool,
    priceFormatter: PropTypes.func,
    variant: PropTypes.oneOf(['booking', 'landing']),
};

function MonitoringValue({ icon, label, value }) {
    const IconComponent = icon;
    return (
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"><IconComponent className="size-3.5" />{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{humanize(value)}</p>
        </div>
    );
}

MonitoringValue.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function StayDetails({ stay }) {
    const observations = stay.observations || [];
    const tasks = stay.tasks || [];

    return (
        <article className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="grid gap-4 bg-slate-50 p-4 dark:bg-slate-800/60 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <PetHotelRoomIllustration
                    size={stay.roomSize || 'small'}
                    occupied={stay.status === 'occupied'}
                    reserved={stay.status === 'reserved'}
                    petName={stay.petNames || stay.petName}
                />
                <div className="min-w-0 self-center">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">{stay.roomLabel}</p>
                    <h3 className="mt-1 break-words text-xl font-black text-slate-950 dark:text-white">{stay.petNames || stay.petName || 'Your pet'}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{stay.branchName || 'Clinic pet hotel'}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div><dt className="font-bold text-slate-500 dark:text-slate-400">Check-in</dt><dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(stay.actualCheckInAt || stay.checkInDate)}</dd></div>
                        <div><dt className="font-bold text-slate-500 dark:text-slate-400">Expected checkout</dt><dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(stay.desiredCheckOutDate || stay.checkOutDate)}</dd></div>
                    </dl>
                </div>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
                <section>
                    <div className="flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"><Activity className="size-4 text-blue-600" />Observations</h4>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{observations.length} update{observations.length === 1 ? '' : 's'}</span>
                    </div>
                    {observations.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">The clinic has not posted an observation yet.</p>
                    ) : (
                        <div className="mt-3 space-y-3">
                            {observations.slice(0, 6).map((observation) => (
                                <div key={observation.observationId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div><p className="font-bold text-slate-950 dark:text-white">{humanize(observation.observationType, 'Care observation')}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(observation.observedAt)}</p></div>
                                        {observation.conditionSeverity && <span className="rounded-full bg-blue-50 px-2 py-1 text-[0.65rem] font-black text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{humanize(observation.conditionSeverity)}</span>}
                                    </div>
                                    {observation.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{observation.notes}</p>}
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <MonitoringValue icon={Utensils} label="Appetite" value={observation.appetiteStatus} />
                                        <MonitoringValue icon={Droplets} label="Water" value={observation.waterIntakeStatus} />
                                        <MonitoringValue icon={Activity} label="Behavior" value={observation.behaviorStatus} />
                                        <MonitoringValue icon={PawPrint} label="Elimination" value={observation.eliminationStatus} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="border-t border-slate-200 pt-5 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"><ListChecks className="size-4 text-emerald-600" />Care, feeding & tasks</h4>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
                    </div>
                    {tasks.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No care tasks have been posted yet.</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {tasks.slice(0, 10).map((task) => (
                                <li key={task.taskId} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                                    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                                        {String(task.taskType).toLowerCase().includes('feed') ? <Utensils className="size-3.5" /> : task.status === 'completed' ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-bold text-slate-950 dark:text-white">{humanize(task.taskType, 'Care task')}</p><span className="text-[0.65rem] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{humanize(task.status)}</span></div>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Due {formatDateTime(task.dueAt)}</p>
                                        {task.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{task.notes}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </article>
    );
}

StayDetails.propTypes = {
    stay: PropTypes.shape({
        assignmentId: PropTypes.number,
        roomSize: PropTypes.string,
        roomLabel: PropTypes.string,
        status: PropTypes.string,
        petName: PropTypes.string,
        petNames: PropTypes.string,
        branchId: PropTypes.number,
        branchName: PropTypes.string,
        actualCheckInAt: PropTypes.string,
        checkInDate: PropTypes.string,
        desiredCheckOutDate: PropTypes.string,
        checkOutDate: PropTypes.string,
        observations: PropTypes.arrayOf(PropTypes.object),
        tasks: PropTypes.arrayOf(PropTypes.object),
    }).isRequired,
};

export function PetHotelOwnerRooms({ activeBranchId = '', onBook, onBranchChange, onBranchesChange }) {
    const [stays, setStays] = useState([]);
    const [error, setError] = useState('');
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);

    const load = async () => {
        try {
            const response = await fetchOwnerBoardingStays();
            const nextStays = Array.isArray(response.stays) ? response.stays : [];
            setStays(nextStays);
            setError('');
        } catch (loadError) {
            setError(loadError.message || 'Your active Pet Hotel stays could not be loaded.');
            throw loadError;
        }
    };

    useAutoRefresh(load, { refreshKey: 'owner-pet-hotel-rooms' });

    const selectedStay = stays.find((stay) => stay.assignmentId === selectedAssignmentId) || null;

    return (
        <div id="owner-availability" className="scroll-mt-24 space-y-3">
            {error && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <span>Your pet's care updates are temporarily unavailable. Room booking remains available.</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => load().catch(() => {})}><RefreshCw className="size-4" />Retry care updates</Button>
                </div>
            )}

            <ClinicAvailabilityCalendar
                title="Book an available time"
                description="Choose a service and date. Regular services show appointment times; Pet Hotel Boarding shows the room map."
                initialService="general-checkup"
                selectedBranchId={activeBranchId}
                showServiceFilter
                boardingStays={stays}
                onBranchChange={onBranchChange}
                onBranchesChange={onBranchesChange}
                onOpenBoardingStay={(stay) => setSelectedAssignmentId(stay.assignmentId)}
                onSelectSlot={onBook}
                onSelectRoom={onBook}
            />

            <Dialog open={Boolean(selectedStay)} onOpenChange={(open) => !open && setSelectedAssignmentId(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black dark:text-white">{selectedStay ? roomMeta(selectedStay.roomSize).label : 'Pet Hotel'} care updates</DialogTitle>
                        <DialogDescription className="dark:text-slate-300">Read-only updates recorded by the clinic during your pet’s active stay.</DialogDescription>
                    </DialogHeader>
                    {selectedStay && <StayDetails stay={selectedStay} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

PetHotelOwnerRooms.propTypes = {
    activeBranchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onBook: PropTypes.func.isRequired,
    onBranchChange: PropTypes.func,
    onBranchesChange: PropTypes.func,
};

export function PetHotelLandingRooms({ onBook }) {
    const [availability, setAvailability] = useState(null);
    const [branchId, setBranchId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const clinicControlId = useId();
    const currentRequest = useRef(branchId);
    const requestSerial = useRef(0);

    useEffect(() => {
        currentRequest.current = branchId;
        return () => { currentRequest.current = null; };
    }, [branchId]);

    const load = async ({ isAutoRefresh = false } = {}) => {
        const serial = ++requestSerial.current;
        const isCurrent = () => currentRequest.current === branchId && requestSerial.current === serial;
        if (!isAutoRefresh) setLoading(true);
        try {
            const today = clinicDateKey();
            const response = await fetchBookingAvailability({
                service: 'boarding',
                month: today.slice(0, 7),
                date: today,
                branchId,
                hotel_boarding_type: 'hotel',
                detailsOnly: true,
            });
            if (!isCurrent()) return;
            setAvailability(response);
            setError('');
            setLoading(false);
            const resolvedBranchId = String(response?.selected?.branchId || '');
            if (branchId && resolvedBranchId !== branchId) {
                currentRequest.current = resolvedBranchId;
                setBranchId(resolvedBranchId);
            }
        } catch (loadError) {
            if (!isCurrent()) return;
            setError(loadError.message || 'Live room availability is temporarily unavailable.');
            throw loadError;
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    useAutoRefresh(load, { refreshKey: `landing-pet-hotel-rooms:${branchId}` });
    const branches = availability?.filters?.branches || [];
    const selectedBranchId = branchId || String(availability?.selected?.branchId || '');
    const selectedBranch = branches.find((branch) => String(branch.id) === selectedBranchId);
    const matchesBranch = !branchId || String(availability?.selected?.branchId || '') === branchId;
    const rooms = normalizeHotelRooms(matchesBranch ? availability?.details?.rooms || [] : []);
    const isLoading = loading || (!matchesBranch && !error);

    const changeBranch = (value) => {
        requestSerial.current += 1;
        currentRequest.current = value;
        setBranchId(value);
        setLoading(true);
        setError('');
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-4 space-y-3">
                <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Choose a Pet Hotel room</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedBranch?.name || (availability ? getAvailabilityBranchName(availability) : 'Pet Hotel')} · Today’s availability</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="w-full space-y-1 sm:max-w-xs">
                        <Label htmlFor={clinicControlId} help="Choose a clinic to see its Pet Hotel rooms and today's availability.">
                            <Building2 className="size-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                            Clinic location
                        </Label>
                        <Select value={selectedBranchId} onValueChange={changeBranch} disabled={!branches.length}>
                            <SelectTrigger id={clinicControlId} aria-busy={isLoading}>
                                <SelectValue displayValue={selectedBranch?.name} placeholder={loading ? 'Loading clinics...' : 'No clinics available'} />
                            </SelectTrigger>
                            <SelectContent>
                                {branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <BoardingAvailabilityLegend />
                </div>
            </div>
            {error && (
                <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p>Room availability could not be refreshed for this clinic.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => load().catch(() => {})} disabled={loading}><RefreshCw className="size-4" aria-hidden="true" />Retry</Button>
                </div>
            )}
            <BoardingRoomAvailability rooms={rooms} onSelectRoom={(room) => onBook(room.size || room.id, availability?.selected?.branchId)} loading={isLoading} availabilityUnavailable={Boolean(error)} className="lg:grid-cols-3" />
        </div>
    );
}

PetHotelLandingRooms.propTypes = {
    onBook: PropTypes.func.isRequired,
};
