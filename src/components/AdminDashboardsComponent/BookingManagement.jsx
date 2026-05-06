import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Calendar, Search, Filter, Eye, CheckCircle, XCircle, User, PawPrint, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '../../ui/sheet';
import PetOwnerProfileModal from './PetOwnerInfoModal';
import PetInfoModal from './PetInfoModal';
import { PhotoViewer } from '../../ui/photo-viewer';

const veterinarians = [
    { id: 'v1', name: 'Dr. Sarah Wilson' },
    { id: 'v2', name: 'Dr. James Chen' },
    { id: 'v3', name: 'Dr. Emily Parker' },
    { id: 'v4', name: 'Dr. Michael Ross' }
];

export default function BookingsManagement() {
    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [currentRescheduleBooking, setCurrentRescheduleBooking] = useState(null);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [viewerImage, setViewerImage] = useState(null);

    useEffect(() => {
        async function fetchBookings() {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings`);
                if (!response.ok) throw new Error('Failed to fetch bookings');
                const data = await response.json();
                setBookings(data);
            } catch (error) {
                console.error('Error fetching bookings:', error);
            }
        }
        fetchBookings();
    }, []);

    const updateBookingStatus = async (id, newStatus) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                setBookings(bookings =>
                    bookings.map(booking =>
                        booking.id === id ? { ...booking, status: newStatus } : booking
                    )
                );
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleReschedule = (booking) => {
        setCurrentRescheduleBooking(booking);
        setNewDate(booking.date);
        setNewTime(booking.time);
        setRescheduleDialogOpen(true);
    };

    const confirmReschedule = () => {
        if (currentRescheduleBooking && newDate && newTime) {
            setBookings(bookings =>
                bookings.map(booking =>
                    booking.id === currentRescheduleBooking.id
                        ? { ...booking, date: newDate, time: newTime }
                        : booking
                )
            );
            setRescheduleDialogOpen(false);
            toast.success(`Booking ${currentRescheduleBooking.bookingNumber} rescheduled to ${newDate} at ${newTime}`);
            setCurrentRescheduleBooking(null);
            setNewDate('');
            setNewTime('');
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

    const getTypeBadge = (booking) => {
        // 1. Home Service takes priority
        if (booking.isHomeService) {
            return <Badge className="bg-[#ffec99] text-[#8a6500] hover:bg-[#ffec99]">Home Service</Badge>;
        }

        // 2. Online Consultation check
        if (booking.isOnlineConsultation) {
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
            'boarding': 'Pet Hotel & Boarding'
        };

        const label = labels[booking.type] || 'Consultation';
        return <Badge variant="secondary">{label}</Badge>;
    };

    const getPriceBadge = (service, price) => {
        if (service === 'Online Consultation') {
            return <Badge className="bg-[#e0f2e9] text-[#0c6a3c] hover:bg-[#e0f2e9]">Paid</Badge>;
        }
        return <Badge className="bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]">Pending</Badge>;
    };

    const filteredBookings = bookings.filter(booking => {
        const matchesSearch =
            booking.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            booking.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            booking.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'all' || booking.type === filterType;
        const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;

        return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
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

            <div className="flex gap-6">
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

            <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px]">
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

                <div className="hidden min-[850px]:flex gap-4">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="size-4 mr-2" />
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
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
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="size-4 mr-2" />
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Booking #</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Type</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Pet / Owner</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Service</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Date & Time</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Price</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                        <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                            <TableCell className="font-['Arimo:Bold',sans-serif]">{booking.bookingNumber}</TableCell>
                            <TableCell>{getTypeBadge(booking.type, booking.isHomeService)}</TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px]">{booking.petName}</p>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">{booking.ownerName}</p>
                                </div>
                            </TableCell>
                            <TableCell>{booking.service}</TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px]">{booking.date}</p>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">{booking.time}</p>
                                </div>
                            </TableCell>
                            <TableCell>{getPriceBadge(booking.service, booking.price)}</TableCell>
                            <TableCell>{getStatusBadge(booking.status)}</TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Eye className="size-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="right" className="sm:max-w-xl">
                                            <div className="sticky top-0 bg-white z-10 border-b p-6">
                                                <SheetHeader>
                                                    <SheetTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                                        Booking Details
                                                    </SheetTitle>
                                                    <SheetDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                                        View complete booking information
                                                    </SheetDescription>
                                                </SheetHeader>
                                            </div>

                                            <div className="p-6 space-y-6">
                                                {/* Quick Action Buttons */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full h-auto py-4 flex flex-col gap-2 border-[#155dfc] hover:bg-[#eff6ff]"
                                                            >
                                                                <User className="size-6 text-[#155dfc]" />
                                                                <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">
                                  View Pet Owner Profile
                                </span>
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                                                    Pet Owner Profile
                                                                </DialogTitle>
                                                            </DialogHeader>
                                                            <PetOwnerProfileModal
                                                                ownerName={booking.ownerName}
                                                                ownerEmail={booking.ownerEmail}
                                                            />
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full h-auto py-4 flex flex-col gap-2 border-[#155dfc] hover:bg-[#eff6ff]"
                                                            >
                                                                <PawPrint className="size-6 text-[#155dfc]" />
                                                                <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">
                                  View Pet Info
                                </span>
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                                                    Pet Information
                                                                </DialogTitle>
                                                            </DialogHeader>
                                                            <PetInfoModal petId={booking.petId} petName={booking.petName} />
                                                        </DialogContent>
                                                    </Dialog>
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
                                                        {getTypeBadge(booking.type, booking.isHomeService)}
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
                                                            {booking.date} at {booking.time}
                                                        </p>
                                                    </div>
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
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Price
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.price}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Status
                                                        </p>
                                                        {getStatusBadge(booking.status)}
                                                    </div>
                                                </div>

                                                {booking.notes && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Notes
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                                            {booking.notes}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Pet Profile Image Section */}
                                                <div className="border-t pt-4">
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                       Pictures of Concern
                                                    </p>
                                                    {booking.image_Booking_Concern_Path ? (
                                                        <div className="grid grid-cols-2 gap-2">
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
                                                <div className="border-t pt-4">
                                                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                                                        Review Booking
                                                    </h4>
                                                    <div className="flex flex-col gap-3">
                                                        {booking.status !== 'confirmed' && booking.status !== 'cancelled' && (
                                                            <Button
                                                                onClick={() => {
                                                                    updateBookingStatus(booking.id, 'confirmed');
                                                                    toast.success(`Booking ${booking.bookingNumber} for ${booking.petName} confirmed successfully`);
                                                                }}
                                                                className="bg-[#0c6a3c] hover:bg-[#09522f] text-white w-full"
                                                            >
                                                                <CheckCircle className="size-4 mr-2" />
                                                                Confirm Booking
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

                                                        {booking.status !== 'confirmed' && booking.status !== 'cancelled' && (
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => {
                                                                    updateBookingStatus(booking.id, 'cancelled');
                                                                    toast.success(`Booking ${booking.bookingNumber} for ${booking.petName} rejected`);
                                                                }}
                                                                className="w-full"
                                                            >
                                                                <XCircle className="size-4 mr-2" />
                                                                Reject
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <PhotoViewer src={viewerImage?.src} alt={viewerImage?.alt} open={!!viewerImage} onOpenChange={() => setViewerImage(null)} />

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
                        <div className="grid grid-cols-2 gap-4">
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
                                <div className="flex gap-2">
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
                                toast.success('Booking rescheduled successfully');
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
        </div>
    );
}
