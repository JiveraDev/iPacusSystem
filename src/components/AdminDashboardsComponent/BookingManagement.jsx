import { useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Search, Filter, CheckCircle, XCircle, X, User, PawPrint, CalendarClock, UserPlus, Loader2, Plus, CreditCard, RotateCcw, Save, Settings, ExternalLink, FileText, Image as ImageIcon, Download, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '../../ui/sheet';
import PetOwnerProfileModal from './PetOwnerInfoModal';
import PetInfoModal from './PetInfoModal';
import { PhotoViewer } from '../../ui/photo-viewer';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { toast } from "../../reusecomponent/toast.jsx";
import { addPetService } from '../../services/addPet';
import { Label } from '../../ui/label';
import { resolveImageUrl } from '../../lib/image';
import { formatDisplayDate, formatDisplayDateRange, formatDisplayTime } from '../../lib/date';
import { formatPhpCurrency, normalizeCurrencyLabel } from '../../lib/currency';
import { isValidPhilippinePhone, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../../lib/philippinePhone';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import {
    canReconstructConsentDocument,
    consentDocumentPath,
    downloadConsentDocument,
    normalizeConsentForms,
    openProtectedDocument,
    useConsentDocumentSource
} from '../../hooks/useConsentDocumentSource';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useNavigate } from '../dashboardRouter.jsx';
import { useBookingPriceProjections } from '../../hooks/useBookingPriceProjections';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { includedItemsText, parseIncludedItems } from '../../lib/servicePriceProjections';
import {
    createBooking,
    fetchBookingBillingContext,
    fetchBookings as fetchBookingsService,
    postBookingPaymentRefund,
    updateBookingSchedule,
    updateBookingStatus as updateBookingStatusService
} from '../../services/bookingService';
import { fetchQueuePets } from '../../services/queueService';
import { fetchAccounts } from '../../services/accountService';
import { fetchBranches, getBranchDisplayName, relocateBooking } from '../../services/branchService';
import TablePagination from '../shared/TablePagination.jsx';
import BookingTimeSlotField from '../shared/BookingTimeSlotField.jsx';
import { assignedBranchId, isBranchSelectionLocked, storedDashboardUser } from '../../lib/branchAccess.js';

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

const BOOKING_PAGE_SIZE = 20;
const ADMIN_BOOKING_SERVICE_TYPES = [
    ...REVIEW_SERVICE_TYPES.filter(
        (type) => !['consultation', 'home-service', 'special services', 'boarding'].includes(type.value)
    )
];

const SERVICE_DISPLAY_PRICE_FIELDS = [
    { key: 'onlineConsultation', label: 'Online Consultation' },
    { key: 'generalConsultation', label: 'General Consultation / Check-up' },
    { key: 'parasiteControl', label: 'Parasite Control' },
    { key: 'vaccination', label: 'Vaccination' },
    { key: 'grooming', label: 'Grooming' },
    { key: 'dentalAssessment', label: 'Dental Assessment' },
    { key: 'dentalCleaning', label: 'Professional Dental Cleaning' },
    { key: 'surgery', label: 'Surgery' },
    { key: 'kapon', label: 'Kapon / Spay-Neuter' },
    { key: 'specialSurgery', label: 'Special Surgery' },
];

const DISPLAY_INSTRUCTION_FIELDS = [
    { key: 'onlineConsultation', label: 'Online Consultation Instruction' },
    { key: 'generalConsultation', label: 'General Consultation Instruction' },
    { key: 'parasiteControl', label: 'Parasite Control Instruction' },
    { key: 'vaccination', label: 'Vaccination Instruction' },
    { key: 'grooming', label: 'Grooming Instruction' },
    { key: 'dental', label: 'Dental Instruction' },
    { key: 'surgery', label: 'Surgery Instruction' },
    { key: 'homeService', label: 'Home-Service Instruction' },
    { key: 'kapon', label: 'Kapon Instruction' },
    { key: 'specialSurgery', label: 'Special Surgery Instruction' },
];

const SERVICE_DETAIL_FIELDS = [
    { key: 'generalConsultation', label: 'General Consultation / Check-up' },
    { key: 'parasiteControl', label: 'Parasite Control' },
    { key: 'vaccination', label: 'Vaccination' },
    { key: 'grooming', label: 'Grooming' },
    { key: 'dental', label: 'Dental' },
    { key: 'surgery', label: 'Surgery' },
];

function todayInputDate() {
    return new Date().toLocaleDateString('en-CA');
}

function normalizeBookingFilterValue(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
}

