import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock,
    FileCheck2,
    FileText,
    LayoutGrid,
    List,
    Loader2,
    PawPrint,
    RefreshCw,
    Scissors,
    Search,
    Stethoscope,
    Upload,
    X
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { toast } from '../../reusecomponent/toast.jsx';
import { calculateAge, clinicTodayDate, formatDisplayDate, formatDisplayDateTime } from '../../lib/date';
import { assignedVetBookings, bookingDateKey, bookingPreviewSelection, bookingsForDate, filterVetBookings, nextBookedDate, nextBookingDayLabel, queueScheduleDate, vetBookingService } from '../../lib/vetDailyBookings';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { normalizeQueuePriority } from '../../lib/queuePriority';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import SignatureCapture from '../SignatureCapture.jsx';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { createAndUploadConsentDocumentPdf } from '../../services/consentDocumentPdf.js';
import { fetchConsentFiles } from '../../services/consentFileService';
import { saveConsentFormRecord } from '../../services/consentRecordService';
import { fetchProfile } from '../../services/profileService';
import {
    fetchQueues,
    updateQueueStatus as updateQueueStatusService
} from '../../services/queueService';
import { uploadDataUrlImage } from '../../services/uploadService';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import CarePageHeader from '../shared/CarePageHeader.jsx';
import GroomingWorkspace from '../shared/GroomingWorkspace.jsx';
import VetBookingDayList from '../shared/VetBookingDayList.jsx';
import { fetchVeterinarianBookings } from '../../services/bookingService';
import './vetMyList.css';

const CONSENT_STORAGE_KEY = 'ipawcus-vet-my-list-consents';

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function isReceived(item) {
    const intakeStatus = normalize(item.clinical_intake?.status || item.clinical_intake_status);
    return normalize(item.status) === 'in-progress'
        && normalize(item.assignment_status) === 'received'
        && ['in_progress', 'completed'].includes(intakeStatus);
}

function isCompleted(item) {
    const status = normalize(item.status);
    return normalize(item.assignment_status) === 'completed' || status === 'completed' || status === 'done';
}

function ownerName(item) {
    return item.owner_name || `${item.first_Name || ''} ${item.last_Name || ''}`.trim() || 'Unknown Owner';
}

function petAge(item) {
    return item.pet_age || calculateAge(item.pet_BDAY) || 'N/A';
}

function formatQueueTime(value) {
    return formatDisplayDateTime(value, undefined, { fallback: 'Not set' });
}

