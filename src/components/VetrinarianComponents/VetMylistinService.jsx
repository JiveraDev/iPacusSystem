import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    Stethoscope,
    Undo2,
    Upload,
    X
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '../../reusecomponent/toast.jsx';
import { calculateAge, formatDisplayDateTime } from '../../lib/date';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import SignatureCapture from '../SignatureCapture.jsx';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import { createConsentDocumentImage } from '../shared/consentDocumentImage.js';
import { fetchConsentFiles } from '../../services/consentFileService';
import { fetchProfile } from '../../services/profileService';
import {
    fetchQueues,
    returnQueue as returnQueueService,
    updateQueueStatus as updateQueueStatusService
} from '../../services/queueService';
import { deleteUpload, uploadDataUrlImage } from '../../services/uploadService';

const CONSENT_STORAGE_KEY = 'ipawcus-vet-my-list-consents';

const FALLBACK_CONSENT_FORMS = [
    {
        file_id: 'general',
        file_name: 'General Medical Consent',
        category: 'consultation',
        content: [
            'GENERAL MEDICAL CONSENT FORM',
            '',
            'I authorize Ipawcus Veterinary Clinic to perform necessary examination, diagnostic, and treatment procedures for my pet.',
            '',
            'I understand that all medical procedures carry risk and that I am responsible for the charges incurred.'
        ].join('\n')
    },
    {
        file_id: 'surgery',
        file_name: 'Surgical Procedure Consent',
        category: 'surgery',
        content: [
            'SURGICAL PROCEDURE CONSENT FORM',
            '',
            'I authorize the veterinarian to perform the discussed surgical procedure and related care for my pet.',
            '',
            'I understand that anesthesia and surgery carry inherent risks.'
        ].join('\n')
    }
];

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function isReceived(item) {
    return normalize(item.status) === 'in-progress' && normalize(item.assignment_status) === 'received';
}

function isCompleted(item) {
    const status = normalize(item.status);
    return normalize(item.assignment_status) === 'completed' || status === 'completed' || status === 'done';
}

function isPastQueueDate(value) {
    if (!value) return false;

    const queueDate = new Date(value);

    if (Number.isNaN(queueDate.getTime())) {
        return false;
    }

    const today = new Date();
    queueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return queueDate < today;
}

