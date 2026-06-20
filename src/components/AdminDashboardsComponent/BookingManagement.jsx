import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Search, Filter, Eye, CheckCircle, XCircle, X, User, PawPrint, CalendarClock, UserPlus, Loader2, Plus, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '../../ui/sheet';
import PetOwnerProfileModal from './PetOwnerInfoModal';
import PetInfoModal from './PetInfoModal';
import { PhotoViewer } from '../../ui/photo-viewer';
import { toast } from "../../reusecomponent/toast.jsx";
import { addPetService } from '../../services/addPet';
import { Label } from '../../ui/label';
import { resolveImageUrl } from '../../lib/image';
import { formatDisplayDate, formatDisplayDateRange, formatDisplayTime } from '../../lib/date';
import { formatPhpCurrency, normalizeCurrencyLabel } from '../../lib/currency';
import { isValidPhilippinePhone, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../../lib/philippinePhone';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useNavigate } from '../dashboardRouter.jsx';
import {
    createBooking,
    fetchBookings as fetchBookingsService,
    updateBookingSchedule,
    updateBookingStatus as updateBookingStatusService
} from '../../services/bookingService';
import { fetchQueuePets } from '../../services/queueService';
import { fetchAccounts } from '../../services/accountService';

const REVIEW_SERVICE_TYPES = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'grooming', label: 'Grooming' },
    { value: 'dental', label: 'Dental Check-up' },
    { value: 'General Check-up', label: 'General Check-up' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'lab-testing', label: 'Lab Testing' },
    { value: 'parasite-control', label: 'Parasite Control' },
    { value: 'home-service', label: 'Home Service' },
    { value: 'special services', label: 'Special Services' },
];

const ADMIN_BOOKING_SERVICE_TYPES = [
    { value: 'online-consultation', label: 'Online Consultation' },
    ...REVIEW_SERVICE_TYPES.filter(
        (type) => !['consultation', 'home-service', 'special services', 'boarding'].includes(type.value)
    )
];

function todayInputDate() {
    return new Date().toLocaleDateString('en-CA');
}

function currentInputTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function createEmptyAdminBookingForm() {
    return {
        serviceType: 'online-consultation',
        veterinarianId: '',
        bookingDate: todayInputDate(),
        bookingTime: currentInputTime(),
        notes: '',
        paymentAction: 'pos'
    };
}

function ownerNameForPet(pet) {
    return pet?.owner_name
        || [pet?.first_Name, pet?.last_Name].filter(Boolean).join(' ').trim()
        || pet?.pet_Temp_owner
        || 'Unknown Owner';
}

function vetId(vet) {
    return String(vet?.user_id || vet?.userId || vet?.id || '');
}

function vetName(vet) {
    if (vet?.veterinarian_name) {
        return vet.veterinarian_name;
    }

    const fullName = [vet?.first_Name, vet?.last_Name].filter(Boolean).join(' ').trim();
    return fullName ? `Dr. ${fullName}` : vet?.mail_Address || vet?.email || 'Veterinarian';
}

function ActionButtonMedia({ image, alt, fallback }) {
    const FallbackIcon = fallback;
    const [hasImageError, setHasImageError] = useState(false);
    const imageUrl = hasImageError ? null : resolveImageUrl(image);

    return (
        <span className="size-10 rounded-full border border-[#bfdbfe] bg-[#eff6ff] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={alt}
                    className="size-full object-cover"
                    onError={() => setHasImageError(true)}
                />
            ) : (
                <FallbackIcon className="size-5 text-[#155dfc]" />
            )}
        </span>
    );
}