function bookingAppointmentDate(booking) {
    const value = booking?.date
        || booking?.bookingDate
        || booking?.booking_date
        || booking?.scheduledStart
        || booking?.scheduled_start;
    const dateOnlyMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateOnlyMatch) {
        return new Date(
            Number(dateOnlyMatch[1]),
            Number(dateOnlyMatch[2]) - 1,
            Number(dateOnlyMatch[3])
        );
    }

    const parsed = new Date(String(value || '').replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bookingMatchesAppointmentFilter(booking, filter) {
    if (filter === 'all') return true;

    const appointmentDate = bookingAppointmentDate(booking);
    if (!appointmentDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (filter === 'today') {
        return appointmentDate >= today && appointmentDate < tomorrow;
    }

    if (filter === 'next-7-days' || filter === 'next-30-days') {
        const end = new Date(today);
        end.setDate(end.getDate() + (filter === 'next-7-days' ? 7 : 30));
        return appointmentDate >= today && appointmentDate < end;
    }

    if (filter === 'past') {
        return appointmentDate < today;
    }

    return true;
}

function createEmptyAdminBookingForm() {
    return {
        serviceType: 'General Check-up',
        veterinarianId: '',
        bookingDate: todayInputDate(),
        bookingTime: '',
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

function isBoardingBooking(booking) {
    const serviceType = String(booking?.type || '').trim().toLowerCase();
    return serviceType === 'boarding' || Boolean(booking?.hotelBoardingType);
}

function bookingChargeName(booking) {
    if (booking?.isOnlineConsultation) {
        return 'Online Consultation';
    }

    if (booking?.isHomeService) {
        const selectedServices = String(booking?.service || '').trim();
        return selectedServices && selectedServices.toLowerCase() !== 'home-service'
            ? `Home Service - ${selectedServices}`
            : 'Home Visit + Consultation';
    }

    return getServiceDisplayName(booking?.service || booking?.type || 'Clinic Service');
}

function bookingPOSCharges(booking) {
    const charges = [{
        classificationId: 'services',
        receiptType: 'SERVICE',
        chargeType: 'service',
        name: bookingChargeName(booking),
        group: booking?.isHomeService ? 'Home Service' : 'Booked Service',
        quantity: 1,
        price: Math.max(0, Number(booking?.price || 0)),
        includedMaterials: [],
        extraMaterials: []
    }];
    const transportFee = Math.max(0, Number(booking?.transportFee || booking?.transport_fee || 0));

    if (booking?.isHomeService && transportFee > 0) {
        charges.push({
            classificationId: 'services',
            receiptType: 'SERVICE',
            chargeType: 'other',
            name: 'Home Service Transport Fee',
            group: 'Home Service',
            quantity: 1,
            price: transportFee,
            includedMaterials: [],
            extraMaterials: []
        });
    }

    return charges;
}

function billingChargeToPOSPrefill(charge) {
    const chargeType = String(charge?.chargeType || charge?.charge_type || 'service').toLowerCase();
    const classificationId = chargeType === 'diagnostic'
        ? 'diagnostics'
        : (chargeType === 'medication'
            ? 'medications'
            : (chargeType === 'retail_product' ? 'products' : 'services'));

    return {
        catalogId: charge?.serviceId ? `service-${charge.serviceId}` : null,
        classificationId,
        receiptType: classificationId === 'products' ? 'PRODUCT' : 'SERVICE',
        chargeType,
        itemId: charge?.itemId || null,
        boardingMaterialUsageId: charge?.boardingMaterialUsageId || null,
        visitChargeId: charge?.chargeId || charge?.charge_id || null,
        lockedExisting: true,
        name: charge?.description || charge?.serviceName || charge?.itemName || 'Visit charge',
        group: charge?.serviceName || charge?.itemName || 'Visit Billing',
        quantity: Math.max(1, Number(charge?.quantity || 1)),
        price: Math.max(0, Number(charge?.unitPrice || 0)),
        includedMaterials: [],
        extraMaterials: []
    };
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

function cloneProjectionConfig(config) {
    return JSON.parse(JSON.stringify(config));
}

function currentUserCanConfigureBookingDisplay() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const role = String(user.role || user.user_role || user.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        return role.includes('super') || role === 'admin';
    } catch {
        return false;
    }
}

function bookingAttachmentPaths(value) {
    return String(value || '')
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean);
}

function isImageAttachmentPath(path) {
    const cleanPath = String(path || '').split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(cleanPath);
}

function attachmentFileName(path) {
    const cleanPath = String(path || '').split('?')[0];
    const parts = cleanPath.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || 'Uploaded file';
}

function BookingAttachmentCard({ path, alt, onPreview }) {
    const [hasImageError, setHasImageError] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const isImage = isImageAttachmentPath(path) && !hasImageError;
    const fileName = attachmentFileName(path);
    const handleView = async () => {
        if (!path || isOpening) return;
        if (isImage) {
            onPreview({ src: path, alt });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(path);
        } catch (error) {
            toast.error(error.message || 'Could not open the booking file.');
        } finally {
            setIsOpening(false);
        }
    };
    const handleDownload = async () => {
        if (!path || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(path, fileName);
        } catch (error) {
            toast.error(error.message || 'Could not download the booking file.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (isImage) {
        return (
            <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="aspect-square bg-slate-50">
                    <ProtectedImage
                        src={path}
                        alt={alt}
                        className="size-full object-cover"
                        fallbackClassName="size-full"
                        onLoadError={() => setHasImageError(true)}
                    />
                </div>
                <div className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600">
                    <ImageIcon className="size-4 shrink-0 text-blue-500" />
                    <span className="truncate">{fileName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleView} className="h-8 gap-1 text-xs">
                        <Eye className="size-3" />
                        View
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading} className="h-8 gap-1 text-xs">
                        {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                        Download
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <FileText className="size-9 text-slate-400" />
            <span className="max-w-full truncate text-sm font-bold text-slate-700">{fileName}</span>
            <div className="grid w-full grid-cols-2 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleView}
                    disabled={isOpening}
                    className="h-8 gap-1 text-xs"
                >
                    {isOpening ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />}
                    View
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading} className="h-8 gap-1 text-xs">
                    {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    Download
                </Button>
            </div>
        </div>
    );
}

function bookingConsentForms(booking) {
    const forms = normalizeConsentForms(booking?.consentForms)
        .filter(form => (
            consentDocumentPath(form)
            || canReconstructConsentDocument(form, booking?.legacyConsentSignaturePath)
        ));

    if (forms.length > 0) {
        return forms;
    }

    const documentPath = consentDocumentPath(booking);
    return documentPath
        ? [{
            id: `booking-consent-${booking?.id || 'document'}`,
            title: 'Signed Consent Form',
            documentPath,
            signerName: booking?.ownerName || '',
            signedAt: booking?.createdAt || booking?.date || ''
        }]
        : [];
}

function BookingConsentCard({ form, booking, onPreview }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const {
        source,
        isPdf,
        isLoading,
        isReconstructed,
        isUnavailable
    } = useConsentDocumentSource(form, booking.legacyConsentSignaturePath);
    const handleView = async () => {
        if (!source || isOpening) return;
        if (!isPdf) {
            onPreview?.({ src: source, alt: `${form.title} complete signed document` });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(source);
        } catch (error) {
            console.error('Failed to open a signed consent PDF:', error);
            toast.error('The signed consent PDF could not be opened. Please try again.');
        } finally {
            setIsOpening(false);
        }
    };
    const handleDownload = async () => {
        if (!source || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(source, `${booking.bookingNumber || `booking-${booking.id}`}-${form.title}`);
        } catch (error) {
            toast.error(error.message || 'Could not download the complete consent form.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-bold text-slate-900">{form.title}</p>
                {form.signedAt && <p className="mt-1 text-xs font-semibold text-slate-500">Signed {formatDisplayDate(form.signedAt)}</p>}
            </div>
            <div className="space-y-3 p-4">
                {source ? (
                    <div className="h-[32rem] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {isPdf ? (
                            <button type="button" onClick={handleView} className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-500 hover:bg-slate-100">
                                <FileText className="size-12 text-blue-600" />
                                <span className="text-sm font-bold">Open signed consent PDF</span>
                            </button>
                        ) : (
                            <ProtectedImage
                                src={source}
                                alt={`${form.title} complete signed document`}
                                className="h-full w-full object-contain"
                                fallbackClassName="h-full w-full"
                            />
                        )}
                    </div>
                ) : isLoading ? (
                    <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                        <Loader2 className="size-5 animate-spin text-blue-600" />
                        Rebuilding the complete legacy consent form
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                        The complete signed form is unavailable. A signature image is never displayed by itself.
                    </div>
                )}
                {isReconstructed && (
                    <p className="text-xs font-semibold text-amber-700">
                        This view rebuilds the retained legacy form text and signature into one complete document.
                    </p>
                )}
                {isUnavailable && form.content && (
                    <p className="text-xs font-semibold text-slate-500">
                        The legacy form could not be reconstructed from its retained files.
                    </p>
                )}
                <div className={`grid grid-cols-1 gap-2 ${isPdf ? '' : 'sm:grid-cols-2'}`}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleView}
                        disabled={!source || isOpening}
                        className="gap-2"
                    >
                        {isOpening ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                        {isPdf ? 'Open PDF' : 'View Complete Form'}
                    </Button>
                    {!isPdf && <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownload}
                        disabled={!source || isDownloading}
                        className="gap-2"
                    >
                        {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        Download
                    </Button>}
                </div>
            </div>
        </div>
    );
}

function ActionButtonMedia({ image, alt, fallback }) {
    const FallbackIcon = fallback;
    const [hasImageError, setHasImageError] = useState(false);
    const imageUrl = hasImageError ? null : resolveImageUrl(image);

    return (
        <span className="size-10 rounded-full border border-[#bfdbfe] bg-[#eff6ff] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
                <ProtectedImage
                    src={image}
                    alt={alt}
                    className="size-full object-cover"
                    fallbackClassName="size-full"
                    onLoadError={() => setHasImageError(true)}
                />
            ) : (
                <FallbackIcon className="size-5 text-[#155dfc]" />
            )}
        </span>
    );
}

function bookingDetailsTriggerId(bookingId) {
    return `booking-details-trigger-${String(bookingId).replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

export default function BookingsManagement() {
    const navigate = useNavigate();
    const dashboardUser = useMemo(() => storedDashboardUser(), []);
    const lockedBranchId = assignedBranchId(dashboardUser);
    const branchFilterLocked = isBranchSelectionLocked(dashboardUser);
    const { paymentMethods } = usePaymentMethods();
    const refundMethods = useMemo(() => [
        { value: 'cash', label: 'Cash' },
        ...paymentMethods
            .filter((method) => String(method.value || method.methodKey || '').toLowerCase() !== 'cash')
            .map((method) => ({ value: method.value || method.methodKey, label: method.label }))
    ], [paymentMethods]);
    const {
        config: bookingDisplayConfig,
        resetConfig: resetBookingDisplayConfig,
        saveConfig: saveBookingDisplayConfig
    } = useBookingPriceProjections();
    const canConfigureBookingDisplay = currentUserCanConfigureBookingDisplay();
    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterBranch, setFilterBranch] = useState(() => branchFilterLocked && lockedBranchId ? lockedBranchId : 'all');
    const [filterDate, setFilterDate] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
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
    const [confirmingBookingId, setConfirmingBookingId] = useState(null);
    const [openingPaymentBookingId, setOpeningPaymentBookingId] = useState(null);
    const [bookingRefundOpen, setBookingRefundOpen] = useState(false);
    const [bookingRefundContext, setBookingRefundContext] = useState(null);
    const [bookingRefundForm, setBookingRefundForm] = useState({ amount: '', method: 'cash', reference: '', reason: '' });
    const [isSubmittingBookingRefund, setIsSubmittingBookingRefund] = useState(false);
    const [bookingPets, setBookingPets] = useState([]);
    const [veterinarians, setVeterinarians] = useState([]);
    const [branches, setBranches] = useState([]);
    const [relocatingBookingId, setRelocatingBookingId] = useState(null);
    const [isLoadingVeterinarians, setIsLoadingVeterinarians] = useState(false);
    const [bookingPetSearch, setBookingPetSearch] = useState('');
    const [selectedBookingPet, setSelectedBookingPet] = useState(null);
    const [adminBookingForm, setAdminBookingForm] = useState(createEmptyAdminBookingForm);
    const [displayConfigOpen, setDisplayConfigOpen] = useState(false);
    const [displayConfigDraft, setDisplayConfigDraft] = useState(() => cloneProjectionConfig(bookingDisplayConfig));

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

    useEffect(() => {
        if (!displayConfigOpen) {
            setDisplayConfigDraft(cloneProjectionConfig(bookingDisplayConfig));
        }
    }, [bookingDisplayConfig, displayConfigOpen]);

    const fetchBookings = async () => {
        try {
            const data = await fetchBookingsService();
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        }
    };

    useAutoRefresh(fetchBookings);

    useEffect(() => {
        fetchBranches({ assignedOnly: branchFilterLocked })
            .then((data) => {
                const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
                setBranches(nextBranches);
                if (branchFilterLocked) {
                    const assigned = nextBranches.find((branch) => String(branch.id) === lockedBranchId) || nextBranches[0];
                    setFilterBranch(assigned ? String(assigned.id) : lockedBranchId || 'all');
                }
            })
            .catch((error) => console.error('Error loading branches:', error));
    }, [branchFilterLocked, lockedBranchId]);

    const handleBookingRelocation = async (booking, branchId) => {
        if (!branchId || String(branchId) === String(booking.branchId)) return;
        setRelocatingBookingId(booking.id);
        try {
            const result = await relocateBooking(booking.id, {
                branchId: Number(branchId),
                reason: 'Corrected during Admin booking review.'
            });
            setBookings((current) => current.map((item) => item.id === booking.id
                ? { ...item, branchId: result.branchId, branchName: result.branchName }
                : item));
            toast.success(result.message || 'Booking location updated.');
        } catch (error) {
            toast.error(error.message || 'Failed to relocate booking.');
        } finally {
            setRelocatingBookingId(null);
        }
    };

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

    const openDisplayConfigDialog = () => {
        setDisplayConfigDraft(cloneProjectionConfig(bookingDisplayConfig));
        setDisplayConfigOpen(true);
    };

    const updateDisplayServicePrice = (key, value) => {
        setDisplayConfigDraft((current) => ({
            ...current,
            servicePrices: {
                ...current.servicePrices,
                [key]: value
            }
        }));
    };

    const updateDisplayInstruction = (key, value) => {
        setDisplayConfigDraft((current) => ({
            ...current,
            instructions: {
                ...current.instructions,
                [key]: value
            }
        }));
    };

    const updateDisplayServiceDetail = (key, field, value) => {
        setDisplayConfigDraft((current) => ({
            ...current,
            serviceDetails: {
                ...current.serviceDetails,
                [key]: {
                    ...current.serviceDetails[key],
                    [field]: field === 'includedItems' ? parseIncludedItems(value) : value
                }
            }
        }));
    };

    const updateDisplayArrayRow = (collection, identityKey, identityValue, field, value) => {
        setDisplayConfigDraft((current) => ({
            ...current,
            [collection]: current[collection].map((row) => (
                String(row[identityKey]) === String(identityValue)
                    ? { ...row, [field]: value }
                    : row
            ))
        }));
    };

    const handleSaveDisplayConfig = () => {
        saveBookingDisplayConfig(displayConfigDraft);
        setDisplayConfigOpen(false);
        toast.success('Booking display projections updated.');
    };

    const handleResetDisplayConfig = () => {
        const defaults = resetBookingDisplayConfig();
        setDisplayConfigDraft(cloneProjectionConfig(defaults));
        toast.success('Booking display projections reset.');
    };

    const selectBookingPet = (pet) => {
        setSelectedBookingPet(pet);
        setBookingPetSearch(`${pet.pet_name} - ${ownerNameForPet(pet)}`);
    };

    const sendBookingPaymentToPOS = async (booking) => {
        if (isBoardingBooking(booking)) {
            toast.error('Boarding payment must be opened from Boarding so the stay and used materials remain complete.');
            navigate('/dashboard/boarding');
            return;
        }

        if (openingPaymentBookingId) return;

        setOpeningPaymentBookingId(booking.id);
        try {
            const context = await fetchBookingBillingContext(booking.id);
            const existingVisit = context?.recommendedVisit || null;
            const billingStatus = String(existingVisit?.billingStatus || '').toLowerCase();
            const paymentSubmission = context?.paymentSubmission || null;
            const proofAwaitingReview = ['submitted', 'under_review', 'legacy_submitted'].includes(
                String(paymentSubmission?.status || '').toLowerCase()
            );
            const verifiedBookingPayment = paymentSubmission?.status === 'verified'
                && !paymentSubmission?.linkedVisitPaymentId
                ? Math.max(0, Number(paymentSubmission.amount || 0) - Number(paymentSubmission.refundedAmount || 0))
                : 0;

            if (proofAwaitingReview) {
                toast.info('This booking already has payment proof awaiting review. Confirm the booking to verify that proof before collecting another payment.');
                return;
            }

            if (existingVisit && ['paid', 'refunded'].includes(billingStatus)) {
                toast.info(
                    billingStatus === 'paid'
                        ? 'This booking invoice is already fully paid.'
                        : 'This booking invoice is refunded and must be resolved before receiving another payment.'
                );
                return;
            }

            const hasExistingCharges = Boolean(existingVisit && (existingVisit.charges || []).length > 0);
            const charges = hasExistingCharges
                ? (existingVisit.charges || []).map(billingChargeToPOSPrefill)
                : bookingPOSCharges(booking);
            const hasConfiguredServicePrice = charges.some((charge) => Number(charge.price || 0) > 0);
            const visitId = Number(existingVisit?.visitId || 0);
            const totals = existingVisit?.totals || {};
            const invoiceTotal = existingVisit
                ? Number(totals.charges || 0)
                : charges.reduce((sum, charge) => sum + (Number(charge.price || 0) * Number(charge.quantity || 1)), 0);
            const paidAmount = (existingVisit ? Number(totals.paid || 0) : 0) + verifiedBookingPayment;
            const balance = Math.max(0, invoiceTotal - paidAmount);

            if (invoiceTotal > 0 && balance <= 0.0001 && verifiedBookingPayment > 0) {
                toast.info('This booking prepayment is already verified. It will be linked to the visit invoice when the service is recorded.');
                return;
            }

            localStorage.setItem('ipawcus-pos-prefill', JSON.stringify({
                message: existingVisit
                    ? (hasExistingCharges
                        ? 'The existing clinical invoice was loaded from the database. Review it without replacing the veterinarian\'s recorded services.'
                        : 'The existing visit has no invoice lines yet. Official booked-service charges were loaded so payment can be completed without creating another visit.')
                    : (hasConfiguredServicePrice
                        ? 'Booked service charges loaded. Review the service and any transport fee before posting payment.'
                        : 'Booked service loaded with no configured price. Set the service price before posting payment.'),
                visit: {
                    id: visitId > 0 ? `visit-${visitId}` : (booking.bookingNumber || `BOOKING-${booking.id}`),
                    visitId: visitId > 0 ? visitId : null,
                    source: visitId > 0 ? 'database' : 'booking_prefill',
                    bookingId: booking.id,
                    bookingNumber: booking.bookingNumber || '',
                    bookingStatus: context?.booking?.status || booking.status || '',
                    branchId: existingVisit?.branchId || context?.booking?.branchId || booking.branchId || null,
                    branchName: existingVisit?.branchName || context?.booking?.branchName || booking.branchName || '',
                    petId: existingVisit?.petId || booking.petId || null,
                    ownerUserId: existingVisit?.ownerUserId || booking.userId || null,
                    sourceType: existingVisit?.sourceType || 'booking',
                    petName: existingVisit?.petName || booking.petName || 'Booking Patient',
                    ownerName: existingVisit?.ownerName || booking.ownerName || 'Pet Owner',
                    species: existingVisit?.petSpecies || booking.petSpecies || 'Pet',
                    visitType: booking.isOnlineConsultation ? 'Online Consultation Payment' : `${bookingChargeName(booking)} Payment`,
                    veterinarian: existingVisit?.veterinarianName || booking.veterinarian || 'Clinic Team',
                    complaint: existingVisit?.diagnosisSummary || booking.notes || `${booking.isOnlineConsultation ? 'Online consultation' : 'Booking'} ${booking.bookingNumber || ''}`.trim(),
                    billingStatus: existingVisit?.billingStatus || (paidAmount > 0 ? 'partial' : 'unbilled'),
                    total: invoiceTotal,
                    paid: paidAmount,
                    balance,
                    status: existingVisit ? 'Existing invoice' : 'Ready for payment'
                },
                charges
            }));
            navigate('/dashboard/pos');
        } catch (error) {
            toast.error(error.message || 'The booking invoice could not be opened.');
        } finally {
            setOpeningPaymentBookingId(null);
        }
    };

    const openBookingPaymentRefund = async (booking) => {
        if (openingPaymentBookingId) return;
        setOpeningPaymentBookingId(booking.id);
        try {
            const context = await fetchBookingBillingContext(booking.id);
            const submission = context?.paymentSubmission;
            if (!submission || submission.status !== 'verified') {
                toast.error('Only a verified, unrefunded booking payment can be refunded.');
                return;
            }
            if (submission.linkedVisitPaymentId) {
                toast.info('This payment is linked to a visit invoice. Use Record Refund in Point-Of-Sale.');
                navigate('/dashboard/pos');
                return;
            }
            const refundableAmount = Number(submission.refundableAmount || 0);
            if (refundableAmount <= 0) {
                toast.info('This booking payment has no refundable balance.');
                return;
            }
            setBookingRefundContext({ booking, submission });
            setBookingRefundForm({
                amount: String(refundableAmount),
                method: submission.paymentMethod || 'cash',
                reference: '',
                reason: 'Cancelled booking payment refund'
            });
            setBookingRefundOpen(true);
        } catch (error) {
            toast.error(error.message || 'The booking payment could not be prepared for refund.');
        } finally {
            setOpeningPaymentBookingId(null);
        }
    };

    const submitBookingPaymentRefund = async () => {
        const submission = bookingRefundContext?.submission;
        const booking = bookingRefundContext?.booking;
        const amount = Number(bookingRefundForm.amount);
        const refundableAmount = Number(submission?.refundableAmount || 0);
        if (!submission || !booking) return;
        if (!Number.isFinite(amount) || amount <= 0 || amount - refundableAmount > 0.0001) {
            toast.error(`Refund must be between PHP 0.01 and ${formatPhpCurrency(refundableAmount)}.`);
            return;
        }
        if (!bookingRefundForm.reason.trim()) {
            toast.error('Enter the reason for this refund.');
            return;
        }
        if (bookingRefundForm.method !== 'cash' && !bookingRefundForm.reference.trim()) {
            toast.error('Enter the non-cash refund transaction reference.');
            return;
        }

        setIsSubmittingBookingRefund(true);
        try {
            await postBookingPaymentRefund(booking.id, {
                submission_id: submission.submissionId,
                amount,
                refund_method: bookingRefundForm.method,
                reference_number: bookingRefundForm.reference.trim() || null,
                reason: bookingRefundForm.reason.trim()
            });
            setBookingRefundOpen(false);
            setBookingRefundContext(null);
            toast.success(`Refund of ${formatPhpCurrency(amount)} recorded for ${booking.bookingNumber}.`);
            await fetchBookings();
        } catch (error) {
            toast.error(error.message || 'Failed to record booking payment refund.');
        } finally {
            setIsSubmittingBookingRefund(false);
        }
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
            const selectedBookingBranchId = filterBranch !== 'all'
                ? Number(filterBranch)
                : (lockedBranchId ? Number(lockedBranchId) : null);
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
                branch_id: selectedBookingBranchId,
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
                branchId: Number(result.branch_id || 0) || null,
                branchName: result.branch_name || '',
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
                notes,
                price: Number(result.price || 0),
                transportFee: Number(result.transport_fee || 0)
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
        const reviewPayload = {
            review_notes: draft.notes
        };
        if (!booking.isOnlineConsultation) {
            reviewPayload.service_type = draft.serviceType;
        }
        const updated = await updateBookingStatus(booking.id, booking.status, reviewPayload);

        if (updated) {
            setBookings(current => current.map(item => (
                item.id === booking.id
                    ? {
                        ...item,
                        ...(booking.isOnlineConsultation
                            ? {}
                            : {
                                type: draft.serviceType,
                                service: getServiceDisplayName(draft.serviceType)
                            }),
                        notes: draft.notes
                    }
                    : item
            )));
            toast.success(`Review saved for ${booking.bookingNumber}.`);
        }
    };

    const confirmBooking = async (booking) => {
        if (confirmingBookingId) return;

        setConfirmingBookingId(booking.id);
        try {
            const draft = getReviewDraft(booking);
            if ((booking.isOnlineConsultation || booking.isHomeService) && !booking.paymentProof) {
                toast.info('This booking requires payment before confirmation. Opening Point-Of-Sale now.');
                await sendBookingPaymentToPOS({
                    ...booking,
                    type: draft.serviceType,
                    service: getServiceDisplayName(draft.serviceType),
                    notes: draft.notes
                });
                return;
            }
            const reviewPayload = {
                review_notes: draft.notes
            };
            if (!booking.isOnlineConsultation) {
                reviewPayload.service_type = draft.serviceType;
            }
            const updated = await updateBookingStatus(booking.id, 'confirmed', reviewPayload);

            if (updated) {
                toast.success(`${booking.isOnlineConsultation ? 'Online consultation' : 'Booking'} ${booking.bookingNumber} for ${booking.petName} confirmed successfully.`);
            }
        } finally {
            setConfirmingBookingId(null);
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
            walletNumber: normalizePhilippinePhoneInput(''),
            transactionNumber: ''
        });
        setCancellationDialogOpen(true);
    };

    const openBookingDetails = (bookingId) => {
        document.getElementById(bookingDetailsTriggerId(bookingId))?.click();
    };

    const handleBookingRowKeyDown = (event, bookingId) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        openBookingDetails(bookingId);
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

    const bookingMatchesBaseFilters = (booking) => {
        if (booking.type === 'boarding' && booking.hotelBoardingType) {
            return false;
        }

        const petName = booking.petName || `Unregistered ${booking.petSpecies || 'Pet'}`;
        const ownerName = booking.ownerName || 'Unknown Owner';
        const bookingNumber = booking.bookingNumber || '';
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const searchableText = [petName, ownerName, bookingNumber, getBookingServiceName(booking)]
            .join(' ')
            .toLowerCase();

        const normalizedBookingType = normalizeBookingFilterValue(booking.type || booking.service);
        const bookingType = booking.isOnlineConsultation
            ? 'online-consultation'
            : booking.isHomeService
                ? 'home-service'
                : normalizedBookingType === 'general-checkup'
                    ? 'general-check-up'
                    : normalizedBookingType;
        const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
        const matchesType = filterType === 'all' || bookingType === filterType;
        const matchesDate = bookingMatchesAppointmentFilter(booking, filterDate);

        return matchesSearch && matchesType && matchesDate;
    };

    const summaryBookings = bookings.filter((booking) => (
        bookingMatchesBaseFilters(booking)
        && (filterBranch === 'all' || String(booking.branchId) === filterBranch)
    ));

    const filteredBookings = summaryBookings.filter(booking => {
        return filterStatus === 'all' || normalizeBookingFilterValue(booking.status) === filterStatus;
    }).sort((a, b) => {
        const statusOrder = {
            'pending': 1,
            'confirmed': 2,
            'completed': 3,
            'cancelled': 4
        };
        const statusDifference = (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
        if (statusDifference !== 0) return statusDifference;

        const leftDate = bookingAppointmentDate(a)?.getTime() || 0;
        const rightDate = bookingAppointmentDate(b)?.getTime() || 0;
        return leftDate - rightDate;
    });

    const filtersAreActive = Boolean(
        searchQuery.trim()
        || filterType !== 'all'
        || filterStatus !== 'all'
        || filterDate !== 'all'
        || (!branchFilterLocked && filterBranch !== 'all')
    );

    const resetBookingFilters = () => {
        setSearchQuery('');
        setFilterType('all');
        setFilterStatus('all');
        setFilterDate('all');
        if (!branchFilterLocked) {
            setFilterBranch('all');
        }
    };

    const totalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKING_PAGE_SIZE));
    const activePage = Math.min(currentPage, totalPages);
    const firstBookingIndex = (activePage - 1) * BOOKING_PAGE_SIZE;
    const paginatedBookings = filteredBookings.slice(firstBookingIndex, firstBookingIndex + BOOKING_PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterType, filterStatus, filterBranch, filterDate]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

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
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {canConfigureBookingDisplay && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openDisplayConfigDialog}
                            className="w-full gap-2 sm:w-auto"
                        >
                            <Settings className="size-4" />
                            Display Settings
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={openAddBookingDialog}
                        className="w-full gap-2 bg-[#155dfc] hover:bg-[#0d4acf] sm:w-auto"
                    >
                        <Plus className="size-4" />
                        Add Booking
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Total Bookings:</span>
                    <span className="bg-[#eff6ff] text-[#155dfc] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {summaryBookings.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Confirmed:</span>
                    <span className="bg-[#e0f2e9] text-[#0c6a3c] font-['Arimo:Bold',sans-serif] font-bold text-[14px] px-2 py-1 rounded-[8px]">
                        {summaryBookings.filter(item => item.status === 'confirmed').length}
                    </span>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                        <Label htmlFor="booking-search" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Search bookings
                        </Label>
                        <Input
                            id="booking-search"
                            placeholder="Pet, owner, booking, or service"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="size-4" />}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Clinic location</Label>
                        {branchFilterLocked ? (
                            <div className="flex min-h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {getBranchDisplayName(branches, filterBranch, 'Assigned clinic location')}
                            </div>
                        ) : (
                            <Select value={filterBranch} onValueChange={setFilterBranch}>
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder="Location"
                                        displayValue={filterBranch === 'all'
                                            ? 'All available locations'
                                            : getBranchDisplayName(branches, filterBranch)}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All available locations</SelectItem>
                                    {branches.map((branch) => (
                                        <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Service type</Label>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-full">
                                <Filter className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All services</SelectItem>
                                <SelectItem value="online-consultation">Online Consultation</SelectItem>
                                <SelectItem value="vaccination">Vaccination</SelectItem>
                                <SelectItem value="grooming">Grooming</SelectItem>
                                <SelectItem value="dental">Dental</SelectItem>
                                <SelectItem value="general-check-up">General Check-up</SelectItem>
                                <SelectItem value="surgery">Surgery</SelectItem>
                                <SelectItem value="lab-testing">Lab Testing</SelectItem>
                                <SelectItem value="parasite-control">Parasite Control</SelectItem>
                                <SelectItem value="home-service">Home Service</SelectItem>
                                <SelectItem value="special-services">Special Services</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Booking status</Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full">
                                <Filter className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Appointment date</Label>
                        <Select value={filterDate} onValueChange={setFilterDate}>
                            <SelectTrigger className="w-full">
                                <CalendarClock className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All appointment dates</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="next-7-days">Next 7 days</SelectItem>
                                <SelectItem value="next-30-days">Next 30 days</SelectItem>
                                <SelectItem value="past">Past appointments</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredBookings.length}</span> matching bookings
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetBookingFilters}
                        disabled={!filtersAreActive}
                        className="w-full gap-2 sm:w-auto"
                    >
                        <X className="size-4" />
                        Reset filters
                    </Button>
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
                            <TableHead className="w-px p-0">
                                <span className="sr-only">Details</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedBookings.map((booking) => (
                            <TableRow
                                key={booking.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openBookingDetails(booking.id)}
                                onKeyDown={(event) => handleBookingRowKeyDown(event, booking.id)}
                                className="cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc]"
                            >
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
                                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{booking.branchName || 'Main Clinic'}</p>
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
                                    <div className="flex flex-wrap items-center">
                                        {booking.hasCancellationRequest ? (
                                            <Badge className="bg-red-100 text-red-700 border-red-200 border px-2.5 py-0.5 rounded-full font-medium">
                                                Cancellation Requested
                                            </Badge>
                                        ) : (
                                            getStatusBadge(booking.status)
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="w-px p-0" onClick={(event) => event.stopPropagation()}>
                                        <Sheet>
                                        <SheetTrigger asChild>
                                            <Button id={bookingDetailsTriggerId(booking.id)} variant="outline" size="sm" className="sr-only">
                                                Open booking details for {booking.bookingNumber}
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
                                                                Home Service Starting Charge
                                                            </p>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[16px] text-blue-600">
                                                                {formatPhpCurrency(booking.price)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {booking.isHomeService && Number(booking.transportFee || 0) > 0 && (
                                                        <div>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                                Transport Fee
                                                            </p>
                                                            <p className="font-['Arimo:Bold',sans-serif] text-[16px] text-blue-600">
                                                                {formatPhpCurrency(booking.transportFee)}
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

                                                {booking.isOnlineConsultation && booking.discussionTopic && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565] mb-1">
                                                            Discussion Topics
                                                        </p>
                                                        <p className="font-['Arimo:Regular',sans-serif] text-[16px] whitespace-pre-wrap">
                                                            {booking.discussionTopic}
                                                        </p>
                                                    </div>
                                                )}

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

                                                {/* Complete consent form section */}
                                                {bookingConsentForms(booking).length > 0 && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                            Signed Consent Form
                                                        </p>
                                                        <div className="space-y-3">
                                                            {bookingConsentForms(booking).map(form => (
                                                                <BookingConsentCard
                                                                    key={form.id}
                                                                    form={form}
                                                                    booking={booking}
                                                                    onPreview={setViewerImage}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {booking.legacyConsentSignaturePath && bookingConsentForms(booking).length === 0 && (
                                                    <div className="border-t pt-4">
                                                        <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                            Signed Consent Form
                                                        </p>
                                                        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                                                            A legacy signature exists, but the complete consent form was not retained. The signature is not shown by itself.
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Pet Profile Image Section */}
                                                <div className="border-t pt-4">
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                       Pictures of Concern
                                                    </p>
                                                    {bookingAttachmentPaths(booking.image_Booking_Concern_Path).length > 0 ? (
                                                        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                                                            {bookingAttachmentPaths(booking.image_Booking_Concern_Path).map((path, idx) => (
                                                                <BookingAttachmentCard
                                                                    key={`${path}-${idx}`}
                                                                    path={path}
                                                                    alt={`${booking.petName} concern ${idx + 1}`}
                                                                    onPreview={setViewerImage}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                                            <p className="text-[12px] text-gray-400 text-center px-2">No uploaded files available</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Payment Proof Section */}
                                                <div className="border-t pt-4">
                                                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-3">
                                                        Payment Proof
                                                    </p>
                                                    {booking.paymentProof ? (
                                                        <div className="space-y-3">
                                                            <BookingAttachmentCard
                                                                path={booking.paymentProof}
                                                                alt="Payment Proof"
                                                                onPreview={setViewerImage}
                                                            />
                                                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] leading-5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                                                                {booking.status === 'pending'
                                                                    ? 'Review this proof as part of booking approval. A separate POS payment action is hidden to prevent duplicate collection.'
                                                                    : 'Payment proof is already on file. A separate POS payment action is hidden to prevent duplicate collection.'}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-[14px] p-6 text-center">
                                                            <p className="text-[14px] text-gray-400">No Proof of Payment</p>
                                                        </div>
                                                    )}
                                                    {booking.status === 'cancelled' && booking.paymentProof && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="mt-3 w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                                            onClick={() => openBookingPaymentRefund(booking)}
                                                            disabled={openingPaymentBookingId === booking.id}
                                                        >
                                                            {openingPaymentBookingId === booking.id
                                                                ? <Loader2 className="mr-2 size-4 animate-spin" />
                                                                : <RotateCcw className="mr-2 size-4" />}
                                                            Record Booking Refund
                                                        </Button>
                                                    )}
                                                </div>

                                                {booking.status !== 'cancelled' && !booking.paymentProof && (
                                                    <div className="border-t pt-4">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => sendBookingPaymentToPOS(booking)}
                                                            disabled={openingPaymentBookingId === booking.id}
                                                            className="w-full border-[#155dfc] text-[#155dfc] hover:bg-[#eff6ff]"
                                                        >
                                                            {openingPaymentBookingId === booking.id
                                                                ? <Loader2 className="size-4 mr-2 animate-spin" />
                                                                : <CreditCard className="size-4 mr-2" />}
                                                            {openingPaymentBookingId === booking.id ? 'Opening Invoice...' : 'Open Point-Of-Sale Payment'}
                                                        </Button>
                                                        <p className="mt-2 text-[12px] text-[#4a5565]">
                                                            The booked service is carried into Point-Of-Sale automatically. Home-service transport is shown as a separate receipt line.
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
                                                                        <Label>Clinic location</Label>
                                                                        <Select
                                                                            value={String(booking.branchId || '')}
                                                                            onValueChange={(value) => handleBookingRelocation(booking, value)}
                                                                            disabled={relocatingBookingId === booking.id}
                                                                        >
                                                                            <SelectTrigger className="bg-white">
                                                                                <SelectValue
                                                                                    placeholder="Select location"
                                                                                    displayValue={booking.branchName || getBranchDisplayName(branches, booking.branchId)}
                                                                                />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {branches.map((branch) => (
                                                                                    <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <p className="text-xs text-slate-500">Relocating keeps the same service price and submitted payment.</p>
                                                                    </div>
                                                                    {booking.isOnlineConsultation ? (
                                                                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                                                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                                                                Booking Type
                                                                            </p>
                                                                            <p className="mt-1 text-sm font-bold text-blue-950">
                                                                                Online Consultation
                                                                            </p>
                                                                        </div>
                                                                    ) : (
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
                                                                    )}
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
                                                                    onClick={() => confirmBooking(booking)}
                                                                    disabled={confirmingBookingId === booking.id}
                                                                    className="bg-[#0c6a3c] hover:bg-[#09522f] text-white w-full"
                                                                >
                                                                    {confirmingBookingId === booking.id ? (
                                                                        <Loader2 className="size-4 mr-2 animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle className="size-4 mr-2" />
                                                                    )}
                                                                    {confirmingBookingId === booking.id
                                                                        ? 'Confirming...'
                                                                        : booking.isOnlineConsultation ? 'Approve Online Consultation' : 'Confirm Booking'}
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
                            </TableCell>
                        </TableRow>
                    ))}
                    {paginatedBookings.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">
                                No bookings match the selected filters.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>
            <TablePagination
                currentPage={activePage}
                totalItems={filteredBookings.length}
                pageSize={BOOKING_PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="bookings"
            />
            <PhotoViewer src={viewerImage?.src} alt={viewerImage?.alt} open={!!viewerImage} onOpenChange={() => setViewerImage(null)} />

            <Dialog open={displayConfigOpen} onOpenChange={setDisplayConfigOpen}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
                            Booking Display Settings
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
                            Configure client-facing booking price projections and instructions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Service Price Display</h3>
                                <p className="mt-1 text-sm text-slate-500">These labels appear on pet-owner booking screens.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {SERVICE_DISPLAY_PRICE_FIELDS.map((field) => (
                                    <div key={field.key} className="space-y-2">
                                        <Label htmlFor={`display-price-${field.key}`}>{field.label}</Label>
                                        <Input
                                            id={`display-price-${field.key}`}
                                            value={displayConfigDraft.servicePrices[field.key] || ''}
                                            onChange={(event) => updateDisplayServicePrice(field.key, event.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Service Detail Display</h3>
                                <p className="mt-1 text-sm text-slate-500">Edit the included rows, duration, and review note shown beside booking forms.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {SERVICE_DETAIL_FIELDS.map((field) => {
                                    const detail = displayConfigDraft.serviceDetails[field.key] || {};

                                    return (
                                        <div key={field.key} className="rounded-lg border border-slate-200 p-4">
                                            <h4 className="mb-3 text-sm font-bold text-slate-900">{field.label}</h4>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`service-detail-title-${field.key}`}>Included Heading</Label>
                                                    <Input
                                                        id={`service-detail-title-${field.key}`}
                                                        value={detail.includedTitle || ''}
                                                        onChange={(event) => updateDisplayServiceDetail(field.key, 'includedTitle', event.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`service-detail-duration-${field.key}`}>Duration</Label>
                                                    <Input
                                                        id={`service-detail-duration-${field.key}`}
                                                        value={detail.duration || ''}
                                                        onChange={(event) => updateDisplayServiceDetail(field.key, 'duration', event.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`service-detail-items-${field.key}`}>Included Rows</Label>
                                                    <Textarea
                                                        id={`service-detail-items-${field.key}`}
                                                        value={includedItemsText(detail.includedItems)}
                                                        onChange={(event) => updateDisplayServiceDetail(field.key, 'includedItems', event.target.value)}
                                                        rows={5}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`service-detail-note-${field.key}`}>Review Note</Label>
                                                    <Textarea
                                                        id={`service-detail-note-${field.key}`}
                                                        value={detail.reviewNote || ''}
                                                        onChange={(event) => updateDisplayServiceDetail(field.key, 'reviewNote', event.target.value)}
                                                        rows={5}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Home-Service Slots</h3>
                                <p className="mt-1 text-sm text-slate-500">Edit the visible home-service item names and price labels.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {displayConfigDraft.homeServices.map((row) => (
                                    <div key={row.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                        <div className="space-y-2">
                                            <Label htmlFor={`home-service-name-${row.id}`}>Slot Name</Label>
                                            <Input
                                                id={`home-service-name-${row.id}`}
                                                value={row.name}
                                                onChange={(event) => updateDisplayArrayRow('homeServices', 'id', row.id, 'name', event.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`home-service-price-${row.id}`}>Price Display</Label>
                                            <Input
                                                id={`home-service-price-${row.id}`}
                                                value={row.price}
                                                onChange={(event) => updateDisplayArrayRow('homeServices', 'id', row.id, 'price', event.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Grooming Size Table</h3>
                                <p className="mt-1 text-sm text-slate-500">Edit the projected grooming prices shown to clients.</p>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Small</TableHead>
                                            <TableHead>Medium</TableHead>
                                            <TableHead>Large</TableHead>
                                            <TableHead>XL</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayConfigDraft.groomingMatrix.map((row) => (
                                            <TableRow key={row.service}>
                                                <TableCell className="min-w-52">
                                                    <Input
                                                        value={row.service}
                                                        onChange={(event) => updateDisplayArrayRow('groomingMatrix', 'service', row.service, 'service', event.target.value)}
                                                    />
                                                </TableCell>
                                                {['small', 'medium', 'large', 'xl'].map((size) => (
                                                    <TableCell key={size} className="min-w-32">
                                                        <Input
                                                            value={row[size]}
                                                            onChange={(event) => updateDisplayArrayRow('groomingMatrix', 'service', row.service, size, event.target.value)}
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Kapon Procedure Table</h3>
                                <p className="mt-1 text-sm text-slate-500">Edit the visible starting prices for Kapon / Spay-Neuter procedures.</p>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Procedure</TableHead>
                                            <TableHead>Recommended Starting Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayConfigDraft.kaponMatrix.map((row) => (
                                            <TableRow key={row.procedure}>
                                                <TableCell className="min-w-72">
                                                    <Input
                                                        value={row.procedure}
                                                        onChange={(event) => updateDisplayArrayRow('kaponMatrix', 'procedure', row.procedure, 'procedure', event.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="min-w-52">
                                                    <Input
                                                        value={row.price}
                                                        onChange={(event) => updateDisplayArrayRow('kaponMatrix', 'procedure', row.procedure, 'price', event.target.value)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Instructions</h3>
                                <p className="mt-1 text-sm text-slate-500">Optional notes shown under matching price displays.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {DISPLAY_INSTRUCTION_FIELDS.map((field) => (
                                    <div key={field.key} className="space-y-2">
                                        <Label htmlFor={`display-instruction-${field.key}`}>{field.label}</Label>
                                        <Textarea
                                            id={`display-instruction-${field.key}`}
                                            value={displayConfigDraft.instructions[field.key] || ''}
                                            onChange={(event) => updateDisplayInstruction(field.key, event.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button type="button" variant="outline" onClick={handleResetDisplayConfig} className="gap-2">
                            <RotateCcw className="size-4" />
                            Reset Defaults
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setDisplayConfigOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveDisplayConfig} className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                                <Save className="size-4" />
                                Save Display Settings
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            Create a counter booking and open its official charges in POS. Online consultation, home service, and boarding remain in their owner-consent workflows.
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
                                    min={todayInputDate()}
                                    disabled={isCreatingBooking}
                                />
                            </div>
                            <BookingTimeSlotField
                                id="admin-booking-time"
                                service={adminBookingForm.serviceType}
                                date={adminBookingForm.bookingDate}
                                branchId={filterBranch !== 'all' ? filterBranch : lockedBranchId}
                                veterinarianId={adminBookingForm.veterinarianId}
                                value={adminBookingForm.bookingTime}
                                onChange={(bookingTime) => setAdminBookingForm((current) => ({ ...current, bookingTime }))}
                                label="Time"
                                disabled={isCreatingBooking}
                            />
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
                                    <SelectItem value="pos">Counter payment, then auto-confirm</SelectItem>
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
                                    restriction="phone"
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
                                    restriction="alphanumeric"
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

            <Dialog open={bookingRefundOpen} onOpenChange={(open) => !isSubmittingBookingRefund && setBookingRefundOpen(open)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Record Booking Payment Refund</DialogTitle>
                        <DialogDescription>
                            Use this only for a verified payment that was cancelled before it became a visit invoice.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                            <p className="font-bold text-slate-900">{bookingRefundContext?.booking?.bookingNumber}</p>
                            <p className="text-slate-600">
                                {bookingRefundContext?.booking?.petName} · Refundable {formatPhpCurrency(bookingRefundContext?.submission?.refundableAmount || 0)}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Refund Amount</Label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    max={bookingRefundContext?.submission?.refundableAmount || undefined}
                                    step="0.01"
                                    restriction="decimal"
                                    value={bookingRefundForm.amount}
                                    onChange={(event) => setBookingRefundForm((current) => ({ ...current, amount: event.target.value }))}
                                    disabled={isSubmittingBookingRefund}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Refund Method</Label>
                                <Select
                                    value={bookingRefundForm.method}
                                    onValueChange={(value) => setBookingRefundForm((current) => ({ ...current, method: value, reference: '' }))}
                                    disabled={isSubmittingBookingRefund}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {refundMethods.map((method) => (
                                            <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {bookingRefundForm.method !== 'cash' && (
                            <div className="space-y-2">
                                <Label>Refund Transaction Reference</Label>
                                <Input
                                    value={bookingRefundForm.reference}
                                    onChange={(event) => setBookingRefundForm((current) => ({ ...current, reference: event.target.value }))}
                                    restriction="alphanumeric"
                                    placeholder="Bank or wallet refund reference"
                                    disabled={isSubmittingBookingRefund}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                value={bookingRefundForm.reason}
                                onChange={(event) => setBookingRefundForm((current) => ({ ...current, reason: event.target.value }))}
                                rows={3}
                                maxLength={500}
                                disabled={isSubmittingBookingRefund}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBookingRefundOpen(false)} disabled={isSubmittingBookingRefund}>Cancel</Button>
                        <Button variant="destructive" onClick={submitBookingPaymentRefund} disabled={isSubmittingBookingRefund}>
                            {isSubmittingBookingRefund && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {isSubmittingBookingRefund ? 'Recording...' : 'Record Refund'}
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
                                        min={todayInputDate()}
                                        className="w-full"
                                    />
                                    {isBoardingBooking(currentRescheduleBooking) ? (
                                        <Input
                                            type="time"
                                            value={newTime}
                                            onChange={(e) => setNewTime(e.target.value)}
                                            className="w-full"
                                        />
                                    ) : (
                                        <BookingTimeSlotField
                                            id="reschedule-booking-time"
                                            service={currentRescheduleBooking?.isOnlineConsultation
                                                ? 'online-consultation'
                                                : currentRescheduleBooking?.isHomeService
                                                    ? 'home-service'
                                                    : currentRescheduleBooking?.type}
                                            date={newDate}
                                            branchId={currentRescheduleBooking?.branchId}
                                            veterinarianId={currentRescheduleBooking?.veterinarianId}
                                            value={newTime}
                                            onChange={setNewTime}
                                            label="New time"
                                            allowCurrentValue={newDate === currentRescheduleBooking?.date}
                                            className="w-full"
                                        />
                                    )}
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
                                restriction="name"
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
                                restriction="name"
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
                                restriction="decimal"
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
