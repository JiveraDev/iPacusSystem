import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardPlus,
    MapPin,
    PawPrint,
    Search,
    ShieldCheck,
    Stethoscope,
    UserPlus,
} from 'lucide-react';
import { Button } from '../../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { toast } from '../../reusecomponent/toast.jsx';
import SubmissionStatus from '../shared/SubmissionStatus';
import { addQueueItem, fetchQueuePets } from '../../services/queueService';
import { formatDisplayDateTime } from '../../lib/date';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { QUEUE_PRIORITY_OPTIONS } from '../../lib/queuePriority';
import BranchBookingSelect from '../shared/BranchBookingSelect.jsx';
import { assignedBranchId, isBranchSelectionLocked, storedDashboardUser } from '../../lib/branchAccess.js';

const SERVICES = [
    'Consultation',
    'Vaccination',
    'Grooming',
    'Dental',
    'General Check-up',
    'Surgery',
    'Kapon',
    'Lab-testing',
    'Parasite-control',
    'Boarding',
    'Home-service',
    'Special Services',
];

const QUEUE_REGISTRATION_HANDOFF_KEY = 'ipawcus-queue-registration-handoff';

export default function AddQueueDialog({ onAddToQueue }) {
    const dashboardUser = useMemo(() => storedDashboardUser(), []);
    const lockedBranchId = assignedBranchId(dashboardUser);
    const branchSelectionLocked = isBranchSelectionLocked(dashboardUser);
    const [allPets, setAllPets] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPet, setSelectedPet] = useState(null);
    const [service, setService] = useState('');
    const [priority, setPriority] = useState('normal');
    const [complaint, setComplaint] = useState('');
    const [branchId, setBranchId] = useState(() => branchSelectionLocked ? lockedBranchId : '');
    const [verified, setVerified] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bookingConflict, setBookingConflict] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        fetchQueuePets()
            .then((data) => {
                const pets = Array.isArray(data) ? data : [];
                setAllPets(pets);

                const rawHandoff = sessionStorage.getItem(QUEUE_REGISTRATION_HANDOFF_KEY);
                if (!rawHandoff) return;

                sessionStorage.removeItem(QUEUE_REGISTRATION_HANDOFF_KEY);
                try {
                    const handoff = JSON.parse(rawHandoff);
                    const handoffPet = pets.find((pet) => String(pet.pet_id) === String(handoff?.petId));
                    if (!handoffPet) {
                        toast.error('The newly registered pet is not available for queueing.');
                        return;
                    }

                    setSelectedPet(handoffPet);
                    setSearchTerm(handoffPet.pet_name || handoff.petName || '');
                    setComplaint(String(handoff.complaint || ''));
                    setIsOpen(true);
                } catch (error) {
                    console.error('Invalid queue registration handoff:', error);
                    toast.error('The newly registered pet could not be prepared for queueing.');
                }
            })
            .catch((error) => {
                console.error('Error loading pets:', error);
                setAllPets([]);
            });
    }, []);

    const suggestions = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (query.length < 2 || !Array.isArray(allPets)) return [];

        return allPets.filter((pet) => {
            const petName = String(pet.pet_name || '').toLowerCase();
            const ownerName = String(pet.owner_display || pet.owner_name || '').toLowerCase();
            return petName.includes(query) || ownerName.includes(query);
        }).slice(0, 20);
    }, [searchTerm, allPets]);

    const handleSelectPet = (pet) => {
        setSelectedPet(pet);
        setSearchTerm(pet.pet_name || '');
        setIsMenuOpen(false);
        setBookingConflict(null);
    };

    const resetForm = () => {
        setSelectedPet(null);
        setSearchTerm('');
        setService('');
        setPriority('normal');
        setComplaint('');
        setBranchId(branchSelectionLocked ? lockedBranchId : '');
        setVerified(false);
        setBookingConflict(null);
        setIsMenuOpen(false);
    };

    const closeDialog = () => {
        if (isSubmitting) return;
        setIsOpen(false);
        resetForm();
    };

    const submitQueue = async ({ cancelActiveBookings = false, confirmedBookingIds = [] } = {}) => {
        if (isSubmitting || !selectedPet || !service || !branchId || !verified) return;

        const selectedPetStatus = String(selectedPet.pet_status || selectedPet.status || '').trim().toLowerCase();
        if (['deceased', 'dead', 'closed', 'done', 'completed'].includes(selectedPetStatus)) {
            toast.error('Closed, completed, or deceased pet records cannot be added to the queue.');
            return;
        }

        setIsSubmitting(true);
        try {
            const queuedPetName = selectedPet.pet_name || 'Pet';
            const data = await addQueueItem({
                pet_id: selectedPet.pet_id,
                user_id: selectedPet.user_id,
                service_name: service,
                branch_id: Number(branchId),
                priority,
                complaint,
                queue_source: 'admin',
                cancel_active_bookings: cancelActiveBookings,
                confirmed_booking_ids: confirmedBookingIds,
            });
            onAddToQueue?.();
            setIsOpen(false);
            resetForm();
            toast.success(
                data.cancelled_booking_count > 0
                    ? `${queuedPetName} was added to the queue and ${data.cancelled_booking_count} active booking${data.cancelled_booking_count === 1 ? ' was' : 's were'} cancelled.`
                    : `${queuedPetName} was added to the queue.`
            );
        } catch (error) {
            if (error.status === 409 && error.data?.code === 'ACTIVE_BOOKING_CONFIRMATION_REQUIRED') {
                setBookingConflict(error.data);
                return;
            }
            toast.error(error.message || 'Failed to add queue item');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmBookingCancellation = () => {
        const confirmedBookingIds = (bookingConflict?.active_bookings || [])
            .map((booking) => Number(booking.booking_id))
            .filter((bookingId) => bookingId > 0);

        submitQueue({ cancelActiveBookings: true, confirmedBookingIds });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (isSubmitting) return;
                setIsOpen(nextOpen);
                if (!nextOpen) resetForm();
            }}
        >
            <DialogTrigger asChild>
                <Button className="w-full gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:w-auto">
                    <UserPlus />
                    Add Queue
                </Button>
            </DialogTrigger>

            <DialogContent className="w-[calc(100%_-_1rem)] max-w-[760px] overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:w-[calc(100%_-_2rem)]">
                <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6 sm:py-5">
                    <DialogHeader className="mb-0 pr-10">
                        <div className="flex items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                                <ClipboardPlus className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-lg font-black text-slate-950 dark:text-white sm:text-xl">
                                    Add patient to queue
                                </DialogTitle>
                                <DialogDescription className="mt-1 max-w-xl leading-5 text-slate-600 dark:text-slate-300">
                                    Select the patient, service, and correct clinic location for this walk-in visit.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="space-y-5 px-4 py-5 sm:px-6">
                    <div className="grid gap-5 lg:grid-cols-2">
                        <section className="space-y-4" aria-labelledby="queue-patient-heading">
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                                <PawPrint className="size-4 text-slate-500 dark:text-slate-400" />
                                <h3 id="queue-patient-heading" className="text-sm font-black text-slate-900 dark:text-white">
                                    Patient
                                </h3>
                            </div>

                            <div className="relative" ref={menuRef}>
                                <Label htmlFor="queue-pet-search">Pet or owner name</Label>
                                <div className="relative mt-1.5">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        id="queue-pet-search"
                                        className="pl-9"
                                        placeholder="Search registered patients"
                                        value={searchTerm}
                                        onChange={(event) => {
                                            setSearchTerm(event.target.value);
                                            setSelectedPet(null);
                                            setBookingConflict(null);
                                            setIsMenuOpen(event.target.value.trim().length >= 2);
                                        }}
                                        onFocus={() => searchTerm.trim().length >= 2 && setIsMenuOpen(true)}
                                        disabled={isSubmitting}
                                        autoComplete="off"
                                    />
                                </div>

                                {isMenuOpen && (
                                    <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                        {suggestions.length ? suggestions.map((pet) => (
                                            <button
                                                type="button"
                                                key={pet.pet_id}
                                                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                                                onClick={() => handleSelectPet(pet)}
                                            >
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    <PawPrint className="size-4" />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{pet.pet_name}</span>
                                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {pet.owner_display || pet.owner_name || 'Owner not listed'}
                                                    </span>
                                                </span>
                                            </button>
                                        )) : (
                                            <p className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">No matching registered patient.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={`rounded-lg border p-3 ${
                                selectedPet
                                    ? 'border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30'
                                    : 'border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
                            }`}>
                                {selectedPet ? (
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#155dfc] shadow-sm dark:bg-slate-900 dark:text-blue-300">
                                            <CheckCircle2 className="size-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{selectedPet.pet_name}</p>
                                            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                                                Owner: {selectedPet.owner_display || selectedPet.owner_name || 'Not listed'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Select a registered patient to continue.</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="queue-complaint">Comments / complaint</Label>
                                <Textarea
                                    id="queue-complaint"
                                    className="mt-1.5 min-h-28 resize-y"
                                    value={complaint}
                                    onChange={(event) => setComplaint(event.target.value)}
                                            placeholder="Visit reason or symptoms"
                                    disabled={isSubmitting}
                                />
                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    Urgent entries send this information to all active veterinarians.
                                </p>
                            </div>
                        </section>

                        <section className="space-y-4" aria-labelledby="queue-visit-heading">
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                                <Stethoscope className="size-4 text-slate-500 dark:text-slate-400" />
                                <h3 id="queue-visit-heading" className="text-sm font-black text-slate-900 dark:text-white">
                                    Visit details
                                </h3>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                <div>
                                    <Label htmlFor="queue-service">Service</Label>
                                    <Select
                                        value={service}
                                        onValueChange={(nextService) => {
                                            setService(nextService);
                                            setBranchId(branchSelectionLocked ? lockedBranchId : '');
                                            setBookingConflict(null);
                                        }}
                                        disabled={isSubmitting}
                                    >
                                        <SelectTrigger id="queue-service" className="mt-1.5">
                                            <SelectValue placeholder="Select service" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SERVICES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="queue-priority">Priority</Label>
                                    <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                                        <SelectTrigger id="queue-priority" className="mt-1.5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {QUEUE_PRIORITY_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {priority === 'urgent' && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                    All active veterinarians will receive an urgent notification containing the patient, branch, and comment.
                                </div>
                            )}

                            {service ? (
                                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        <MapPin className="size-3.5" />
                                        Service location
                                    </div>
                                    <BranchBookingSelect
                                        service={service}
                                        value={branchId}
                                        onChange={setBranchId}
                                        assignedOnly
                                        locked={branchSelectionLocked}
                                        lockedBranchId={lockedBranchId}
                                    />
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    Select a service before choosing the clinic location.
                                </div>
                            )}

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="verified"
                                        className="mt-0.5"
                                        checked={verified}
                                        onCheckedChange={setVerified}
                                        disabled={isSubmitting}
                                    />
                                    <div>
                                        <Label htmlFor="verified" className="font-bold text-slate-900 dark:text-white">
                                            Details verified
                                        </Label>
                                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            I verified the patient, requested service, priority, and clinic location.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {bookingConflict && (
                        <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="min-w-0">
                                    <p className="text-sm font-black">Active booking found</p>
                                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">{bookingConflict.message}</p>
                                </div>
                            </div>

                            <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                                {(bookingConflict.active_bookings || []).map((booking) => (
                                    <div key={booking.booking_id} className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-xs dark:border-amber-800 dark:bg-slate-950/40">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-bold">{booking.booking_number || `Booking #${booking.booking_id}`}</span>
                                            <span className="capitalize text-amber-700 dark:text-amber-300">{booking.status}</span>
                                        </div>
                                        <p className="mt-1 text-amber-800 dark:text-amber-200">
                                            {getServiceDisplayName(booking.service_type)}
                                            {booking.booking_date ? ` - ${formatDisplayDateTime(booking.booking_date, booking.booking_time)}` : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {bookingConflict.can_cancel_and_queue && (
                                <p className="text-xs font-medium leading-5">
                                    Continuing cancels the bookings above and makes this queue entry the active clinic workflow.
                                </p>
                            )}
                        </div>
                    )}

                    <SubmissionStatus active={isSubmitting} label="Adding queue entry..." slowLabel="Still adding queue entry..." />
                </div>

                <DialogFooter className="m-0 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/50 sm:px-6">
                    {bookingConflict ? (
                        <>
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting} className="w-full sm:w-auto">
                                Keep {bookingConflict.active_bookings?.length === 1 ? 'booking' : 'bookings'}
                            </Button>
                            {bookingConflict.can_cancel_and_queue && (
                                <Button
                                    type="button"
                                    onClick={handleConfirmBookingCancellation}
                                    disabled={isSubmitting}
                                    className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                                >
                                    {isSubmitting
                                        ? 'Cancelling and adding...'
                                        : `Cancel ${bookingConflict.active_bookings?.length === 1 ? 'booking' : 'bookings'} and add queue`}
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting} className="w-full sm:w-auto">
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => submitQueue()}
                                disabled={!selectedPet || !service || !branchId || !verified || isSubmitting}
                                className="w-full bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:w-auto sm:min-w-36"
                            >
                                <ShieldCheck />
                                {isSubmitting ? 'Adding...' : 'Add to queue'}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