export default function BookingsManagement() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('Service Type');
    const [filterStatus, setFilterStatus] = useState('Status');
    const [filterAge, setFilterAge] = useState('7d');
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [currentRescheduleBooking, setCurrentRescheduleBooking] = useState(null);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [viewerImage, setViewerImage] = useState(null);
    const [infoModal, setInfoModal] = useState(null);
    const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
    const [currentCancellationBooking, setCurrentCancellationBooking] = useState(null);
    const [cancellationData, setCancellationData] = useState({
        message: '',
        walletNumber: normalizePhilippinePhoneInput(''),
        transactionNumber: ''
    });
    const [reviewDrafts, setReviewDrafts] = useState({});
    const [addBookingOpen, setAddBookingOpen] = useState(false);
    const [isLoadingBookingPets, setIsLoadingBookingPets] = useState(false);
    const [isCreatingBooking, setIsCreatingBooking] = useState(false);
    const [bookingPets, setBookingPets] = useState([]);
    const [veterinarians, setVeterinarians] = useState([]);
    const [isLoadingVeterinarians, setIsLoadingVeterinarians] = useState(false);
    const [bookingPetSearch, setBookingPetSearch] = useState('');
    const [selectedBookingPet, setSelectedBookingPet] = useState(null);
    const [adminBookingForm, setAdminBookingForm] = useState(createEmptyAdminBookingForm);

    // Registration states
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationData, setRegistrationData] = useState({
        petName: '',
        species: 'Dog',
        breed: '',
        birthDate: '',
        gender: 'Male',
        weight: '',
        tempOwnerName: '',
        status: 'Healthy',
        bookingId: null,
        ownerId: null
    });

    const fetchBookings = async () => {
        try {
            const data = await fetchBookingsService();
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        }
    };

    useAutoRefresh(fetchBookings);

    const bookingPetSuggestions = useMemo(() => {
        const query = bookingPetSearch.trim().toLowerCase();
        if (query.length < 2) {
            return [];
        }

        return bookingPets
            .filter((pet) => {
                const ownerUserId = Number(pet.user_id);
                const petStatus = String(pet.pet_status || '').toLowerCase();
                if (!Number.isFinite(ownerUserId) || ownerUserId <= 0 || ['deceased', 'dead'].includes(petStatus)) {
                    return false;
                }

                const petName = String(pet.pet_name || '').toLowerCase();
                const ownerName = ownerNameForPet(pet).toLowerCase();
                return petName.includes(query) || ownerName.includes(query);
            })
            .slice(0, 8);
    }, [bookingPetSearch, bookingPets]);

    const updateBookingStatus = async (id, newStatus, extraPayload = {}) => {
        try {
            const result = await updateBookingStatusService(id, { status: newStatus, ...extraPayload });
            setBookings(bookings =>
                bookings.map(booking =>
                    booking.id === id ? { ...booking, status: newStatus, onlineConsultation: result.onlineConsultation || booking.onlineConsultation } : booking
                )
            );
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.message || 'Failed to update booking status.');
            return false;
        }
    };

    const openAddBookingDialog = async () => {
        setAddBookingOpen(true);

        if (bookingPets.length === 0 && !isLoadingBookingPets) {
            setIsLoadingBookingPets(true);
            try {
                const data = await fetchQueuePets();
                setBookingPets(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error loading pets for booking:', error);
                toast.error(error.message || 'Failed to load pets for booking.');
            } finally {
                setIsLoadingBookingPets(false);
            }
        }

        if (veterinarians.length === 0 && !isLoadingVeterinarians) {
            setIsLoadingVeterinarians(true);
            try {
                const data = await fetchAccounts();
                setVeterinarians(Array.isArray(data?.veterinarians)
                    ? data.veterinarians.filter((vet) => Number(vet.is_active ?? 1) === 1)
                    : []);
            } catch (error) {
                console.error('Error loading veterinarians for booking:', error);
                toast.error(error.message || 'Failed to load veterinarians.');
            } finally {
                setIsLoadingVeterinarians(false);
            }
        }
    };

    const resetAddBookingDialog = () => {
        setBookingPetSearch('');
        setSelectedBookingPet(null);
        setAdminBookingForm(createEmptyAdminBookingForm());
    };

    const selectBookingPet = (pet) => {
        setSelectedBookingPet(pet);
        setBookingPetSearch(`${pet.pet_name} - ${ownerNameForPet(pet)}`);
    };

    const sendBookingPaymentToPOS = (booking) => {
        localStorage.setItem('ipawcus-pos-prefill', JSON.stringify({
            message: 'Booking payment loaded. Add the payment service manually before posting.',
            visit: {
                id: booking.bookingNumber || `BOOKING-${booking.id}`,
                bookingId: booking.id,
                petId: booking.petId || null,
                ownerUserId: booking.userId || null,
                sourceType: 'booking',
                petName: booking.petName || 'Booking Patient',
                ownerName: booking.ownerName || 'Pet Owner',
                species: booking.petSpecies || 'Pet',
                visitType: booking.isOnlineConsultation ? 'Online Consultation Payment' : 'Booking Payment',
                veterinarian: booking.veterinarian || 'Clinic Team',
                complaint: booking.notes || `${booking.isOnlineConsultation ? 'Online consultation' : 'Booking'} ${booking.bookingNumber || ''}`.trim(),
                status: 'Add payment service'
            },
            charges: []
        }));
        navigate('/dashboard/pos');
    };

    const createAdminBooking = async () => {
        if (isCreatingBooking) return;

        if (!selectedBookingPet) {
            toast.error('Select a registered pet before creating a booking.');
            return;
        }

        const ownerUserId = Number(selectedBookingPet.user_id);
        if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) {
            toast.error('This pet has no linked registered owner account. Link an owner before creating a booking.');
            return;
        }

        const isOnlineConsultation = adminBookingForm.serviceType === 'online-consultation';
        if (isOnlineConsultation && !adminBookingForm.veterinarianId) {
            toast.error('Select a veterinarian for online consultation.');
            return;
        }

        if (!adminBookingForm.bookingDate || !adminBookingForm.bookingTime) {
            toast.error('Booking date and time are required.');
            return;
        }

        setIsCreatingBooking(true);
        try {
            const shouldOpenPOS = adminBookingForm.paymentAction === 'pos';
            const savedServiceType = isOnlineConsultation ? 'consultation' : adminBookingForm.serviceType;
            const serviceLabel = isOnlineConsultation ? 'Online Consultation' : getServiceDisplayName(savedServiceType);
            const selectedVet = veterinarians.find((vet) => vetId(vet) === String(adminBookingForm.veterinarianId));
            const notes = [
                isOnlineConsultation ? '[Admin Online Consultation Booking]' : '[Admin Face-to-Face Booking]',
                `Service: ${serviceLabel}`,
                adminBookingForm.notes.trim()
            ].filter(Boolean).join('\n');

            const result = await createBooking({
                user_id: ownerUserId,
                pet_id: selectedBookingPet.pet_id,
                pet_ids: [selectedBookingPet.pet_id],
                service_type: savedServiceType,
                booking_date: adminBookingForm.bookingDate,
                booking_time: adminBookingForm.bookingTime,
                registered_status: 'Registered',
                is_home_service: 0,
                is_online_consultation: isOnlineConsultation ? 1 : 0,
                veterinarian_id: isOnlineConsultation ? Number(adminBookingForm.veterinarianId) : null,
                price: 0,
                notes
            });

            const createdBooking = {
                id: result.booking_id,
                bookingNumber: result.booking_number,
                userId: ownerUserId,
                petId: selectedBookingPet.pet_id,
                petName: selectedBookingPet.pet_name,
                petSpecies: selectedBookingPet.pet_species,
                ownerName: ownerNameForPet(selectedBookingPet),
                type: savedServiceType,
                service: serviceLabel,
                date: adminBookingForm.bookingDate,
                time: adminBookingForm.bookingTime,
                isOnlineConsultation,
                veterinarian: selectedVet ? vetName(selectedVet) : 'Clinic Team',
                status: 'pending',
                notes
            };

            toast.success(`Booking ${result.booking_number} created.`);
            setAddBookingOpen(false);
            resetAddBookingDialog();
            await fetchBookings();

            if (shouldOpenPOS) {
                sendBookingPaymentToPOS(createdBooking);
            }
        } catch (error) {
            console.error('Error creating admin booking:', error);
            toast.error(error.message || 'Failed to create booking.');
        } finally {
            setIsCreatingBooking(false);
        }
    };

    const getReviewDraft = (booking) => reviewDrafts[booking.id] || {
        serviceType: booking.type || 'consultation',
        notes: booking.notes || ''
    };

    const updateReviewDraft = (booking, field, value) => {
        setReviewDrafts(current => ({
            ...current,
            [booking.id]: {
                ...getReviewDraft(booking),
                [field]: value
            }
        }));
    };

    const saveBookingReview = async (booking) => {
        const draft = getReviewDraft(booking);
        const updated = await updateBookingStatus(booking.id, booking.status, {
            service_type: draft.serviceType,
            review_notes: draft.notes
        });

        if (updated) {
            setBookings(current => current.map(item => (
                item.id === booking.id
                    ? {
                        ...item,
                        type: draft.serviceType,
                        service: getServiceDisplayName(draft.serviceType),
                        notes: draft.notes
                    }
                    : item
            )));
            toast.success(`Review saved for ${booking.bookingNumber}.`);
        }
    };

    const sendOnlineBookingToPOS = (booking) => {
        localStorage.setItem('ipawcus-pos-prefill', JSON.stringify({
            visit: {
                id: booking.bookingNumber,
                bookingId: booking.id,
                petId: booking.petId || null,
                ownerUserId: booking.userId || null,
                sourceType: 'booking',
                petName: booking.petName || 'Online Consultation',
                ownerName: booking.ownerName || 'Pet Owner',
                species: booking.petSpecies || 'Pet',
                visitType: 'Online Consultation Payment',
                veterinarian: booking.veterinarian || 'Clinic Team',
                complaint: booking.notes || 'Admin-created online consultation payment',
                status: 'Payment only'
            },
            charges: Number(booking.price || 0) > 0
                ? [{
                    classificationId: 'services',
                    receiptType: 'SERVICE',
                    name: booking.isOnlineConsultation ? 'Online Consultation' : getServiceDisplayName(booking.service || booking.type || 'Online Consultation'),
                    group: 'Online Consultation',
                    quantity: 1,
                    price: Number(booking.price || 0),
                    includedMaterials: [],
                    extraMaterials: []
                }]
                : []
        }));
        navigate('/dashboard/pos');
    };

    const handleReschedule = (booking) => {
        setCurrentRescheduleBooking(booking);
        setNewDate(booking.date);
        setNewTime(booking.time);
        setRescheduleDialogOpen(true);
    };

    const openCancellationRequest = (booking) => {
        setCurrentCancellationBooking(booking);
        setCancellationData({
            message: '',
            walletNumber: normalizePhilippinePhoneInput(''),
            transactionNumber: ''
        });
        setCancellationDialogOpen(true);
    };

    const confirmCancellationRequest = async () => {
        if (!currentCancellationBooking) return;
        if (!cancellationData.message.trim()) {
            toast.error('Please enter a cancellation message.');
            return;
        }

        const walletRequired = Boolean(currentCancellationBooking.paymentProof);
        const walletNumber = normalizePhilippinePhoneForSubmit(cancellationData.walletNumber, { optional: !walletRequired });

        if (walletRequired && (!isValidPhilippinePhone(cancellationData.walletNumber) || !cancellationData.transactionNumber.trim())) {
            toast.error('Please provide the wallet number and transaction number for the manual return process.');
            return;
        }

        if (!isValidPhilippinePhone(cancellationData.walletNumber, { optional: !walletRequired })) {
            toast.error('Wallet number must be complete after +639.');
            return;
        }

        try {
            await updateBookingStatusService(currentCancellationBooking.id, {
                status: 'cancelled',
                cancellation_message: cancellationData.message.trim(),
                wallet_number: walletNumber,
                transaction_number: cancellationData.transactionNumber.trim()
            });

            toast.success(`Cancellation request recorded for ${currentCancellationBooking.bookingNumber}.`);
            setCancellationDialogOpen(false);
            setCurrentCancellationBooking(null);
            fetchBookings();
        } catch (error) {
            console.error('Error requesting cancellation:', error);
            toast.error(error.message || 'Failed to request cancellation.');
        }
    };

    const confirmReschedule = async () => {
        if (currentRescheduleBooking && newDate && newTime) {
            try {
                const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                const result = await updateBookingSchedule(currentRescheduleBooking.id, {
                    booking_date: newDate,
                    booking_time: newTime,
                    changed_by_user_id: storedUser.id || storedUser.user_id || null,
                    reason: 'Admin reschedule'
                });

                setBookings(bookings =>
                    bookings.map(booking =>
                        booking.id === currentRescheduleBooking.id
                            ? { ...booking, date: newDate, time: newTime, onlineConsultation: result.onlineConsultation || booking.onlineConsultation }
                            : booking
                    )
                );
                setRescheduleDialogOpen(false);
                toast.success(`Booking ${currentRescheduleBooking.bookingNumber} rescheduled to ${formatDisplayDate(newDate)} at ${newTime}`);
                setCurrentRescheduleBooking(null);
                setNewDate('');
                setNewTime('');
            } catch (error) {
                console.error('Error rescheduling booking:', error);
                toast.error(error.message || 'Failed to reschedule booking.');
            }
        }
    };

    const handleOpenRegistration = (booking) => {
        const normalizedOwnerId = Number(booking.userId ?? booking.user_id);
        const today = new Date().toISOString().split('T')[0];
        setRegistrationData({
            petName: booking.petName || '',
            species: booking.petSpecies || 'Dog',
            breed: booking.petBreed || '',
            birthDate: today,
            gender: 'Male',
            weight: booking.petWeight || '',
            tempOwnerName: booking.ownerName, // As requested: temp owner to be directly the pet owner
            status: 'Healthy',
            bookingId: booking.id,
            ownerId: Number.isFinite(normalizedOwnerId) && normalizedOwnerId > 0 ? normalizedOwnerId : null
        });
        setIsRegisterModalOpen(true);
    };

    const handleRegisterPet = async () => {
        if (!registrationData.petName || !registrationData.species || !registrationData.breed || !registrationData.birthDate || !registrationData.gender) {
            toast.error("Please fill in all required fields (Name, Species, Breed, Birth Date, Gender)");
            return;
        }
        if (!registrationData.ownerId) {
            toast.error("Cannot register: booking owner is missing. Please refresh bookings and try again.");
            return;
        }

        setIsRegistering(true);
        try {
            await addPetService({
                ...registrationData,
                petName: registrationData.petName,
                species: registrationData.species,
                breed: registrationData.breed,
                birthDate: registrationData.birthDate,
                gender: registrationData.gender,
                weight: registrationData.weight,
                tempOwnerName: registrationData.tempOwnerName,
                status: registrationData.status,
                userId: Number(registrationData.ownerId) // Pass the ownerId for auto-linking
            });

            // After registration, update the booking to link to the new pet and mark as registered
            // In a real app, you might have an endpoint to link a booking to a pet
            // For now, let's just update the local state and inform the user
            toast.success(`${registrationData.petName} registered and linked to ${registrationData.tempOwnerName} successfully!`);
            
            // Re-fetch bookings to show updated status
            fetchBookings();
            setIsRegisterModalOpen(false);
        } catch (error) {
            toast.error('Failed to register pet: ' + error.message);
        } finally {
            setIsRegistering(false);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            'pending': { 
                bg: 'bg-amber-50', 
                text: 'text-amber-700', 
                border: 'border-amber-200',
                label: 'Pending' 
            },
            'confirmed': { 
                bg: 'bg-blue-50', 
                text: 'text-blue-700', 
                border: 'border-blue-200',
                label: 'Confirmed' 
            },
            'completed': { 
                bg: 'bg-green-50', 
                text: 'text-green-700', 
                border: 'border-green-200',
                label: 'Completed' 
            },
            'cancelled': { 
                bg: 'bg-red-50', 
                text: 'text-red-700', 
                border: 'border-red-200',
                label: 'Cancelled' 
            }
        };

        const { bg, text, border, label } = variants[status] || variants['pending'];
        return (
            <Badge className={`${bg} ${text} ${border} border px-2.5 py-0.5 rounded-full font-medium`}>
                {label}
            </Badge>
        );
    };

    const getTypeBadge = (type, isHomeService, isOnlineConsultation) => {
        // 1. Home Service takes priority
        if (isHomeService) {
            return <Badge className="bg-[#ffec99] text-[#8a6500] hover:bg-[#ffec99]">Home Service</Badge>;
        }

        // 2. Online Consultation check
        if (isOnlineConsultation) {
            return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Online Consultation</Badge>;
        }

        // 3. Specific Service mapping
        const labels = {
            'consultation': 'Consultation',
            'vaccination': 'Vaccination',
            'grooming': 'Grooming',
            'dental': 'Dental Check-up',
            'General Check-up': 'General Check-up',
            'general-checkup': 'General Check-up',
            'surgery': 'Surgery',
            'kapon': 'Kapon / Special Surgery',
            'lab-testing': 'Lab Testing',
            'parasite-control': 'Parasite Control',
            'boarding': 'Pet Hotel & Kennel Boarding',
            'special services': 'Special Services'
        };

        const label = labels[type] || 'Consultation';
        return <Badge variant="secondary">{label}</Badge>;
    };

    const getBoardingStayLabel = (type) => (
        type === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding'
    );

    const getBookingServiceName = (booking) => (
        booking?.isOnlineConsultation
            ? 'Online Consultation'
            : getServiceDisplayName(booking?.service || booking?.type || 'consultation')
    );

    const getBoardingAssignmentStatusLabel = (status) => {
        const labels = {
            reserved: 'Reserved',
            occupied: 'Boarded',
            checked_out: 'Checked Out'
        };

        return labels[status] || getServiceDisplayName(status || 'Pending');
    };

    const filteredBookings = bookings.filter(booking => {
        if (booking.type === 'boarding' && booking.hotelBoardingType) {
            return false;
        }

        // Fallback for names to prevent crashes
        const petName = booking.petName || `Unregistered ${booking.petSpecies || 'Pet'}`;
        const ownerName = booking.ownerName || 'Unknown Owner';
        const bookingNumber = booking.bookingNumber || '';

        const matchesSearch =
            petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bookingNumber.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'all'
            || filterType === 'Service Type'
            || (filterType === 'online-consultation' ? booking.isOnlineConsultation : booking.type === filterType);
        const matchesStatus = filterStatus === 'all' || filterStatus === 'Status' || booking.status === filterStatus;
        const createdDate = new Date(booking.createdAt || booking.date);
        const today = new Date();
        const ageLimitDays = {
            '7d': 7,
            '14d': 14,
            '30d': 30
        }[filterAge];
        const ageInDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
        const isToday = !Number.isNaN(createdDate.getTime()) && createdDate.toDateString() === today.toDateString();
        const matchesAge = filterAge === 'today'
            ? isToday
            : filterAge === 'all' || booking.status === 'cancelled' || (!Number.isNaN(ageInDays) && ageInDays <= ageLimitDays);

        return matchesSearch && matchesType && matchesStatus && matchesAge;
    }).sort((a, b) => {
        const statusOrder = {
            'pending': 1,
            'confirmed': 2,
            'completed': 3,
            'cancelled': 4
        };
        return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
    });

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                        Bookings Management
                    </h2>
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        View and manage all booking appointments
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={openAddBookingDialog}
                    className="w-full gap-2 bg-[#155dfc] hover:bg-[#0d4acf] sm:w-auto"
                >
                    <Plus className="size-4" />
                    Add Booking
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Total Bookings:</span>
                    <span className="bg-[#eff6ff] text-[#155dfc] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {bookings.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Confirmed:</span>
                    <span className="bg-[#e0f2e9] text-[#0c6a3c] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {bookings.filter(item => item.status === 'confirmed').length}
                    </span>
                </div>
            </div>

            <div className="mb-6 flex flex-col gap-4 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:flex-nowrap">
                <div className="w-full min-[1100px]:min-w-[260px] min-[1100px]:flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5565]" />
                        <Input
                            placeholder="Search by pet name, owner, or booking number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3 min-[1100px]:flex min-[1100px]:w-auto min-[1100px]:flex-none min-[1100px]:flex-nowrap min-[1100px]:items-center">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-full min-[1100px]:w-[180px]">
                            <Filter className="size-4 mr-2" />
                            <SelectValue placeholder="Service Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Service Type">Service Type</SelectItem>
                            <SelectItem value="online-consultation">Online Consultation</SelectItem>
                            <SelectItem value="vaccination">Vaccination</SelectItem>
                            <SelectItem value="grooming">Grooming</SelectItem>
                            <SelectItem value="dental">Dental</SelectItem>
                            <SelectItem value="General Check-up">General Check-up</SelectItem>
                            <SelectItem value="surgery">Surgery</SelectItem>
                            <SelectItem value="lab-testing">Lab Testing</SelectItem>
                            <SelectItem value="parasite-control">Parasite Control</SelectItem>
                            <SelectItem value="home-service">Home Service</SelectItem>
                            <SelectItem value="special services">Special Services</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full min-[1100px]:w-[180px]">
                            <Filter className="size-4 mr-2" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Status">Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterAge} onValueChange={setFilterAge}>
                        <SelectTrigger className="w-full min-[1100px]:w-[160px]">
                            <CalendarClock className="size-4 mr-2" />
                            <SelectValue placeholder="Age" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Dates</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="14d">Last 2 Weeks</SelectItem>
                            <SelectItem value="30d">Last 1 Month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Booking #</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden md:table-cell">Type</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Pet / Owner</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif] hidden md:table-cell">Date & Time</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                            <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredBookings.map((booking) => (
                            <TableRow key={booking.id}>
                                <TableCell className="font-['Arimo:Bold',sans-serif]">{booking.bookingNumber}</TableCell>
                                <TableCell className="hidden md:table-cell">{getTypeBadge(booking.type, booking.isHomeService, booking.isOnlineConsultation)}</TableCell>
                                <TableCell>
                                    <div>
                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px]">
                                            {booking.petName}
                                            {!booking.isRegistered && (
                                                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Unreg</span>
                                            )}
                                        </p>
                                        <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">{booking.ownerName}</p>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    <div>
                                        <p className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                            {formatDisplayDate(booking.checkInDate || booking.date, { compact: true })}
                                        </p>
                                        <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                                            {booking.checkOutDate ? `Until ${formatDisplayDate(booking.checkOutDate, { compact: true })}` : formatDisplayTime(booking.time)}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {booking.hasCancellationRequest ? (
                                            <Badge className="bg-red-100 text-red-700 border-red-200 border px-2.5 py-0.5 rounded-full font-medium">
                                                Cancellation Requested
                                            </Badge>
                                        ) : (
                                            getStatusBadge(booking.status)
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Eye className="size-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
                                            <div className="sticky top-0 bg-white z-10 border-b p-6">
                                                <SheetHeader className="mb-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <SheetTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                                                Booking Details
                                                            </SheetTitle>
                                                            <SheetDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                                                View complete booking information
                                                            </SheetDescription>
                                                        </div>
                                                        <SheetClose
                                                            aria-label="Close booking details"
                                                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                                        >
                                                            <X className="size-4" />
                                                        </SheetClose>
                                                    </div>
                                                </SheetHeader>
                                            </div>

                                            <div className="space-y-6 p-4 sm:p-6">
                                                {/* Quick Action Buttons */}
                                                <div className={`grid ${!booking.isRegistered ? 'grid-cols-1 min-[420px]:grid-cols-3' : 'grid-cols-1 min-[420px]:grid-cols-2'} gap-3`}>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => setInfoModal({ type: 'owner', booking })}
                                                        className="w-full h-auto py-4 flex flex-col gap-2 border-[#155dfc] hover:bg-[#eff6ff]"
                                                    >
                                                        <ActionButtonMedia
                                                            image={booking.ownerProfileImage}
                                                            alt={`${booking.ownerName || 'Pet owner'} profile`}
                                                            fallback={User}
                                                        />
                                                        <span className="max-w-full truncate font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                                                            {booking.ownerName || 'Pet Owner'} profile
                                                        </span>
                                                        <span className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#155dfc]">
                                                            View Pet Owner
                                                        </span>
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => setInfoModal({ type: 'pet', booking })}
                                                        className="w-full h-auto py-4 flex flex-col gap-2 border-[#155dfc] hover:bg-[#eff6ff]"
                                                    >
                                                        <ActionButtonMedia
                                                            image={booking.petProfileImage}
                                                            alt={`${booking.petName || 'Pet'} profile`}
                                                            fallback={PawPrint}
                                                        />
                                                        <span className="max-w-full truncate font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                                                            {booking.petName || 'Pet'} profile
                                                        </span>
                                                        <span className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#155dfc]">
                                                            View Pet Info
                                                        </span>
                                                    </Button>

                                                    {!booking.isRegistered && (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleOpenRegistration(booking)}
                                                            className="w-full h-auto py-4 flex flex-col gap-2 border-amber-500 hover:bg-amber-50"
                                                        >
                                                            <UserPlus className="size-6 text-amber-500" />
                                                            <span className="font-['Arimo:Bold',sans-serif] text-[12px] text-amber-500">
                                                                Register Pet
                                                            </span>
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Basic Info */}
                                            <div className="space-y-3">
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Booking Number
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.bookingNumber}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Type
                                                        </p>
                                                        {getTypeBadge(booking.type, booking.isHomeService, booking.isOnlineConsultation)}
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Pet Name
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.petName}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Pet Breed / Type
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.petBreed || 'Not Specified'} / {booking.petSpecies || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Registration Status
                                                        </p>
                                                        <p className={`font-['Arimo:Bold',sans-serif] text-[16px] ${booking.isRegistered ? 'text-green-600' : 'text-amber-600'}`}>
                                                            {booking.isRegistered ? 'Registered' : 'Not Registered'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Owner
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.ownerName}
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                                            {booking.ownerEmail}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Service
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {getBookingServiceName(booking)}
                                                        </p>
                                                    </div>
                                                    {booking.isOnlineConsultation && (
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                Specified Veterinarian
                                                            </p>
                                                            <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                                {booking.veterinarian || 'Unassigned'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Date & Time
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.checkInDate && booking.checkOutDate
                                                                ? formatDisplayDateRange(booking.checkInDate, booking.checkOutDate)
                                                                : `${formatDisplayDate(booking.date)} at ${formatDisplayTime(booking.time)}`}
                                                        </p>
                                                    </div>
                                                    {booking.hotelBoardingType && (
                                                        <>
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                    Stay Type
                                                                </p>
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                                    {getBoardingStayLabel(booking.hotelBoardingType)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                    Room/Kennel Size
                                                                </p>
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[16px] capitalize">
                                                                    {booking.roomSize || 'Not set'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                    Reserved Room/Kennel
                                                                </p>
                                                                {booking.boardingAssignment ? (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                                            {booking.boardingAssignment.roomLabel}
                                                                        </p>
                                                                        <Badge className="bg-blue-50 text-blue-700">
                                                                            {getBoardingAssignmentStatusLabel(booking.boardingAssignment.status)}
                                                                        </Badge>
                                                                    </div>
                                                                ) : (
                                                                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-amber-600">
                                                                        Not reserved yet
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                    Emergency Contact
                                                                </p>
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                                    {booking.emergencyContact || 'Not provided'}
                                                                </p>
                                                            </div>
                                                            {booking.price > 0 && (
                                                                <div>
                                                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                        Estimated Stay Total
                                                                    </p>
                                                                    <p className="font-['Arimo:Bold',sans-serif] text-[16px] text-blue-600">
                                                                        {formatPhpCurrency(booking.price)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {booking.isHomeService && booking.address && (
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                Service Address
                                                            </p>
                                                            <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                                {booking.address}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {booking.isHomeService && booking.price > 0 && (
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                Paid Transport Fee
                                                            </p>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[16px] text-blue-600">
                                                                {formatPhpCurrency(booking.price)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Status
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {booking.hasCancellationRequest ? (
                                                                <Badge className="bg-red-100 text-red-700 border-red-200 border px-2.5 py-0.5 rounded-full font-medium">
                                                                    Cancellation Requested
                                                                </Badge>
                                                            ) : (
                                                                getStatusBadge(booking.status)
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {booking.notes && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Notes
                                                        </p>
                                                        {String(booking.notes).includes('[Cancellation Request]') && (
                                                            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                                                Cancellation request submitted by the pet owner. Review the wallet and transaction details before processing any return.
                                                            </div>
                                                        )}
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px] whitespace-pre-wrap">
                                                            {booking.notes}
                                                        </p>
                                                    </div>
                                                )}

                                                {booking.type === 'special services' && Array.isArray(booking.specialServiceItems) && booking.specialServiceItems.length > 0 && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-2">
                                                            Special Service Items
                                                        </p>
                                                        <div className="space-y-3">
                                                            {booking.specialServiceItems.map((item, index) => (
                                                                <div key={`${item.id || item.sequenceNo || index}`} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <p className="font-semibold text-slate-900">{item.serviceTitle || 'Special Service'}</p>
                                                                            {item.serviceDescription && (
                                                                                <p className="mt-1 text-sm text-slate-600">{item.serviceDescription}</p>
                                                                            )}
                                                                        </div>
                                                                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                                                            #{item.sequenceNo || index + 1}
                                                                        </span>
                                                                    </div>
                                                                    {(item.priceLabel || item.durationLabel || item.maxPets) && (
                                                                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                                                                            {item.priceLabel && <p><span className="font-semibold">Price:</span> {normalizeCurrencyLabel(item.priceLabel)}</p>}
                                                                            {item.durationLabel && <p><span className="font-semibold">Duration:</span> {item.durationLabel}</p>}
                                                                            {item.maxPets && <p><span className="font-semibold">Max Pets:</span> {item.maxPets}</p>}
                                                                        </div>
                                                                    )}
                                                                    {item.serviceDetails && (
                                                                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.serviceDetails}</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {Array.isArray(booking.addOns) && booking.addOns.length > 0 && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-2">
                                                            Add-ons
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {booking.addOns.map((addOn) => (
                                                                <span key={addOn.id || addOn.name} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                                                                    {addOn.name || addOn.id}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Signature Section */}
                                                {booking.signaturePath && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                            Client Signature
                                                        </p>
                                                        <div className="bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] rounded-[14px] p-4 flex items-center justify-center">
                                                            <img
                                                                src={booking.signaturePath}
                                                                alt="Client Signature"
                                                                className="max-h-24 object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Pet Profile Image Section */}
                                                <div className="border-t pt-4">
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                       Pictures of Concern
                                                    </p>
                                                    {booking.image_Booking_Concern_Path ? (
                                                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                                                            {booking.image_Booking_Concern_Path.split(',').filter(path => path.trim() !== "").map((path, idx) => (
                                                                <div 
                                                                    key={idx}
                                                                    className="w-full aspect-square cursor-pointer hover:opacity-80 transition-opacity"
                                                                    onClick={() => setViewerImage({ src: path.trim(), alt: `${booking.petName} concern ${idx + 1}` })}
                                                                >
                                                                    <img
                                                                        src={path.trim()}
                                                                        alt={`${booking.petName} concern ${idx + 1}`}
                                                                        className="w-full h-full object-cover rounded-xl border border-[rgba(0,0,0,0.1)]"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                                            <p className="text-[12px] text-gray-400 text-center px-2">No images available</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Payment Proof Section */}
                                                <div className="border-t pt-4">
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                        Payment Proof
                                                    </p>
                                                    {booking.paymentProof ? (
                                                        <div 
                                                            className="bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] rounded-[14px] p-4 cursor-pointer hover:bg-[#f3f4f6] transition-colors"
                                                            onClick={() => setViewerImage({ src: booking.paymentProof, alt: "Payment Proof" })}
                                                        >
                                                            <img
                                                                src={booking.paymentProof}
                                                                alt="Payment Proof"
                                                                className="w-full h-auto object-cover rounded-[8px] border border-[rgba(0,0,0,0.1)]"
                                                            />
                                                            <p className="text-center text-[12px] text-[#4a5565] mt-2">
                                                                Click to view full size
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-[14px] p-6 text-center">
                                                            <p className="text-[14px] text-gray-400">No Proof of Payment</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {booking.status !== 'cancelled' && (
                                                    <div className="border-t pt-4">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => sendBookingPaymentToPOS(booking)}
                                                            className="w-full border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff]"
                                                        >
                                                            <CreditCard className="size-4 mr-2" />
                                                            Open Point-Of-Sale Payment
                                                        </Button>
                                                        <p className="mt-2 text-[12px] text-[#4a5565]">
                                                            Point-Of-Sale opens blank so staff can add the payment service manually.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Review Booking Section */}
                                                {booking.status !== 'completed' && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                                                            Review Booking
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            {booking.status !== 'confirmed' && booking.status !== 'cancelled' && (
                                                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                                    <div className="space-y-2">
                                                                        <Label>Reviewed Service</Label>
                                                                        <Select
                                                                            value={getReviewDraft(booking).serviceType}
                                                                            onValueChange={(value) => updateReviewDraft(booking, 'serviceType', value)}
                                                                        >
                                                                            <SelectTrigger className="bg-white">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {REVIEW_SERVICE_TYPES.map((type) => (
                                                                                    <SelectItem key={type.value} value={type.value}>
                                                                                        {type.label}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>Reviewed Notes / Observations</Label>
                                                                        <Textarea
                                                                            value={getReviewDraft(booking).notes}
                                                                            onChange={(event) => updateReviewDraft(booking, 'notes', event.target.value)}
                                                                            placeholder="Adjust the service based on client notes, observations, or request before confirming."
                                                                            rows={4}
                                                                            className="bg-white"
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        onClick={() => saveBookingReview(booking)}
                                                                        className="w-full border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff]"
                                                                    >
                                                                        Save Review
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {booking.status !== 'confirmed' && booking.status !== 'cancelled' && (
                                                                <Button
                                                                    onClick={async () => {
                                                                        const draft = getReviewDraft(booking);
                                                                        const updated = await updateBookingStatus(booking.id, 'confirmed', {
                                                                            service_type: draft.serviceType,
                                                                            review_notes: draft.notes
                                                                        });
                                                                        if (updated) {
                                                                            toast.success(`${booking.isOnlineConsultation ? 'Online consultation' : 'Booking'} ${booking.bookingNumber} for ${booking.petName} confirmed successfully`);
                                                                            if (booking.isOnlineConsultation && !booking.paymentProof) {
                                                                                sendOnlineBookingToPOS({
                                                                                    ...booking,
                                                                                    type: draft.serviceType,
                                                                                    service: getServiceDisplayName(draft.serviceType),
                                                                                    notes: draft.notes
                                                                                });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="bg-[#0c6a3c] hover:bg-[#09522f] text-white w-full"
                                                                >
                                                                    <CheckCircle className="size-4 mr-2" />
                                                                    {booking.isOnlineConsultation ? 'Approve Online Consultation' : 'Confirm Booking'}
                                                                </Button>
                                                            )}

                                                            {booking.status !== 'cancelled' && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => {
                                                                    handleReschedule(booking);
                                                                    toast.success(`Rescheduling booking ${booking.bookingNumber}...`);
                                                                }}
                                                                className="border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff] w-full"
                                                            >
                                                                <CalendarClock className="size-4 mr-2" />
                                                                Reschedule
                                                            </Button>
                                                            )}

                                                            {booking.status !== 'cancelled' && (
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => openCancellationRequest(booking)}
                                                                className="w-full"
                                                            >
                                                                <XCircle className="size-4 mr-2" />
                                                                Request Cancellation
                                                            </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
            <PhotoViewer src={viewerImage?.src} alt={viewerImage?.alt} open={!!viewerImage} onOpenChange={() => setViewerImage(null)} />

            <Dialog
                open={addBookingOpen}
                onOpenChange={(open) => {
                    if (isCreatingBooking) {
                        return;
                    }

                    setAddBookingOpen(open);
                    if (!open) {
                        resetAddBookingDialog();
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Add Booking
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Create an admin booking. Point-Of-Sale opens without a preset service so staff can add the payment line manually.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pet</Label>
                            <Input
                                value={bookingPetSearch}
                                onChange={(event) => {
                                    setBookingPetSearch(event.target.value);
                                    setSelectedBookingPet(null);
                                }}
                                placeholder={isLoadingBookingPets ? 'Loading pets...' : 'Search registered pet or owner'}
                                disabled={isCreatingBooking}
                            />
                            {bookingPetSearch.trim().length >= 2 && !selectedBookingPet && (
                                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                                    {isLoadingBookingPets ? (
                                        <div className="px-3 py-2 text-sm text-slate-500">Loading pets...</div>
                                    ) : bookingPetSuggestions.length > 0 ? (
                                        bookingPetSuggestions.map((pet) => (
                                            <button
                                                type="button"
                                                key={pet.pet_id}
                                                onClick={() => selectBookingPet(pet)}
                                                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50"
                                            >
                                                <span className="font-semibold text-slate-900">{pet.pet_name}</span>
                                                <span className="text-xs text-slate-500">
                                                    {ownerNameForPet(pet)}{pet.pet_species ? ` / ${pet.pet_species}` : ''}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-sm text-slate-500">No registered pet found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Owner</Label>
                                <Input
                                    value={selectedBookingPet ? ownerNameForPet(selectedBookingPet) : ''}
                                    readOnly
                                    className="bg-slate-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Service Category</Label>
                                <Select
                                    value={adminBookingForm.serviceType}
                                    onValueChange={(value) => setAdminBookingForm((current) => ({ ...current, serviceType: value }))}
                                    disabled={isCreatingBooking}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ADMIN_BOOKING_SERVICE_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {adminBookingForm.serviceType === 'online-consultation' && (
                                <div className="space-y-2">
                                    <Label>Veterinarian</Label>
                                    <Select
                                        value={adminBookingForm.veterinarianId}
                                        onValueChange={(value) => setAdminBookingForm((current) => ({ ...current, veterinarianId: value }))}
                                        disabled={isCreatingBooking || isLoadingVeterinarians}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingVeterinarians ? 'Loading veterinarians...' : 'Select veterinarian'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {veterinarians.length > 0 ? (
                                                veterinarians.map((vet) => (
                                                    <SelectItem key={vetId(vet)} value={vetId(vet)}>
                                                        {vetName(vet)}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="no-veterinarians" disabled>
                                                    No veterinarians available
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={adminBookingForm.bookingDate}
                                    onChange={(event) => setAdminBookingForm((current) => ({ ...current, bookingDate: event.target.value }))}
                                    disabled={isCreatingBooking}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Time</Label>
                                <Input
                                    type="time"
                                    value={adminBookingForm.bookingTime}
                                    onChange={(event) => setAdminBookingForm((current) => ({ ...current, bookingTime: event.target.value }))}
                                    disabled={isCreatingBooking}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Payment</Label>
                            <Select
                                value={adminBookingForm.paymentAction}
                                onValueChange={(value) => setAdminBookingForm((current) => ({ ...current, paymentAction: value }))}
                                disabled={isCreatingBooking}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pos">Open Point-Of-Sale after booking</SelectItem>
                                    <SelectItem value="unpaid">Save as unpaid booking</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={adminBookingForm.notes}
                                onChange={(event) => setAdminBookingForm((current) => ({ ...current, notes: event.target.value }))}
                                rows={3}
                                placeholder="Walk-in or admin booking notes"
                                disabled={isCreatingBooking}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAddBookingOpen(false)}
                            disabled={isCreatingBooking}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={createAdminBooking}
                            disabled={isCreatingBooking}
                            className="bg-[#155dfc] hover:bg-[#0d4acf]"
                        >
                            {isCreatingBooking ? (
                                <><Loader2 className="size-4 mr-2 animate-spin" /> Creating...</>
                            ) : adminBookingForm.paymentAction === 'pos' ? (
                                'Create & Open Point-Of-Sale'
                            ) : (
                                'Create Booking'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!infoModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setInfoModal(null);
                    }
                }}
            >
                {infoModal && (
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                {infoModal.type === 'owner' ? 'Pet Owner Profile' : 'Pet Information'}
                            </DialogTitle>
                            <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                {infoModal.type === 'owner'
                                    ? `Profile details for ${infoModal.booking.ownerName || 'the pet owner'}`
                                    : `Biological details for ${infoModal.booking.petName || 'the pet'}`}
                            </DialogDescription>
                        </DialogHeader>

                        {infoModal.type === 'owner' ? (
                            <PetOwnerProfileModal
                                ownerId={infoModal.booking.userId}
                                ownerName={infoModal.booking.ownerName}
                                ownerEmail={infoModal.booking.ownerEmail}
                                ownerPhone={infoModal.booking.ownerPhone}
                                ownerEmergencyNumber={infoModal.booking.ownerEmergencyNumber}
                                ownerAddress={infoModal.booking.ownerAddress}
                                ownerBirthdate={infoModal.booking.ownerBirthdate}
                                ownerProfileImage={infoModal.booking.ownerProfileImage}
                            />
                        ) : (
                            <PetInfoModal
                                petId={infoModal.booking.petId}
                                petName={infoModal.booking.petName}
                                booking={infoModal.booking}
                            />
                        )}
                    </DialogContent>
                )}
            </Dialog>

            <Dialog
                open={cancellationDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setCancellationDialogOpen(false);
                        setCurrentCancellationBooking(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Request Cancellation
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Record the cancellation reason and any manual return details for this booking.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">Booking Number</p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">{currentCancellationBooking?.bookingNumber}</p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">Pet / Owner</p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">{currentCancellationBooking?.petName} / {currentCancellationBooking?.ownerName}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cancellationMessage">Cancellation Message *</Label>
                            <Textarea
                                id="cancellationMessage"
                                value={cancellationData.message}
                                onChange={(event) => setCancellationData({ ...cancellationData, message: event.target.value })}
                                placeholder="Explain why the booking is being cancelled and what the admin should communicate to the client."
                                rows={4}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="walletNumber">
                                    Wallet Number {currentCancellationBooking?.paymentProof ? '*' : '(optional)'}
                                </Label>
                                <Input
                                    id="walletNumber"
                                    value={cancellationData.walletNumber}
                                    onChange={(event) => setCancellationData({ ...cancellationData, walletNumber: normalizePhilippinePhoneInput(event.target.value) })}
                                    inputMode="tel"
                                    maxLength={13}
                                    placeholder="+639"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="transactionNumber">
                                    Transaction Number {currentCancellationBooking?.paymentProof ? '*' : '(optional)'}
                                </Label>
                                <Input
                                    id="transactionNumber"
                                    value={cancellationData.transactionNumber}
                                    onChange={(event) => setCancellationData({ ...cancellationData, transactionNumber: event.target.value })}
                                    placeholder="Manual return transaction reference"
                                />
                            </div>
                        </div>

                        {currentCancellationBooking?.paymentProof && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                This booking has payment proof on file. Wallet and transaction details are required so the return process can be handled manually.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCancellationDialogOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmCancellationRequest}
                        >
                            Submit Cancellation Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reschedule Dialog */}
            <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Reschedule Booking
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Select a new date and time for the booking
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">Booking Number</p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">{currentRescheduleBooking?.bookingNumber}</p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">Pet Name</p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">{currentRescheduleBooking?.petName}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">New Date & Time</p>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="w-full"
                                    />
                                    <Input
                                        type="time"
                                        value={newTime}
                                        onChange={(e) => setNewTime(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="default"
                            onClick={() => {
                                confirmReschedule();
                            }}
                        >
                            Confirm Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setRescheduleDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Register Pet Dialog */}
            <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
                <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Register New Pet
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Register {registrationData.petName} to the system to track progress.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Pet Name *</Label>
                            <Input 
                                value={registrationData.petName} 
                                onChange={(e) => setRegistrationData({...registrationData, petName: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Species *</Label>
                            <Select 
                                value={registrationData.species} 
                                onValueChange={(value) => setRegistrationData({...registrationData, species: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select species" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Dog">Dog</SelectItem>
                                    <SelectItem value="Cat">Cat</SelectItem>
                                    <SelectItem value="Bird">Bird</SelectItem>
                                    <SelectItem value="Rabbit">Rabbit</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Breed *</Label>
                            <Input 
                                value={registrationData.breed} 
                                onChange={(e) => setRegistrationData({...registrationData, breed: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Birth Date *</Label>
                            <Input 
                                type="date"
                                value={registrationData.birthDate} 
                                onChange={(e) => setRegistrationData({...registrationData, birthDate: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Gender *</Label>
                            <Select 
                                value={registrationData.gender} 
                                onValueChange={(value) => setRegistrationData({...registrationData, gender: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Neutered Male">Neutered Male</SelectItem>
                                    <SelectItem value="Spayed Female">Spayed Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Weight (kg)</Label>
                            <Input 
                                value={registrationData.weight} 
                                onChange={(e) => setRegistrationData({...registrationData, weight: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Temporary Owner Name</Label>
                            <Input 
                                value={registrationData.tempOwnerName} 
                                readOnly
                                className="bg-slate-50"
                            />
                            <p className="text-[12px] text-gray-500">Automatically set to the person who booked the appointment.</p>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Initial Health Status</Label>
                            <Select 
                                value={registrationData.status} 
                                onValueChange={(value) => setRegistrationData({...registrationData, status: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Healthy">Healthy</SelectItem>
                                    <SelectItem value="Emergency">Emergency</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            onClick={handleRegisterPet} 
                            disabled={isRegistering}
                            className="bg-[#155dfc] hover:bg-[#0d4acf]"
                        >
                            {isRegistering ? (
                                <><Loader2 className="size-4 mr-2 animate-spin" /> Registering...</>
                            ) : (
                                "Confirm Registration"
                            )}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setIsRegisterModalOpen(false)}
                            disabled={isRegistering}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
