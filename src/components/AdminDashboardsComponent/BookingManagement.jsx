import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Search, Filter, Eye, CheckCircle, XCircle, X, User, PawPrint, CalendarClock, UserPlus, Loader2 } from 'lucide-react';
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
        walletNumber: '',
        transactionNumber: ''
    });

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
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings`);
            if (!response.ok) throw new Error('Failed to fetch bookings');
            const data = await response.json();
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    const updateBookingStatus = async (id, newStatus, extraPayload = {}) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, ...extraPayload })
            });
            
            if (response.ok) {
                const result = await response.json().catch(() => ({}));
                setBookings(bookings =>
                    bookings.map(booking =>
                        booking.id === id ? { ...booking, status: newStatus, onlineConsultation: result.onlineConsultation || booking.onlineConsultation } : booking
                    )
                );
                return true;
            } else {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to update booking status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.message || 'Failed to update booking status.');
            return false;
        }
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
            walletNumber: '',
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

        if (currentCancellationBooking.paymentProof && (!cancellationData.walletNumber.trim() || !cancellationData.transactionNumber.trim())) {
            toast.error('Please provide the wallet number and transaction number for the manual return process.');
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings/${currentCancellationBooking.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'cancelled',
                    cancellation_message: cancellationData.message.trim(),
                    wallet_number: cancellationData.walletNumber.trim(),
                    transaction_number: cancellationData.transactionNumber.trim()
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to request cancellation');
            }

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
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings/${currentRescheduleBooking.id}/schedule`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        booking_date: newDate,
                        booking_time: newTime,
                        changed_by_user_id: storedUser.id || storedUser.user_id || null,
                        reason: 'Admin reschedule'
                    })
                });

                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to reschedule booking');
                }

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
            'wellness': 'General Check-up',
            'surgery': 'Surgery',
            'kapon': 'Kapon / Special Surgery',
            'lab-testing': 'Lab Testing',
            'parasite-control': 'Parasite Control',
            'boarding': 'Pet Hotel & Boarding',
            'special services': 'Special Services'
        };

        const label = labels[type] || 'Consultation';
        return <Badge variant="secondary">{label}</Badge>;
    };

    const filteredBookings = bookings.filter(booking => {
        // Fallback for names to prevent crashes
        const petName = booking.petName || `Unregistered ${booking.petSpecies || 'Pet'}`;
        const ownerName = booking.ownerName || 'Unknown Owner';
        const bookingNumber = booking.bookingNumber || '';

        const matchesSearch =
            petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bookingNumber.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'all' || filterType === 'Service Type' || booking.type === filterType;
        const matchesStatus = filterStatus === 'all' || filterStatus === 'Status' || booking.status === filterStatus;
        const ageLimitDays = {
            '7d': 7,
            '14d': 14,
            '30d': 30
        }[filterAge];
        const createdDate = new Date(booking.createdAt || booking.date);
        const ageInDays = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
        const matchesAge = filterAge === 'all' || booking.status === 'cancelled' || (!Number.isNaN(ageInDays) && ageInDays <= ageLimitDays);

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
            <div>
                <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                    Bookings Management
                </h2>
                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                    View and manage all booking appointments
                </p>
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
                            <SelectItem value="consultation">Consultation</SelectItem>
                            <SelectItem value="vaccination">Vaccination</SelectItem>
                            <SelectItem value="grooming">Grooming</SelectItem>
                            <SelectItem value="dental">Dental</SelectItem>
                            <SelectItem value="wellness">Wellness</SelectItem>
                            <SelectItem value="surgery">Surgery</SelectItem>
                            <SelectItem value="lab-testing">Lab Testing</SelectItem>
                            <SelectItem value="parasite-control">Parasite Control</SelectItem>
                            <SelectItem value="boarding">Boarding</SelectItem>
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
                                        <SheetContent side="right" showClose={false} className="sm:max-w-xl overflow-y-auto">
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
                                                            {booking.service}
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
                                                                <p className="font-['Arimo:Regular',sans-serif] text-[16px] capitalize">
                                                                    {booking.hotelBoardingType}
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
                                                                        PHP {Number(booking.price).toLocaleString('en-US')}
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
                                                                ₱{booking.price}
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
                                                                            {item.priceLabel && <p><span className="font-semibold">Price:</span> {item.priceLabel}</p>}
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

                                                {/* Review Booking Section */}
                                                {booking.status !== 'completed' && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                                                            Review Booking
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            {booking.status !== 'confirmed' && booking.status !== 'cancelled' && (
                                                                <Button
                                                                    onClick={async () => {
                                                                        const updated = await updateBookingStatus(booking.id, 'confirmed');
                                                                        if (updated) {
                                                                            toast.success(`${booking.isOnlineConsultation ? 'Online consultation' : 'Booking'} ${booking.bookingNumber} for ${booking.petName} confirmed successfully`);
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
                                    onChange={(event) => setCancellationData({ ...cancellationData, walletNumber: event.target.value })}
                                    placeholder="Wallet number used for the return process"
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
