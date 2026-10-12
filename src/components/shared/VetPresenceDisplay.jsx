import { ArrowUpRight, CalendarDays, Coffee, RefreshCw, Stethoscope } from 'lucide-react';

// Public status follows clinic hours; the admin switch remains a separate daily setting.
export default function VetPresenceDisplay({ presence, error = false, variant = 'home', onRetry, scheduleHref = '#owner-availability' }) {
    const known = Boolean(presence) && !error;
    const isClosed = known && (presence.status === 'closed' || presence.clinic?.isOpen === false);
    const isLunch = known && !isClosed && presence.status === 'lunch';
    const isIn = known && !isClosed && !isLunch && presence.isIn;
    const title = error ? 'Status temporarily unavailable' : !known ? 'Checking on the vet…' : isClosed ? 'Clinic is closed' : isLunch ? 'Vet appointments on lunch break' : isIn ? 'The vet is in' : 'The vet is currently out';
    const description = error
        ? 'We couldn’t confirm the latest status. Try again before planning your visit.'
        : !known
            ? 'Getting the latest clinic update.'
            : isClosed
                ? `${presence.clinic?.name || 'The clinic'} is closed right now. Choose an available date for your visit.`
                : isLunch
                    ? 'Vet appointments resume at 1:00 PM Manila. Grooming remains bookable while the clinic is open.'
                    : isIn
                ? 'Planning a visit? Check the available appointment times first.'
                : 'You can still explore available dates for your next appointment.';
    const dot = !known || isClosed ? 'bg-slate-400' : isIn ? 'bg-emerald-500' : 'bg-amber-500';
    const iconTone = !known || isClosed
        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        : isIn
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
    const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';

    if (variant === 'landing') {
        return (
            <div aria-label="Veterinarian availability" className="inline-flex max-w-full flex-wrap items-center gap-2.5 rounded-full border border-blue-100 bg-white px-4 py-2.5 text-[#102a56] shadow-sm shadow-blue-950/10">
                <Stethoscope className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
                <span role="status" aria-atomic="true" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
                    {error ? 'VET STATUS UNAVAILABLE' : !known ? 'CHECKING VET STATUS…' : isClosed ? 'CLINIC IS CLOSED' : isLunch ? 'VET LUNCH BREAK' : isIn ? 'THE VET IS IN' : 'THE VET IS OUT'}
                </span>
                {error && <button type="button" onClick={onRetry} aria-label="Retry vet status" className="inline-flex size-8 items-center justify-center rounded-full text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><RefreshCw className="size-4" aria-hidden="true" /></button>}
            </div>
        );
    }

    return (
        <section aria-label="Today's clinic update" className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}><Stethoscope className="size-5" /></span>
                    <div className="min-w-0" role="status" aria-atomic="true">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Today at the clinic</p>
                        <h2 className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />{title}</h2>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                    </div>
                </div>
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between xl:gap-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                    <div className="flex items-start gap-2.5">
                        <Coffee className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily lunch break</p><p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">12:00–1:00 PM <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Manila</span></p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Vet appointments pause. Grooming remains bookable during clinic hours.</p></div>
                    </div>
                    {error ? (
                        <button type="button" onClick={onRetry} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 ${focus}`}><RefreshCw className="size-4" aria-hidden="true" />Retry status</button>
                    ) : (
                        <a href={scheduleHref} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 ${focus}`}><CalendarDays className="size-4" aria-hidden="true" />View available times<ArrowUpRight className="size-4" aria-hidden="true" /></a>
                    )}
                </div>
            </div>
        </section>
    );
}
