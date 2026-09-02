import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Download,
    Eye,
    FileText,
    GripVertical,
    Loader2,
    PanelRightClose,
    PanelRightOpen,
    PawPrint,
    Pencil,
    Pill,
    Plus,
    Search,
    Stethoscope,
    Syringe,
    Trash2
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
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
import { fetchProfile } from '../../services/profileService';
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
        return 'Source Diagnosis Sheet';
    }

    return record?.title || sourceLabel(record);
}

function editorLabel(name) {
    const value = String(name || '').trim();
    if (!value) return '';

    return value.toLowerCase().startsWith('dr.') ? value : `Dr. ${value}`;
}

function imageUrl(attachment) {
    return resolveImageUrl(attachment?.url || attachment?.relativeUrl || '');
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
        revisionNotes: draft?.revisionNotes || ''
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
    const [itemDraft, setItemDraft] = useState({ title: '', summary: '', revisionNotes: '' });
    const [itemAutosaveStatus, setItemAutosaveStatus] = useState('idle');
    const [isPetPreviewOpen, setIsPetPreviewOpen] = useState(true);
    const [isServiceRecordsOpen, setIsServiceRecordsOpen] = useState(true);
    const [viewer, setViewer] = useState(null);
    const [previewRecord, setPreviewRecord] = useState(null);
    const [recordUpdateContext] = useState(readRecordUpdateContext);
    const [highlightedRequest, setHighlightedRequest] = useState(null);
    const [isCompletingRequest, setIsCompletingRequest] = useState(false);
    const groupAutosaveTimerRef = useRef(null);
    const itemAutosaveTimerRef = useRef(null);
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

    const finishRecordUpdateRequest = async () => {
        if (!highlightedRequest?.requestId || isCompletingRequest) return;

        setIsCompletingRequest(true);
        try {
            const response = await updateRecordUpdateRequest(highlightedRequest.requestId, {
                action: 'complete',
                userId: currentUserId,
                veterinarianNotes: 'Medical record update completed.'
            });

            if (response?.request) {
                setHighlightedRequest(response.request);
            } else {
                setHighlightedRequest(current => current ? { ...current, status: 'completed' } : current);
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
            return;
        }
        if (!record?.sourceType || !record?.sourceId) {
            toast.error('This record cannot be added to an organized summary.');
            return;
        }
        if (addedToGroup(record, targetGroupId)) {
            toast.success('That record is already in this organized summary.');
            return;
        }

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
        } catch (error) {
            console.error('Failed to add a medical record to an organized summary:', error);
            toast.error('The record could not be added to the organized summary. Please try again.');
        }
    };

    const openEditItem = (item) => {
        const nextDraft = {
            title: item.title || '',
            summary: cleanOrganizedSummary(item.summary),
            revisionNotes: item.revisionNotes || ''
        };
        setEditingItem(item);
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
                <Card petHover={false} className="relative z-40 overflow-visible border-slate-200">
                    <CardContent className="p-4">
                        <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center">
                            <div>
                                <h3 className="text-base font-black text-slate-950">Find Pet</h3>
                                <p className="mt-1 text-xs font-semibold text-slate-500">Search by name, pet ID, breed, or owner.</p>
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
                                    placeholder="Type to search pets"
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
                                                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-slate-950">
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
                    />
                )}

                <div className={isPetPreviewOpen ? '' : 'xl:hidden'}>
                    <PetPreviewCard
                        pet={selectedPet}
                        onCollapse={() => setIsPetPreviewOpen(false)}
                    />
                </div>
            </section>

            {!selectedPetId ? (
                <EmptyPanel
                    icon={PawPrint}
                    title="No pet selected"
                    message="Search and select a pet to view or edit medical records."
                />
            ) : !isPetPreviewOpen && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPetPreviewOpen(true)}
                    aria-label="Show pet information"
                    aria-expanded={isPetPreviewOpen}
                    className="fixed right-3 top-28 z-40 hidden size-14 items-center justify-center rounded-full border border-blue-200 bg-white p-0 text-[#155dfc] shadow-xl ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 xl:flex"
                >
                    <PanelRightOpen className="size-5" strokeWidth={2.4} />
                </Button>
            )}

            {selectedPetId && recordsData?.schemaReady === false && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    Medical records are temporarily unavailable. Try again later or contact support.
                </div>
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

            {selectedPetId && (
            <section className={`grid min-h-[38rem] gap-5 ${isServiceRecordsOpen ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : 'xl:grid-cols-1'}`}>
                <main className="min-w-0 space-y-4">
                    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                                <ClipboardList className="size-5" />
                            </span>
                            <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-950 dark:text-white">Organized Medical Records</h3>
                            {selectedPet && (
                                <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-300">
                                    {selectedPet.name || selectedPet.petName} - {selectedPet.species || 'Pet'} {selectedPet.ownerName ? `- ${selectedPet.ownerName}` : ''}
                                </p>
                            )}
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
                            {groups.length > 0 && (
                                <Select value={String(selectedGroupId)} onValueChange={setSelectedGroupId}>
                                    <SelectTrigger className="w-full sm:w-72">
                                        <SelectValue placeholder="Select organized record" displayValue={selectedGroup?.title} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map((group) => (
                                            <SelectItem key={group.groupId} value={String(group.groupId)}>
                                                {group.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button
                                type="button"
                                onClick={openCreateGroup}
                                disabled={!selectedPetId || isSavingGroup}
                                aria-label="Create a new organized summary"
                                className="shrink-0 gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                            >
                                {isSavingGroup ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                <span>New Organized Summary</span>
                            </Button>
                        </div>
                    </div>

                    {isLoadingRecords ? (
                        <LoadingPanel />
                    ) : groups.length === 0 ? (
                        <EmptyPanel
                            icon={ClipboardList}
                            title="No organized records"
                            message="Create an organized summary, then drop service or vaccination records into it."
                        />
                    ) : (
                        <div className="space-y-4">
                            {groups.map((group) => (
                                <RecordGroup
                                    key={group.groupId}
                                    group={group}
                                    selected={String(group.groupId) === String(selectedGroupId)}
                                    onSelect={() => setSelectedGroupId(String(group.groupId))}
                                    onDrop={(event) => handleDropOnGroup(event, group)}
                                    onEdit={() => openEditGroup(group)}
                                    onDelete={() => removeGroup(group)}
                                    isEditing={String(editingGroupId) === String(group.groupId)}
                                    draft={groupDraft}
                                    onDraftChange={setGroupDraft}
                                    onSaveEdit={() => saveGroup(group.groupId)}
                                    onCancelEdit={cancelGroupEdit}
                                    isSaving={isSavingGroup}
                                    autosaveStatus={groupAutosaveStatus}
                                    onEditItem={openEditItem}
                                    onRemoveItem={removeItem}
                                    onPreview={setViewer}
                                />
                            ))}
                        </div>
                    )}
                </main>

                <aside className={`relative min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start ${isServiceRecordsOpen ? '' : 'xl:hidden'}`}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsServiceRecordsOpen(false)}
                            aria-label="Hide service records"
                            aria-expanded={isServiceRecordsOpen}
                            className="absolute -left-5 top-5 z-10 hidden size-10 rounded-full border-blue-200 bg-white p-0 text-[#155dfc] shadow-lg ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 xl:inline-flex"
                        >
                            <PanelRightClose className="size-5" strokeWidth={2.4} />
                        </Button>

                        <div className="border-b border-slate-100 p-4 pl-6">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 font-black text-slate-950">
                                        <ClipboardList className="size-5 text-[#155dfc]" />
                                        Service Records
                                    </h3>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Drag into a group summary.</p>
                                </div>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{serviceHistory.length}</Badge>
                            </div>
                        </div>

                        <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
                            {serviceHistory.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
                                    No paid or finished service records found for this pet.
                                </p>
                            ) : (
                                serviceHistory.map((record) => (
                                    <ServiceRecordCard
                                        key={recordKey(record)}
                                        record={record}
                                        onOpenPreview={() => setPreviewRecord(record)}
                                        onPreview={setViewer}
                                    />
                                ))
                            )}
                        </div>
                    </aside>
            </section>
            )}

            {selectedPetId && !isServiceRecordsOpen && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsServiceRecordsOpen(true)}
                    aria-label="Show service records"
                    aria-expanded={isServiceRecordsOpen}
                    className="fixed right-3 top-48 z-40 hidden size-14 items-center justify-center rounded-full border border-blue-200 bg-white p-0 text-[#155dfc] shadow-xl ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 xl:flex"
                >
                    <PanelRightOpen className="size-5" strokeWidth={2.4} />
                    {serviceHistory.length > 0 && (
                        <span className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow-md">
                            {serviceHistory.length}
                        </span>
                    )}
                </Button>
            )}

            <Dialog open={Boolean(previewRecord)} onOpenChange={(open) => !open && setPreviewRecord(null)}>
                <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{previewRecord?.title || 'Service Record'}</DialogTitle>
                        <DialogDescription>
                            {previewRecord ? `${sourceLabel(previewRecord)} - ${formatDisplayDate(previewRecord.serviceDate)}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <SourceRecordDetails record={previewRecord} onPreview={setViewer} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewRecord(null)}>Close</Button>
                        <Button
                            onClick={() => previewRecord && copyRecordToGroup(previewRecord)}
                            disabled={!selectedGroupId || (previewRecord && addedToGroup(previewRecord, selectedGroupId))}
                            className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                        >
                            Add to Target Summary
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
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <DialogTitle>Modify Grouped Diagnosis Summary</DialogTitle>
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
                            Edit the curated summary without changing the original diagnosis or billing record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="font-black text-slate-950">Source Diagnosis Sheet</h3>
                            <SourceRecordDetails record={editingItem?.sourceSnapshot} onPreview={setViewer} />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Grouped Title</Label>
                                <Input value={itemDraft.title} onChange={(event) => setItemDraft(current => ({ ...current, title: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Source Diagnosis Sheet</Label>
                                <Textarea
                                    value={itemDraft.summary}
                                    onChange={(event) => setItemDraft(current => ({ ...current, summary: event.target.value }))}
                                    className="min-h-40"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Veterinarian Revision Notes</Label>
                                <Textarea
                                    value={itemDraft.revisionNotes}
                                    onChange={(event) => setItemDraft(current => ({ ...current, revisionNotes: event.target.value }))}
                                            placeholder="Revision notes"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                        <Button onClick={saveItem} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">Save Revision</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Medical record image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}

function PetPreviewCard({ pet, onCollapse }) {
    const imageSrc = pet?.profileImage || pet?.setpetImage_url || '';
    const petName = pet?.name || pet?.petName || 'No pet selected';
    const petId = pet?.id || pet?.pet_sharable_ID || pet?.dbId || pet?.db_id || 'N/A';

    return (
        <Card className="overflow-hidden border-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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
                            <h3 className="break-words text-lg font-black text-slate-950">{petName}</h3>
                            <Badge className="border-0 bg-blue-50 text-[#155dfc]">
                                {pet?.status || 'Active'}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            {[pet?.species, pet?.breed].filter(Boolean).join(' - ') || 'Species not set'}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Pet Information</p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCollapse}
                    aria-label="Hide pet information"
                    className="hidden h-9 gap-2 border-blue-200 bg-white text-[#155dfc] hover:border-blue-300 hover:bg-blue-50 xl:inline-flex"
                >
                    <PanelRightClose className="size-4" strokeWidth={2.4} />
                    Hide
                </Button>
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

function RecordUpdateHighlight({ request, onFinish, isFinishing }) {
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
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-800">{value || 'N/A'}</p>
        </div>
    );
}

function LoadingPanel() {
    return (
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                <Loader2 className="size-5 animate-spin text-[#155dfc]" />
                Loading medical records...
            </div>
        </div>
    );
}

function EmptyPanel({ icon, title, message }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
            {createElement(icon, { className: 'mx-auto mb-4 size-12 text-slate-300' })}
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{message}</p>
        </div>
    );
}

function RecordGroup({
    group,
    selected,
    isEditing,
    draft,
    isSaving,
    onSelect,
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
            className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${selected ? 'border-[#155dfc] ring-2 ring-blue-100' : 'border-slate-200'}`}
        >
            <header className="border-b border-slate-100 bg-slate-50 p-4">
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
                        <button type="button" onClick={onSelect} className="min-w-0 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-black text-slate-950">{group.title}</h3>
                                {selected && <Badge className="border-0 bg-blue-50 text-[#155dfc]">Target</Badge>}
                                {!group.visibleToOwner && <Badge className="border-0 bg-amber-50 text-amber-700">Internal</Badge>}
                            </div>
                            {group.summary && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">{group.summary}</p>}
                            {group.updatedByName && (
                                <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                    Edited by {editorLabel(group.updatedByName)}
                                </p>
                            )}
                        </button>
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

            <div className="divide-y divide-slate-100">
                {asArray(group.items).length === 0 ? (
                    <div className="p-5 text-sm font-semibold text-slate-400">
                        Drop service records or vaccination rows here.
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
    const source = item.sourceSnapshot || {};
    const attachments = [...asArray(source.attachments), ...asArray(source.sourceUploads)];

    return (
        <section className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{formatDisplayDate(item.serviceDate || source.serviceDate)}</p>
                    <h4 className="mt-1 break-words text-base font-black text-slate-900">{item.title}</h4>
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

function ServiceRecordCard({ record, onOpenPreview, onPreview }) {
    const attachments = [...asArray(record.attachments), ...asArray(record.sourceUploads)];
    const openPreview = () => {
        onOpenPreview?.();
    };

    return (
        <article
            role="button"
            tabIndex={0}
            draggable
            onClick={openPreview}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPreview();
                }
            }}
            onDragStart={(event) => {
                event.dataTransfer.setData(MEDICAL_RECORD_DRAG_TYPE, dragPayload('service', record));
                event.dataTransfer.setData('application/json', JSON.stringify(record));
                event.dataTransfer.setData('text/plain', record.title || 'Service record');
                event.dataTransfer.effectAllowed = 'copy';
            }}
            className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow active:cursor-grabbing"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-slate-100 text-slate-700">{sourceLabel(record)}</Badge>
                        {record.isAddedToOrganizedRecord && (
                            <Badge className="gap-1 border-0 bg-green-50 text-green-700">
                                <CheckCircle2 className="size-3" />
                                Added
                            </Badge>
                        )}
                    </div>
                    <h4 className="break-words text-sm font-black text-slate-950">{record.title || 'Service record'}</h4>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <CalendarDays className="size-3" />
                        {formatDisplayDate(record.serviceDate)}
                    </p>
                </div>
                <GripVertical className="mt-1 size-4 shrink-0 text-slate-300" />
            </div>
            {record.summary && (
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{record.summary}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                {record.billingStatus && <span>Billing: {record.billingStatus}</span>}
                {prescriptionCount(record) > 0 && <span>{prescriptionCount(record)} Rx</span>}
                {attachments.length > 0 && <span>{attachments.length} file{attachments.length === 1 ? '' : 's'}</span>}
            </div>
            {attachments.length > 0 && <AttachmentStrip attachments={attachments.slice(0, 4)} onPreview={onPreview} compact />}
        </article>
    );
}

function AttachmentStrip({ attachments, onPreview, compact = false }) {
    return (
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
            {attachments.map((attachment, index) => (
                <EmrAttachmentCard
                    key={attachment.id || `${attachment.url || attachment.relativeUrl}-${index}`}
                    attachment={attachment}
                    onPreview={onPreview}
                />
            ))}
        </div>
    );
}

function EmrAttachmentCard({ attachment, onPreview }) {
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
            <div className={`grid gap-1 p-2 ${isPdf ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
            </div>
        </div>
    );
}

function SourceRecordDetails({ record, onPreview }) {
    if (!record) {
        return <p className="text-sm font-semibold text-slate-500">No source snapshot is available for this grouped item.</p>;
    }

    const attachments = [...asArray(record.attachments), ...asArray(record.sourceUploads)];
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
            {attachments.length > 0 && <AttachmentStrip attachments={attachments} onPreview={onPreview} />}
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
