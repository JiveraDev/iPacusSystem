import { useState } from 'react';
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

const veterinarians = [
    { id: 'v1', name: 'Dr. Sarah Wilson' },
    { id: 'v2', name: 'Dr. James Chen' },
    { id: 'v3', name: 'Dr. Emily Parker' },
    { id: 'v4', name: 'Dr. Michael Ross' }
];

export default function BookingsManagement() {
    const [bookings, setBookings] = useState(mockBookings);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [currentRescheduleBooking, setCurrentRescheduleBooking] = useState(null);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    const updateBookingStatus = (id, newStatus) => {
        setBookings(bookings =>
            bookings.map(booking =>
                booking.id === id ? { ...booking, status: newStatus } : booking
            )
        );
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
            setCurrentRescheduleBooking(null);
            setNewDate('');
            setNewTime('');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            'pending': { variant: 'outline', text: 'Pending' },
            'confirmed': { variant: 'default', text: 'Confirmed' },
            'completed': { variant: 'default', text: 'Completed' },
            'cancelled': { variant: 'destructive', text: 'Cancelled' }
        };

        const { variant, text } = variants[status];
        return <Badge variant={variant}>{text}</Badge>;
    };

    const getTypeBadge = (type, isHomeService) => {
        const labels = {
            'consultation': 'Consultation',
            'vaccination': 'Vaccination',
            'grooming': 'Grooming',
            'dental': 'Dental',
            'wellness': 'Wellness',
            'surgery': 'Surgery',
            'lab-testing': 'Lab Testing',
            'parasite-control': 'Parasite Control',
            'boarding': 'Boarding',
            'home-service': 'Home Service'
        };

        const label = labels[type];
        if (isHomeService) {
            return <Badge className="bg-[#ffec99] text-[#8a6500] hover:bg-[#ffec99]">Home {label}</Badge>;
        }
        return <Badge variant="secondary">{label}</Badge>;
    };

    const getPriceBadge = (service, price) => {
        // For Online Consultation, show "Paid" badge
        if (service === 'Online Consultation') {
            return <Badge className="bg-[#e0f2e9] text-[#0c6a3c] hover:bg-[#e0f2e9]">Paid</Badge>;
        }
        // For others, show "Pending" badge
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
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                    Bookings Management
                </h2>
                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                    View and manage all booking appointments
                </p>
            </div>

            {/* Stats */}
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

            {/* Filters and Search */}
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

            {/* Table */}
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
                            <TableCell className="font-['Arimo:Bold',sans-serif]">
                                {booking.bookingNumber}
                            </TableCell>
                            <TableCell>
                                {getTypeBadge(booking.type, booking.isHomeService)}
                            </TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px]">
                                        {booking.petName}
                                    </p>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                                        {booking.ownerName}
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="font-['Arimo:Regular',sans-serif]">
                                {booking.service}
                            </TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                        {booking.date}
                                    </p>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                                        {booking.time}
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell>
                                {getPriceBadge(booking.service, booking.price)}
                            </TableCell>
                            <TableCell>
                                {getStatusBadge(booking.status)}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Eye className="size-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="right" className="w-[800px] sm:max-w-none overflow-y-auto p-0">
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
                                                                <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                                                    View pet owner's personal information and contact details
                                                                </DialogDescription>
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
                                                                <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                                                    View complete pet profile and medical history
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <PetInfoModal petName={booking.petName} />
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

                                                {/* Payment Proof Section */}
                                                {booking.paymentProof && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                            Payment Proof
                                                        </p>
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <div className="bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] rounded-[14px] p-4 cursor-pointer hover:bg-[#f3f4f6] transition-colors">
                                                                    <img
                                                                        src={booking.paymentProof}
                                                                        alt="Payment Proof"
                                                                        className="w-full h-auto object-cover rounded-[8px] border border-[rgba(0,0,0,0.1)]"
                                                                    />
                                                                    <p className="text-center text-[12px] text-[#4a5565] mt-2">
                                                                        Click to view full size
                                                                    </p>
                                                                </div>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-4xl w-[90vw]">
                                                                <DialogHeader>
                                                                    <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                                                                        Payment Proof - Full View
                                                                    </DialogTitle>
                                                                    <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                                                                        Inspect payment proof image
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <div className="max-h-[70vh] overflow-auto">
                                                                    <img
                                                                        src={booking.paymentProof}
                                                                        alt="Payment Proof Full Size"
                                                                        className="w-full h-auto rounded-[8px] border border-[rgba(0,0,0,0.1)]"
                                                                    />
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                )}

                                                {/* Online Consultation Review Section */}
                                                {booking.isOnlineConsultation && booking.status === 'pending' && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                                                            Review Booking
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            <Button
                                                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                                                className="bg-[#0c6a3c] hover:bg-[#09522f] text-white w-full"
                                                            >
                                                                <CheckCircle className="size-4 mr-2" />
                                                                Confirm Booking
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => handleReschedule(booking)}
                                                                className="border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff] w-full"
                                                            >
                                                                <CalendarClock className="size-4 mr-2" />
                                                                Reschedule
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                                                className="w-full"
                                                            >
                                                                <XCircle className="size-4 mr-2" />
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Review Booking Section for All Other Bookings */}
                                                {!(booking.isOnlineConsultation && booking.status === 'pending') && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                                                            Review Booking
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            <Button
                                                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                                                className="bg-[#0c6a3c] hover:bg-[#09522f] text-white w-full"
                                                            >
                                                                <CheckCircle className="size-4 mr-2" />
                                                                Confirm Booking
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => handleReschedule(booking)}
                                                                className="border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff] w-full"
                                                            >
                                                                <CalendarClock className="size-4 mr-2" />
                                                                Reschedule
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                                                className="w-full"
                                                            >
                                                                <XCircle className="size-4 mr-2" />
                                                                Reject
                                                            </Button>
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

            {filteredBookings.length === 0 && (
                <div className="py-12 text-center">
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        No bookings found
                    </p>
                </div>
            )}

            {/* Reschedule Dialog */}
            <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
                <DialogContent className="max-w-none w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Reschedule Booking
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Change the date and time of the booking
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Booking Number
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking?.bookingNumber}
                                </p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Type
                                </p>
                                {currentRescheduleBooking && getTypeBadge(currentRescheduleBooking.type, currentRescheduleBooking.isHomeService)}
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Pet Name
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking?.petName}
                                </p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Owner
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking?.ownerName}
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                    {currentRescheduleBooking?.ownerEmail}
                                </p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Service
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking?.service}
                                </p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    New Date & Time
                                </p>
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
                            {currentRescheduleBooking?.isHomeService && currentRescheduleBooking?.address && (
                                <div className="col-span-2">
                                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                        Service Address
                                    </p>
                                    <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                        {currentRescheduleBooking.address}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Price
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking?.price}
                                </p>
                            </div>
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Status
                                </p>
                                {currentRescheduleBooking && getStatusBadge(currentRescheduleBooking.status)}
                            </div>
                        </div>
                        {currentRescheduleBooking?.notes && (
                            <div>
                                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                    Notes
                                </p>
                                <p className="font-['Arimo:Regular',sans-serif] text-[16px]">
                                    {currentRescheduleBooking.notes}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={confirmReschedule}
                        >
                            Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
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

const mockBookings = [
    {
        id: '1',
        bookingNumber: 'BK-2026-001',
        petName: 'Max',
        ownerName: 'Test User',
        ownerEmail: 'test@vetfocus.com',
        type: 'consultation',
        service: 'Online Consultation',
        date: '2026-03-05',
        time: '2:00 PM',
        status: 'pending',
        price: '₱500',
        notes: 'Pet has been showing signs of lethargy. Owner requests consultation regarding recent behavioral changes.',
        isHomeService: false,
        paymentProof: 'https://images.unsplash.com/photo-1607609972246-a14762f20d3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXltZW50JTIwcmVjZWlwdCUyMG1vYmlsZSUyMHBob25lfGVufDF8fHx8MTc3MjI3NTQ5MHww&ixlib=rb-4.1.0&q=80&w=1080',
        isOnlineConsultation: true,
        veterinarian: 'Dr. Sarah Wilson'
    },
    {
        id: '6',
        bookingNumber: 'BK-2026-006',
        petName: 'Buddy',
        ownerName: 'Maria Santos',
        ownerEmail: 'maria@email.com',
        type: 'consultation',
        service: 'Online Consultation',
        date: '2026-03-08',
        time: '10:00 AM',
        status: 'pending',
        price: '₱500',
        notes: 'Follow-up consultation for vaccination schedule and dietary concerns.',
        isHomeService: false,
        paymentProof: 'https://images.unsplash.com/photo-1656189368832-43a6dd24f18f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5rJTIwdHJhbnNmZXIlMjBzY3JlZW5zaG90JTIwcHJvb2Z8ZW58MXx8fHwxNzcyMjc1NDkzfDA&ixlib=rb-4.1.0&q=80&w=1080',
        isOnlineConsultation: true,
        veterinarian: 'Dr. James Chen'
    },
    {
        id: '7',
        bookingNumber: 'BK-2026-007',
        petName: 'Coco',
        ownerName: 'Robert Lee',
        ownerEmail: 'robert@email.com',
        type: 'consultation',
        service: 'Online Consultation',
        date: '2026-03-12',
        time: '4:00 PM',
        status: 'confirmed',
        price: '₱500',
        notes: 'Confirmed consultation regarding skin allergies.',
        isHomeService: false,
        paymentProof: 'https://images.unsplash.com/photo-1607609972246-a14762f20d3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXltZW50JTIwcmVjZWlwdCUyMG1vYmlsZSUyMHBob25lfGVufDF8fHx8MTc3MjI3NTQ5MHww&ixlib=rb-4.1.0&q=80&w=1080',
        isOnlineConsultation: true,
        veterinarian: 'Dr. Emily Parker'
    },
    {
        id: '2',
        bookingNumber: 'BK-2026-002',
        petName: 'Luna',
        ownerName: 'Jane Smith',
        ownerEmail: 'jane@email.com',
        type: 'grooming',
        service: 'Grooming (Home Service)',
        date: '2026-02-09',
        time: '2:00 PM',
        status: 'pending',
        price: '₱800 - ₱1,500',
        isHomeService: true,
        address: '123 Main Street, Barangay San Isidro, Quezon City, Metro Manila 1100'
    },
    {
        id: '3',
        bookingNumber: 'BK-2026-003',
        petName: 'Charlie',
        ownerName: 'John Doe',
        ownerEmail: 'john@email.com',
        type: 'boarding',
        service: 'Pet Hotel - 3 days',
        date: '2026-02-15',
        time: 'Check-in 9:00 AM',
        status: 'confirmed',
        price: '₱2,400',
        isHomeService: false
    },
    {
        id: '4',
        bookingNumber: 'BK-2026-004',
        petName: 'Bella',
        ownerName: 'Sarah Johnson',
        ownerEmail: 'sarah@email.com',
        type: 'surgery',
        service: 'Kapon (Spay/Neuter)',
        date: '2026-02-12',
        time: '8:00 AM',
        status: 'pending',
        price: '₱3,000 - ₱5,000',
        isHomeService: false
    },
    {
        id: '5',
        bookingNumber: 'BK-2026-005',
        petName: 'Rocky',
        ownerName: 'Mike Brown',
        ownerEmail: 'mike@email.com',
        type: 'vaccination',
        service: 'Vaccination (Home Service)',
        date: '2026-02-08',
        time: '11:00 AM',
        status: 'completed',
        price: '₱300 - ₱1,000',
        isHomeService: true,
        address: '456 Rizal Avenue, Barangay Poblacion, Makati City, Metro Manila 1210'
    }
];