function readStoredConsents() {
    try {
        return JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function getUserName(user) {
    const fullName = [
        user?.firstName || user?.FirstName || user?.first_name,
        user?.lastName || user?.LastName || user?.last_name
    ].filter(Boolean).join(' ').trim();

    return fullName || user?.name || user?.email || 'Veterinarian';
}

function getPreferredBranchFilter(user) {
    const branchId = user?.preferred_branch_id || user?.preferredBranchId;
    return branchId ? String(branchId) : 'all';
}

function numericId(value) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

export default function VetMyList() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const veterinarianUserId = getUserId(currentUser);
    const veterinarianName = getUserName(currentUser);
    const fileInputRef = useRef(null);
    const [queue, setQueue] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [todayKey, setTodayKey] = useState(() => clinicTodayDate());
    const [isBookingsLoading, setIsBookingsLoading] = useState(true);
    const [bookingsError, setBookingsError] = useState('');
    const [bookingViewerDate, setBookingViewerDate] = useState(() => bookingPreviewSelection(window.location.search).date);
    const [previewBookingId, setPreviewBookingId] = useState(() => bookingPreviewSelection(window.location.search).bookingId);
    const [consentForms, setConsentForms] = useState([]);
    const [consentRecords, setConsentRecords] = useState(readStoredConsents);
    const [veterinarianLicense, setVeterinarianLicense] = useState(currentUser?.licenseNumber || currentUser?.prc_license_number || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedQueue, setHasLoadedQueue] = useState(false);
    const [isSavingConsent, setIsSavingConsent] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [updatingQueueId, setUpdatingQueueId] = useState(null);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [consentDialogOpen, setConsentDialogOpen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [groomingReviewsOpen, setGroomingReviewsOpen] = useState(false);

    useEffect(() => {
        const syncBookingPreview = () => {
            const selection = bookingPreviewSelection(window.location.search);
            setBookingViewerDate(selection.date);
            setPreviewBookingId(selection.bookingId);
        };
        window.addEventListener('popstate', syncBookingPreview);
        window.addEventListener('ipawcus:dashboard-route-change', syncBookingPreview);
        return () => {
            window.removeEventListener('popstate', syncBookingPreview);
            window.removeEventListener('ipawcus:dashboard-route-change', syncBookingPreview);
        };
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem('ipawcus-open-grooming-reviews') === '1') {
            sessionStorage.removeItem('ipawcus-open-grooming-reviews');
            setGroomingReviewsOpen(true);
        }
    }, []);
    const [selectedConsentId, setSelectedConsentId] = useState('');
    const [signerName, setSignerName] = useState('');
    const [signatureImage, setSignatureImage] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [completedViewMode, setCompletedViewMode] = useState('table');
    const [branches, setBranches] = useState([]);
    const [branchFilter, setBranchFilter] = useState('all');

    useEffect(() => {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentRecords));
    }, [consentRecords]);

    useEffect(() => {
        if (!hasLoadedQueue) return;

        const visibleQueueIds = new Set(
            queue
                .filter(item => normalize(item.status) !== 'cancelled')
                .map(item => String(item.queue_id))
        );
        const staleQueueIds = Object.keys(consentRecords).filter(queueId => !visibleQueueIds.has(String(queueId)));

        if (staleQueueIds.length === 0) return;

        setConsentRecords(current => {
            const nextRecords = { ...current };
            let hasDeletedRecord = false;

            staleQueueIds.forEach(queueId => {
                if (Object.prototype.hasOwnProperty.call(nextRecords, queueId)) {
                    delete nextRecords[queueId];
                    hasDeletedRecord = true;
                }
            });

            return hasDeletedRecord ? nextRecords : current;
        });
    }, [consentRecords, hasLoadedQueue, queue]);

    useEffect(() => {
        const loadVetProfile = async () => {
            if (!veterinarianUserId) return;

            try {
                const data = await fetchProfile({
                    userId: veterinarianUserId,
                    role: currentUser?.role || 'Veterinarian'
                });
                setVeterinarianLicense(data.prc_license_number || data.licenseNumber || '');
            } catch {
                setVeterinarianLicense(currentUser?.licenseNumber || currentUser?.prc_license_number || '');
            }
        };

        loadVetProfile();
    }, [currentUser, veterinarianUserId]);

    const loadQueue = async ({ isAutoRefresh = false } = {}) => {
        setTodayKey(clinicTodayDate());
        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const data = await fetchQueues();

            setQueue(Array.isArray(data) ? data : []);
            setHasLoadedQueue(true);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            if (!isAutoRefresh) {
                setErrorMessage(error.message || 'Failed to load veterinarian list.');
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const loadConsentForms = async () => {
        try {
            const data = await fetchConsentFiles();

            setConsentForms(Array.isArray(data) ? data : []);
        } catch {
            setConsentForms([]);
        }
    };

    const loadBookings = async ({ isAutoRefresh = false } = {}) => {
        setTodayKey(clinicTodayDate());
        if (!isAutoRefresh) setIsBookingsLoading(true);
        try {
            const data = await fetchVeterinarianBookings();
            setBookings(Array.isArray(data) ? data : []);
            setBookingsError('');
        } catch (error) {
            setBookingsError(error.message || 'Your booking schedule could not be loaded.');
        } finally {
            setIsBookingsLoading(false);
        }
    };

    useAutoRefresh(loadQueue);
    useAutoRefresh(loadBookings, { enabled: Boolean(veterinarianUserId), refreshKey: `vet-my-list-bookings-${veterinarianUserId}` });
    useAutoRefresh(loadConsentForms, { intervalMs: 15000, refreshKey: 'vet-consent-files' });
    useAutoRefresh(async () => {
        try {
            const data = await fetchBranches();
            const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
            setBranches(nextBranches);
            setBranchFilter((current) => {
                if (current === 'all') return current;
                if (current !== 'all' && nextBranches.some((branch) => String(branch.id) === current)) return current;
                const preferred = getPreferredBranchFilter(currentUser);
                const selected = nextBranches.find((branch) => String(branch.id) === preferred)
                    || nextBranches.find((branch) => branch.isMain)
                    || nextBranches[0];
                return selected ? String(selected.id) : 'all';
            });
        } catch (error) {
            console.error('Failed to load My List branches:', error);
        }
    }, { intervalMs: 30000, refreshKey: 'vet-my-list-branches' });

    const assignedQueue = useMemo(() => {
        if (!veterinarianUserId) return [];

        return queue.filter(item =>
            String(item.veterinarian_user_id || '') === String(veterinarianUserId)
        );
    }, [queue, veterinarianUserId]);

    const receivedItems = useMemo(() => {
        return assignedQueue
            .filter(item => queueScheduleDate(item) === todayKey)
            .filter(isReceived)
            .sort((a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0));
    }, [assignedQueue, todayKey]);

    const completedItems = useMemo(() => {
        return assignedQueue
            .filter(item => queueScheduleDate(item) === todayKey)
            .filter(isCompleted)
            .sort((a, b) => new Date(b.completed_at || b.timestamp) - new Date(a.completed_at || a.timestamp));
    }, [assignedQueue, todayKey]);

    const approvedBookings = useMemo(() => filterVetBookings(assignedVetBookings(bookings, veterinarianUserId), '', branchFilter), [bookings, branchFilter, veterinarianUserId]);
    const todayBookings = useMemo(() => bookingsForDate(filterVetBookings(approvedBookings, searchQuery), todayKey), [approvedBookings, searchQuery, todayKey]);
    const nextDate = nextBookedDate(approvedBookings, todayKey);
    const nextBookings = bookingsForDate(approvedBookings, nextDate);
    const previewBookings = bookingsForDate(approvedBookings, bookingViewerDate);
    const previewBooking = assignedVetBookings(bookings, veterinarianUserId, false).find(booking => String(booking.id) === previewBookingId && bookingDateKey(booking.date) === bookingViewerDate);
    const previewPatient = previewBooking ? assignedQueue.find(item => String(item.booking_id) === String(previewBooking.id) && isReceived(item)) : null;
    const getBookingStatus = (booking) => {
        if (normalize(booking.status) === 'pending') return { label: 'Pending approval', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
        const patient = assignedQueue.find(item => String(item.booking_id) === String(booking.id) && normalize(item.status) !== 'cancelled');
        const intakeStatus = normalize(patient?.clinical_intake?.status || patient?.clinical_intake_status);
        if (patient && isCompleted(patient)) return { label: 'Done', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
        if (intakeStatus === 'in_progress') return { label: 'Undergoing physical examination', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
        if (intakeStatus === 'completed') return { label: 'Ready for diagnosis', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
        return { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
    };
    const openBookingPreview = (date, booking = null) => {
        setBookingViewerDate(date);
        setPreviewBookingId(booking ? String(booking.id) : '');
    };

    const filteredReceivedItems = useMemo(
        () => filterItems(receivedItems, searchQuery, branchFilter),
        [branchFilter, receivedItems, searchQuery]
    );
    const filteredCompletedItems = useMemo(
        () => filterItems(completedItems, searchQuery, branchFilter),
        [branchFilter, completedItems, searchQuery]
    );

    const selectedConsent = consentForms.find(form => String(form.file_id) === selectedConsentId);

    const getConsentRecord = (item) => {
        const storedRecord = consentRecords[item.queue_id] || consentRecords[String(item.queue_id)] || {};
        const serverRecords = Array.isArray(item.consent_records)
            ? item.consent_records
            : Array.isArray(item.consentRecords)
                ? item.consentRecords
                : [];
        const signedServerRecord = serverRecords.find(record =>
            record?.signed_file_path || record?.signedFilePath || record?.signed_consent_document_path
        ) || {};
        const physicalServerRecord = serverRecords.find(record =>
            record?.physical_file_path || record?.physicalFilePath || record?.physical_consent_path
        ) || {};
        const signedDocumentPath = storedRecord.signedDocumentPath
            || signedServerRecord.signed_file_path
            || signedServerRecord.signedFilePath
            || signedServerRecord.signed_consent_document_path
            || item.signed_consent_document_path
            || '';
        const physicalConsentPath = storedRecord.physicalConsentPath
            || physicalServerRecord.physical_file_path
            || physicalServerRecord.physicalFilePath
            || physicalServerRecord.physical_consent_path
            || item.physical_consent_path
            || '';
        const signedAt = storedRecord.signedAt
            || signedServerRecord.signed_at
            || signedServerRecord.signedAt
            || physicalServerRecord.signed_at
            || physicalServerRecord.signedAt
            || item.signed_consent_at
            || '';
        if (!signedDocumentPath && !physicalConsentPath && !storedRecord.signedAt) {
            return null;
        }

        return {
            ...storedRecord,
            consentRecordId: storedRecord.consentRecordId
                || signedServerRecord.consent_record_id
                || signedServerRecord.consentRecordId
                || physicalServerRecord.consent_record_id
                || physicalServerRecord.consentRecordId
                || item.signed_consent_record_id
                || null,
            consentName: storedRecord.consentName
                || signedServerRecord.consent_type
                || signedServerRecord.consentType
                || item.signed_consent_type
                || (physicalConsentPath ? 'Physical Consent Upload' : 'Signed Consent'),
            signedDocumentPath,
            physicalConsentPath,
            signedAt: signedAt || (physicalConsentPath ? item.received_at || item.timestamp || '' : ''),
            physicalConsentUploadedAt: physicalConsentPath
                ? storedRecord.physicalConsentUploadedAt
                    || physicalServerRecord.signed_at
                    || physicalServerRecord.signedAt
                    || signedAt
                    || item.received_at
                    || item.timestamp
                    || ''
                : '',
            hasSignature: Boolean(signedDocumentPath),
            isTemporary: false
        };
    };
    const selectedConsentRecord = selectedPatient ? getConsentRecord(selectedPatient) : null;

    const updateQueueStatus = async (queueId, status) => {
        setUpdatingQueueId(queueId);

        try {
            const data = await updateQueueStatusService({
                queue_id: queueId,
                status,
                action: status === 'in-progress' ? 'reopen' : undefined
            });

            if (!data.success) {
                throw new Error(data.error || data.message || 'Failed to update queue status.');
            }

            setQueue(current =>
                current.map(item =>
                    item.queue_id === queueId
                        ? {
                            ...item,
                            status,
                            assignment_status: status === 'completed'
                                ? 'completed'
                                : status === 'in-progress'
                                    ? 'received'
                                    : item.assignment_status
                        }
                        : item
                )
            );
            toast.success(status === 'completed' ? 'Patient marked done.' : 'Patient returned to received list.');
        } catch (error) {
            toast.error(error.message || 'The patient status could not be updated. Refresh My List and try again.');
        } finally {
            setUpdatingQueueId(null);
        }
    };

    const openConsentDialog = (item) => {
        const record = getConsentRecord(item);
        setSelectedPatient(item);
        setSelectedConsentId(record?.consentId || '');
        setSignerName(record?.signerName || ownerName(item));
        setSignatureImage(record?.signatureImage || null);
        setConsentDialogOpen(true);
    };

    const openUploadDialog = (item) => {
        const record = getConsentRecord(item);
        setSelectedPatient(item);
        setUploadedFileName(record?.physicalConsentName || '');
        setPreviewUrl(record?.physicalConsentPreview || record?.physicalConsentPath || '');
        setUploadDialogOpen(true);
    };

    const saveConsent = async () => {
        if (!selectedPatient || !selectedConsentId) {
            toast.error('Please select a consent form.');
            return;
        }

        if (!signatureImage) {
            toast.error('Please provide the owner signature.');
            return;
        }

        setIsSavingConsent(true);

        try {
            const signedAtDate = new Date();
            const signedAt = signedAtDate.toLocaleString();
            const signedAtIso = signedAtDate.toISOString();
            const signedDocumentPath = await createAndUploadConsentDocumentPdf({
                title: selectedConsent?.file_name || selectedConsent?.name || 'Consent Form',
                content: selectedConsent?.content || '',
                signatureImage,
                signerName: signerName.trim() || ownerName(selectedPatient),
                signedAt,
                veterinarianName,
                veterinarianLicense,
                templateContext: {
                    ownerName: signerName.trim() || ownerName(selectedPatient),
                    petName: selectedPatient.pet_name,
                    petSpecies: selectedPatient.pet_species,
                    petBreed: selectedPatient.pet_breed,
                    serviceName: selectedPatient.service_name || selectedPatient.service_type,
                    branchName: selectedPatient.branch_name,
                    queueNumber: selectedPatient.queue_number
                }
            }, 'signed_consent');
            let consentRecordId = null;
            let recordWarning = '';

            try {
                const recordData = await saveConsentFormRecord({
                    consent_file_id: numericId(selectedConsentId),
                    consent_type: selectedConsent?.file_name || selectedConsent?.name || 'Consent Form',
                    owner_user_id: numericId(selectedPatient.user_id),
                    pet_id: numericId(selectedPatient.pet_id),
                    queue_id: numericId(selectedPatient.queue_id),
                    booking_id: numericId(selectedPatient.booking_id),
                    service_name: getServiceDisplayName(selectedPatient.service_name, 'Queue'),
                    status: 'signed',
                    source: 'vet_my_list',
                    signed_at: signedAtIso,
                    signed_file_path: signedDocumentPath,
                    signer_name: signerName.trim() || ownerName(selectedPatient),
                    processed_by_user_id: numericId(veterinarianUserId),
                    processed_by_name: veterinarianName,
                    notes: 'Captured from veterinarian My List.'
                });

                consentRecordId = recordData?.consent_record_id || null;
            } catch (recordError) {
                console.warn('Consent report tracking was not recorded:', recordError);
                recordWarning = recordError?.message || 'Consent report tracking was not recorded.';
            }

            setConsentRecords(current => ({
                ...current,
                [selectedPatient.queue_id]: {
                    ...(current[selectedPatient.queue_id] || {}),
                    consentRecordId,
                    consentId: selectedConsentId,
                    consentName: selectedConsent?.file_name || selectedConsent?.name || 'Consent Form',
                    signerName: signerName.trim() || ownerName(selectedPatient),
                    signatureImage,
                    signedDocumentPath,
                    hasSignature: true,
                    isTemporary: false,
                    signedAt
                }
            }));

            setConsentDialogOpen(false);
            setSelectedPatient(null);
            setSignatureImage(null);
            if (recordWarning) {
                toast.warning('The signed consent was saved, but report tracking was not updated. Refresh Reports later or contact an administrator.');
            } else {
                toast.success('Signed consent document saved and tracked for reports.');
            }
        } catch (error) {
            toast.error(error.message || 'The signed consent could not be saved. Check the signature and try again.');
        } finally {
            setIsSavingConsent(false);
        }
    };

    const savePhysicalConsent = async () => {
        if (!selectedPatient || !uploadedFileName || !previewUrl) {
            toast.error('Please select a consent image first.');
            return;
        }

        setIsSavingConsent(true);

        try {
            const uploadedAt = new Date().toISOString();
            const physicalConsentPath = previewUrl?.startsWith('data:image')
                ? await uploadDataUrlImage(previewUrl, 'booking_signature', 'physical_consent')
                : previewUrl;
            let consentRecordId = null;
            let recordWarning = '';

            try {
                const recordData = await saveConsentFormRecord({
                    consent_type: 'Physical Consent Upload',
                    owner_user_id: numericId(selectedPatient.user_id),
                    pet_id: numericId(selectedPatient.pet_id),
                    queue_id: numericId(selectedPatient.queue_id),
                    booking_id: numericId(selectedPatient.booking_id),
                    service_name: getServiceDisplayName(selectedPatient.service_name, 'Queue'),
                    status: 'signed',
                    source: 'vet_my_list',
                    signed_at: uploadedAt,
                    physical_file_path: physicalConsentPath,
                    signer_name: ownerName(selectedPatient),
                    processed_by_user_id: numericId(veterinarianUserId),
                    processed_by_name: veterinarianName,
                    notes: `Physical consent uploaded: ${uploadedFileName}`
                });

                consentRecordId = recordData?.consent_record_id || null;
            } catch (recordError) {
                console.warn('Physical consent report tracking was not recorded:', recordError);
                recordWarning = recordError?.message || 'Consent report tracking was not recorded.';
            }

            setConsentRecords(current => ({
                ...current,
                [selectedPatient.queue_id]: {
                    ...(current[selectedPatient.queue_id] || {}),
                    consentRecordId,
                    physicalConsentName: uploadedFileName,
                    physicalConsentPath,
                    physicalConsentPreview: previewUrl,
                    physicalConsentUploadedAt: uploadedAt,
                    signedAt: current[selectedPatient.queue_id]?.signedAt || uploadedAt,
                    isTemporary: false
                }
            }));

            setUploadDialogOpen(false);
            setSelectedPatient(null);
            setUploadedFileName('');
            setPreviewUrl('');
            if (recordWarning) {
                toast.warning('The physical consent was uploaded, but report tracking was not updated. Refresh Reports later or contact an administrator.');
            } else {
                toast.success('Physical consent uploaded and tracked for reports.');
            }
        } catch (error) {
            toast.error(error.message || 'The physical consent could not be uploaded. Check the image and try again.');
        } finally {
            setIsSavingConsent(false);
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            toast.error('Please select a PNG, JPG, or WEBP image so the consent preview can be verified.');
            event.target.value = '';
            return;
        }

        setUploadedFileName('');
        setPreviewUrl('');
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            if (!result.startsWith('data:image/')) {
                toast.error('The selected image could not be previewed. Please choose another file.');
                event.target.value = '';
                return;
            }

            setUploadedFileName(file.name);
            setPreviewUrl(result);
        };
        reader.onerror = () => {
            setUploadedFileName('');
            setPreviewUrl('');
            event.target.value = '';
            toast.error('The selected image could not be read. Please try another PNG or JPG file.');
        };
        reader.readAsDataURL(file);
    };

    const cacheDiagnosisContext = (item, mode = 'edit') => {
        const consentRecord = getConsentRecord(item);

        try {
            sessionStorage.setItem('ipawcus-vet-diagnosis-context', JSON.stringify({
                mode,
                queueId: String(item.queue_id),
                queueNumber: item.queue_number ? String(item.queue_number) : '',
                queueReference: formatQueueReference(item),
                petId: String(item.pet_id || ''),
                petName: item.pet_name || 'Unknown Pet',
                petSpecies: item.pet_species || '',
                petBreed: item.pet_breed || '',
                petBirthDate: item.pet_BDAY || '',
                petAge: petAge(item),
                petGender: item.pet_gender || '',
                petWeight: item.pet_weight || '',
                petStatus: item.pet_status || '',
                petMicrochipId: item.pet_microchip || '',
                petAllergies: item.pet_allergies || '',
                petColor: item.pet_color_marking || '',
                petProfileImage: item.setpetImage_url || '',
                ownerUserId: item.user_id ? String(item.user_id) : '',
                ownerName: ownerName(item),
                ownerPhone: item.contactNumber || '',
                ownerAddress: item.address || '',
                serviceName: getServiceDisplayName(item.service_name, 'Queue'),
                complaint: item.complaint || '',
                priority: item.priority || '',
                queueSource: item.queue_source || '',
                bookingId: item.booking_id ? String(item.booking_id) : '',
                bookingNumber: item.related_booking_number || '',
                bookingNotes: item.booking_notes || '',
                bookingConcernPaths: item.booking_concern_paths || '',
                bookingSignaturePath: item.booking_signature_path || '',
                queueImagePath: item.image_path || '',
                queueSignaturePath: item.signiture_self_service_path || '',
                assignmentId: item.assignment_id ? String(item.assignment_id) : '',
                clinicalIntake: item.clinical_intake || null,
                signedConsentDocumentPath: consentRecord?.signedDocumentPath || '',
                signedConsentType: consentRecord?.consentName || '',
                signedConsentAt: consentRecord?.signedAt || '',
                physicalConsentPath: consentRecord?.physicalConsentPath || '',
                physicalConsentPreview: consentRecord?.physicalConsentPreview || ''
            }));
        } catch {
            // Diagnosis can still open without cached context; the page has safe fallbacks.
        }
    };

    const startDiagnosis = (item) => {
        if (queueScheduleDate(item) !== clinicTodayDate()) {
            toast.error('Diagnosis from My List is available only for today’s patients.');
            return;
        }
        const record = getConsentRecord(item);
        const intakeStatus = normalize(item.clinical_intake?.status || item.clinical_intake_status);

        if (intakeStatus !== 'completed') {
            toast.error('The assistant veterinarian must complete the physical examination before diagnosis can begin.');
            return;
        }

        if (!record?.signedAt && !record?.signedDocumentPath && !record?.physicalConsentPath) {
            toast.error('Please record consent before starting diagnosis.');
            return;
        }

        cacheDiagnosisContext(item, 'edit');

        navigate('/dashboard/vet/diagnosis');
    };

    return (
        <div className="care-workspace vet-my-list space-y-5 pb-24">
            <CarePageHeader
                icon={Stethoscope}
                title="My List"
                description="Review your assigned patients, check examination progress, and begin diagnosis."
                layout="stacked"
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" disabled={isBookingsLoading || Boolean(bookingsError) || !nextDate} onClick={() => openBookingPreview(nextDate)} className="gap-2" title={nextDate ? `View approved bookings for ${formatDisplayDate(nextDate)}` : 'No future approved bookings'}>
                            <CalendarDays className="size-4" />
                            {nextBookingDayLabel(nextDate, todayKey)}{nextDate ? ` (${nextBookings.length})` : ''}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/todos')} className="gap-2">All schedules</Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                loadQueue();
                                loadBookings();
                                loadConsentForms();
                            }}
                            disabled={isLoading}
                            className="gap-2"
                        >
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            <span>Refresh</span>
                        </Button>
                    </div>
                )}
            />

            <div className="vet-list-content space-y-5">
                <div className="vet-day-context">
                    <span><CalendarDays className="size-4" aria-hidden="true" />{formatDisplayDate(todayKey)}</span>
                    <span><RefreshCw className="size-3.5" aria-hidden="true" />Updates automatically</span>
                </div>

                <div className="vet-list-toolbar">
                    <div className="space-y-2">
                        <Label htmlFor="vet-list-search">Search patients and bookings</Label>
                        <Input
                            id="vet-list-search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search booking, queue, pet or owner"
                            className="h-10"
                            leftIcon={<Search className="size-4" />}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label id="vet-list-clinic-label">Clinic</Label>
                        <Select value={branchFilter} onValueChange={setBranchFilter} searchable={false}>
                            <SelectTrigger aria-labelledby="vet-list-clinic-label"><Building2 className="size-4 text-slate-500" /><SelectValue displayValue={branchFilter === 'all' ? 'All assigned clinics' : getBranchDisplayName(branches, branchFilter)} /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All assigned clinics</SelectItem>{branches.map(branch => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {searchQuery || branchFilter !== 'all' ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setBranchFilter('all'); }}>
                            <X className="size-4" />Clear filters
                        </Button>
                    ) : null}
                </div>

                {errorMessage && (
                    <div role="alert" className="vet-list-error">
                        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                        <p>{errorMessage}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => loadQueue()}>Retry patients</Button>
                    </div>
                )}

                <div className="vet-workspace-grid">
                    <section className="vet-list-panel" aria-labelledby="vet-patients-heading">
                        <div className="vet-panel-heading">
                            <div>
                                <h2 id="vet-patients-heading">In progress <span className="vet-section-count">{filteredReceivedItems.length}</span></h2>
                                <p>Examination progress and consent for today’s patients.</p>
                            </div>
                        </div>

                        {isLoading ? (
                            <LoadingState />
                        ) : errorMessage && !hasLoadedQueue ? (
                            <EmptyState message="Patients could not be loaded." description="Use Retry patients above to reconnect." />
                        ) : filteredReceivedItems.length === 0 ? (
                            <EmptyState message={searchQuery || branchFilter !== 'all' ? 'No patients match your filters.' : 'No patients in progress.'} description={searchQuery || branchFilter !== 'all' ? 'Try another name, queue reference, or clinic.' : 'Assigned patients appear here when their examination begins.'} />
                        ) : (
                            <div className="vet-patient-list">
                                {filteredReceivedItems.map(item => (
                                    <PatientCard
                                        key={item.queue_id}
                                        item={item}
                                        consentRecord={getConsentRecord(item)}
                                        onConsent={() => openConsentDialog(item)}
                                        onUploadConsent={() => openUploadDialog(item)}
                                        onStartDiagnosis={() => startDiagnosis(item)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="vet-list-panel vet-bookings" aria-labelledby="vet-bookings-heading">
                        <div className="vet-panel-heading">
                            <div>
                                <h2 id="vet-bookings-heading">Today’s bookings <span className="vet-section-count">{todayBookings.length}</span></h2>
                                <p>Your approved appointments, ordered by time.</p>
                            </div>
                            <CalendarDays className="size-4" aria-hidden="true" />
                        </div>
                        {isBookingsLoading ? <LoadingState /> : bookingsError ? <div role="alert" className="vet-list-error"><p>{bookingsError}</p><Button type="button" variant="outline" size="sm" onClick={() => loadBookings()}>Retry bookings</Button></div> : <VetBookingDayList compact bookings={todayBookings} getStatus={getBookingStatus} onSelect={booking => openBookingPreview(todayKey, booking)} emptyText="No approved bookings for today. Future bookings are in All schedules." />}
                    </section>
                </div>

                <section className="vet-list-panel" aria-labelledby="vet-completed-heading">
                    <div className="vet-panel-heading">
                        <div>
                            <h2 id="vet-completed-heading">Completed today <span className="vet-section-count">{filteredCompletedItems.length}</span></h2>
                            <p>Review completed visits or return a patient to your list.</p>
                        </div>
                        <div className="vet-view-switch" role="group" aria-label="Completed patient view">
                            <Button
                                type="button"
                                variant={completedViewMode === 'table' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCompletedViewMode('table')}
                                aria-pressed={completedViewMode === 'table'}
                            >
                                <List className="size-4" />
                                Table
                            </Button>
                            <Button
                                type="button"
                                variant={completedViewMode === 'cards' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCompletedViewMode('cards')}
                                aria-pressed={completedViewMode === 'cards'}
                            >
                                <LayoutGrid className="size-4" />
                                Cards
                            </Button>
                        </div>
                    </div>

                    {isLoading ? <LoadingState /> : filteredCompletedItems.length === 0 ? (
                        <EmptyState message={searchQuery || branchFilter !== 'all' ? 'No completed patients match your filters.' : 'No completed patients today.'} compact />
                    ) : (
                        <div data-completed-view={completedViewMode}>
                            <div className="vet-completed-cards">
                                <CompletedPatientsCards
                                    items={filteredCompletedItems}
                                    getConsentRecord={getConsentRecord}
                                    updatingQueueId={updatingQueueId}
                                    onReopen={(item) => updateQueueStatus(item.queue_id, 'in-progress')}
                                />
                            </div>
                            <div className="vet-completed-table">
                                <CompletedPatientsTable
                                    items={filteredCompletedItems}
                                    getConsentRecord={getConsentRecord}
                                    updatingQueueId={updatingQueueId}
                                    onReopen={(item) => updateQueueStatus(item.queue_id, 'in-progress')}
                                />
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <Button
                type="button"
                onClick={() => setGroomingReviewsOpen(true)}
                className="fixed bottom-5 right-5 z-40 h-12 gap-2 rounded-full bg-[#155dfc] px-4 text-white shadow-lg shadow-blue-900/20 hover:bg-[#0d4acf] sm:bottom-7 sm:right-7"
            >
                <Scissors className="size-5" />
                <span>Grooming reviews</span>
            </Button>

            <Dialog open={Boolean(bookingViewerDate)} onOpenChange={open => { if (!open) { setBookingViewerDate(''); setPreviewBookingId(''); } }}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{previewBooking ? previewBooking.bookingNumber || `Booking #${previewBooking.id}` : `${bookingViewerDate === todayKey ? 'Today' : nextBookingDayLabel(bookingViewerDate, todayKey)} — approved bookings`}</DialogTitle>
                        <DialogDescription>{formatDisplayDate(bookingViewerDate)} · {bookingViewerDate === todayKey ? 'Your assigned bookings for this date.' : 'Schedule preview only. Physical examination remains with the admin.'}</DialogDescription>
                    </DialogHeader>
                    {isBookingsLoading ? <LoadingState /> : bookingsError ? <div role="alert" className="space-y-3 text-sm text-red-600 dark:text-red-300"><p>{bookingsError}</p><Button type="button" variant="outline" onClick={() => loadBookings()}>Retry</Button></div> : previewBooking ? (
                        <div className="space-y-4">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewBookingId('')} className="gap-2"><ArrowLeft className="size-4" />Back to bookings</Button>
                            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{previewBooking.petName || 'Pet'}</h3><Badge className={`border-0 ${getBookingStatus(previewBooking).className}`}>{getBookingStatus(previewBooking).label}</Badge></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Detail label="Schedule" value={formatDisplayDateTime(previewBooking.date, previewBooking.time)} />
                                <Detail label="Service" value={vetBookingService(previewBooking)} />
                                <Detail label="Clinic" value={previewBooking.branchName} />
                                <Detail label="Owner" value={previewBooking.ownerName} />
                                <Detail label="Contact" value={previewBooking.ownerPhone} />
                                <Detail label="Pet" value={[previewBooking.petSpecies, previewBooking.petBreed].filter(Boolean).join(' · ')} />
                                <Detail label="Notes" value={previewBooking.notes} className="sm:col-span-2" />
                            </div>
                            {previewBooking.isOnlineConsultation ? <Button type="button" variant="outline" onClick={() => navigate('/dashboard/vet/online-consultations')}>Open online consultations</Button> : previewPatient && bookingViewerDate === todayKey && normalize(previewBooking.status) === 'confirmed' ? <Button type="button" disabled={normalize(previewPatient.clinical_intake?.status || previewPatient.clinical_intake_status) !== 'completed'} onClick={() => startDiagnosis(previewPatient)} className="gap-2"><Stethoscope className="size-4" />{normalize(previewPatient.clinical_intake?.status || previewPatient.clinical_intake_status) === 'completed' ? 'Open diagnosis' : 'Waiting for examination'}</Button> : <p className="text-sm text-slate-500 dark:text-slate-400">{bookingViewerDate === todayKey ? 'The admin starts the physical examination before this patient is ready for diagnosis.' : 'This future appointment is shown for planning only.'}</p>}
                        </div>
                    ) : <VetBookingDayList bookings={previewBookings} getStatus={getBookingStatus} onSelect={booking => setPreviewBookingId(String(booking.id))} />}
                    <DialogFooter><Button type="button" variant="outline" onClick={() => { setBookingViewerDate(''); setPreviewBookingId(''); }}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={groomingReviewsOpen} onOpenChange={setGroomingReviewsOpen}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Grooming reviews</DialogTitle>
                        <DialogDescription>Review grooming concerns assigned to you and record your assessment.</DialogDescription>
                    </DialogHeader>
                    <GroomingWorkspace mode="vet" />
                </DialogContent>
            </Dialog>

            <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
                <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
                    <DialogHeader>
                        <div className="px-5 pt-5">
                            <DialogTitle>Consent Signature</DialogTitle>
                            <DialogDescription>
                                Select the clinic consent template, place the owner signature in the document, then save it as an image.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 px-5 pb-2">
                        <div className="mx-auto max-w-2xl rounded-xl bg-slate-50 p-2">
                            <ConsentDocument
                                variant="compact"
                                title={selectedConsent?.file_name || selectedConsent?.name || 'Select a consent form'}
                                content={selectedConsent?.content || 'Choose a consent form to preview the official document.'}
                                signatureImage={signatureImage}
                                signerName={signerName.trim() || ownerName(selectedPatient || {})}
                                signedAt={signatureImage ? selectedConsentRecord?.signedAt || new Date().toLocaleString() : ''}
                                veterinarianName={veterinarianName}
                                veterinarianLicense={veterinarianLicense}
                                templateContext={{
                                    ownerName: signerName.trim() || ownerName(selectedPatient || {}),
                                    petName: selectedPatient?.pet_name,
                                    petSpecies: selectedPatient?.pet_species,
                                    petBreed: selectedPatient?.pet_breed,
                                    serviceName: selectedPatient?.service_name || selectedPatient?.service_type,
                                    branchName: selectedPatient?.branch_name,
                                    queueNumber: selectedPatient?.queue_number
                                }}
                            />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Consent Form</Label>
                                    <Select value={selectedConsentId} onValueChange={setSelectedConsentId}>
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder="Select consent form"
                                                displayValue={selectedConsent?.file_name || selectedConsent?.name}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {consentForms.map(form => (
                                                <SelectItem key={form.file_id} value={String(form.file_id)}>
                                                    {form.file_name || form.name || 'Consent Form'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Owner / Signer Name</Label>
                                    <Input
                                        value={signerName}
                                        onChange={(event) => setSignerName(event.target.value)}
                                        placeholder="Pet owner full name"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Owner Signature</Label>
                                    <SignatureCapture
                                        signature={signatureImage}
                                        onSignatureChange={setSignatureImage}
                                        disabled={!selectedConsentId}
                                    />
                                </div>
                                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-relaxed text-blue-700 md:col-span-2">
                                    The saved consent is generated from the document preview with the owner signature placed in the signature area.
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t bg-white px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setConsentDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={saveConsent}
                            disabled={isSavingConsent || !selectedConsentId || !signatureImage}
                            className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                        >
                            {isSavingConsent ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                            Save Signed Consent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Upload Physical Consent</DialogTitle>
                        <DialogDescription>
                            Attach a photo of the signed form for {selectedPatient?.pet_name || 'this patient'}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {!previewUrl ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-blue-300 hover:bg-blue-50"
                            >
                                <Upload className="mb-3 size-10 text-slate-500" />
                                <span className="font-bold text-slate-900">Choose consent image</span>
                                <span className="mt-1 text-sm font-medium text-slate-500">PNG or JPG</span>
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <ProtectedImage
                                        src={previewUrl}
                                        alt="Complete physical consent preview"
                                        className="max-h-[340px] w-full object-contain"
                                        fallbackClassName="min-h-48 w-full"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setUploadedFileName('');
                                        setPreviewUrl('');
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = '';
                                        }
                                    }}
                                    className="w-full"
                                >
                                    <X className="size-4" />
                                    Remove and choose another
                                </Button>
                            </div>
                        )}

                        {uploadedFileName && (
                            <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                                Selected: {uploadedFileName}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={savePhysicalConsent}
                            disabled={isSavingConsent || !uploadedFileName || !previewUrl}
                            className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                        >
                            {isSavingConsent ? <Loader2 className="size-4 animate-spin" /> : null}
                            Save Upload
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
function filterItems(items, searchQuery, branchFilter = 'all') {
    const query = normalize(searchQuery);
    const byBranch = items.filter(item => branchFilter === 'all' || String(item.branch_id) === branchFilter);

    if (!query) return byBranch;

    return byBranch.filter(item => {
        const searchableText = [
            formatQueueReference(item),
            item.pet_name,
            ownerName(item),
            getServiceDisplayName(item.service_name, ''),
            item.complaint,
            item.pet_species,
            item.pet_breed,
            item.priority,
            item.branch_name
        ].join(' ');

        return normalize(searchableText).includes(query);
    });
}

function PatientCard({ item, consentRecord, onConsent, onUploadConsent, onStartDiagnosis }) {
    const hasConsent = Boolean(
        consentRecord?.signedAt
        || consentRecord?.signedDocumentPath
        || consentRecord?.physicalConsentPath
    );
    const intakeStatus = normalize(item.clinical_intake?.status || item.clinical_intake_status);
    const examinationComplete = intakeStatus === 'completed';

    return (
        <article className="vet-patient-row" aria-label={`Patient ${item.pet_name || 'Unknown Pet'}, ${formatQueueReference(item)}`}>
            <div className="min-w-0">
                <PatientSummary item={item} />
                <dl className="vet-patient-context">
                    <div><dt>Owner</dt><dd>{ownerName(item)}</dd></div>
                    <div><dt>Service</dt><dd>{getServiceDisplayName(item.service_name, 'Queue')}</dd></div>
                </dl>
                {item.complaint ? <p className="vet-patient-complaint"><span>Concern</span>{item.complaint}</p> : null}
                <PatientDetails item={item} />
            </div>
            <div className="vet-patient-workflow">
                <Badge className={examinationComplete
                    ? 'border-0 bg-emerald-50 text-emerald-700'
                    : 'border-0 bg-amber-50 text-amber-700'}>
                    {examinationComplete ? 'Examination complete' : 'In examination'}
                </Badge>
                {getConsentBadge(consentRecord)}
                <div className="vet-patient-actions">
                {!hasConsent && (
                    <>
                        <Button type="button" variant="outline" size="sm" onClick={onConsent} aria-label={`Record consent for ${item.pet_name}`}>
                            <FileText className="size-4" />
                            Consent
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={onUploadConsent} aria-label={`Upload consent for ${item.pet_name}`}>
                            <Upload className="size-4" />
                            Upload
                        </Button>
                    </>
                )}
                <Button
                    type="button"
                    onClick={onStartDiagnosis}
                    variant={!hasConsent || !examinationComplete ? 'secondary' : 'default'}
                    disabled={!hasConsent || !examinationComplete}
                    aria-label={`Open diagnosis for ${item.pet_name}`}
                    aria-describedby={`vet-patient-requirement-${item.queue_id}`}
                    className="vet-diagnosis-action"
                >
                    <Stethoscope className="size-4" />
                    Open diagnosis
                </Button>
                </div>
                <p id={`vet-patient-requirement-${item.queue_id}`} className="vet-workflow-hint">
                    {!examinationComplete ? 'Complete examination before diagnosis.' : !hasConsent ? 'Record owner consent to continue.' : 'Ready to begin diagnosis.'}
                </p>
            </div>
        </article>
    );
}

function CompletedPatientsCards({ items, getConsentRecord, updatingQueueId, onReopen }) {
    return (
        <div className="vet-completed-grid">
            {items.map((item) => {
                const consentRecord = getConsentRecord(item);
                const isUpdating = updatingQueueId === item.queue_id;

                return (
                    <article key={item.queue_id} className="vet-completed-card">
                        <PatientSummary item={item} />
                        <dl className="vet-patient-context">
                            <div><dt>Owner</dt><dd>{ownerName(item)}</dd></div>
                            <div><dt>Service</dt><dd>{getServiceDisplayName(item.service_name, 'Queue')}</dd></div>
                            <div><dt>Completed</dt><dd>{formatQueueTime(item.completed_at || item.timestamp)}</dd></div>
                        </dl>
                        {item.complaint ? <p className="vet-patient-complaint">{item.complaint}</p> : null}
                        <div className="vet-completed-card-actions">
                            {getConsentBadge(consentRecord)}
                            <Button type="button" variant="outline" size="sm" onClick={() => onReopen(item)} disabled={isUpdating} aria-label={`Reopen visit for ${item.pet_name}`}>
                                {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                                Reopen
                            </Button>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

function CompletedPatientsTable({ items, getConsentRecord, updatingQueueId, onReopen }) {
    return (
        <Table aria-label="Completed patients" className="vet-completed-records">
            <TableHeader>
                <TableRow>
                    <TableHead>Patient / Queue</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => {
                    const consentRecord = getConsentRecord(item);
                    const isUpdating = updatingQueueId === item.queue_id;

                    return (
                        <TableRow key={item.queue_id}>
                            <TableCell>
                                <div className="vet-completed-identity"><strong>{item.pet_name || 'Unknown Pet'}</strong><span>{formatQueueReference(item)}</span></div>
                                <p className="vet-secondary">{ownerName(item)}</p>
                                <p className="vet-secondary">{[item.pet_species, item.pet_breed].filter(Boolean).join(' · ') || 'No pet profile details'}</p>
                            </TableCell>
                            <TableCell>
                                <p className="vet-record-service">{getServiceDisplayName(item.service_name, 'Queue')}</p>
                                <p className="vet-secondary">{item.branch_name || 'Main Clinic'}</p>
                                {item.complaint ? <p className="vet-secondary line-clamp-2">{item.complaint}</p> : null}
                            </TableCell>
                            <TableCell className="tabular-nums">
                                {formatQueueTime(item.completed_at || item.timestamp)}
                            </TableCell>
                            <TableCell>
                                {getConsentBadge(consentRecord)}
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => onReopen(item)} disabled={isUpdating} aria-label={`Reopen visit for ${item.pet_name}`}>
                                        {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                                        Reopen
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

function PatientSummary({ item }) {
    return (
        <div className="vet-patient-identity">
            <span className="vet-patient-avatar"><PawPrint className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
                <div className="vet-patient-title">
                    <h3>{item.pet_name || 'Unknown Pet'}</h3>
                    <span className="vet-queue-reference">{formatQueueReference(item)}</span>
                    {getPriorityBadge(item.priority)}
                </div>
                <p className="vet-secondary">{[item.pet_species, item.pet_breed].filter(Boolean).join(' · ') || 'No pet profile details'}</p>
                <p className="vet-secondary">{item.branch_name || 'Main Clinic'}</p>
            </div>
        </div>
    );
}

function PatientDetails({ item }) {
    return (
        <details className="vet-patient-details">
            <summary>Patient details<ChevronDown className="size-3.5" aria-hidden="true" /></summary>
            <div className="vet-patient-detail-grid">
                <Detail label="Contact" value={item.contactNumber} />
                <Detail label="Age" value={petAge(item)} />
                <Detail label="Weight" value={item.pet_weight ? `${item.pet_weight} kg` : ''} />
                <Detail label="Received" value={formatQueueTime(item.received_at || item.timestamp)} />
            </div>
        </details>
    );
}

function Detail({ label, value, className = '' }) {
    return (
        <div className={className}>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                {value || <span className="text-slate-600 dark:text-slate-300">Not recorded</span>}
            </p>
        </div>
    );
}

function getPriorityBadge(priority) {
    const normalizedPriority = normalizeQueuePriority(priority);
    if (normalizedPriority === 'urgent') return (
        <Badge className="border-0 bg-red-600 text-white">
            <AlertTriangle className="mr-1 size-3" />
            Urgent
        </Badge>
    );
    if (normalizedPriority === 'low-test') return (
        <Badge className="border border-blue-200 bg-blue-50 text-blue-700">Low-test</Badge>
    );
    return null;
}

function getConsentBadge(record) {
    if (!record?.signedAt && !record?.signedDocumentPath && !record?.physicalConsentPath) {
        return <span className="vet-consent" data-state="missing"><FileText className="size-3.5" aria-hidden="true" />Consent needed</span>;
    }

    if (record.physicalConsentUploadedAt) {
        return <span className="vet-consent" data-state="signed"><FileCheck2 className="size-3.5" aria-hidden="true" />Physical consent</span>;
    }

    if (record.isTemporary) {
        return <span className="vet-consent" data-state="temporary"><FileText className="size-3.5" aria-hidden="true" />Temporary consent</span>;
    }

    return <span className="vet-consent" data-state="signed"><FileCheck2 className="size-3.5" aria-hidden="true" />Signed consent</span>;
}

function LoadingState() {
    return (
        <div className="vet-list-loading" role="status">
            <span className="sr-only">Loading veterinarian list...</span>
            {[1, 2].map(row => <div key={row} className="vet-loading-row" aria-hidden="true"><span /><span /><span /></div>)}
        </div>
    );
}

function EmptyState({ message, description, compact = false }) {
    return (
        <div className={`vet-list-empty ${compact ? 'vet-list-empty-compact' : ''}`}>
            {compact ? <CheckCircle2 className="size-6" aria-hidden="true" /> : <Stethoscope className="size-6" aria-hidden="true" />}
            <h3>{message}</h3>
            {description ? <p>{description}</p> : null}
        </div>
    );
}
