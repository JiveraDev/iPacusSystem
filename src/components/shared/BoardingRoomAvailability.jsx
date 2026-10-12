import PropTypes from 'prop-types';
import { ArrowUpRight, Clock3, DoorOpen, Loader2, LockKeyhole, PawPrint } from 'lucide-react';

const ROOM_STATUS = {
    available: { label: 'Available', icon: DoorOpen, color: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    reserved: { label: 'Reserved', icon: Clock3, color: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    occupied: { label: 'Occupied', icon: PawPrint, color: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-500' },
    unavailable: { label: 'Unavailable', icon: LockKeyhole, color: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-300 dark:bg-slate-600' },
    mine: { label: 'Your pet', icon: PawPrint, color: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-600' },
};

export function BoardingAvailabilityLegend({ showOwnStays = false }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            {['available', 'reserved', 'occupied', 'unavailable', ...(showOwnStays ? ['mine'] : [])].map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-2 rounded-full ${ROOM_STATUS[status].dot}`} />
                    {ROOM_STATUS[status].label}
                </span>
            ))}
        </div>
    );
}

BoardingAvailabilityLegend.propTypes = { showOwnStays: PropTypes.bool };

export default function BoardingRoomAvailability({
    rooms = [],
    stays = [],
    onSelectRoom,
    onOpenStay,
    loading = false,
    availabilityUnavailable = false,
    className = '',
}) {
    if (!rooms.length) {
        return (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <DoorOpen className="size-5" aria-hidden="true" />
                <p>{loading ? 'Checking room availability…' : 'No rooms are configured for this date.'}</p>
            </div>
        );
    }

    return (
        <div className={`grid gap-5 ${className}`}>
            {rooms.map((room) => {
                const size = room.size || room.id;
                const sizeCode = size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L';
                const roomStays = stays.filter((stay) => stay.roomSize === size);
                const stayByNumber = new Map(roomStays.map((stay) => [Number(stay.roomNumber), stay]));
                const highestOwnedRoom = Math.max(0, ...roomStays.map((stay) => Number(stay.roomNumber || 0)));
                const total = Math.max(0, Number(room.total || 0), highestOwnedRoom);
                const occupied = Math.max(0, Number(room.occupied || 0));
                const reserved = Math.max(0, Number(room.reserved ?? Number(room.booked || 0) - occupied));
                const available = Math.max(0, Number(room.available || 0));
                let occupiedRemaining = Math.max(0, occupied - roomStays.filter((stay) => stay.status === 'occupied').length);
                let reservedRemaining = Math.max(0, reserved - roomStays.filter((stay) => stay.status === 'reserved').length);
                let availableRemaining = available;

                return (
                    <section key={room.roomType || `${room.type || 'hotel'}-${size}`} className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{room.label}</h4>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {loading ? 'Checking availability…' : availabilityUnavailable ? 'Availability unavailable' : `${total} room${total === 1 ? '' : 's'}`}
                                </p>
                            </div>
                            {!loading && !availabilityUnavailable && (
                                <span className={`text-xs font-semibold tabular-nums ${available > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {available} available
                                </span>
                            )}
                        </div>

                        {total > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2.5">
                                {Array.from({ length: total }, (_, index) => {
                                    const roomNumber = index + 1;
                                    const ownStay = stayByNumber.get(roomNumber);
                                    let status = ownStay ? 'mine' : 'unavailable';
                                    if (!ownStay && occupiedRemaining > 0) {
                                        status = 'occupied';
                                        occupiedRemaining -= 1;
                                    } else if (!ownStay && reservedRemaining > 0) {
                                        status = 'reserved';
                                        reservedRemaining -= 1;
                                    } else if (!ownStay && availableRemaining > 0) {
                                        status = 'available';
                                        availableRemaining -= 1;
                                    }
                                    const meta = ROOM_STATUS[status];
                                    const StatusIcon = loading ? Loader2 : meta.icon;
                                    const statusLabel = loading ? 'Checking…' : availabilityUnavailable ? 'Check unavailable' : meta.label;
                                    const roomCode = `${sizeCode}${String(roomNumber).padStart(2, '0')}`;
                                    const canSelect = !loading && !availabilityUnavailable && (status === 'mine' ? Boolean(onOpenStay) : status === 'available' && Boolean(onSelectRoom));
                                    const petName = ownStay?.petNames || ownStay?.petName || '';

                                    return (
                                        <button
                                            key={roomNumber}
                                            type="button"
                                            disabled={!canSelect}
                                            onClick={() => status === 'mine' ? onOpenStay?.(ownStay) : onSelectRoom?.(room)}
                                            aria-label={`${room.label}, room ${roomCode}: ${statusLabel}${petName ? `, ${petName}` : ''}`}
                                            className={`group flex min-h-28 min-w-0 flex-col rounded-xl border p-3 text-left transition-colors enabled:hover:border-blue-500 enabled:hover:bg-blue-50/50 enabled:active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-default dark:enabled:hover:bg-blue-950/30 dark:enabled:active:bg-blue-950/60 dark:focus-visible:ring-offset-slate-900 ${status === 'mine'
                                                ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20'
                                                : status === 'available'
                                                    ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                                                    : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'}`}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">{roomCode}</span>
                                                {canSelect && <ArrowUpRight className="size-4 shrink-0 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-300" aria-hidden="true" />}
                                            </span>
                                            {petName && <span className="mt-1 break-words text-xs text-slate-600 dark:text-slate-300">{petName}</span>}
                                            <span className={`mt-auto flex items-center gap-1.5 pt-4 text-xs font-medium ${loading || availabilityUnavailable ? ROOM_STATUS.unavailable.color : meta.color}`}>
                                                <StatusIcon className={`size-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                                                <span>{statusLabel}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                                {loading ? 'Checking rooms…' : availabilityUnavailable ? 'Room status could not be loaded.' : 'No rooms configured.'}
                            </p>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

BoardingRoomAvailability.propTypes = {
    rooms: PropTypes.arrayOf(PropTypes.object),
    stays: PropTypes.arrayOf(PropTypes.object),
    onSelectRoom: PropTypes.func,
    onOpenStay: PropTypes.func,
    loading: PropTypes.bool,
    availabilityUnavailable: PropTypes.bool,
    className: PropTypes.string,
};
