import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Award,
    BadgeCheck,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Download,
    Eye,
    FileText,
    FolderOpen,
    GripVertical,
    Loader2,
    PawPrint,
    PenLine,
    Pencil,
    Pill,
    Plus,
    Search,
    Stethoscope,
    Syringe,
    Trash2,
    Upload
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { downloadConsentDocument, openProtectedDocument } from '../../hooks/useConsentDocumentSource';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { formatDisplayDate } from '../../lib/date';
import { dedupeClinicalFields } from '../../lib/clinicalRecord';
import { resolveImageUrl } from '../../lib/image';
import { formatQueueReference } from '../../lib/referenceNumbers';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import PrescriptionPlanPanel from '../shared/PrescriptionPlanPanel.jsx';
import { fetchProfile } from '../../services/profileService';
import { uploadDataUrlImage, uploadDocumentFile } from '../../services/uploadService';
import {
    addPetMedicalRecordGroupItem,
    createPetMedicalRecordGroup,
    deletePetMedicalRecordGroup,
    fetchAllPets,
    fetchPetMedicalRecords,
    removePetMedicalRecordGroupItem,
    savePetMedicalRecord,
    updatePetMedicalRecordGroup,
    updatePetMedicalRecordGroupItem
} from '../../services/petService';
import { fetchRecordUpdateRequests, updateRecordUpdateRequest } from '../../services/recordUpdateRequestService';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import EditPetInformationDialog from '../shared/EditPetInformationDialog.jsx';
import PetCertificateDialog from '../shared/PetCertificateDialog.jsx';
import SignatureCapture from '../SignatureCapture.jsx';
import { fetchPetCertificates, issuePetMedicalCertificate } from '../../services/petCertificateService';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function userId(user) {
    return user?.user_id || user?.userId || user?.id || null;
}

function userDisplayName(user) {
    const firstName = user?.first_Name || user?.firstName || user?.first_name || '';
    const lastName = user?.last_Name || user?.lastName || user?.last_name || '';
    const composedName = [firstName, lastName].filter(Boolean).join(' ').trim();

    return composedName || user?.fullName || user?.full_name || user?.name || '';
}

function userLicenseNumber(user) {
    return user?.prc_license_number
        || user?.licenseNumber
        || user?.license_number
        || user?.prcLicenseNumber
        || '';
}

function petLabel(pet) {
    return [pet?.petName || pet?.name, pet?.species, pet?.breed].filter(Boolean).join(' - ') || 'Select pet';
}

function recordKey(record) {
    return `${record.sourceType}:${record.sourceId}`;
}

function sourceLabel(record) {
    if (record.sourceType === 'grooming') return record.bookingNumber ? `Grooming · ${record.bookingNumber}` : 'Grooming record';
    if (record.sourceType === 'boarding') return record.bookingNumber ? `Boarding · ${record.bookingNumber}` : 'Boarding record';
    if (record.bookingNumber) return `Booking ${record.bookingNumber}`;
    if (record.queueNumber) return formatQueueReference(record);
    if (record.sourceType === 'vaccination') return 'Vaccination record';
    return record.sourceType === 'visit' ? 'Clinical visit' : 'Diagnosis record';
}

const MEDICAL_RECORD_DRAG_TYPE = 'application/x-ipawcus-medical-record';

function dragPayload(kind, record) {
    return JSON.stringify({ kind, record });
}

function readDraggedRecord(event) {
    const raw = event.dataTransfer.getData(MEDICAL_RECORD_DRAG_TYPE)
        || event.dataTransfer.getData('application/json');

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.record || parsed;
}

function addedToGroup(record, groupId) {
    return asArray(record?.addedToGroups).some(group => String(group.groupId) === String(groupId));
}

function vaccinationTitle(vaccine) {
    return vaccine?.name || 'Vaccination record';
}

function vaccinationSummary(vaccine) {
    return [
        `Vaccine: ${vaccine?.name || 'N/A'}`,
        `Date given: ${formatDisplayDate(vaccine?.date)}`,
        `Next due: ${formatDisplayDate(vaccine?.nextDue)}`,
        `Veterinarian: ${vaccine?.applicator || vaccine?.veterinarianName || 'N/A'}`,
        vaccine?.notes ? `Notes: ${vaccine.notes}` : ''
    ].filter(Boolean).join('\n');
}

function vaccinationSourceRecord(vaccine) {
    return {
        id: `vaccination-${vaccine?.id}`,
        sourceType: 'vaccination',
        sourceId: vaccine?.id,
        title: vaccinationTitle(vaccine),
        summary: vaccinationSummary(vaccine),
        serviceDate: vaccine?.date || vaccine?.nextDue || '',
        status: vaccine?.status || 'completed',
        veterinarianName: vaccine?.applicator || vaccine?.veterinarianName || '',
        addedToGroups: vaccine?.addedToGroups || [],
        isAddedToOrganizedRecord: vaccine?.isAddedToOrganizedRecord || false
    };
}

