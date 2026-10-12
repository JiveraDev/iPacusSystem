import { ChevronRight, Clock3 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { formatDisplayTime } from '../../lib/date';
import { vetBookingService } from '../../lib/vetDailyBookings';

export default function VetBookingDayList({ bookings, onSelect, getStatus, emptyText = 'No approved bookings for this date.' }) {
    if (!bookings.length) return <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
    return (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {bookings.map(booking => {
                const status = getStatus?.(booking) || { label: booking.status === 'pending' ? 'Pending approval' : 'Approved', className: booking.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
                return <li key={booking.id}>
                    <button type="button" onClick={() => onSelect(booking)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/50 sm:px-5">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="break-words text-sm font-bold text-slate-900 dark:text-slate-100">{booking.petName || 'Pet not specified'}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{booking.bookingNumber || `Booking #${booking.id}`}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5 font-semibold"><Clock3 className="size-3.5 shrink-0" />{formatDisplayTime(booking.time)}</span>
                                <span>{vetBookingService(booking)}</span>
                                <span>{booking.branchName || 'Clinic'}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">Owner: {booking.ownerName || 'Pet owner'}</p>
                            <Badge className={`mt-2 border-0 text-[11px] sm:hidden ${status.className}`}>{status.label}</Badge>
                        </div>
                        <Badge className={`hidden shrink-0 border-0 text-xs sm:inline-flex ${status.className}`}>{status.label}</Badge>
                        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                </li>;
            })}
        </ul>
    );
}