function isCurrentDate(value) {
    if (!value) return false;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    const today = new Date();

    return (
        date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate()
    );
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

async function deleteUploadedFile(path) {
    if (!path || String(path).startsWith('data:')) return;

    try {
        await deleteUpload({ path });
    } catch {
        // Local consent cleanup should not be blocked by a missing file.
    }
}

function deleteConsentFiles(record) {
    [
        record?.signedDocumentPath,
        record?.physicalConsentPath
    ].filter(Boolean).forEach(deleteUploadedFile);
}

export default function VetMyList() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const veterinarianUserId = getUserId(currentUser);
    const veterinarianName = getUserName(currentUser);
    const fileInputRef = useRef(null);
    const autoReturnedQueueIdsRef = useRef(new Set());
    const [queue, setQueue] = useState([]);
    const [consentForms, setConsentForms] = useState(FALLBACK_CONSENT_FORMS);
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
    const [selectedConsentId, setSelectedConsentId] = useState('');
    const [signerName, setSignerName] = useState('');
    const [signatureImage, setSignatureImage] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');

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

        staleQueueIds.forEach(queueId => deleteConsentFiles(consentRecords[queueId]));

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

            if (Array.isArray(data) && data.length > 0) {
                setConsentForms(data);
            }
        } catch {
            setConsentForms(FALLBACK_CONSENT_FORMS);
        }
    };

    useAutoRefresh(loadQueue);
    useAutoRefresh(loadConsentForms, { intervalMs: 15000, refreshKey: 'vet-consent-files' });

    const assignedQueue = useMemo(() => {
        if (!veterinarianUserId) return [];

        return queue.filter(item =>
            String(item.veterinarian_user_id || '') === String(veterinarianUserId)
        );
    }, [queue, veterinarianUserId]);

    const receivedItems = useMemo(() => {
        return assignedQueue
            .filter(isReceived)
            .sort((a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0));
    }, [assignedQueue]);

    const completedItems = useMemo(() => {
        return assignedQueue
            .filter(isCompleted)
            .filter(item => isCurrentDate(item.completed_at || item.timestamp))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [assignedQueue]);

    const filteredReceivedItems = useMemo(() => filterItems(receivedItems, searchQuery), [receivedItems, searchQuery]);
    const filteredCompletedItems = useMemo(() => filterItems(completedItems, searchQuery), [completedItems, searchQuery]);
    const urgentCount = receivedItems.filter(item => normalize(item.priority) === 'urgent').length;

    const selectedConsent = consentForms.find(form => String(form.file_id) === selectedConsentId);

    const getConsentRecord = (item) => consentRecords[item.queue_id] || null;
    const selectedConsentRecord = selectedPatient ? getConsentRecord(selectedPatient) : null;

    const deleteConsentRecord = useCallback((queueId, { deleteFiles = false } = {}) => {
        const record = consentRecords[String(queueId)];

        if (deleteFiles) {
            deleteConsentFiles(record);
        }

        setConsentRecords(current => {
            const key = String(queueId);

            if (!Object.prototype.hasOwnProperty.call(current, key)) {
                return current;
            }

            const nextRecords = { ...current };
            delete nextRecords[key];
            return nextRecords;
        });
    }, [consentRecords]);

    useEffect(() => {
        if (!veterinarianUserId || receivedItems.length === 0) return;

        const expiredItems = receivedItems.filter(item => {
            const queueId = String(item.queue_id || '');

            return queueId
                && isPastQueueDate(item.timestamp)
                && !autoReturnedQueueIdsRef.current.has(queueId);
        });

        if (expiredItems.length === 0) return;

        let isActive = true;
        expiredItems.forEach(item => autoReturnedQueueIdsRef.current.add(String(item.queue_id)));

        const returnExpiredItems = async () => {
            const results = await Promise.allSettled(expiredItems.map(async item => {
                const data = await returnQueueService({
                    queue_id: item.queue_id,
                    veterinarian_user_id: veterinarianUserId,
                    return_reason: 'Returned automatically because queue date passed'
                });

                if (!data.success) {
                    throw new Error(data.error || data.message || 'Failed to auto-return expired queue patient.');
                }

                return item.queue_id;
            }));

            if (!isActive) return;

            const returnedQueueIds = [];

            results.forEach((result, index) => {
                const queueId = String(expiredItems[index].queue_id);

                if (result.status === 'fulfilled') {
                    returnedQueueIds.push(result.value);
                    return;
                }

                autoReturnedQueueIdsRef.current.delete(queueId);
                console.error('Failed to auto-return expired queue patient:', result.reason);
            });

            if (returnedQueueIds.length === 0) return;

            setQueue(current =>
                current.map(item =>
                    returnedQueueIds.includes(item.queue_id)
                        ? {
                            ...item,
                            assignment_status: 'returned',
                            returned_at: new Date().toISOString(),
                            has_active_assignment: 0
                        }
                        : item
                )
            );
            returnedQueueIds.forEach(queueId => deleteConsentRecord(queueId, { deleteFiles: true }));
        };

        returnExpiredItems();

        return () => {
            isActive = false;
        };
    }, [deleteConsentRecord, receivedItems, veterinarianUserId]);

    const updateQueueStatus = async (queueId, status) => {
        setUpdatingQueueId(queueId);

        try {
            const data = await updateQueueStatusService({ queue_id: queueId, status });

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
            toast.error(error.message || 'Failed to update patient.');
        } finally {
            setUpdatingQueueId(null);
        }
    };

    const returnToApprovedList = async (queueId) => {
        if (!veterinarianUserId) {
            toast.error('Could not identify the current veterinarian account.');
            return;
        }

        setUpdatingQueueId(queueId);

        try {
            const data = await returnQueueService({
                queue_id: queueId,
                veterinarian_user_id: veterinarianUserId,
                return_reason: 'Returned from veterinarian My List'
            });

            if (!data.success) {
                throw new Error(data.error || data.message || 'Failed to return patient to approved list.');
            }

            setQueue(current =>
                current.map(item =>
                    item.queue_id === queueId
                        ? {
                            ...item,
                            assignment_status: 'returned',
                            returned_at: new Date().toISOString(),
                            has_active_assignment: 0
                        }
                        : item
                )
            );
            deleteConsentRecord(queueId, { deleteFiles: true });
            toast.success('Patient returned to the approved queue list.');
        } catch (error) {
            toast.error(error.message || 'Failed to return patient.');
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
        setPreviewUrl(record?.physicalConsentPreview || '');
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
            const signedAt = new Date().toLocaleString();
            const signedDocumentImage = await createConsentDocumentImage({
                title: selectedConsent?.file_name || selectedConsent?.name || 'Consent Form',
                content: selectedConsent?.content || '',
                signatureImage,
                signerName: signerName.trim() || ownerName(selectedPatient),
                signedAt,
                veterinarianName,
                veterinarianLicense
            });
            const signedDocumentPath = await uploadDataUrlImage(signedDocumentImage, 'booking_signature', 'signed_consent');

            setConsentRecords(current => ({
                ...current,
                [selectedPatient.queue_id]: {
                    ...(current[selectedPatient.queue_id] || {}),
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
            toast.success('Signed consent document saved as an image.');
        } catch (error) {
            toast.error(error.message || 'Failed to save signed consent.');
        } finally {
            setIsSavingConsent(false);
        }
    };

    const savePhysicalConsent = () => {
        if (!selectedPatient || !uploadedFileName) {
            toast.error('Please select a consent image first.');
            return;
        }

        setConsentRecords(current => ({
            ...current,
            [selectedPatient.queue_id]: {
                ...(current[selectedPatient.queue_id] || {}),
                physicalConsentName: uploadedFileName,
                physicalConsentPreview: previewUrl,
                physicalConsentUploadedAt: new Date().toISOString(),
                isTemporary: false
            }
        }));

        setUploadDialogOpen(false);
        setSelectedPatient(null);
        setUploadedFileName('');
        setPreviewUrl('');
        toast.success('Physical consent attached locally.');
    };

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file.');
            event.target.value = '';
            return;
        }

        setUploadedFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(String(reader.result || ''));
        reader.readAsDataURL(file);
    };

    const cacheDiagnosisContext = (item, mode = 'edit') => {
        const consentRecord = getConsentRecord(item);

        try {
            sessionStorage.setItem('ipawcus-vet-diagnosis-context', JSON.stringify({
                mode,
                queueId: String(item.queue_id),
                queueNumber: item.queue_number ? String(item.queue_number) : '',
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
                signedConsentDocumentPath: consentRecord?.signedDocumentPath || '',
                physicalConsentPath: consentRecord?.physicalConsentPath || '',
                physicalConsentPreview: consentRecord?.physicalConsentPreview || ''
            }));
        } catch {
            // Diagnosis can still open without cached context; the page has safe fallbacks.
        }
    };

    const startDiagnosis = (item) => {
        const record = getConsentRecord(item);

        if (!record?.signedAt) {
            toast.error('Please record consent before starting diagnosis.');
            return;
        }

        cacheDiagnosisContext(item, 'edit');

        navigate('/dashboard/vet/diagnosis');
    };

    const viewRecord = (item) => {
        cacheDiagnosisContext(item, 'view');
        navigate('/dashboard/vet/diagnosis');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#101828]">My List</h2>
                    <p className="text-sm font-medium text-slate-500">
                        Received queue patients assigned to veterinarian handling.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        loadQueue();
                        loadConsentForms();
                    }}
                    disabled={isLoading}
                    className="w-full gap-2 sm:w-auto"
                >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatCard icon={Clock} label="In Progress" value={receivedItems.length} tone="blue" />
                <StatCard icon={CheckCircle} label="Done" value={completedItems.length} tone="green" />
                <StatCard icon={AlertTriangle} label="Urgent" value={urgentCount} tone="red" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search pet, owner, queue #, service, or complaint"
                        className="h-10 pl-10"
                    />
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {errorMessage}
                </div>
            )}

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">In Progress</h3>
                    <Badge className="border-0 bg-blue-50 text-blue-700">{filteredReceivedItems.length} patients</Badge>
                </div>

                {isLoading ? (
                    <LoadingState />
                ) : filteredReceivedItems.length === 0 ? (
                    <EmptyState message="No received queue patients found." />
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {filteredReceivedItems.map(item => (
                            <PatientCard
                                key={item.queue_id}
                                item={item}
                                consentRecord={getConsentRecord(item)}
                                isUpdating={updatingQueueId === item.queue_id}
                                onConsent={() => openConsentDialog(item)}
                                onUploadConsent={() => openUploadDialog(item)}
                                onStartDiagnosis={() => startDiagnosis(item)}
                                onReturnToApproved={() => returnToApprovedList(item.queue_id)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Done</h3>
                    <Badge className="border-0 bg-green-50 text-green-700">{filteredCompletedItems.length} patients</Badge>
                </div>

                {filteredCompletedItems.length === 0 ? (
                    <EmptyState message="No completed queue patients found." compact />
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {filteredCompletedItems.map(item => (
                            <CompletedPatientCard
                                key={item.queue_id}
                                item={item}
                                consentRecord={getConsentRecord(item)}
                                isUpdating={updatingQueueId === item.queue_id}
                                onView={() => viewRecord(item)}
                                onUploadConsent={() => openUploadDialog(item)}
                                onReopen={() => updateQueueStatus(item.queue_id, 'in-progress')}
                            />
                        ))}
                    </div>
                )}
            </section>

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
                            />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Consent Form</Label>
                                    <Select value={selectedConsentId} onValueChange={setSelectedConsentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select consent form" />
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
                            accept="image/*"
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
                                    <img src={previewUrl} alt="Consent preview" className="max-h-[340px] w-full object-contain" />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setUploadedFileName('');
                                        setPreviewUrl('');
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
                        <Button type="button" onClick={savePhysicalConsent} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            Save Upload
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function filterItems(items, searchQuery) {
    const query = normalize(searchQuery);

    if (!query) return items;

    return items.filter(item => {
        const searchableText = [
            item.queue_number ? `#${item.queue_number}` : '',
            item.pet_name,
            ownerName(item),
            getServiceDisplayName(item.service_name, ''),
            item.complaint,
            item.pet_species,
            item.pet_breed,
            item.priority
        ].join(' ');

        return normalize(searchableText).includes(query);
    });
}

function StatCard({ icon, label, value, tone }) {
    const Icon = icon;
    const toneClasses = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-50 text-green-700',
        red: 'bg-red-50 text-red-700'
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`flex size-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
                    <Icon className="size-5" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-500">{label}</p>
                    <p className="text-3xl font-black leading-tight text-slate-900">{value}</p>
                </div>
            </div>
        </div>
    );
}

function PatientCard({ item, consentRecord, isUpdating, onConsent, onUploadConsent, onStartDiagnosis, onReturnToApproved }) {
    const hasConsent = Boolean(consentRecord?.signedAt);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <PatientSummary item={item} />
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {getPriorityBadge(item.priority)}
                    {getConsentBadge(consentRecord)}
                </div>
            </div>

            <PatientDetails item={item} />

            <div className={`mt-5 grid gap-2 sm:grid-cols-2 ${hasConsent ? 'xl:grid-cols-2' : 'xl:grid-cols-4'}`}>
                {!hasConsent && (
                    <>
                        <Button type="button" variant="outline" onClick={onConsent}>
                            <FileText className="size-4" />
                            Consent
                        </Button>
                        <Button type="button" variant="outline" onClick={onUploadConsent}>
                            <Upload className="size-4" />
                            Upload
                        </Button>
                    </>
                )}
                <Button
                    type="button"
                    onClick={onStartDiagnosis}
                    disabled={!hasConsent}
                    className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                >
                    <Stethoscope className="size-4" />
                    Diagnosis
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onReturnToApproved}
                    disabled={isUpdating}
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                    <Undo2 className="size-4" />
                    Return
                </Button>
            </div>
        </div>
    );
}

function CompletedPatientCard({ item, consentRecord, isUpdating, onView, onUploadConsent, onReopen }) {
    const hasConsent = Boolean(consentRecord?.signedAt);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <PatientSummary item={item} />
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Badge className="border-0 bg-green-50 text-green-700">Done</Badge>
                    {getConsentBadge(consentRecord)}
                </div>
            </div>

            <PatientDetails item={item} />

            <div className={`mt-5 grid gap-2 ${hasConsent ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                <Button type="button" variant="outline" onClick={onView}>
                    <Eye className="size-4" />
                    View
                </Button>
                {!hasConsent && (
                    <Button type="button" variant="outline" onClick={onUploadConsent}>
                        <Upload className="size-4" />
                        Upload Consent
                    </Button>
                )}
                <Button type="button" onClick={onReopen} disabled={isUpdating} className="bg-slate-900 text-white hover:bg-slate-800">
                    {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                    Reopen
                </Button>
            </div>
        </div>
    );
}

function PatientSummary({ item }) {
    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-xl font-black text-slate-900">{item.pet_name || 'Unknown Pet'}</h4>
                <Badge className="border-0 bg-blue-50 text-blue-700">Queue #{item.queue_number}</Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">
                {[item.pet_species, item.pet_breed].filter(Boolean).join(' - ') || 'No pet profile details'}
            </p>
        </div>
    );
}

function PatientDetails({ item }) {
    return (
        <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
            <Detail label="Owner" value={ownerName(item)} />
            <Detail label="Service" value={getServiceDisplayName(item.service_name, 'Queue')} />
            <Detail label="Received" value={formatQueueTime(item.received_at || item.timestamp)} />
            <Detail label="Contact" value={item.contactNumber} />
            <Detail label="Age" value={petAge(item)} />
            <Detail label="Weight" value={item.pet_weight ? `${item.pet_weight} kg` : ''} />
            <Detail label="Complaint" value={item.complaint} className="md:col-span-2" />
        </div>
    );
}

function Detail({ label, value, className = '' }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-semibold text-slate-700">
                {value || <span className="text-slate-300">N/A</span>}
            </p>
        </div>
    );
}

function getPriorityBadge(priority) {
    return normalize(priority) === 'urgent' ? (
        <Badge className="border-0 bg-red-600 text-white">
            <AlertTriangle className="mr-1 size-3" />
            Urgent
        </Badge>
    ) : (
        <Badge className="border-0 bg-slate-100 text-slate-700">Normal</Badge>
    );
}

function getConsentBadge(record) {
    if (!record?.signedAt) {
        return <Badge className="border-0 bg-red-50 text-red-700">No Consent</Badge>;
    }

    if (record.physicalConsentUploadedAt) {
        return <Badge className="border-0 bg-green-50 text-green-700">Physical Consent</Badge>;
    }

    if (record.isTemporary) {
        return <Badge className="border-0 bg-amber-50 text-amber-700">Temporary Consent</Badge>;
    }

    return <Badge className="border-0 bg-green-50 text-green-700">Signed Consent</Badge>;
}

function LoadingState() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
            <Loader2 className="mx-auto mb-3 size-6 animate-spin text-[#155dfc]" />
            Loading veterinarian list...
        </div>
    );
}

function EmptyState({ message, compact = false }) {
    return (
        <div className={`rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm font-semibold text-slate-400 ${compact ? 'p-6' : 'p-10'}`}>
            {message}
        </div>
    );
}