function cleanOrganizedSummary(value) {
    return String(value || '')
        .split(/\r?\n/)
        .filter(line => !/^service\s*:/i.test(line.trim()))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function organizedRecordTitle(record) {
    if (String(record?.sourceType || '').toLowerCase() === 'diagnosis' || record?.diagnosis) {
        return 'Diagnosis Summary';
    }

    return record?.title || sourceLabel(record);
}

function organizedItemTitle(item) {
    const title = String(item?.title || '').trim();
    return title.toLowerCase() === 'source diagnosis sheet' ? 'Diagnosis Summary' : (title || 'Clinical record');
}

function editorLabel(name) {
    const value = String(name || '').trim();
    if (!value) return '';

    return value.toLowerCase().startsWith('dr.') ? value : `Dr. ${value}`;
}

function imageUrl(attachment) {
    return resolveImageUrl(attachment?.url || attachment?.relativeUrl || '');
}

function recordAttachments(record) {
    const seen = new Set();
    return [...asArray(record?.attachments), ...asArray(record?.sourceUploads)].filter((attachment) => {
        const key = String(attachment?.url || attachment?.relativeUrl || attachment?.id || '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const REVISION_CLINICAL_FIELDS = [
    'chiefComplaint',
    'majorSymptoms',
    'symptoms',
    'physicalExam',
    'diagnosis',
    'recommendations',
    'treatment',
    'medications',
    'labResults',
    'followUp',
    'notes'
];

function revisionSnapshotForItem(item) {
    const source = item?.sourceSnapshot && typeof item.sourceSnapshot === 'object'
        ? item.sourceSnapshot
        : {};
    const savedRevision = item?.revisionSnapshot && typeof item.revisionSnapshot === 'object'
        ? item.revisionSnapshot
        : {};
    const snapshot = {};

    REVISION_CLINICAL_FIELDS.forEach((field) => {
        snapshot[field] = Object.prototype.hasOwnProperty.call(savedRevision, field)
            ? String(savedRevision[field] || '')
            : String(source[field] || '');
    });

    snapshot.revisionAttachments = asArray(savedRevision.revisionAttachments);
    return snapshot;
}

function effectiveItemRecord(item) {
    const source = item?.sourceSnapshot && typeof item.sourceSnapshot === 'object'
        ? item.sourceSnapshot
        : {};
    const revision = item?.revisionSnapshot && typeof item.revisionSnapshot === 'object'
        ? item.revisionSnapshot
        : {};
    const sourceAttachments = recordAttachments(source);
    const revisionAttachments = asArray(revision.revisionAttachments);
    const seen = new Set();
    const attachments = [...sourceAttachments, ...revisionAttachments].filter((attachment, index) => {
        const key = String(attachment?.url || attachment?.relativeUrl || attachment?.id || index).trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return {
        ...source,
        ...revision,
        attachments,
        sourceUploads: []
    };
}

function isImage(attachment) {
    const mime = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || attachment?.relativeUrl || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

function prescriptionCount(record) {
    return asArray(record?.prescriptions).length
        + asArray(record?.customSections).reduce((count, section) => (
            count + asArray(section?.prescriptions || section?.prescription).length
        ), 0);
}

function formatCurrency(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `PHP ${amount.toFixed(2)}` : 'PHP 0.00';
}

function readRecordUpdateContext() {
    if (typeof window === 'undefined') {
        return { petId: '', requestId: '' };
    }

    const params = new URLSearchParams(window.location.search);
    const petId = window.sessionStorage.getItem('vet-record-update-pet-id') || params.get('petId') || '';
    const requestId = window.sessionStorage.getItem('vet-record-update-request-id') || params.get('requestId') || '';

    window.sessionStorage.removeItem('vet-record-update-pet-id');
    window.sessionStorage.removeItem('vet-record-update-request-id');

    return { petId: String(petId || ''), requestId: String(requestId || '') };
}

function isRecordRequestPaid(request) {
    return ['verified', 'waived'].includes(String(request?.paymentStatus || '').toLowerCase());
}

function localDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addCalendarDays(value, days) {
    const source = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
        ? new Date(`${value}T00:00:00`)
        : new Date();
    source.setDate(source.getDate() + days);
    return localDateInputValue(source);
}

function emptyMedicalCertificateDraft() {
    const examinationDate = localDateInputValue();
    const initialFinding = 'Based on the clinical examination performed on the date stated, the patient was clinically stable at the time of examination. This certificate records the attending veterinarian\'s findings and does not by itself serve as travel, quarantine, vaccination, or disease-free clearance.';

    return {
        examinationDate,
        validUntil: addCalendarDays(examinationDate, 30),
        clinicalFindings: initialFinding,
        signature: ''
    };
}

function autosaveText(status) {
    if (status === 'saving') return 'Autosaving...';
    if (status === 'saved') return 'Autosaved';
    if (status === 'error') return 'Autosave failed';
    return '';
}

function groupDraftSignature(draft) {
    return JSON.stringify({
        title: String(draft?.title || '').trim(),
        summary: draft?.summary || '',
        visibleToOwner: draft?.visibleToOwner !== false
    });
}

function itemDraftSignature(draft) {
    return JSON.stringify({
        title: String(draft?.title || '').trim() || 'Clinical record',
        summary: draft?.summary || '',
        revisionNotes: draft?.revisionNotes || '',
        revisionSnapshot: draft?.revisionSnapshot || {}
    });
}

export default function VetPetsEMR() {
    const currentUser = useDashboardUser();
    const currentUserId = userId(currentUser);
    const [veterinarianProfile, setVeterinarianProfile] = useState(null);
    const [pets, setPets] = useState([]);
    const [petSearch, setPetSearch] = useState('');
    const [selectedPetId, setSelectedPetId] = useState('');
    const [recordsData, setRecordsData] = useState(null);
    const [isLoadingPets, setIsLoadingPets] = useState(true);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [isPetSearchOpen, setIsPetSearchOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [editingGroupId, setEditingGroupId] = useState('');
    const [groupDraft, setGroupDraft] = useState({ title: '', summary: '', visibleToOwner: true });
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [groupAutosaveStatus, setGroupAutosaveStatus] = useState('idle');
    const [editingItem, setEditingItem] = useState(null);
    const [itemDraft, setItemDraft] = useState({
        title: '',
        summary: '',
        revisionNotes: '',
        revisionSnapshot: {}
    });
    const [itemAutosaveStatus, setItemAutosaveStatus] = useState('idle');
    const [isUploadingRevisionFiles, setIsUploadingRevisionFiles] = useState(false);
    const [sourceSearch, setSourceSearch] = useState('');
    const [showIncludedSources, setShowIncludedSources] = useState(false);
    const [addingRecordKey, setAddingRecordKey] = useState('');
    const [viewer, setViewer] = useState(null);
    const [previewRecord, setPreviewRecord] = useState(null);
    const [recordUpdateContext] = useState(readRecordUpdateContext);
    const [highlightedRequest, setHighlightedRequest] = useState(null);
    const [isCompletingRequest, setIsCompletingRequest] = useState(false);
    const [isPetInformationEditorOpen, setIsPetInformationEditorOpen] = useState(false);
    const [certificateData, setCertificateData] = useState({ registrationCertificate: null, medicalCertificate: null, schemaReady: true });
    const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);
    const [certificateViewer, setCertificateViewer] = useState(null);
    const [medicalCertificateDraft, setMedicalCertificateDraft] = useState(emptyMedicalCertificateDraft);
    const [showMedicalCertificateSignature, setShowMedicalCertificateSignature] = useState(false);
    const [isIssuingMedicalCertificate, setIsIssuingMedicalCertificate] = useState(false);
    const groupAutosaveTimerRef = useRef(null);
    const itemAutosaveTimerRef = useRef(null);
    const revisionFileInputRef = useRef(null);
    const groupSavedSignatureRef = useRef('');
    const itemSavedSignatureRef = useRef('');
    const veterinarianIdentity = useMemo(() => ({
        ...(currentUser || {}),
        ...(veterinarianProfile || {})
    }), [currentUser, veterinarianProfile]);

    useEffect(() => {
        let isMounted = true;

        if (!currentUserId) {
            setVeterinarianProfile(null);
            return () => {
                isMounted = false;
            };
        }

        fetchProfile({
            userId: currentUserId,
            role: currentUser?.role || 'Veterinarian'
        })
            .then((profile) => {
                if (isMounted) {
                    setVeterinarianProfile(profile || null);
                }
            })
            .catch((error) => {
                if (isMounted) {
                    setVeterinarianProfile(null);
                    console.error('Failed to load veterinarian profile for vaccination attribution:', error);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [currentUser?.role, currentUserId]);

    const loadPets = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoadingPets(true);
        }

        try {
            const data = await fetchAllPets();
            const nextPets = Array.isArray(data) ? data : [];
            setPets(nextPets);
            const requestedPetId = recordUpdateContext.petId;
            if (requestedPetId) {
                const requestedPet = nextPets.find(pet => String(pet.db_id || pet.id) === String(requestedPetId));
                if (requestedPet) {
                    setPetSearch(requestedPet.petName || requestedPet.name || petLabel(requestedPet));
                }
            }
            setSelectedPetId(current => current || (requestedPetId ? String(requestedPetId) : ''));
            return nextPets;
        } catch (error) {
            if (!isAutoRefresh) {
                console.error('Failed to load pets for medical records:', error);
                toast.error('Pets could not be loaded. Refresh the page or try again later.');
            }
            return [];
        } finally {
            if (!isAutoRefresh) {
                setIsLoadingPets(false);
            }
        }
    }, [recordUpdateContext.petId]);

    const loadRecords = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!selectedPetId) return null;

        if (!isAutoRefresh) {
            setIsLoadingRecords(true);
        }

        try {
            const data = await fetchPetMedicalRecords(selectedPetId);
            if (data.success === false) {
                throw new Error(data.message || 'Medical records could not be loaded.');
            }
            if (data.schemaReady === false && !isAutoRefresh) {
                console.error('Medical records are unavailable:', data.message || data);
            }
            setRecordsData(data);
            const groups = asArray(data.organizedRecords);
            setSelectedGroupId(current => (
                current && groups.some(group => String(group.groupId) === String(current))
                    ? current
                    : String(groups[0]?.groupId || '')
            ));
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                console.error('Failed to load medical records:', error);
                toast.error('Medical records could not be loaded. Refresh the page or try again later.');
            }
            return null;
        } finally {
            if (!isAutoRefresh) {
                setIsLoadingRecords(false);
            }
        }
    }, [selectedPetId]);

    const loadCertificates = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!selectedPetId) return null;

        try {
            const data = await fetchPetCertificates(selectedPetId, {
                dedupe: false,
                transientRetryCount: isAutoRefresh ? 0 : 1
            });
            setCertificateData({
                registrationCertificate: data.registrationCertificate || null,
                medicalCertificate: data.medicalCertificate || null,
                schemaReady: data.schemaReady !== false
            });
            setCertificateViewer((current) => {
                if (!current) return current;
                return current.type === 'medical'
                    ? (data.medicalCertificate || current)
                    : (data.registrationCertificate || current);
            });
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                console.error('Failed to load pet certificates:', error);
            }
            return null;
        }
    }, [selectedPetId]);

    useEffect(() => {
        loadPets();
    }, [loadPets]);

    useEffect(() => {
        let isMounted = true;
        const requestId = recordUpdateContext.requestId;

        if (!requestId) {
            setHighlightedRequest(null);
            return () => {
                isMounted = false;
            };
        }

        fetchRecordUpdateRequests({ requestId })
            .then((data) => {
                if (!isMounted) return;
                const request = Array.isArray(data.requests) ? data.requests[0] : null;
                setHighlightedRequest(request || null);
            })
            .catch(() => {
                if (isMounted) {
                    setHighlightedRequest(null);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [recordUpdateContext.requestId]);

    useAutoRefresh(loadRecords, {
        enabled: Boolean(selectedPetId),
        refreshKey: `vet-pet-medical-records-${selectedPetId}`
    });

    useAutoRefresh(loadCertificates, {
        enabled: Boolean(selectedPetId),
        refreshKey: `vet-pet-certificates-${selectedPetId}`
    });

    const openMedicalCertificateIssuer = () => {
        setMedicalCertificateDraft(emptyMedicalCertificateDraft());
        setShowMedicalCertificateSignature(false);
        setIsCertificateDialogOpen(true);
    };

    const issueMedicalCertificate = async () => {
        if (!selectedPetId || isIssuingMedicalCertificate) return;
        if (!medicalCertificateDraft.clinicalFindings.trim()) {
            toast.error('Enter the clinical findings before issuing the medical certificate.');
            return;
        }
        if (!medicalCertificateDraft.signature) {
            setShowMedicalCertificateSignature(true);
            toast.error('Use Sign Certificate and add the veterinarian signature first.');
            return;
        }
        const examinationDate = new Date(`${medicalCertificateDraft.examinationDate}T00:00:00`);
        const validUntil = new Date(`${medicalCertificateDraft.validUntil}T00:00:00`);
        const validityDays = Math.round((validUntil.getTime() - examinationDate.getTime()) / 86400000);
        if (!Number.isFinite(validityDays) || validityDays < 1 || validityDays > 30) {
            toast.error('Choose a valid-until date from 1 to 30 days after the examination.');
            return;
        }

        setIsIssuingMedicalCertificate(true);
        try {
            const linkedRequestId = highlightedRequest?.requestId
                && String(highlightedRequest.petId) === String(selectedPetId)
                && ['assigned', 'in_progress'].includes(String(highlightedRequest.status || '').toLowerCase())
                ? highlightedRequest.requestId
                : null;
            const signaturePath = await uploadDataUrlImage(
                medicalCertificateDraft.signature,
                'diagnosis',
                `medical-certificate-${selectedPetId}`
            );
            const response = await issuePetMedicalCertificate(selectedPetId, {
                requestId: linkedRequestId,
                examinationDate: medicalCertificateDraft.examinationDate,
                validUntil: medicalCertificateDraft.validUntil,
                clinicalFindings: medicalCertificateDraft.clinicalFindings.trim(),
                certificationStatement: medicalCertificateDraft.clinicalFindings.trim(),
                signaturePath
            });
            const medicalCertificate = response.medicalCertificate || null;
            setCertificateData((current) => ({ ...current, medicalCertificate }));
            if (linkedRequestId) {
                setHighlightedRequest((current) => current ? { ...current, medicalCertificate } : current);
            }
            setIsCertificateDialogOpen(false);
            setShowMedicalCertificateSignature(false);
            setCertificateViewer(medicalCertificate);
            toast.success('Medical certificate issued. It is now available to the pet owner.');
        } catch (error) {
            console.error('Failed to issue medical certificate:', error);
            toast.error(error.message || 'The medical certificate could not be issued. Please try again.');
        } finally {
            setIsIssuingMedicalCertificate(false);
        }
    };

    const finishRecordUpdateRequest = async () => {
        if (!highlightedRequest?.requestId || isCompletingRequest) return;

        setIsCompletingRequest(true);
        try {
            const response = await updateRecordUpdateRequest(highlightedRequest.requestId, {
                action: 'complete',
                userId: currentUserId,
                veterinarianNotes: 'Medical record update completed.'
            });
            const refreshedCertificates = await loadCertificates({ isAutoRefresh: true });
            const medicalCertificate = refreshedCertificates?.medicalCertificate || certificateData.medicalCertificate || null;

            if (response?.request) {
                setHighlightedRequest({
                    ...response.request,
                    medicalCertificate: response.request.medicalCertificate || medicalCertificate
                });
            } else {
                setHighlightedRequest(current => current ? { ...current, status: 'completed', medicalCertificate } : current);
            }

            toast.success('Record update finished. Pet owner notified.');
        } catch (error) {
            console.error('Failed to finish the medical record update request:', error);
            toast.error(error.message || 'The record update could not be completed. Please try again.');
        } finally {
            setIsCompletingRequest(false);
        }
    };

    const filteredPets = useMemo(() => {
        const query = petSearch.trim().toLowerCase();
        if (!query) return pets;

        return pets.filter(pet => [
            pet.petName,
            pet.name,
            pet.id,
            pet.db_id,
            pet.species,
            pet.breed,
            pet.tempOwnerName
        ].join(' ').toLowerCase().includes(query));
    }, [petSearch, pets]);

    const groups = asArray(recordsData?.organizedRecords);
    const serviceHistory = asArray(recordsData?.serviceHistory);
    const vaccinations = asArray(recordsData?.vaccinations);
    const selectedPet = recordsData?.pet || pets.find(pet => String(pet.db_id || pet.id) === String(selectedPetId));
    const selectedGroup = groups.find(group => String(group.groupId) === String(selectedGroupId));
    const visiblePetOptions = filteredPets.slice(0, 8);
    const sourceRecords = [
        ...serviceHistory,
        ...vaccinations.map(vaccinationSourceRecord)
    ].sort((left, right) => String(right.serviceDate || '').localeCompare(String(left.serviceDate || '')));
    const normalizedSourceSearch = sourceSearch.trim().toLowerCase();
    const visibleSourceRecords = sourceRecords.filter((record) => {
        const isIncluded = selectedGroupId && addedToGroup(record, selectedGroupId);
        if (!showIncludedSources && isIncluded) return false;
        if (!normalizedSourceSearch) return true;

        return [
            record.title,
            record.summary,
            record.serviceDate,
            record.veterinarianName,
            sourceLabel(record)
        ].join(' ').toLowerCase().includes(normalizedSourceSearch);
    });
    const availableSourceCount = sourceRecords.filter(record => !selectedGroupId || !addedToGroup(record, selectedGroupId)).length;

    useEffect(() => {
        if (groupAutosaveTimerRef.current) {
            window.clearTimeout(groupAutosaveTimerRef.current);
            groupAutosaveTimerRef.current = null;
        }

        if (!editingGroupId || !selectedPetId || isSavingGroup) {
            return undefined;
        }

        const title = groupDraft.title.trim();
        if (!title) {
            setGroupAutosaveStatus('idle');
            return undefined;
        }

        const group = groups.find(item => String(item.groupId) === String(editingGroupId));
        const draftSignature = groupDraftSignature(groupDraft);
        const savedSignature = groupSavedSignatureRef.current || (group ? groupDraftSignature(group) : '');

        if (draftSignature === savedSignature) {
            setGroupAutosaveStatus('saved');
            return undefined;
        }

        setGroupAutosaveStatus('saving');
        const timerId = window.setTimeout(async () => {
            try {
                await updatePetMedicalRecordGroup(selectedPetId, {
                    groupId: editingGroupId,
                    title,
                    summary: cleanOrganizedSummary(groupDraft.summary),
                    visibleToOwner: groupDraft.visibleToOwner,
                    userId: currentUserId
                });
                groupSavedSignatureRef.current = draftSignature;
                setGroupAutosaveStatus('saved');
            } catch {
                setGroupAutosaveStatus('error');
            }
        }, 900);

        groupAutosaveTimerRef.current = timerId;
        return () => {
            window.clearTimeout(timerId);
            if (groupAutosaveTimerRef.current === timerId) {
                groupAutosaveTimerRef.current = null;
            }
        };
    }, [
        currentUserId,
        editingGroupId,
        groupDraft,
        groups,
        isSavingGroup,
        selectedPetId
    ]);

    useEffect(() => {
        if (itemAutosaveTimerRef.current) {
            window.clearTimeout(itemAutosaveTimerRef.current);
            itemAutosaveTimerRef.current = null;
        }

        if (!editingItem || !selectedPetId) {
            return undefined;
        }

        const itemId = editingItem.itemId;
        const title = itemDraft.title.trim() || 'Clinical record';
        const draftSignature = itemDraftSignature(itemDraft);
        const savedSignature = itemSavedSignatureRef.current || itemDraftSignature(editingItem);

        if (draftSignature === savedSignature) {
            setItemAutosaveStatus('saved');
            return undefined;
        }

        setItemAutosaveStatus('saving');
        const timerId = window.setTimeout(async () => {
            try {
                await updatePetMedicalRecordGroupItem(selectedPetId, {
                    itemId,
                    title,
                    summary: cleanOrganizedSummary(itemDraft.summary),
                    revisionNotes: itemDraft.revisionNotes,
                    revisionSnapshot: itemDraft.revisionSnapshot,
                    userId: currentUserId
                });
                itemSavedSignatureRef.current = draftSignature;
                setItemAutosaveStatus('saved');
            } catch {
                setItemAutosaveStatus('error');
            }
        }, 900);

        itemAutosaveTimerRef.current = timerId;
        return () => {
            window.clearTimeout(timerId);
            if (itemAutosaveTimerRef.current === timerId) {
                itemAutosaveTimerRef.current = null;
            }
        };
    }, [
        currentUserId,
        editingItem,
        itemDraft,
        selectedPetId
    ]);

    const selectPet = (pet) => {
        const nextPetId = String(pet?.db_id || pet?.id || '');
        if (!nextPetId) return;

        setPetSearch(pet.petName || pet.name || petLabel(pet));
        setIsPetSearchOpen(false);

        if (nextPetId !== String(selectedPetId)) {
            setSelectedPetId(nextPetId);
            setRecordsData(null);
            setSelectedGroupId('');
            setEditingGroupId('');
            setEditingItem(null);
            setPreviewRecord(null);
            setSourceSearch('');
            setShowIncludedSources(false);
            setAddingRecordKey('');
            setGroupAutosaveStatus('idle');
            setItemAutosaveStatus('idle');
            groupSavedSignatureRef.current = '';
            itemSavedSignatureRef.current = '';
        }
    };

    const openCreateGroup = async () => {
        if (!selectedPetId || isSavingGroup) return;

        const nextDraft = {
            title: `${selectedPet?.name || selectedPet?.petName || 'Pet'} Clinical Summary`,
            summary: '',
            visibleToOwner: true
        };

        setIsSavingGroup(true);
        try {
            const data = await createPetMedicalRecordGroup(selectedPetId, {
                ...nextDraft,
                userId: currentUserId
            });
            const nextGroupId = String(data?.groupId || '');
            if (nextGroupId) {
                setSelectedGroupId(nextGroupId);
                setEditingGroupId(nextGroupId);
                setGroupDraft(nextDraft);
                groupSavedSignatureRef.current = groupDraftSignature(nextDraft);
                setGroupAutosaveStatus('saved');
            }
            toast.success('Organized summary created.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            console.error('Failed to create an organized medical summary:', error);
            toast.error('The organized summary could not be created. Please try again.');
        } finally {
            setIsSavingGroup(false);
        }
    };

    const openEditGroup = (group) => {
        const nextDraft = {
            title: group.title || '',
            summary: cleanOrganizedSummary(group.summary),
            visibleToOwner: group.visibleToOwner !== false
        };
        setEditingGroupId(String(group.groupId));
        groupSavedSignatureRef.current = groupDraftSignature(nextDraft);
        setGroupAutosaveStatus('saved');
        setGroupDraft(nextDraft);
    };

    const saveGroup = async (groupId = editingGroupId) => {
        if (!selectedPetId || !groupId) return;
        if (!groupDraft.title.trim()) {
            toast.error('Group title is required.');
            return;
        }

        if (groupAutosaveTimerRef.current) {
            window.clearTimeout(groupAutosaveTimerRef.current);
            groupAutosaveTimerRef.current = null;
        }

        setIsSavingGroup(true);
        setGroupAutosaveStatus('saving');
        try {
            await updatePetMedicalRecordGroup(selectedPetId, {
                groupId,
                title: groupDraft.title,
                summary: cleanOrganizedSummary(groupDraft.summary),
                visibleToOwner: groupDraft.visibleToOwner,
                userId: currentUserId
            });
            toast.success('Organized summary updated.');
            groupSavedSignatureRef.current = groupDraftSignature(groupDraft);
            setGroupAutosaveStatus('saved');
            setEditingGroupId('');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            setGroupAutosaveStatus('error');
            console.error('Failed to save an organized medical summary:', error);
            toast.error('The organized summary could not be saved. Please try again.');
        } finally {
            setIsSavingGroup(false);
        }
    };

    const cancelGroupEdit = () => {
        setEditingGroupId('');
        setGroupAutosaveStatus('idle');
        groupSavedSignatureRef.current = '';
        setGroupDraft({ title: '', summary: '', visibleToOwner: true });
    };

    const removeGroup = async (group) => {
        if (!window.confirm(`Delete organized record "${group.title}"?`)) return;

        try {
            await deletePetMedicalRecordGroup(selectedPetId, group.groupId, { userId: currentUserId });
            toast.success('Organized record deleted.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            console.error('Failed to delete an organized medical record:', error);
            toast.error('The organized record could not be deleted. Please try again.');
        }
    };

    const copyRecordToGroup = async (record, targetGroupId = selectedGroupId) => {
        if (!targetGroupId) {
            toast.error('Create or select an organized record first.');
            return false;
        }
        if (!record?.sourceType || !record?.sourceId) {
            toast.error('This record cannot be added to an organized summary.');
            return false;
        }
        if (addedToGroup(record, targetGroupId)) {
            toast.info('That record is already included in this organized summary.');
            return false;
        }

        const pendingKey = `${recordKey(record)}:${targetGroupId}`;
        if (addingRecordKey === pendingKey) return false;

        setAddingRecordKey(pendingKey);
        try {
            await addPetMedicalRecordGroupItem(selectedPetId, {
                groupId: targetGroupId,
                sourceType: record.sourceType,
                sourceId: record.sourceId,
                title: organizedRecordTitle(record),
                summary: cleanOrganizedSummary(record.summary),
                userId: currentUserId
            });
            toast.success(record.sourceType === 'vaccination'
                ? 'Vaccination copied into the organized summary.'
                : 'Service record added to the organized summary.');
            await loadRecords({ isAutoRefresh: true });
            return true;
        } catch (error) {
            console.error('Failed to add a medical record to an organized summary:', error);
            toast.error('The record could not be added to the organized summary. Please try again.');
            return false;
        } finally {
            setAddingRecordKey('');
        }
    };

    const openEditItem = (item) => {
        const nextDraft = {
            title: organizedItemTitle(item),
            summary: cleanOrganizedSummary(item.summary),
            revisionNotes: item.revisionNotes || '',
            revisionSnapshot: revisionSnapshotForItem(item)
        };
        setEditingItem(item);
        setIsUploadingRevisionFiles(false);
        itemSavedSignatureRef.current = itemDraftSignature(nextDraft);
        setItemAutosaveStatus('saved');
        setItemDraft(nextDraft);
    };

    const saveItem = async () => {
        if (!editingItem) return;

        if (itemAutosaveTimerRef.current) {
            window.clearTimeout(itemAutosaveTimerRef.current);
            itemAutosaveTimerRef.current = null;
        }

        setItemAutosaveStatus('saving');
        try {
            await updatePetMedicalRecordGroupItem(selectedPetId, {
                itemId: editingItem.itemId,
                title: itemDraft.title,
                summary: cleanOrganizedSummary(itemDraft.summary),
                revisionNotes: itemDraft.revisionNotes,
                revisionSnapshot: itemDraft.revisionSnapshot,
                userId: currentUserId
            });
            toast.success('Grouped summary updated.');
            itemSavedSignatureRef.current = itemDraftSignature(itemDraft);
            setItemAutosaveStatus('saved');
            setEditingItem(null);
            itemSavedSignatureRef.current = '';
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            setItemAutosaveStatus('error');
            console.error('Failed to update a grouped medical summary:', error);
            toast.error('The grouped summary could not be updated. Please try again.');
        }
    };

    const uploadRevisionFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length || !editingItem || isUploadingRevisionFiles) return;

        const existingFiles = asArray(itemDraft.revisionSnapshot?.revisionAttachments);
        if (existingFiles.length + files.length > 20) {
            toast.error('A medical-record revision can contain up to 20 added files.');
            return;
        }

        const invalidFile = files.find((file) => (
            file.size <= 0
            || file.size > 8 * 1024 * 1024
            || !['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type)
        ));
        if (invalidFile) {
            toast.error('Upload PNG, JPG, WEBP, GIF, or PDF files no larger than 8 MB each.');
            return;
        }

        setIsUploadingRevisionFiles(true);
        try {
            const uploaded = await Promise.all(files.map(async (file, index) => {
                const result = await uploadDocumentFile(file, 'diagnosis', {
                    returnMetadata: true,
                    formFields: {
                        petId: selectedPetId,
                        petName: selectedPet?.petName || selectedPet?.name || '',
                        recordLabel: itemDraft.title || 'medical-record-revision',
                        attachmentCategory: 'medical_record_revision'
                    }
                });

                return {
                    id: `revision-${Date.now()}-${index}`,
                    name: result.displayName || result.originalName || file.name,
                    originalName: result.originalName || file.name,
                    storedFileName: result.storedFileName || '',
                    url: result.path,
                    relativeUrl: result.path,
                    mimeType: result.mimeType || file.type,
                    category: 'medical_record_revision',
                    uploadedAt: new Date().toISOString()
                };
            }));

            setItemDraft((current) => ({
                ...current,
                revisionSnapshot: {
                    ...(current.revisionSnapshot || {}),
                    revisionAttachments: [
                        ...asArray(current.revisionSnapshot?.revisionAttachments),
                        ...uploaded
                    ]
                }
            }));
            toast.success(`${uploaded.length} revision file${uploaded.length === 1 ? '' : 's'} uploaded.`);
        } catch (error) {
            console.error('Failed to upload medical-record revision files:', error);
            toast.error('One or more revision files could not be uploaded. Please try again.');
        } finally {
            setIsUploadingRevisionFiles(false);
        }
    };

    const removeRevisionFile = (attachmentToRemove, attachmentIndex) => {
        setItemDraft((current) => ({
            ...current,
            revisionSnapshot: {
                ...(current.revisionSnapshot || {}),
                revisionAttachments: asArray(current.revisionSnapshot?.revisionAttachments).filter((attachment, index) => (
                    index !== attachmentIndex
                    || attachment?.id !== attachmentToRemove?.id
                ))
            }
        }));
    };

    const removeItem = async (item) => {
        try {
            await removePetMedicalRecordGroupItem(selectedPetId, item.itemId, { userId: currentUserId });
            toast.success('Service record removed from group.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            console.error('Failed to remove a service record from its group:', error);
            toast.error('The service record could not be removed. Please try again.');
        }
    };

    const handleDropOnGroup = (event, group) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';

        try {
            const record = readDraggedRecord(event);
            if (!record) return;
            copyRecordToGroup(record, group.groupId);
        } catch {
            toast.error('The dragged medical record could not be read.');
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                icon={Stethoscope}
                title="Medical Record Editor"
                description="Curate paid or finished service records into owner-ready organized summaries."
                petHover
                petKind="cat"
                petAccent="blue"
            />

            <section className="space-y-4">
                <Card petHover={false} className="relative z-40 overflow-visible border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                    <CardContent className="p-4">
                        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-center">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#155dfc]">Step 1</p>
                                <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">Choose a patient</h3>
                                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Search by name, pet ID, breed, or owner.</p>
                            </div>

                            <div
                                className="relative"
                                onBlur={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget)) {
                                        setIsPetSearchOpen(false);
                                    }
                                }}
                            >
                                <Input
                                    value={petSearch}
                                    onChange={(event) => {
                                        setPetSearch(event.target.value);
                                        setIsPetSearchOpen(true);
                                    }}
                                    onFocus={() => setIsPetSearchOpen(true)}
                                    placeholder="Search the patient directory"
                                    className="h-11 text-base"
                                    leftIcon={<Search className="size-4" />}
                                />

                                {isPetSearchOpen && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                        {isLoadingPets ? (
                                            <div className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-500">
                                                <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                                                Loading pets...
                                            </div>
                                        ) : visiblePetOptions.length === 0 ? (
                                            <div className="p-5 text-center text-sm font-semibold text-slate-400">
                                                No pets match your search.
                                            </div>
                                        ) : (
                                            visiblePetOptions.map((pet) => {
                                                const petId = String(pet.db_id || pet.id);
                                                const isSelected = petId === String(selectedPetId);
                                                const isHighlightedRequestPet = highlightedRequest && String(highlightedRequest.petId) === petId;
                                                const meta = [
                                                    pet.species,
                                                    pet.breed,
                                                    pet.id || pet.pet_sharable_ID,
                                                    pet.tempOwnerName || pet.ownerName
                                                ].filter(Boolean).join(' - ');

                                                return (
                                                    <button
                                                        key={petId}
                                                        type="button"
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            selectPet(pet);
                                                        }}
                                                        className={`flex w-full items-start justify-between gap-3 rounded-md p-3 text-left transition ${
                                                            isSelected ? 'bg-blue-50 dark:bg-blue-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-slate-950 dark:text-white">
                                                                {pet.petName || pet.name || 'Unnamed pet'}
                                                            </span>
                                                            {meta && (
                                                                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                                                                    {meta}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="flex shrink-0 flex-col items-end gap-1">
                                                            {isHighlightedRequestPet && (
                                                                <Badge className="border-0 bg-red-50 text-red-700">Urgent</Badge>
                                                            )}
                                                            {isHighlightedRequestPet && isRecordRequestPaid(highlightedRequest) && (
                                                                <Badge className="border-0 bg-green-50 text-green-700">Paid</Badge>
                                                            )}
                                                            {isSelected && (
                                                                <Badge className="border-0 bg-[#155dfc] text-white">Selected</Badge>
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                        {filteredPets.length > visiblePetOptions.length && (
                                            <div className="border-t border-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
                                                Keep typing to narrow {filteredPets.length - visiblePetOptions.length} more result{filteredPets.length - visiblePetOptions.length === 1 ? '' : 's'}.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {highlightedRequest && String(highlightedRequest.petId) === String(selectedPetId) && (
                    <RecordUpdateHighlight
                        request={highlightedRequest}
                        onFinish={finishRecordUpdateRequest}
                        isFinishing={isCompletingRequest}
                        medicalCertificate={certificateData.medicalCertificate}
                        certificateSchemaReady={certificateData.schemaReady}
                        onIssueMedicalCertificate={openMedicalCertificateIssuer}
                        onViewMedicalCertificate={() => setCertificateViewer(certificateData.medicalCertificate)}
                    />
                )}

                {selectedPetId && selectedPet && (
                    <PetPreviewCard
                        pet={selectedPet}
                        onEdit={() => setIsPetInformationEditorOpen(true)}
                        medicalCertificate={certificateData.medicalCertificate}
                        certificateSchemaReady={certificateData.schemaReady}
                        onIssueMedicalCertificate={openMedicalCertificateIssuer}
                        onViewMedicalCertificate={() => setCertificateViewer(certificateData.medicalCertificate)}
                    />
                )}
            </section>

            {!selectedPetId ? (
                <EmptyPanel
                    icon={PawPrint}
                    title="No pet selected"
                    message="Search and select a pet to view or edit medical records."
                />
            ) : null}

            {selectedPetId && recordsData?.schemaReady === false && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    Medical records are temporarily unavailable. Try again later or contact support.
                </div>
            )}

            {selectedPetId && (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <header className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/80 sm:px-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                                    <ClipboardList className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#155dfc]">Clinical workspace</p>
                                    <h2 className="mt-0.5 text-lg font-black text-slate-950 dark:text-white">Build the owner-ready medical summary</h2>
                                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        Select one summary, then add the relevant service or vaccination records.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-center dark:border-slate-700 dark:bg-slate-950">
                                <WorkflowStat label="Summaries" value={groups.length} />
                                <WorkflowStat label="In target" value={asArray(selectedGroup?.items).length} />
                                <WorkflowStat label="Available" value={availableSourceCount} />
                            </div>
                        </div>
                    </header>

                    <div className="grid min-h-[36rem] lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
                        <aside className="border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 2</p>
                                    <h3 className="mt-1 font-black text-slate-950 dark:text-white">Choose summary</h3>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={openCreateGroup}
                                    disabled={!selectedPetId || isSavingGroup}
                                    aria-label="Create a new organized summary"
                                    className="size-9 shrink-0 bg-[#155dfc] p-0 text-white hover:bg-[#0d4acf]"
                                >
                                    {isSavingGroup ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                </Button>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1" aria-label="Organized medical summaries">
                                {groups.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                        Create the first owner-ready summary.
                                    </div>
                                ) : groups.map((group) => {
                                    const isSelected = String(group.groupId) === String(selectedGroupId);
                                    const itemCount = asArray(group.items).length;

                                    return (
                                        <button
                                            key={group.groupId}
                                            type="button"
                                            onClick={() => setSelectedGroupId(String(group.groupId))}
                                            className={`w-full rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 ${
                                                isSelected
                                                    ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/50'
                                                    : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className="flex items-start gap-2">
                                                <FolderOpen className={`mt-0.5 size-4 shrink-0 ${isSelected ? 'text-[#155dfc]' : 'text-slate-400'}`} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block break-words text-sm font-black text-slate-900 dark:text-white">{group.title}</span>
                                                    <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                        {itemCount} record{itemCount === 1 ? '' : 's'} · {group.visibleToOwner === false ? 'Internal' : 'Owner visible'}
                                                    </span>
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </aside>

                        <main className="min-w-0 bg-white p-4 dark:bg-slate-900 sm:p-5">
                            <div className="mb-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Active summary</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                    Edit the owner-facing overview and review the records included below.
                                </p>
                            </div>

                            {isLoadingRecords ? (
                                <LoadingPanel />
                            ) : groups.length === 0 ? (
                                <EmptyPanel
                                    icon={ClipboardList}
                                    title="Start an organized summary"
                                    message="Create a summary from the left panel before adding source records."
                                />
                            ) : selectedGroup ? (
                                <RecordGroup
                                    key={selectedGroup.groupId}
                                    group={selectedGroup}
                                    onDrop={(event) => handleDropOnGroup(event, selectedGroup)}
                                    onEdit={() => openEditGroup(selectedGroup)}
                                    onDelete={() => removeGroup(selectedGroup)}
                                    isEditing={String(editingGroupId) === String(selectedGroup.groupId)}
                                    draft={groupDraft}
                                    onDraftChange={setGroupDraft}
                                    onSaveEdit={() => saveGroup(selectedGroup.groupId)}
                                    onCancelEdit={cancelGroupEdit}
                                    isSaving={isSavingGroup}
                                    autosaveStatus={groupAutosaveStatus}
                                    onEditItem={openEditItem}
                                    onRemoveItem={removeItem}
                                    onPreview={setViewer}
                                />
                            ) : (
                                <EmptyPanel
                                    icon={FolderOpen}
                                    title="Choose a summary"
                                    message="Select an organized summary from the left panel to continue."
                                />
                            )}
                        </main>

                        <aside className="min-w-0 border-t border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
                            <div className="border-b border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 3</p>
                                        <h3 className="mt-1 font-black text-slate-950 dark:text-white">Add source records</h3>
                                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Use Add, or drag a card into the active summary.</p>
                                    </div>
                                    <Badge className="border-0 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{sourceRecords.length}</Badge>
                                </div>

                                <div className="mt-4 space-y-3">
                                    <Input
                                        value={sourceSearch}
                                        onChange={(event) => setSourceSearch(event.target.value)}
                                        placeholder="Search source records"
                                        leftIcon={<Search className="size-4" />}
                                        aria-label="Search service and vaccination records"
                                    />
                                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                        <Checkbox checked={showIncludedSources} onCheckedChange={(checked) => setShowIncludedSources(checked === true)} />
                                        Show records already included in this summary
                                    </label>
                                </div>
                            </div>

                            <div className="grid max-h-[38rem] gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:max-h-[calc(100vh-19rem)] xl:grid-cols-1">
                                {!selectedGroupId ? (
                                    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                        Choose or create a summary before adding records.
                                    </p>
                                ) : visibleSourceRecords.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                        {sourceRecords.length === 0
                                            ? 'No paid, finished, or vaccination records are available for this pet.'
                                            : 'No source records match the current filters.'}
                                    </p>
                                ) : (
                                    visibleSourceRecords.map((record) => {
                                        const isIncluded = addedToGroup(record, selectedGroupId);
                                        const pendingKey = `${recordKey(record)}:${selectedGroupId}`;

                                        return (
                                            <ServiceRecordCard
                                                key={recordKey(record)}
                                                record={record}
                                                onOpenPreview={() => setPreviewRecord(record)}
                                                onPreview={setViewer}
                                                onAdd={() => copyRecordToGroup(record)}
                                                isAddedToTarget={isIncluded}
                                                isAdding={addingRecordKey === pendingKey}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </aside>
                    </div>
                </section>
            )}

            {selectedPetId && (
                <VaccinationPanel
                    key={selectedPetId}
                    vaccinations={vaccinations}
                    petId={selectedPetId}
                    veterinarian={veterinarianIdentity}
                    onSaved={() => loadRecords({ isAutoRefresh: true })}
                />
            )}

            <Dialog open={Boolean(previewRecord)} onOpenChange={(open) => !open && setPreviewRecord(null)}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{previewRecord?.title || 'Service Record'}</DialogTitle>
                        <DialogDescription>
                            {previewRecord ? `${sourceLabel(previewRecord)} - ${formatDisplayDate(previewRecord.serviceDate)}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <SourceRecordDetails record={previewRecord} petId={selectedPetId} onPreview={setViewer} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewRecord(null)}>Close</Button>
                        <Button
                            onClick={async () => {
                                if (!previewRecord) return;
                                const wasAdded = await copyRecordToGroup(previewRecord);
                                if (wasAdded) setPreviewRecord(null);
                            }}
                            disabled={
                                !selectedGroupId
                                || (previewRecord && addedToGroup(previewRecord, selectedGroupId))
                                || (previewRecord && addingRecordKey === `${recordKey(previewRecord)}:${selectedGroupId}`)
                            }
                            className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                        >
                            {previewRecord && addingRecordKey === `${recordKey(previewRecord)}:${selectedGroupId}`
                                ? <Loader2 className="size-4 animate-spin" />
                                : <Plus className="size-4" />}
                            Add to {selectedGroup?.title || 'active summary'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editingItem)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingItem(null);
                        setItemAutosaveStatus('idle');
                        itemSavedSignatureRef.current = '';
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <DialogHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <DialogTitle>Revise Medical Record</DialogTitle>
                            {autosaveText(itemAutosaveStatus) && (
                                <Badge className={`w-fit border-0 ${
                                    itemAutosaveStatus === 'error'
                                        ? 'bg-red-50 text-red-700'
                                        : itemAutosaveStatus === 'saving'
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-green-50 text-green-700'
                                }`}>
                                    {autosaveText(itemAutosaveStatus)}
                                </Badge>
                            )}
                        </div>
                        <DialogDescription>
                            Compare the permanent source record on the left with the editable medical-record revision on the right. Saving never changes the original diagnosis sheet or source files.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid items-start gap-5 lg:grid-cols-2">
                        <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Original · Read only</p>
                                <h3 className="mt-1 font-black text-slate-950 dark:text-white">Preserved source and files</h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use this as the audit reference. Revision changes never overwrite these original details or pictures.</p>
                            </div>
                            <SourceRecordDetails record={editingItem?.sourceSnapshot} petId={selectedPetId} onPreview={setViewer} />
                        </section>
                        <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900/60 dark:bg-blue-950/10">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#155dfc]">Revision · Editable</p>
                                <h3 className="mt-1 font-black text-slate-950 dark:text-white">Current medical record</h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Edit the clinical history and add supporting files. This revised copy is what appears in the organized medical record.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Record title</Label>
                                <Input value={itemDraft.title} onChange={(event) => setItemDraft(current => ({ ...current, title: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Revised diagnosis / medical summary</Label>
                                <Textarea
                                    value={itemDraft.summary}
                                    onChange={(event) => setItemDraft(current => ({ ...current, summary: event.target.value }))}
                                    className="min-h-28 resize-y"
                                />
                            </div>
                            <RevisionClinicalEditor
                                snapshot={itemDraft.revisionSnapshot}
                                onChange={(field, value) => setItemDraft((current) => ({
                                    ...current,
                                    revisionSnapshot: {
                                        ...(current.revisionSnapshot || {}),
                                        [field]: value
                                    }
                                }))}
                            />
                            <div className="space-y-3 rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900/60 dark:bg-slate-900">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <Label>Revision pictures and files</Label>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add images or PDFs to this revision. Original source files remain preserved.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => revisionFileInputRef.current?.click()}
                                        disabled={isUploadingRevisionFiles}
                                        className="shrink-0 gap-2"
                                    >
                                        {isUploadingRevisionFiles
                                            ? <Loader2 className="size-4 animate-spin" />
                                            : <Upload className="size-4" />}
                                        {isUploadingRevisionFiles ? 'Uploading...' : 'Upload files'}
                                    </Button>
                                    <input
                                        ref={revisionFileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                                        onChange={uploadRevisionFiles}
                                        className="hidden"
                                    />
                                </div>
                                {asArray(itemDraft.revisionSnapshot?.revisionAttachments).length > 0 ? (
                                    <AttachmentStrip
                                        attachments={itemDraft.revisionSnapshot.revisionAttachments}
                                        onPreview={setViewer}
                                        onRemove={removeRevisionFile}
                                    />
                                ) : (
                                    <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">No files added to this revision yet.</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Veterinarian Revision Notes</Label>
                                <Textarea
                                    value={itemDraft.revisionNotes}
                                    onChange={(event) => setItemDraft(current => ({ ...current, revisionNotes: event.target.value }))}
                                    placeholder="Explain what was revised without rewriting the source diagnosis."
                                />
                            </div>
                        </section>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                        <Button
                            onClick={saveItem}
                            disabled={isUploadingRevisionFiles || itemAutosaveStatus === 'saving'}
                            className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                        >
                            Save Revision
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isCertificateDialogOpen}
                onOpenChange={(open) => {
                    if (!isIssuingMedicalCertificate) {
                        setIsCertificateDialogOpen(open);
                        if (!open) setShowMedicalCertificateSignature(false);
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Award className="size-5 text-[#155dfc]" />
                            {certificateData.medicalCertificate ? 'Replace Medical Certificate' : 'Issue Medical Certificate'}
                        </DialogTitle>
                        <DialogDescription>
                            {highlightedRequest?.requestId && String(highlightedRequest.petId) === String(selectedPetId)
                                ? `The certificate will be linked to ${highlightedRequest.requestNumber}. `
                                : 'No record-update request is required. '}
                            It becomes available in the owner&apos;s pet profile. The default validity is 30 days and may be shortened by the veterinarian.
                        </DialogDescription>
                    </DialogHeader>

                    {!certificateData.schemaReady ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                            Medical certificate storage is not installed. Run DDL/20261002_03_pet_certificates.sql first.
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="medical-certificate-examination-date">Examination date</Label>
                                    <Input
                                        id="medical-certificate-examination-date"
                                        type="date"
                                        value={medicalCertificateDraft.examinationDate}
                                        max={localDateInputValue()}
                                        onChange={(event) => {
                                            const examinationDate = event.target.value;
                                            setMedicalCertificateDraft((current) => ({
                                                ...current,
                                                examinationDate,
                                                validUntil: addCalendarDays(examinationDate, 30)
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="medical-certificate-valid-until">Valid until</Label>
                                    <Input
                                        id="medical-certificate-valid-until"
                                        type="date"
                                        value={medicalCertificateDraft.validUntil}
                                        min={addCalendarDays(medicalCertificateDraft.examinationDate, 1)}
                                        max={addCalendarDays(medicalCertificateDraft.examinationDate, 30)}
                                        onChange={(event) => setMedicalCertificateDraft((current) => ({ ...current, validUntil: event.target.value }))}
                                    />
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Choose 1 to 30 days after the examination.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="medical-certificate-findings">Clinical findings</Label>
                                <Textarea
                                    id="medical-certificate-findings"
                                    value={medicalCertificateDraft.clinicalFindings}
                                    onChange={(event) => setMedicalCertificateDraft((current) => ({ ...current, clinicalFindings: event.target.value }))}
                                    placeholder="Record the examination findings that support this certificate."
                                    className="min-h-28 resize-y"
                                    maxLength={5000}
                                />
                                <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Revise the initial finding so it accurately reflects what was observed during the examination.</p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-black text-slate-950 dark:text-white">Veterinarian signature</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">The signature is stored with the issued certificate.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant={showMedicalCertificateSignature ? 'secondary' : 'outline'}
                                        onClick={() => setShowMedicalCertificateSignature((current) => !current)}
                                        className="gap-2"
                                    >
                                        <PenLine className="size-4" />
                                        {showMedicalCertificateSignature ? 'Hide signature box' : 'Sign Certificate'}
                                    </Button>
                                </div>
                                {showMedicalCertificateSignature ? (
                                    <div className="mt-4">
                                        <SignatureCapture
                                            signature={medicalCertificateDraft.signature}
                                            onSignatureChange={(signature) => setMedicalCertificateDraft((current) => ({ ...current, signature }))}
                                            disabled={isIssuingMedicalCertificate}
                                        />
                                    </div>
                                ) : null}
                                {medicalCertificateDraft.signature && !showMedicalCertificateSignature ? (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                                        <BadgeCheck className="size-4" /> Signature captured
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsCertificateDialogOpen(false)} disabled={isIssuingMedicalCertificate}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={issueMedicalCertificate}
                            disabled={!certificateData.schemaReady || isIssuingMedicalCertificate}
                            className="gap-2"
                        >
                            {isIssuingMedicalCertificate ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
                            {isIssuingMedicalCertificate ? 'Issuing certificate...' : 'Issue certificate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PetCertificateDialog
                open={Boolean(certificateViewer)}
                onOpenChange={(open) => !open && setCertificateViewer(null)}
                certificate={certificateViewer}
            />

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Medical record image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
            {isPetInformationEditorOpen && selectedPet && (
                <EditPetInformationDialog
                    petId={selectedPet.id || selectedPet.db_id || selectedPetId}
                    onClose={() => setIsPetInformationEditorOpen(false)}
                    onSaved={(updatedPet) => {
                        setPets((current) => current.map((pet) => String(pet.db_id || pet.id) === String(selectedPetId) ? { ...pet, ...updatedPet } : pet));
                        setRecordsData((current) => current ? { ...current, pet: { ...current.pet, ...updatedPet } } : current);
                    }}
                />
            )}
        </div>
    );
}

function WorkflowStat({ label, value }) {
    return (
        <div className="min-w-20 border-r border-slate-200 px-3 py-2 last:border-r-0 dark:border-slate-700">
            <p className="text-base font-black text-slate-950 dark:text-white">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        </div>
    );
}

function PetPreviewCard({ pet, onEdit, medicalCertificate, certificateSchemaReady, onIssueMedicalCertificate, onViewMedicalCertificate }) {
    const imageSrc = pet?.profileImage || pet?.setpetImage_url || '';
    const petName = pet?.name || pet?.petName || 'No pet selected';
    const petId = pet?.id || pet?.pet_sharable_ID || pet?.dbId || pet?.db_id || 'N/A';

    return (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        {imageSrc ? (
                            <ProtectedImage
                                src={imageSrc}
                                alt={`${petName} profile`}
                                className="h-full w-full object-cover"
                                fallbackClassName="h-full w-full"
                            />
                        ) : (
                            <PawPrint className="size-8 text-slate-300" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-lg font-black text-slate-950 dark:text-white">{petName}</h3>
                            <Badge className="border-0 bg-blue-50 text-[#155dfc]">
                                {pet?.status || 'Active'}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {[pet?.species, pet?.breed].filter(Boolean).join(' - ') || 'Species not set'}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Pet Information</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {medicalCertificate ? (
                        <Button type="button" variant="outline" size="sm" onClick={onViewMedicalCertificate} className="h-9 gap-2 border-blue-200 bg-white text-[#155dfc] hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/50">
                            <Eye className="size-4" />
                            View medical cert
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onIssueMedicalCertificate}
                        disabled={!certificateSchemaReady}
                        className="h-9 gap-2 border-blue-200 bg-white text-[#155dfc] hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/50"
                    >
                        <Award className="size-4" />
                        {medicalCertificate ? 'Replace medical cert' : 'Issue medical cert'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-9 gap-2 border-blue-200 bg-white text-[#155dfc] hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/50">
                        <Pencil className="size-4" strokeWidth={2.4} />
                        Edit pet information
                    </Button>
                </div>
            </div>

            <CardContent className="p-4">
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    <PreviewInfo label="Pet ID" value={petId} />
                    <PreviewInfo label="Sex" value={pet?.gender || 'N/A'} />
                    <PreviewInfo label="Age" value={pet?.age || 'N/A'} />
                    <PreviewInfo label="Weight" value={pet?.weight ? `${pet.weight} kg` : 'N/A'} />
                    <PreviewInfo label="Microchip" value={pet?.microchipId || 'N/A'} />
                </div>
            </CardContent>
        </Card>
    );
}

function RecordUpdateHighlight({ request, onFinish, isFinishing, medicalCertificate, certificateSchemaReady, onIssueMedicalCertificate, onViewMedicalCertificate }) {
    const isCompleted = String(request?.status || '').toLowerCase() === 'completed';

    return (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-red-950">Record Update Request</h3>
                        <Badge className="border-0 bg-red-600 text-white">Urgent</Badge>
                        {isRecordRequestPaid(request) && (
                            <Badge className="border-0 bg-green-600 text-white">Paid</Badge>
                        )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-red-800">
                        {request.requestNumber} - {request.petName || 'Selected pet'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge className="w-fit border-0 bg-white text-red-700">
                        {request.status ? String(request.status).replace(/_/g, ' ') : 'assigned'}
                    </Badge>
                    {!isCompleted && (
                        <Button
                            type="button"
                            onClick={onFinish}
                            disabled={isFinishing}
                            className="gap-2 bg-green-600 text-white hover:bg-green-700"
                        >
                            {isFinishing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            Finish Update
                        </Button>
                    )}
                </div>
            </div>
            <div className="mt-3 rounded-lg border border-red-100 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Owner Requested Details</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">
                    {request.requestedChanges || 'No request details provided.'}
                </p>
            </div>
            <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#155dfc]">Certificates included automatically</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                            The clinic registration certificate is always available. Issue a veterinarian medical certificate here when the examination supports one.
                        </p>
                        {medicalCertificate ? (
                            <p className="mt-1 text-xs font-bold text-emerald-700">
                                {medicalCertificate.certificateNumber} · valid until {formatDisplayDate(medicalCertificate.validUntil)}
                            </p>
                        ) : null}
                        {!certificateSchemaReady ? (
                            <p className="mt-1 text-xs font-bold text-red-700">Certificate storage migration is required before issuing.</p>
                        ) : null}
                    </div>
                    {!isCompleted ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                            {medicalCertificate ? (
                                <Button type="button" variant="outline" size="sm" onClick={onViewMedicalCertificate} className="gap-2">
                                    <Eye className="size-4" /> View
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={onIssueMedicalCertificate}
                                disabled={!certificateSchemaReady}
                                className="gap-2 border-blue-200 text-[#155dfc] hover:bg-blue-50"
                            >
                                <PenLine className="size-4" />
                                {medicalCertificate ? 'Replace medical cert' : 'Issue medical cert'}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function VaccinationPanel({ vaccinations, petId, veterinarian, onSaved }) {
    const veterinarianName = userDisplayName(veterinarian);
    const veterinarianLicense = userLicenseNumber(veterinarian);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draft, setDraft] = useState({
        name: '',
        date: '',
        nextDue: '',
        applicator: veterinarianName,
        veterinarianLicense,
        notes: ''
    });

    useEffect(() => {
        setDraft(current => ({
            ...current,
            applicator: current.applicator || veterinarianName,
            veterinarianLicense: current.veterinarianLicense || veterinarianLicense
        }));
    }, [veterinarianLicense, veterinarianName]);

    const updateDraft = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
    };

    const resetDraft = () => {
        setDraft({
            name: '',
            date: '',
            nextDue: '',
            applicator: veterinarianName,
            veterinarianLicense,
            notes: ''
        });
    };

    const saveVaccination = async () => {
        if (!draft.name.trim() || !draft.date || !draft.nextDue) {
            toast.error('Vaccine name, date given, and next due date are required.');
            return;
        }
        if (draft.nextDue < draft.date) {
            toast.error('Next due date cannot be earlier than the date given.');
            return;
        }

        setIsSaving(true);
        try {
            await savePetMedicalRecord(petId, {
                type: 'vaccination',
                action: 'add',
                name: draft.name.trim(),
                date: draft.date,
                nextDue: draft.nextDue,
                applicator: draft.applicator.trim() || veterinarianName,
                veterinarianLicense: draft.veterinarianLicense.trim(),
                notes: draft.notes.trim(),
                status: 'completed'
            });
            await onSaved?.();
            toast.success('Vaccination record added.');
            setIsDialogOpen(false);
            resetDraft();
        } catch (error) {
            console.error('Failed to add vaccination record:', error);
            toast.error('The vaccination record could not be added. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Syringe className="size-5 text-[#155dfc]" />
                            <h3 className="text-lg font-black text-slate-950">Vaccination Records</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="w-fit border-0 bg-blue-50 text-[#155dfc]">
                                {vaccinations.length} vaccine{vaccinations.length === 1 ? '' : 's'}
                            </Badge>
                            <Button type="button" size="sm" onClick={() => setIsDialogOpen(true)} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                <Plus className="size-4" />
                                Add Vaccination Record
                            </Button>
                        </div>
                    </div>
                </header>

                {vaccinations.length === 0 ? (
                    <div className="p-5 text-sm font-semibold text-slate-400">No vaccination records saved for this pet.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {vaccinations.map((vaccine, index) => {
                            const source = vaccinationSourceRecord(vaccine);
                            const canDrag = Boolean(source.sourceId);

                            return (
                                <div
                                    key={vaccine.id || index}
                                    draggable={canDrag}
                                    onDragStart={(event) => {
                                        if (!canDrag) return;
                                        event.dataTransfer.setData(MEDICAL_RECORD_DRAG_TYPE, dragPayload('vaccination', source));
                                        event.dataTransfer.setData('application/json', JSON.stringify(source));
                                        event.dataTransfer.setData('text/plain', source.title);
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="grid cursor-grab gap-3 px-5 py-4 text-sm transition hover:bg-blue-50/30 active:cursor-grabbing md:grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr_1fr_0.9fr] md:items-center"
                                >
                                    <VaccineCell label="Vaccine" value={vaccine.name || 'Unnamed vaccine'} strong />
                                    <VaccineCell label="Date Given" value={formatDisplayDate(vaccine.date)} />
                                    <VaccineCell label="Next Due" value={formatDisplayDate(vaccine.nextDue)} highlight />
                                    <VaccineCell label="Veterinarian" value={vaccine.applicator || vaccine.veterinarianName || 'N/A'} />
                                    <div className="flex flex-wrap items-center justify-between gap-2 md:justify-start">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
                                        <Badge className={`w-fit border-0 ${vaccine.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                                            {vaccine.status || 'completed'}
                                        </Badge>
                                        {vaccine.isAddedToOrganizedRecord && (
                                            <Badge className="gap-1 border-0 bg-blue-50 text-[#155dfc]">
                                                <CheckCircle2 className="size-3" />
                                                Copied
                                            </Badge>
                                        )}
                                        <GripVertical className="hidden size-4 text-slate-300 md:block" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <Dialog open={isDialogOpen} onOpenChange={(open) => !isSaving && setIsDialogOpen(open)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Vaccination Record</DialogTitle>
                        <DialogDescription>Record a vaccine administered to this pet.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="vaccination-name">Vaccine name</Label>
                            <Input id="vaccination-name" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="e.g. Anti-rabies" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vaccination-date">Date given</Label>
                            <Input id="vaccination-date" type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vaccination-next-due">Next due date</Label>
                            <Input id="vaccination-next-due" type="date" min={draft.date || undefined} value={draft.nextDue} onChange={(event) => updateDraft('nextDue', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vaccination-vet">Veterinarian</Label>
                            <Input id="vaccination-vet" value={draft.applicator} onChange={(event) => updateDraft('applicator', event.target.value)} placeholder="Veterinarian name" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vaccination-license">License number</Label>
                            <Input id="vaccination-license" value={draft.veterinarianLicense} onChange={(event) => updateDraft('veterinarianLicense', event.target.value)} placeholder="PRC license number" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="vaccination-notes">Notes</Label>
                            <Textarea id="vaccination-notes" value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Optional notes" rows={4} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="button" onClick={saveVaccination} disabled={isSaving} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Syringe className="size-4" />}
                            Save Vaccination
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function VaccineCell({ label, value, strong = false, highlight = false }) {
    return (
        <div className="flex items-start justify-between gap-3 md:block">
            <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">{label}</span>
            <span className={`min-w-0 break-words text-right md:text-left ${strong ? 'font-black text-slate-900' : 'font-semibold'} ${highlight ? 'text-[#155dfc]' : 'text-slate-700'}`}>
                {value || 'N/A'}
            </span>
        </div>
    );
}

function PreviewInfo({ label, value }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{value || 'N/A'}</p>
        </div>
    );
}

function LoadingPanel() {
    return (
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Loader2 className="size-5 animate-spin text-[#155dfc]" />
                Loading medical records...
            </div>
        </div>
    );
}

function EmptyPanel({ icon, title, message }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            {createElement(icon, { className: 'mx-auto mb-4 size-12 text-slate-300' })}
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{message}</p>
        </div>
    );
}

function RecordGroup({
    group,
    isEditing,
    draft,
    isSaving,
    onDrop,
    onEdit,
    onDelete,
    onDraftChange,
    onSaveEdit,
    onCancelEdit,
    autosaveStatus,
    onEditItem,
    onRemoveItem,
    onPreview
}) {
    return (
        <article
            onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={onDrop}
            className="overflow-hidden rounded-xl border border-blue-300 bg-white shadow-sm ring-2 ring-blue-100 transition dark:border-blue-800 dark:bg-slate-900 dark:ring-blue-950"
        >
            <header className="border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                {isEditing ? (
                    <div className="space-y-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={draft.title}
                                    onChange={(event) => onDraftChange(current => ({ ...current, title: event.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Group Summary</Label>
                                <Textarea
                                    value={draft.summary}
                                    onChange={(event) => onDraftChange(current => ({ ...current, summary: event.target.value }))}
                                    placeholder="Treatment summary"
                                    className="min-h-24"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                                <Checkbox
                                    checked={draft.visibleToOwner}
                                    onCheckedChange={(checked) => onDraftChange(current => ({ ...current, visibleToOwner: checked }))}
                                />
                                Visible to pet owner print view
                            </label>
                            <div className="flex flex-col gap-2 sm:items-end">
                                {autosaveText(autosaveStatus) && (
                                    <Badge className={`w-fit border-0 ${
                                        autosaveStatus === 'error'
                                            ? 'bg-red-50 text-red-700'
                                            : autosaveStatus === 'saving'
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-green-50 text-green-700'
                                    }`}>
                                        {autosaveText(autosaveStatus)}
                                    </Badge>
                                )}
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button type="button" variant="outline" onClick={onCancelEdit}>
                                        Cancel
                                    </Button>
                                    <Button type="button" onClick={onSaveEdit} disabled={isSaving} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                        {isSaving && <Loader2 className="size-4 animate-spin" />}
                                        Apply Summary
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-black text-slate-950 dark:text-white">{group.title}</h3>
                                <Badge className="border-0 bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">Active</Badge>
                                {!group.visibleToOwner && <Badge className="border-0 bg-amber-50 text-amber-700">Internal</Badge>}
                            </div>
                            {group.summary && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600 dark:text-slate-300">{group.summary}</p>}
                            {group.updatedByName && (
                                <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                    Edited by {editorLabel(group.updatedByName)}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={onEdit} className="gap-1">
                                <Pencil className="size-3" />
                                Edit
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={onDelete} className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
                                <Trash2 className="size-3" />
                                Delete
                            </Button>
                        </div>
                    </div>
                )}
            </header>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {asArray(group.items).length === 0 ? (
                    <div className="m-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center dark:border-blue-900 dark:bg-blue-950/20">
                        <FolderOpen className="mx-auto size-8 text-blue-300 dark:text-blue-700" />
                        <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">This summary is ready for records</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                            Use Add in the source panel, or drag a service or vaccination record here.
                        </p>
                    </div>
                ) : (
                    group.items.map((item) => (
                        <GroupedItem
                            key={item.itemId}
                            item={item}
                            onEdit={() => onEditItem(item)}
                            onRemove={() => onRemoveItem(item)}
                            onPreview={onPreview}
                        />
                    ))
                )}
            </div>
        </article>
    );
}

function GroupedItem({ item, onEdit, onRemove, onPreview }) {
    const source = effectiveItemRecord(item);
    const attachments = recordAttachments(source);

    return (
        <section className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{formatDisplayDate(item.serviceDate || source.serviceDate)}</p>
                    <h4 className="mt-1 break-words text-base font-black text-slate-900">{organizedItemTitle(item)}</h4>
                    {item.updatedByName && (
                        <p className="mt-1 text-xs font-bold text-slate-400">Edited by {editorLabel(item.updatedByName)}</p>
                    )}
                    {item.summary && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{item.summary}</p>}
                    {item.revisionNotes && (
                        <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-sm font-semibold text-amber-800">{item.revisionNotes}</p>
                    )}
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={onEdit} className="gap-1">
                        <Pencil className="size-3" />
                        Revise
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={onRemove} className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
                        <Trash2 className="size-3" />
                        Remove
                    </Button>
                </div>
            </div>
            {attachments.length > 0 && (
                <AttachmentStrip attachments={attachments} onPreview={onPreview} />
            )}
        </section>
    );
}

function ServiceRecordCard({ record, onOpenPreview, onPreview, onAdd, isAddedToTarget, isAdding }) {
    const attachments = recordAttachments(record);
    const openPreview = () => {
        onOpenPreview?.();
    };

    return (
        <article
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(MEDICAL_RECORD_DRAG_TYPE, dragPayload('service', record));
                event.dataTransfer.setData('application/json', JSON.stringify(record));
                event.dataTransfer.setData('text/plain', record.title || 'Service record');
                event.dataTransfer.effectAllowed = 'copy';
            }}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{sourceLabel(record)}</Badge>
                        {isAddedToTarget && (
                            <Badge className="gap-1 border-0 bg-green-50 text-green-700">
                                <CheckCircle2 className="size-3" />
                                Included
                            </Badge>
                        )}
                    </div>
                    <button type="button" onClick={openPreview} className="break-words text-left text-sm font-black text-slate-950 hover:text-[#155dfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] dark:text-white dark:hover:text-blue-300">
                        {record.title || 'Service record'}
                    </button>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <CalendarDays className="size-3" />
                        {formatDisplayDate(record.serviceDate)}
                    </p>
                </div>
                <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" aria-hidden="true" />
            </div>
            {record.summary && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">{record.summary}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                {record.billingStatus && <span>Billing: {record.billingStatus}</span>}
                {prescriptionCount(record) > 0 && <span>{prescriptionCount(record)} Rx</span>}
                {attachments.length > 0 && <span>{attachments.length} file{attachments.length === 1 ? '' : 's'}</span>}
            </div>
            {attachments.length > 0 && <AttachmentStrip attachments={attachments.slice(0, 4)} onPreview={onPreview} compact />}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <Button type="button" size="sm" variant="outline" onClick={openPreview} className="gap-1.5">
                    <Eye className="size-3.5" />
                    Details
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={onAdd}
                    disabled={isAddedToTarget || isAdding}
                    className="gap-1.5 bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                >
                    {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : isAddedToTarget ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}
                    {isAdding ? 'Adding' : isAddedToTarget ? 'Included' : 'Add'}
                </Button>
            </div>
        </article>
    );
}

function AttachmentStrip({ attachments, onPreview, compact = false, onRemove }) {
    return (
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
            {attachments.map((attachment, index) => (
                <EmrAttachmentCard
                    key={attachment.id || `${attachment.url || attachment.relativeUrl}-${index}`}
                    attachment={attachment}
                    onPreview={onPreview}
                    onRemove={onRemove ? () => onRemove(attachment, index) : null}
                />
            ))}
        </div>
    );
}

function EmrAttachmentCard({ attachment, onPreview, onRemove }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const rawPath = attachment?.preview || attachment?.url || attachment?.relativeUrl || '';
    const url = imageUrl(attachment);
    const canPreview = isImage(attachment);
    const title = attachment?.name || 'Attachment';
    const isPdf = String(attachment?.mimeType || attachment?.mime_type || '').toLowerCase() === 'application/pdf'
        || rawPath.split(/[?#]/)[0].toLowerCase().endsWith('.pdf');

    const handleView = async (event) => {
        event.stopPropagation();
        if (!rawPath || isOpening) return;
        if (canPreview) {
            onPreview({ src: rawPath, alt: title });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(rawPath);
        } catch (error) {
            console.error('Failed to open a medical-record attachment:', error);
            toast.error('The medical-record attachment could not be opened. Please try again.');
        } finally {
            setIsOpening(false);
        }
    };

    const handleDownload = async (event) => {
        event.stopPropagation();
        if (!rawPath || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(rawPath, title);
        } catch (error) {
            console.error('Failed to download a medical-record attachment:', error);
            toast.error('The medical-record attachment could not be downloaded. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50" title={title}>
            <div className="flex h-20 items-center justify-center bg-white">
                {canPreview && url ? (
                    <ProtectedImage
                        src={rawPath}
                        alt={title}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                    />
                ) : (
                    <FileText className="size-5 text-slate-300" />
                )}
            </div>
            <p className="truncate px-2 pt-2 text-xs font-semibold text-slate-600">{title}</p>
            <div className={`grid gap-1 p-2 ${onRemove ? (isPdf ? 'grid-cols-2' : 'grid-cols-3') : (isPdf ? 'grid-cols-1' : 'grid-cols-2')}`}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleView}
                    disabled={!rawPath || isOpening}
                    className="h-8 gap-1 px-2 text-xs"
                >
                    {isOpening ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                    {isPdf ? 'Open PDF' : 'View'}
                </Button>
                {!isPdf && <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!rawPath || isDownloading}
                    className="h-8 gap-1 px-2 text-xs"
                >
                    {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    Download
                </Button>}
                {onRemove && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRemove();
                        }}
                        className="h-8 gap-1 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove ${title} from this revision`}
                    >
                        <Trash2 className="size-3" />
                        <span className={isPdf ? '' : 'sr-only'}>Remove</span>
                    </Button>
                )}
            </div>
        </div>
    );
}

function RevisionClinicalEditor({ snapshot, onChange }) {
    const fields = [
        ['chiefComplaint', 'Chief Complaint'],
        ['majorSymptoms', 'Major Symptoms'],
        ['symptoms', 'Symptoms'],
        ['physicalExam', 'Physical Exam'],
        ['diagnosis', 'Diagnosis / Findings'],
        ['recommendations', 'Recommendations'],
        ['treatment', 'Treatment'],
        ['medications', 'Medications'],
        ['labResults', 'Laboratory Results'],
        ['notes', 'Clinical Notes']
    ];

    return (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900/60 dark:bg-slate-900">
            <div>
                <Label>Clinical history and diagnosis</Label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Revise any field below. Blank fields remain blank in the revised copy.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {fields.map(([field, label]) => (
                    <div key={field} className={`space-y-1.5 ${['physicalExam', 'diagnosis', 'treatment', 'labResults', 'notes'].includes(field) ? 'sm:col-span-2' : ''}`}>
                        <Label htmlFor={`revision-${field}`} className="text-xs">{label}</Label>
                        <Textarea
                            id={`revision-${field}`}
                            value={snapshot?.[field] || ''}
                            onChange={(event) => onChange(field, event.target.value)}
                            className="min-h-20 resize-y"
                        />
                    </div>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="revision-follow-up" className="text-xs">Follow-up date</Label>
                    <Input
                        id="revision-follow-up"
                        type="date"
                        value={snapshot?.followUp || ''}
                        onChange={(event) => onChange('followUp', event.target.value)}
                        className="sm:max-w-64"
                    />
                </div>
            </div>
        </div>
    );
}

function SourceRecordDetails({ record, petId, onPreview }) {
    if (!record) {
        return <p className="text-sm font-semibold text-slate-500">No source snapshot is available for this grouped item.</p>;
    }

    const attachments = recordAttachments(record);
    const prescriptions = [
        ...asArray(record.prescriptions),
        ...asArray(record.customSections).flatMap(section => asArray(section.prescriptions || section.prescription))
    ];
    const customSections = asArray(record.customSections).filter(section => {
        if (!section || typeof section !== 'object') return false;
        return Boolean(section.value || section.notes || section.majorSymptoms || section.description);
    });
    const vitalSigns = record.vitalSigns && typeof record.vitalSigns === 'object' && !Array.isArray(record.vitalSigns)
        ? Object.entries(record.vitalSigns).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        : [];
    const charges = asArray(record.charges);
    const totals = record.totals || {};
    const clinical = dedupeClinicalFields([
        ['chiefComplaint', record.chiefComplaint],
        ['majorSymptoms', record.majorSymptoms],
        ['symptoms', record.symptoms],
        ['physicalExam', record.physicalExam],
        ['diagnosis', record.diagnosis],
        ['recommendations', record.recommendations],
        ['treatment', record.treatment],
        ['medications', record.medications],
        ['labResults', record.labResults],
        ['followUp', record.followUp ? formatDisplayDate(record.followUp) : ''],
        ['notes', record.notes]
    ]);

    return (
        <div className="space-y-4 text-sm">
            {petId && <PrescriptionPlanPanel petId={petId} canManage allowStart={false} title="Live prescription plan" />}
            <div className="grid grid-cols-2 gap-3">
                <Detail label="Source" value={sourceLabel(record)} />
                <Detail label="Date" value={formatDisplayDate(record.serviceDate)} />
                <Detail label="Vet" value={record.veterinarianName || 'Clinic Team'} />
                <Detail label="Billing" value={record.billingStatus || record.status || 'N/A'} />
            </div>
            <TextBlock icon={AlertCircle} label="Chief Complaint" value={clinical.chiefComplaint} />
            <TextBlock icon={ClipboardList} label="Major Symptoms" value={clinical.majorSymptoms} />
            <TextBlock icon={ClipboardList} label="Symptoms" value={clinical.symptoms} />
            <TextBlock icon={ClipboardList} label="Physical Exam" value={clinical.physicalExam} />
            <TextBlock icon={Stethoscope} label="Diagnosis" value={clinical.diagnosis} />
            <TextBlock icon={ClipboardList} label="Recommendations" value={clinical.recommendations} />
            <TextBlock icon={ClipboardList} label="Treatment" value={clinical.treatment} />
            <TextBlock icon={Pill} label="Medications" value={clinical.medications} />
            <TextBlock icon={ClipboardList} label="Lab Results" value={clinical.labResults} />
            <TextBlock icon={CalendarDays} label="Follow-up" value={clinical.followUp} />
            <TextBlock icon={AlertCircle} label="Notes" value={clinical.notes} />
            {vitalSigns.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Vital Signs</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {vitalSigns.map(([label, value]) => (
                            <Detail key={label} label={label.replace(/_/g, ' ')} value={String(value)} />
                        ))}
                    </div>
                </div>
            )}
            {customSections.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Additional History</p>
                    <div className="space-y-2">
                        {customSections.map((section, index) => (
                            <TextBlock
                                key={section.id || index}
                                icon={FileText}
                                label={section.title || section.label || section.type || `Clinical Note ${index + 1}`}
                                value={section.value || section.notes || section.majorSymptoms || section.description}
                            />
                        ))}
                    </div>
                </div>
            )}
            {prescriptions.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <p className="mb-2 font-black text-[#155dfc]">Prescriptions</p>
                    <div className="space-y-2">
                        {prescriptions.map((prescription, index) => (
                            <p key={prescription.id || index} className="rounded-md bg-blue-50 p-2 font-semibold text-slate-700">
                                {prescription.medicine || prescription.name || 'Medication'}
                            </p>
                        ))}
                    </div>
                </div>
            )}
            {charges.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Billing Lines</p>
                    <div className="divide-y divide-slate-100">
                        {charges.map((charge, index) => (
                            <div key={charge.id || index} className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem] sm:items-center">
                                <p className="font-bold text-slate-800">{charge.description || charge.serviceName || charge.itemName || 'Charge'}</p>
                                <p className="text-xs font-semibold text-slate-500">Qty {charge.quantity || 1}</p>
                                <p className="font-black text-slate-900">{formatCurrency(charge.subtotal ?? charge.unitPrice ?? 0)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                        <Detail label="Charges" value={formatCurrency(totals.charges)} />
                        <Detail label="Paid" value={formatCurrency(totals.paid)} />
                        <Detail label="Balance" value={formatCurrency(totals.balance)} />
                    </div>
                </div>
            )}
            {attachments.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Related files · {attachments.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Diagnosis attachments, grooming photos, and boarding uploads remain linked to their original source.</p>
                    <AttachmentStrip attachments={attachments} onPreview={onPreview} />
                </section>
            )}
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-bold text-slate-800">{value || 'N/A'}</p>
        </div>
    );
}

function TextBlock({ icon, label, value }) {
    if (!value) return null;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                {createElement(icon, { className: 'size-4' })}
                {label}
            </div>
            <p className="whitespace-pre-wrap font-semibold leading-6 text-slate-700">{value}</p>
        </div>
    );
}
