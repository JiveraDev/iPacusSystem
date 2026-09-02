import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Bell,
    Building2,
    CalendarClock,
    Cat,
    CheckCircle,
    ClipboardList,
    Clock,
    CreditCard,
    Dog,
    Eye,
    FileText,
    Home,
    Hotel,
    LayoutGrid,
    Loader2,
    Package,
    PawPrint,
    Plus,
    Printer,
    Receipt,
    Search,
    ShieldCheck,
    Table2,
    Trash2,
    Upload,
    Wrench
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatPhpCurrency } from '../../lib/currency';
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../../lib/philippinePhone';
import { fetchInventoryItems } from '../../services/inventoryApi';
import SignatureCapture from '../SignatureCapture.jsx';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import {
    assignBoardingRoom,
    checkInBoardingBooking,
    checkOutBoardingBooking,
    completeBoardingTask,
    createBoardingDocument,
    createBoardingMaterial,
    createBoardingObservation,
    createBoardingRooms,
    createBoardingTask,
    directBoardingCheckIn,
    fetchBoardingMonitoring,
    fetchBoardingMaterials,
    fetchBoardingRooms,
    removeBoardingMaterial,
    updateBoardingRoom,
    updateDesiredCheckOut
} from '../../services/boardingService';
import { fetchBookings } from '../../services/bookingService';
import { fetchAllPets } from '../../services/petService';
import { fetchServiceCatalog } from '../../services/serviceCatalogService';
import { deleteUpload, uploadDocumentFile } from '../../services/uploadService';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import { assignedBranchId, isBranchSelectionLocked } from '../../lib/branchAccess.js';
import { fetchConsentFiles } from '../../services/consentFileService.js';
import { hasConsentContext, normalizeConsentTemplate } from '../../lib/consentAssignments.js';
import { createAndUploadConsentDocumentPdf } from '../../services/consentDocumentPdf.js';
import { consentDocumentPath, openProtectedDocument } from '../../hooks/useConsentDocumentSource.js';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import ProtectedImage from '../shared/ProtectedImage.jsx';

const FACILITY_LABELS = {
    boarding: 'Kennel Boarding',
    hotel: 'Pet Hotel Boarding'
};

const ROOM_SIZE_LABELS = {
    large: 'Large',
    medium: 'Medium',
    small: 'Small'
};

const ROOM_SIZE_ORDER = ['large', 'medium', 'small'];
const ROOM_SIZE_OPTIONS = ROOM_SIZE_ORDER.map((value) => ({ value, label: ROOM_SIZE_LABELS[value] }));

const OBSERVATION_LABELS = {
    eating: 'Eating',
    bathing: 'Bathing',
    playing: 'Playing',
    behavior: 'Behavior',
    other: 'Other'
};

const TASK_LABELS = {
    feeding: 'Feeding',
    bathing: 'Bathing',
    playing: 'Playing',
    medication: 'Medication',
    inspection: 'Inspection',
    other: 'Other'
};

const DOCUMENT_TYPE_LABELS = {
    monitoring_report: 'Monitoring Report',
    boarding_history: 'Boarding History',
    checkout_summary: 'Checkout Summary',
    diagnosis_reference: 'Diagnosis Reference',
    other: 'Other'
};

const emptyAddRoomForm = {
    branchId: '',
    type: 'boarding',
    roomSize: 'small',
    quantity: '1',
    description: ''
};

const emptyDirectCheckInForm = {
    petId: '',
    type: 'boarding',
    roomSize: 'small',
    roomNumber: '',
    serviceCatalogId: '',
    checkOutDate: '',
    emergencyContact: normalizePhilippinePhoneInput(''),
    notes: ''
};

const emptyObservationForm = {
    assignmentId: '',
    observationType: 'eating',
    notes: ''
};

const emptyTaskForm = {
    assignmentId: '',
    taskType: 'feeding',
    dueAt: '',
    assignedTo: '',
    notes: ''
};

const emptyDocumentForm = {
    assignmentId: '',
    bookingId: '',
    documentType: 'monitoring_report',
    title: '',
    notes: '',
    file: null,
    fileName: ''
};

const emptyMaterialForm = {
    assignmentId: '',
    inventoryId: '',
    quantity: '1',
    unitPrice: '',
    notes: '',
    clientReference: ''
};

const BOARDING_MATERIAL_STORAGE_KEY = 'ipawcus-boarding-material-usage';

function createBoardingMaterialClientReference() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `mat-${crypto.randomUUID()}`;
    }

    return `mat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(value, fallback = 'Not set') {
    if (!value) return fallback;
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDateTime(value, fallback = 'Not started') {
    if (!value) return fallback;
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getTaskStatusStyle(status) {
    const styles = {
        overdue: 'border-red-200 bg-red-50 text-red-700',
        pending: 'border-amber-200 bg-amber-50 text-amber-700',
        completed: 'border-green-200 bg-green-50 text-green-700'
    };

    return styles[status] || styles.pending;
}

function getRoomStatusMeta(status) {
    const meta = {
        occupied: {
            label: 'Boarded',
            note: 'Boarding stay active',
            Icon: PawPrint,
            rail: 'bg-blue-600',
            badge: 'bg-blue-50 text-blue-700',
            card: 'border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
            iconBox: 'bg-blue-50 text-blue-700'
        },
        reserved: {
            label: 'Reserved',
            note: 'Waiting check-in',
            Icon: CalendarClock,
            rail: 'bg-sky-500',
            badge: 'bg-sky-50 text-sky-700',
            card: 'border-sky-200 hover:border-sky-400 hover:shadow-sky-100',
            iconBox: 'bg-sky-50 text-sky-700'
        },
        available: {
            label: 'Available',
            note: 'Ready',
            Icon: CheckCircle,
            rail: 'bg-green-500',
            badge: 'bg-green-50 text-green-700',
            card: 'border-green-200 hover:border-green-400 hover:shadow-green-100',
            iconBox: 'bg-green-50 text-green-700'
        },
        maintenance: {
            label: 'Maintenance',
            note: 'Unavailable',
            Icon: Wrench,
            rail: 'bg-red-500',
            badge: 'bg-red-50 text-red-700',
            card: 'border-red-200 bg-red-50/40 hover:border-red-400 hover:shadow-red-100',
            iconBox: 'bg-red-50 text-red-700'
        }
    };

    return meta[status] || meta.available;
}

function getFacilityMeta(facilityType) {
    if (facilityType === 'hotel') {
        return {
            title: 'Pet Hotel Boarding Rooms',
            unitLabel: 'Rooms',
            unitSingular: 'Room',
            Icon: Hotel,
            accent: 'border-l-blue-600',
            surface: 'bg-blue-50',
            text: 'text-blue-700'
        };
    }

    return {
        title: 'Kennel Boarding',
        unitLabel: 'Kennels',
        unitSingular: 'Kennel',
        Icon: Home,
        accent: 'border-l-green-600',
        surface: 'bg-green-50',
        text: 'text-green-700'
    };
}

function getRoomCode(unit) {
    const facilityPrefix = unit.hotelBoardingType === 'hotel' ? 'H' : 'K';
    const sizePrefix = unit.roomSize === 'small' ? 'S' : unit.roomSize === 'medium' ? 'M' : 'L';

    return `${facilityPrefix}-${sizePrefix}${String(unit.roomNumber).padStart(2, '0')}`;
}

function sortUnitsLargeToSmall(unitsToSort) {
    const sizeRank = Object.fromEntries(ROOM_SIZE_ORDER.map((size, index) => [size, index]));

    return [...unitsToSort].sort((a, b) => {
        const sizeDiff = (sizeRank[a.roomSize] ?? 99) - (sizeRank[b.roomSize] ?? 99);
        if (sizeDiff !== 0) return sizeDiff;

        return (a.roomNumber || 0) - (b.roomNumber || 0);
    });
}

function getPetIcon(species) {
    const normalized = String(species || '').toLowerCase();
    if (normalized.includes('dog')) return Dog;
    if (normalized.includes('cat')) return Cat;

    return PawPrint;
}

function PetSpeciesIcon({ species, className }) {
    const normalized = String(species || '').toLowerCase();

    if (normalized.includes('dog')) {
        return <Dog className={className} />;
    }

    if (normalized.includes('cat')) {
        return <Cat className={className} />;
    }

    return <PawPrint className={className} />;
}

function getPetOptionValue(pet) {
    return String(pet?.db_id || pet?.pet_id || pet?.id || '');
}

function getPetName(pet) {
    return pet?.petName || pet?.pet_name || pet?.name || 'Unnamed pet';
}

function getPetOwnerName(pet) {
    const directName = pet?.ownerName || pet?.owner_name || pet?.owner || pet?.userName || pet?.tempOwnerName || pet?.pet_Temp_owner;

    if (directName) {
        return String(directName).trim();
    }

    return [
        pet?.ownerFirstName || pet?.owner_first_name,
        pet?.ownerLastName || pet?.owner_last_name
    ].filter(Boolean).join(' ').trim();
}

function getPetSearchLabel(pet) {
    return [getPetName(pet), pet?.species].filter(Boolean).join(' - ');
}

function getPetSearchText(pet) {
    return [
        getPetOptionValue(pet),
        getPetName(pet),
        pet?.species,
        pet?.breed,
        getPetOwnerName(pet)
    ].filter(Boolean).join(' ').toLowerCase();
}

function countStayDays(startDate, endDate) {
    if (!startDate || !endDate) return 1;
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    return Number.isFinite(days) && days > 0 ? days : 1;
}

function countOverdueDays(expectedOutDate, currentDate = todayIso()) {
    if (!expectedOutDate) return 0;
    const start = new Date(`${String(expectedOutDate).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(currentDate).slice(0, 10)}T00:00:00`);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    return Number.isFinite(days) && days > 0 ? days : 0;
}

function normalizeInventoryItemsResponse(response) {
    const items = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
            ? response
            : [];

    return items.map((item) => {
        const itemId = Number(item.itemId || item.item_id || item.id || 0);
        const quantity = Number(item.quantity ?? item.stock ?? item.total_quantity ?? 0);
        const costPrice = Number(item.costPrice ?? item.cost_price ?? item.unitCost ?? item.unit_cost ?? item.sellingPrice ?? 0);
        const sellingPrice = Number(item.sellingPrice ?? item.selling_price ?? item.unitPrice ?? item.unit_price ?? costPrice);

        return {
            id: String(item.id || itemId),
            itemId,
            name: item.name || item.itemName || item.item_name || 'Inventory item',
            sku: item.sku || '',
            category: String(item.category || '').toUpperCase(),
            unit: item.unit || 'pcs',
            quantity: Number.isFinite(quantity) ? quantity : 0,
            costPrice: Number.isFinite(costPrice) ? costPrice : 0,
            sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0
        };
    }).filter((item) => item.id && item.itemId > 0);
}

function loadBoardingMaterialUsage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(BOARDING_MATERIAL_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function saveBoardingMaterialUsage(value) {
    localStorage.setItem(BOARDING_MATERIAL_STORAGE_KEY, JSON.stringify(value));
}

function groupBoardingMaterialUsage(materials = []) {
    return materials.reduce((grouped, material) => {
        const assignmentId = String(material.assignmentId || '');
        if (!assignmentId) return grouped;

        grouped[assignmentId] = [...(grouped[assignmentId] || []), material];
        return grouped;
    }, {});
}

function uniqueBoardingMaterialLines(materials = []) {
    const uniqueLines = new Map();
    materials.forEach((material) => {
        const key = material.usageId
            ? `usage-${material.usageId}`
            : `local-${material.clientReference || material.id}`;
        uniqueLines.set(key, material);
    });
    return [...uniqueLines.values()];
}

function getPendingLocalMaterialUsage(materialUsage) {
    return Object.entries(materialUsage).reduce((pending, [assignmentId, lines]) => {
        const localLines = (Array.isArray(lines) ? lines : []).filter((line) => !line.usageId);
        if (localLines.length > 0) {
            pending[assignmentId] = localLines;
        }
        return pending;
    }, {});
}

function getAssignmentMaterialLines(materialUsage, assignmentId) {
    if (!assignmentId) return [];
    const lines = materialUsage[String(assignmentId)];
    return Array.isArray(lines) ? lines : [];
}

function getCatalogServiceId(service) {
    return String(service?.serviceId || service?.service_id || '');
}

function getCatalogServiceName(service) {
    return service?.serviceName || service?.service_name || 'Boarding service';
}

function getCatalogServicePrice(service) {
    return Number(service?.basePrice ?? service?.base_price ?? 0);
}

function getCatalogServiceLabel(service) {
    const code = service?.serviceCode || service?.service_code;
    const name = getCatalogServiceName(service);

    return code ? `${name} (${code})` : name;
}

function buildPaymentPrefill(unit, materialLines = []) {
    const assignment = unit.assignment || {};
    const checkInDate = assignment.actualCheckInAt || assignment.checkInDate;
    const checkOutDate = assignment.desiredCheckOutDate || assignment.checkOutDate;
    const stayDays = countStayDays(checkInDate, checkOutDate);
    const overdueDays = countOverdueDays(checkOutDate);
    const totalPrice = Number(assignment.price || 0);
    const fallbackDailyRate = unit.hotelBoardingType === 'hotel' ? 1000 : 800;
    const dailyRate = Number(assignment.overstayDailyRate || 0) || fallbackDailyRate;
    const linePrice = totalPrice > 0 ? totalPrice : fallbackDailyRate * stayDays;
    const materialCharges = materialLines.map((line) => {
        const category = String(line.category || '').toUpperCase();
        const isMedication = category.includes('MED') || category.includes('DRUG') || category.includes('VACCINE');
        return {
            name: `Material: ${line.itemName}`,
            group: 'Boarding',
            quantity: Number(line.quantity) || 1,
            price: Number(line.unitPrice) || 0,
            inventoryId: line.inventoryId,
            boardingMaterialUsageId: line.usageId || null,
            receiptType: isMedication ? 'MEDICINE' : 'PRODUCT',
            classificationId: isMedication ? 'medications' : 'products'
        };
    });
    const charges = [
        {
            name: `${unit.roomLabel} stay`,
            group: 'Boarding',
            quantity: 1,
            price: linePrice,
            receiptType: 'SERVICE',
            classificationId: 'services'
        }
    ];

    if (overdueDays > 0) {
        charges.push({
            name: `Overdue boarding extension (${overdueDays} day${overdueDays === 1 ? '' : 's'})`,
            group: 'Boarding',
            quantity: overdueDays,
            price: dailyRate,
            receiptType: 'SERVICE',
            classificationId: 'services'
        });
    }

    charges.push(...materialCharges);

    return {
        source: 'boarding',
        sourceId: assignment.bookingId,
        visit: {
            id: assignment.bookingNumber || `BOARD-${assignment.bookingId || Date.now()}`,
            bookingId: assignment.bookingId || null,
            petId: assignment.petId || null,
            ownerUserId: assignment.ownerUserId || null,
            branchId: assignment.branchId || null,
            sourceType: 'boarding',
            petName: assignment.petName || 'Boarding Pet',
            ownerName: assignment.ownerName || 'Pet Owner',
            species: assignment.petSpecies || 'Pet',
            visitType: unit.hotelBoardingType === 'hotel' ? 'Pet Hotel Boarding Stay' : 'Kennel Boarding Stay',
            veterinarian: 'Boarding Team',
            complaint: `${unit.roomLabel} from ${formatDate(checkInDate)} to ${formatDate(checkOutDate)}`,
            status: 'Ready for payment'
        },
        charges,
        message: overdueDays > 0 || materialCharges.length > 0
            ? 'Boarding checkout loaded with stay charge, overdue days, and recorded materials.'
            : 'Boarding checkout loaded. Review the invoice before posting payment.',
        summary: {
            roomLabel: unit.roomLabel,
            stayDays,
            overdueDays,
            checkInDate,
            checkOutDate,
            materialCount: materialCharges.length
        }
    };
}

function resolveFileUrl(path) {
    if (!path) return '';
    const value = String(path).trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:)/i.test(value)) return value;

    return `/${value.replace(/^\/+/, '').replace(/^public\//, '')}`;
}

function getBoardingDocumentUrl(document) {
    return resolveFileUrl(document?.documentPath || document?.url || '');
}

function boardingConsentPath(booking) {
    const directPath = consentDocumentPath(booking);
    const isPdfPath = (path) => {
        const normalized = String(path || '').split(/[?#]/)[0].toLowerCase();
        return normalized.endsWith('.pdf') || normalized.startsWith('data:application/pdf');
    };
    if (isPdfPath(directPath)) return directPath;

    const forms = Array.isArray(booking?.consentForms) ? booking.consentForms : [];
    return forms.map((form) => consentDocumentPath(form)).find(isPdfPath) || '';
}

function isBoardingConsentRequiredError(error) {
    return error?.data?.code === 'boarding_consent_required'
        || (error?.status === 422 && /boarding consent|consent pdf/i.test(String(error?.message || '')));
}

function boardingConsentUploadFromPayload(payload = {}) {
    if (payload.signed_document_path) {
        return {
            path: payload.signed_document_path,
            uploadReceipt: payload.signed_document_receipt || ''
        };
    }

    if (payload.physical_consent_path) {
        return {
            path: payload.physical_consent_path,
            uploadReceipt: payload.physical_consent_receipt || ''
        };
    }

    return null;
}

function cleanupUnusedBoardingConsent(payload, requestError) {
    const upload = boardingConsentUploadFromPayload(payload);
    const status = Number(requestError?.status || 0);

    // A timeout or server failure may happen after the booking transaction commits.
    // Keep the PDF in that uncertain case so a legal consent record is never deleted.
    if (!upload?.path || !upload.uploadReceipt || status < 400 || status >= 500) return;

    deleteUpload({
        path: upload.path,
        upload_receipt: upload.uploadReceipt
    }).catch((cleanupError) => {
        if (cleanupError?.status !== 409) {
            console.error('Failed to clean up an unused boarding consent PDF:', cleanupError);
        }
    });
}

function BoardingConsentCapture({
    booking,
    templates,
    templateId,
    onTemplateIdChange,
    mode,
    onModeChange,
    signature,
    onSignatureChange,
    uploadFile,
    onUploadFileChange,
    disabled = false,
    ignoreExisting = false,
}) {
    const existingPath = ignoreExisting ? '' : boardingConsentPath(booking);
    const template = templates.find((item) => item.id === templateId) || templates[0] || null;

    if (existingPath) {
        return (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-black">Signed boarding consent recorded</p>
                            <p className="mt-1 text-sm font-medium text-emerald-800">The existing PDF will remain linked to this booking and pet record.</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openProtectedDocument(existingPath).catch(() => toast.error('The consent PDF could not be opened.'))}
                        className="shrink-0 border-emerald-300 bg-white text-emerald-800"
                    >
                        <Eye className="size-4" />
                        Preview PDF
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Boarding consent template *</Label>
                <Select value={templateId} onValueChange={onTemplateIdChange} disabled={disabled || templates.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select boarding consent" /></SelectTrigger>
                    <SelectContent>
                        {templates.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                    </SelectContent>
                </Select>
                {templates.length === 0 && (
                    <p className="text-sm font-semibold text-amber-700">Assign a Boarding template in Consent Management before reserving a room.</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                    type="button"
                    onClick={() => onModeChange('sign')}
                    disabled={disabled}
                    aria-pressed={mode === 'sign'}
                    className={`min-h-10 rounded-md px-3 text-sm font-black transition ${mode === 'sign' ? 'bg-white text-[#155dfc] shadow-sm' : 'text-slate-600'}`}
                >
                    Sign now
                </button>
                <button
                    type="button"
                    onClick={() => onModeChange('upload')}
                    disabled={disabled}
                    aria-pressed={mode === 'upload'}
                    className={`min-h-10 rounded-md px-3 text-sm font-black transition ${mode === 'upload' ? 'bg-white text-[#155dfc] shadow-sm' : 'text-slate-600'}`}
                >
                    Upload completed PDF
                </button>
            </div>

            {mode === 'sign' ? (
                <>
                    <div className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-100 p-2" tabIndex={0} aria-label="Scrollable boarding consent preview">
                        <ConsentDocument
                            variant="compact"
                            title={template?.title || 'Boarding Consent'}
                            content={template?.content || 'Select the assigned boarding consent template.'}
                            signatureImage={signature}
                            signerName={booking?.ownerName || ''}
                            veterinarianName="Vetfocus Boarding Team"
                            representativeLabel="Clinic Representative"
                            representativeDetail="Boarding consent verification"
                            templateContext={{
                                ownerName: booking?.ownerName || '',
                                ownerAddress: booking?.ownerAddress || '',
                                ownerPhone: booking?.ownerPhone || '',
                                petName: booking?.petName || '',
                                petSpecies: booking?.petSpecies || '',
                                petBreed: booking?.petBreed || '',
                                serviceName: 'Boarding',
                                branchName: booking?.branchName || '',
                                bookingNumber: booking?.bookingNumber || '',
                            }}
                        />
                    </div>
                    <SignatureCapture
                        key={`${booking?.id || booking?.petId || booking?.pet_id || 'boarding'}-${templateId}`}
                        signature={signature}
                        onSignatureChange={onSignatureChange}
                        disabled={disabled || !template}
                    />
                </>
            ) : (
                <div className="space-y-2">
                    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-[#155dfc]">
                        <Upload className="size-7 text-[#155dfc]" />
                        <span className="mt-2 text-sm font-black text-slate-800">{uploadFile?.name || 'Choose completed consent PDF'}</span>
                        <span className="mt-1 text-xs font-semibold text-slate-500">PDF only</span>
                        <input
                            key={`${booking?.id || booking?.petId || booking?.pet_id || 'boarding'}-${templateId}`}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            disabled={disabled}
                            onChange={(event) => onUploadFileChange(event.target.files?.[0] || null)}
                        />
                    </label>
                    {uploadFile && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                const previewUrl = URL.createObjectURL(uploadFile);
                                const previewWindow = window.open('', '_blank');
                                if (!previewWindow) {
                                    URL.revokeObjectURL(previewUrl);
                                    toast.error('Allow pop-ups to preview the selected PDF.');
                                    return;
                                }
                                previewWindow.opener = null;
                                previewWindow.location.href = previewUrl;
                                window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
                            }}
                        >
                            <Eye className="size-4" />
                            Preview selected PDF
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function isImageBoardingDocument(document) {
    const mimeType = document?.mimeType || document?.mime_type || '';
    const url = document?.documentPath || document?.url || document?.fileName || document?.file_name || '';

    return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(url));
}

function isPdfBoardingDocument(document) {
    const mimeType = document?.mimeType || document?.mime_type || '';
    const url = document?.documentPath || document?.url || document?.fileName || document?.file_name || '';

    return mimeType === 'application/pdf' || /\.pdf$/i.test(String(url));
}

function documentTypeLabel(value) {
    return DOCUMENT_TYPE_LABELS[value] || value || 'Document';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildHistoryPrintHtml({ title, booking, assignment, tasks, observations, documents }) {
    const subjectTitle = escapeHtml(title || 'Boarding Monitoring History');
    const petName = escapeHtml(assignment?.petName || booking?.petName || 'Pet');
    const ownerName = escapeHtml(assignment?.ownerName || booking?.ownerName || 'Owner');
    const bookingNumber = escapeHtml(assignment?.bookingNumber || booking?.bookingNumber || '');
    const roomLabel = escapeHtml(assignment?.roomLabel || booking?.boardingAssignment?.roomLabel || '');

    const renderList = (items, renderer, emptyText) => (
        items.length === 0
            ? `<p class="empty">${escapeHtml(emptyText)}</p>`
            : items.map(renderer).join('')
    );

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subjectTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #101828; margin: 32px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    h2 { margin: 24px 0 10px; font-size: 16px; border-bottom: 1px solid #d0d5dd; padding-bottom: 6px; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .box { border: 1px solid #d0d5dd; border-radius: 8px; padding: 10px; }
    .label { color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .value { margin-top: 4px; font-weight: 700; }
    .entry { border: 1px solid #eaecf0; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
    .entry-title { font-weight: 700; }
    .entry-meta { color: #667085; font-size: 12px; margin-top: 4px; }
    .notes { white-space: pre-wrap; margin-top: 8px; font-size: 13px; }
    .empty { color: #98a2b3; font-style: italic; }
  </style>
</head>
<body>
  <h1>${subjectTitle}</h1>
  <div class="entry-meta">Generated ${escapeHtml(new Date().toLocaleString())}</div>
  <div class="meta">
    <div class="box"><div class="label">Booking</div><div class="value">${bookingNumber || 'N/A'}</div></div>
    <div class="box"><div class="label">Room</div><div class="value">${roomLabel || 'N/A'}</div></div>
    <div class="box"><div class="label">Pet</div><div class="value">${petName}</div></div>
    <div class="box"><div class="label">Owner</div><div class="value">${ownerName}</div></div>
  </div>

  <h2>Observations</h2>
  ${renderList(observations, (observation) => `
    <div class="entry">
      <div class="entry-title">${escapeHtml(OBSERVATION_LABELS[observation.observationType] || observation.observationType)}</div>
      <div class="entry-meta">${escapeHtml(formatDateTime(observation.observedAt))}</div>
      <div class="notes">${escapeHtml(observation.notes)}</div>
    </div>
  `, 'No observations recorded.')}

  <h2>Tasks</h2>
  ${renderList(tasks, (task) => `
    <div class="entry">
      <div class="entry-title">${escapeHtml(TASK_LABELS[task.taskType] || task.taskType)} - ${escapeHtml(task.status)}</div>
      <div class="entry-meta">${escapeHtml(formatDateTime(task.dueAt))}${task.completedAt ? ` / Completed ${escapeHtml(formatDateTime(task.completedAt))}` : ''}</div>
      <div class="notes">${escapeHtml(task.notes || '')}</div>
    </div>
  `, 'No tasks recorded.')}

  <h2>Documents</h2>
  ${renderList(documents, (document) => `
    <div class="entry">
      <div class="entry-title">${escapeHtml(document.title)}</div>
      <div class="entry-meta">${escapeHtml(documentTypeLabel(document.documentType))} / ${escapeHtml(formatDateTime(document.createdAt))}</div>
      <div class="notes">${escapeHtml(document.notes || '')}</div>
    </div>
  `, 'No documents attached.')}
</body>
</html>`;
}

export default function PetBoardingManagement() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const lockedBranchId = assignedBranchId(dashboardUser);
    const branchSelectionLocked = isBranchSelectionLocked(dashboardUser);
    const documentFileInputRef = useRef(null);
    const materialMutationVersionRef = useRef(0);
    const [activeTab, setActiveTab] = useState('overview');
    const [facilityView, setFacilityView] = useState('boarding');
    const [units, setUnits] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [observations, setObservations] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [pets, setPets] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [materialUsage, setMaterialUsage] = useState(loadBoardingMaterialUsage);
    const [materialBackendReady, setMaterialBackendReady] = useState(false);
    const [materialSchemaReady, setMaterialSchemaReady] = useState(null);
    const [materialBillingTraceReady, setMaterialBillingTraceReady] = useState(null);
    const [materialSyncMessage, setMaterialSyncMessage] = useState('');
    const [boardingBookings, setBoardingBookings] = useState([]);
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [roomViewMode, setRoomViewMode] = useState('cards');
    const [isLoading, setIsLoading] = useState(true);
    const [schemaMessage, setSchemaMessage] = useState('');
    const [catalogSchemaMessage, setCatalogSchemaMessage] = useState('');
    const [documentSchemaMessage, setDocumentSchemaMessage] = useState('');
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [isDirectCheckInOpen, setIsDirectCheckInOpen] = useState(false);
    const [isObservationOpen, setIsObservationOpen] = useState(false);
    const [isTaskOpen, setIsTaskOpen] = useState(false);
    const [isDocumentOpen, setIsDocumentOpen] = useState(false);
    const [isMaterialOpen, setIsMaterialOpen] = useState(false);
    const [isDesiredOutOpen, setIsDesiredOutOpen] = useState(false);
    const [isReservationConsentOpen, setIsReservationConsentOpen] = useState(false);
    const [reservationBooking, setReservationBooking] = useState(null);
    const [reservationUnit, setReservationUnit] = useState(null);
    const [reservationConsentPurpose, setReservationConsentPurpose] = useState('reserve');
    const [reservationForceConsentCapture, setReservationForceConsentCapture] = useState(false);
    const [consentTemplates, setConsentTemplates] = useState([]);
    const [reservationConsentTemplateId, setReservationConsentTemplateId] = useState('');
    const [reservationConsentMode, setReservationConsentMode] = useState('sign');
    const [reservationConsentSignature, setReservationConsentSignature] = useState(null);
    const [reservationConsentFile, setReservationConsentFile] = useState(null);
    const [directConsentTemplateId, setDirectConsentTemplateId] = useState('');
    const [directConsentMode, setDirectConsentMode] = useState('sign');
    const [directConsentSignature, setDirectConsentSignature] = useState(null);
    const [directConsentFile, setDirectConsentFile] = useState(null);
    const [addRoomForm, setAddRoomForm] = useState(emptyAddRoomForm);
    const [directCheckInForm, setDirectCheckInForm] = useState(emptyDirectCheckInForm);
    const [observationForm, setObservationForm] = useState(emptyObservationForm);
    const [taskForm, setTaskForm] = useState(emptyTaskForm);
    const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
    const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
    const [desiredOutDate, setDesiredOutDate] = useState('');
    const [actionLoading, setActionLoading] = useState('');
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState(() => lockedBranchId);

    useAutoRefresh(async () => {
        try {
            const data = await fetchBranches({ service: 'boarding', assignedOnly: true });
            const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
            setBranches(nextBranches);
            setBranchId(current => {
                if (nextBranches.some(branch => String(branch.id) === String(current))) return current;
                const preferred = dashboardUser?.preferred_branch_id || dashboardUser?.preferredBranchId;
                const next = nextBranches.find(branch => String(branch.id) === String(preferred))
                    || nextBranches.find(branch => branch.isMain)
                    || nextBranches[0];
                return next ? String(next.id) : '';
            });
        } catch (error) {
            console.error('Failed to load boarding locations:', error);
        }
    }, { intervalMs: 30000, refreshKey: 'boarding-branches' });

    useAutoRefresh(async () => {
        try {
            const data = await fetchConsentFiles();
            const templates = (Array.isArray(data) ? data : [])
                .map(normalizeConsentTemplate)
                .filter((template) => hasConsentContext(template, 'boarding'));
            setConsentTemplates(templates);
            setReservationConsentTemplateId((current) => (
                templates.some((template) => template.id === current) ? current : templates[0]?.id || ''
            ));
            setDirectConsentTemplateId((current) => (
                templates.some((template) => template.id === current) ? current : templates[0]?.id || ''
            ));
        } catch (error) {
            console.error('Failed to load boarding consent templates:', error);
            setConsentTemplates([]);
        }
    }, { intervalMs: 30000, refreshKey: 'boarding-consent-templates' });

    useEffect(() => {
        setReservationConsentSignature(null);
        setReservationConsentFile(null);
    }, [reservationConsentTemplateId]);

    useEffect(() => {
        setDirectConsentSignature(null);
        setDirectConsentFile(null);
    }, [directConsentTemplateId]);

    useEffect(() => {
        const pendingMaterialUsage = getPendingLocalMaterialUsage(materialUsage);
        if (Object.keys(pendingMaterialUsage).length === 0) {
            localStorage.removeItem(BOARDING_MATERIAL_STORAGE_KEY);
        } else {
            saveBoardingMaterialUsage(pendingMaterialUsage);
        }
    }, [materialUsage]);

    const fetchBoardingData = useCallback(async ({ isAutoRefresh = false } = {}) => {
        const materialVersionAtStart = materialMutationVersionRef.current;
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const [roomsResult, monitoringResult, materialsResult, petsResult, bookingsResult, catalogResult, inventoryResult] = await Promise.allSettled([
                fetchBoardingRooms({ branch_id: branchId }),
                fetchBoardingMonitoring({ branch_id: branchId }),
                fetchBoardingMaterials({ branch_id: branchId }),
                fetchAllPets(),
                fetchBookings(),
                fetchServiceCatalog(),
                fetchInventoryItems({ branch_id: branchId })
            ]);

            if (roomsResult.status === 'fulfilled') {
                setUnits(Array.isArray(roomsResult.value.units) ? roomsResult.value.units : []);
                setSchemaMessage('');
            } else if (!isAutoRefresh) {
                console.error('Failed to load boarding rooms:', roomsResult.reason);
                setSchemaMessage('Boarding rooms could not be loaded. Refresh the page or try again later.');
            }

            if (monitoringResult.status === 'fulfilled') {
                setTasks(Array.isArray(monitoringResult.value.tasks) ? monitoringResult.value.tasks : []);
                setObservations(Array.isArray(monitoringResult.value.observations) ? monitoringResult.value.observations : []);
                setDocuments(Array.isArray(monitoringResult.value.documents) ? monitoringResult.value.documents : []);
                setDocumentSchemaMessage(
                    monitoringResult.value.documentSchemaReady === false
                        ? 'Document uploads are temporarily unavailable. You can continue managing this boarding stay without attachments.'
                        : ''
                );
                if (monitoringResult.value.documentSchemaReady === false && !isAutoRefresh) {
                    console.error('Boarding document uploads are unavailable:', monitoringResult.value);
                }
            }

            if (materialsResult.status === 'fulfilled') {
                const materialSchemaIsReady = materialsResult.value?.schemaReady !== false;
                const billingTraceIsReady = materialsResult.value?.billingTraceReady === true;
                setMaterialSchemaReady(materialSchemaIsReady);
                setMaterialBillingTraceReady(billingTraceIsReady);

                if (!materialSchemaIsReady) {
                    if (!isAutoRefresh) {
                        console.error('Boarding material storage is unavailable:', materialsResult.value);
                    }
                    setMaterialBackendReady(false);
                    setMaterialSyncMessage('Boarding materials cannot be saved right now. Existing boarding tasks remain available.');
                } else {
                    const localMaterialUsage = loadBoardingMaterialUsage();
                    const localMaterialLines = Object.values(localMaterialUsage)
                        .flatMap((lines) => Array.isArray(lines) ? lines : [])
                        .filter((line) => !line.usageId);
                    const migrationResults = await Promise.allSettled(localMaterialLines.map((line) => (
                        createBoardingMaterial({
                            assignment_id: Number(line.assignmentId),
                            item_id: Number(line.itemId || line.inventoryId),
                            quantity: Number(line.quantity),
                            unit_price: Number(line.unitPrice || 0),
                            notes: line.notes || null,
                            client_reference: line.clientReference || line.id
                        })
                    )));
                    const migratedLines = migrationResults
                        .filter((result) => (
                            result.status === 'fulfilled'
                            && result.value?.material?.status === 'recorded'
                        ))
                        .map((result) => result.value.material);
                    const failedLines = migrationResults
                        .map((result, index) => ({ result, line: localMaterialLines[index] }))
                        .filter(({ result }) => (
                            result.status !== 'fulfilled'
                            || result.value?.material?.status !== 'recorded'
                        ));

                    if (materialVersionAtStart === materialMutationVersionRef.current) {
                        const serverLines = uniqueBoardingMaterialLines([
                            ...(materialsResult.value.materials || []),
                            ...migratedLines
                        ]);
                        const nextUsage = groupBoardingMaterialUsage(serverLines);
                        failedLines.forEach(({ line }) => {
                            const key = String(line.assignmentId || '');
                            if (key) {
                                nextUsage[key] = [...(nextUsage[key] || []), line];
                            }
                        });
                        setMaterialUsage(nextUsage);
                        setMaterialBackendReady(failedLines.length === 0);
                    }

                    if (failedLines.length > 0) {
                        console.error('Failed to synchronize boarding material records:', failedLines);
                        setMaterialSyncMessage(
                            `${failedLines.length} locally staged material record${failedLines.length === 1 ? '' : 's'} could not be synchronized.`
                            + ' Review the entries and try again.'
                        );
                    } else if (!billingTraceIsReady) {
                        if (!isAutoRefresh) {
                            console.error('Boarding material charges are unavailable:', materialsResult.value);
                        }
                        setMaterialSyncMessage('Material charges are temporarily unavailable for payment. Try again later or contact support.');
                    } else {
                        setMaterialSyncMessage('');
                    }
                }
            } else if (!isAutoRefresh) {
                console.error('Failed to load boarding materials:', materialsResult.reason);
                setMaterialSyncMessage('Boarding materials could not be loaded. Refresh the page or try again later.');
            }

            if (petsResult.status === 'fulfilled') {
                setPets(Array.isArray(petsResult.value) ? petsResult.value : []);
            }

            if (bookingsResult.status === 'fulfilled') {
                setBoardingBookings(Array.isArray(bookingsResult.value) ? bookingsResult.value : []);
            }

            if (catalogResult.status === 'fulfilled') {
                if (catalogResult.value?.schemaReady === false) {
                    if (!isAutoRefresh) {
                        console.error('Boarding service catalog is unavailable:', catalogResult.value?.message || catalogResult.value);
                    }
                    setServiceCatalog([]);
                    setCatalogSchemaMessage('Catalog pricing is temporarily unavailable. Try again later or contact support.');
                } else {
                    setServiceCatalog(Array.isArray(catalogResult.value?.services) ? catalogResult.value.services : []);
                    setCatalogSchemaMessage('');
                }
            } else if (!isAutoRefresh) {
                console.error('Failed to load the boarding service catalog:', catalogResult.reason);
                setCatalogSchemaMessage('Catalog pricing could not be loaded. Refresh the page or try again later.');
            }

            if (inventoryResult.status === 'fulfilled') {
                setInventoryItems(normalizeInventoryItemsResponse(inventoryResult.value));
            }
        } catch (error) {
            if (!isAutoRefresh) {
                console.error('Failed to load boarding data:', error);
                setSchemaMessage('Boarding information could not be loaded. Refresh the page or try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useAutoRefresh(fetchBoardingData, { enabled: Boolean(branchId), refreshKey: branchId || 'no-branch' });

    const filteredUnits = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const matches = units
            .filter((unit) => unit.hotelBoardingType === facilityView)
            .filter((unit) => {
                if (!query) return true;
                const assignment = unit.assignment || {};
                return [
                    unit.roomLabel,
                    unit.status,
                    assignment.petName,
                    assignment.ownerName,
                    assignment.bookingNumber
                ].some((value) => String(value || '').toLowerCase().includes(query));
            });

        return sortUnitsLargeToSmall(matches);
    }, [facilityView, searchQuery, units]);

    const activeUnits = useMemo(() => (
        filteredUnits.filter((unit) => unit.status === 'occupied' || unit.status === 'reserved')
    ), [filteredUnits]);

    const activeAssignments = useMemo(() => (
        sortUnitsLargeToSmall(units)
            .filter((unit) => unit.assignment && (unit.status === 'occupied' || unit.status === 'reserved'))
            .map((unit) => ({
                unit,
                assignment: unit.assignment,
                value: String(unit.assignment.assignmentId)
            }))
    ), [units]);

    const documentSubjects = useMemo(() => {
        const seen = new Set();
        const subjects = [];

        activeAssignments.forEach(({ unit, assignment }) => {
            const key = `assignment:${assignment.assignmentId}`;
            seen.add(key);
            subjects.push({
                value: key,
                assignmentId: assignment.assignmentId,
                bookingId: assignment.bookingId,
                petId: assignment.petId,
                petName: assignment.petName,
                ownerName: assignment.ownerName,
                bookingNumber: assignment.bookingNumber,
                roomLabel: unit.roomLabel,
                source: 'active',
                assignment,
                booking: null
            });
        });

        boardingBookings
            .filter((booking) => String(booking.branchId || '') === String(branchId || ''))
            .filter((booking) => booking.type === 'boarding' && booking.boardingAssignment)
            .forEach((booking) => {
                const assignment = booking.boardingAssignment;
                const key = assignment.assignmentId ? `assignment:${assignment.assignmentId}` : `booking:${booking.id}`;
                if (seen.has(key)) return;
                seen.add(key);
                subjects.push({
                    value: key,
                    assignmentId: assignment.assignmentId || null,
                    bookingId: booking.id,
                    petId: booking.petId,
                    petName: booking.petName,
                    ownerName: booking.ownerName,
                    bookingNumber: booking.bookingNumber,
                    roomLabel: assignment.roomLabel || '',
                    source: booking.status === 'completed' ? 'history' : 'booking',
                    assignment: {
                        ...assignment,
                        bookingId: booking.id,
                        petId: booking.petId,
                        petName: booking.petName,
                        ownerName: booking.ownerName,
                        bookingNumber: booking.bookingNumber,
                        checkInDate: booking.checkInDate,
                        checkOutDate: booking.checkOutDate
                    },
                    booking
                });
            });

        return subjects;
    }, [activeAssignments, boardingBookings, branchId]);

    const visibleBoardingBookings = useMemo(() => (
        boardingBookings
            .filter((booking) => String(booking.branchId || '') === String(branchId || ''))
            .filter((booking) => booking.type === 'boarding' && booking.hotelBoardingType)
            .filter((booking) => booking.status !== 'completed' && booking.status !== 'cancelled')
            .filter((booking) => booking.hotelBoardingType === facilityView)
            .sort((a, b) => {
                const statusOrder = { pending: 1, confirmed: 2 };
                return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
            })
    ), [boardingBookings, branchId, facilityView]);

    const pendingReservationCount = useMemo(() => (
        visibleBoardingBookings.filter((booking) => !booking.boardingAssignment).length
    ), [visibleBoardingBookings]);

    const availableDirectRooms = useMemo(() => (
        sortUnitsLargeToSmall(units.filter((unit) => (
            unit.hotelBoardingType === directCheckInForm.type &&
            unit.roomSize === directCheckInForm.roomSize &&
            unit.status === 'available'
        )))
    ), [directCheckInForm.roomSize, directCheckInForm.type, units]);

    const boardingCatalogServices = useMemo(() => (
        serviceCatalog
            .filter((service) => service.isActive !== false && service.serviceType === 'boarding')
            .sort((a, b) => getCatalogServiceName(a).localeCompare(getCatalogServiceName(b)))
    ), [serviceCatalog]);

    const selectedBoardingCatalogService = useMemo(() => (
        boardingCatalogServices.find((service) => getCatalogServiceId(service) === directCheckInForm.serviceCatalogId) || null
    ), [boardingCatalogServices, directCheckInForm.serviceCatalogId]);

    const directCheckInStayDays = useMemo(() => (
        directCheckInForm.checkOutDate ? countStayDays(todayIso(), directCheckInForm.checkOutDate) : 0
    ), [directCheckInForm.checkOutDate]);

    const directCheckInUnitPrice = selectedBoardingCatalogService
        ? getCatalogServicePrice(selectedBoardingCatalogService)
        : 0;

    const directCheckInEstimatedTotal = selectedBoardingCatalogService
        ? directCheckInUnitPrice * Math.max(directCheckInStayDays, 1)
        : 0;

    const visibleMaterialUsage = useMemo(() => (
        Object.values(materialUsage)
            .flatMap((lines) => Array.isArray(lines) ? lines : [])
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
            .slice(0, 80)
    ), [materialUsage]);

    const stats = useMemo(() => ({
        total: filteredUnits.length,
        available: filteredUnits.filter((unit) => unit.status === 'available').length,
        reserved: filteredUnits.filter((unit) => unit.status === 'reserved').length,
        occupied: filteredUnits.filter((unit) => unit.status === 'occupied').length,
        maintenance: filteredUnits.filter((unit) => unit.status === 'maintenance').length,
        overdue: tasks.filter((task) => task.status === 'overdue').length,
        pending: tasks.filter((task) => task.status === 'pending').length,
        materials: visibleMaterialUsage.length
    }), [filteredUnits, tasks, visibleMaterialUsage.length]);

    const selectedAssignmentId = selectedUnit?.assignment?.assignmentId ? String(selectedUnit.assignment.assignmentId) : '';

    const selectedUnitObservations = useMemo(() => (
        observations.filter((observation) => String(observation.assignmentId || '') === selectedAssignmentId)
    ), [observations, selectedAssignmentId]);

    const selectedUnitTasks = useMemo(() => (
        tasks.filter((task) => String(task.assignmentId || '') === selectedAssignmentId)
    ), [tasks, selectedAssignmentId]);

    const selectedUnitDocuments = useMemo(() => (
        documents.filter((document) => String(document.assignmentId || '') === selectedAssignmentId)
    ), [documents, selectedAssignmentId]);

    const selectedUnitMaterials = useMemo(() => (
        getAssignmentMaterialLines(materialUsage, selectedAssignmentId)
    ), [materialUsage, selectedAssignmentId]);

    const visibleDocuments = useMemo(() => documents.slice(0, 50), [documents]);

    const activeInventoryItems = useMemo(() => (
        inventoryItems.filter((item) => item.quantity > 0)
    ), [inventoryItems]);

    const selectedMaterialItem = useMemo(() => (
        inventoryItems.find((item) => item.id === materialForm.inventoryId) || null
    ), [inventoryItems, materialForm.inventoryId]);

    const selectedDocumentSubject = useMemo(() => (
        documentSubjects.find((subject) => subject.value === documentForm.assignmentId)
    ), [documentForm.assignmentId, documentSubjects]);

    const openUnitDetails = (unit) => {
        setSelectedUnit(unit);
        setDesiredOutDate(unit.assignment?.desiredCheckOutDate || unit.assignment?.checkOutDate || '');
        setIsDetailOpen(true);
    };

    const openObservation = (unit = selectedUnit) => {
        const assignmentId = unit?.assignment?.assignmentId ? String(unit.assignment.assignmentId) : activeAssignments[0]?.value || '';
        setObservationForm({
            ...emptyObservationForm,
            assignmentId
        });
        setIsObservationOpen(true);
    };

    const openTask = (unit = selectedUnit) => {
        const assignmentId = unit?.assignment?.assignmentId ? String(unit.assignment.assignmentId) : activeAssignments[0]?.value || '';
        setTaskForm({
            ...emptyTaskForm,
            assignmentId
        });
        setIsTaskOpen(true);
    };

    const openMaterialUsage = (unit = selectedUnit) => {
        const assignmentId = unit?.assignment?.assignmentId ? String(unit.assignment.assignmentId) : activeAssignments[0]?.value || '';
        setMaterialForm({
            ...emptyMaterialForm,
            assignmentId,
            clientReference: createBoardingMaterialClientReference()
        });
        setIsMaterialOpen(true);
    };

    const openDocumentUpload = (unit = selectedUnit) => {
        const subject = unit?.assignment?.assignmentId
            ? documentSubjects.find((item) => String(item.assignmentId) === String(unit.assignment.assignmentId))
            : documentSubjects[0];

        setDocumentForm({
            ...emptyDocumentForm,
            assignmentId: subject?.value || '',
            bookingId: subject?.bookingId ? String(subject.bookingId) : '',
            title: subject?.petName ? `${subject.petName} monitoring document` : ''
        });
        setIsDocumentOpen(true);
    };

    const handleDocumentFileSelect = (event) => {
        const file = event.target.files?.[0] || null;
        const allowedTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf'
        ]);
        const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']);
        const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || '';

        if (file && !allowedTypes.has(file.type) && !allowedExtensions.has(extension)) {
            toast.error('Upload a JPG, PNG, GIF, WEBP, or PDF document.');
            event.target.value = '';
            return;
        }

        if (file && (file.size <= 0 || file.size > 8 * 1024 * 1024)) {
            toast.error('Boarding documents must be larger than 0 bytes and no more than 8 MB.');
            event.target.value = '';
            return;
        }

        setDocumentForm((current) => ({
            ...current,
            file,
            fileName: file?.name || ''
        }));
        event.target.value = '';
    };

    const openWalkInCheckIn = (unit = null) => {
        setDirectConsentMode('sign');
        setDirectConsentSignature(null);
        setDirectConsentFile(null);
        setDirectConsentTemplateId(consentTemplates[0]?.id || '');
        setDirectCheckInForm({
            ...emptyDirectCheckInForm,
            type: unit?.hotelBoardingType || facilityView,
            roomSize: unit?.roomSize || 'small',
            roomNumber: unit?.roomNumber ? String(unit.roomNumber) : '',
            serviceCatalogId: boardingCatalogServices[0] ? getCatalogServiceId(boardingCatalogServices[0]) : '',
            checkOutDate: ''
        });
        setIsDirectCheckInOpen(true);
    };

    const handleDirectCheckInOpenChange = (open) => {
        if (actionLoading === 'direct-check-in') return;

        setDirectConsentSignature(null);
        setDirectConsentFile(null);
        setIsDirectCheckInOpen(open);
        if (!open) setDirectConsentMode('sign');
    };

    const handleDirectPetChange = (petId) => {
        setDirectCheckInForm((current) => ({ ...current, petId }));
        setDirectConsentSignature(null);
        setDirectConsentFile(null);
    };

    const handleDirectConsentTemplateChange = (templateId) => {
        setDirectConsentTemplateId(templateId);
        setDirectConsentSignature(null);
        setDirectConsentFile(null);
    };

    const handleDirectConsentModeChange = (mode) => {
        setDirectConsentMode(mode);
        setDirectConsentSignature(null);
        setDirectConsentFile(null);
    };

    const openAddRoom = () => {
        setAddRoomForm({
            ...emptyAddRoomForm,
            branchId: String(branchId || ''),
            type: facilityView
        });
        setIsAddRoomOpen(true);
    };

    const updateRoomStatus = async (unit, status) => {
        setActionLoading(`room-${unit.id}`);
        try {
            await updateBoardingRoom({
                branch_id: Number(branchId),
                room_type: unit.roomType,
                room_number: unit.roomNumber,
                status
            });

            toast.success(
                status === 'maintenance'
                    ? 'Room marked for maintenance.'
                    : status === 'retired'
                        ? 'Room removed from active capacity.'
                        : 'Room marked available.'
            );
            setIsDetailOpen(false);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to update boarding room status:', error);
            toast.error('The room status could not be updated. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const prepareBoardingConsent = async ({
        booking,
        templateId,
        mode,
        signature,
        uploadFile,
        allowExisting = true,
        scopeBookingId = 0,
        scopePetId = 0,
    }) => {
        if (allowExisting && boardingConsentPath(booking)) return {};

        const template = consentTemplates.find((item) => item.id === templateId);
        if (!template) {
            throw new Error('Select the assigned boarding consent template.');
        }

        const signerName = booking?.ownerName || getPetOwnerName(booking) || 'Pet owner';
        const signedAt = new Date().toISOString();
        let signedDocumentPath = '';
        let signedDocumentReceipt = '';
        let physicalConsentPath = '';
        let physicalConsentReceipt = '';
        const uploadScope = {
            consent_context: 'boarding',
            consent_file_id: Number(template.id) || 0,
            booking_id: Number(scopeBookingId) || 0,
            pet_id: Number(scopePetId) || 0,
        };

        if (mode === 'upload') {
            if (!uploadFile || (uploadFile.type !== 'application/pdf' && !/\.pdf$/i.test(uploadFile.name || ''))) {
                throw new Error('Upload the completed boarding consent as a PDF file.');
            }
            const upload = await uploadDocumentFile(uploadFile, 'consent_document', {
                returnMetadata: true,
                formFields: uploadScope,
            });
            physicalConsentPath = upload?.path || '';
            physicalConsentReceipt = upload?.uploadReceipt || '';
        } else {
            if (!signature) {
                throw new Error('Capture the pet owner signature before continuing.');
            }
            const upload = await createAndUploadConsentDocumentPdf({
                title: template.title,
                content: template.content,
                signatureImage: signature,
                signerName,
                signedAt,
                veterinarianName: 'Vetfocus Boarding Team',
                representativeLabel: 'Clinic representative',
                representativeDetail: 'Boarding consent verification',
                templateContext: {
                    ownerName: signerName,
                    ownerAddress: booking?.ownerAddress || '',
                    ownerPhone: booking?.ownerPhone || '',
                    petName: booking?.petName || getPetName(booking),
                    petSpecies: booking?.petSpecies || booking?.species || '',
                    petBreed: booking?.petBreed || booking?.breed || '',
                    serviceName: 'Boarding',
                    branchName: booking?.branchName || getBranchDisplayName(branches, branchId) || '',
                    bookingNumber: booking?.bookingNumber || '',
                },
            }, 'boarding-consent', {
                returnMetadata: true,
                formFields: uploadScope,
            });
            signedDocumentPath = upload?.path || '';
            signedDocumentReceipt = upload?.uploadReceipt || '';
        }

        if (!signedDocumentPath && !physicalConsentPath) {
            throw new Error('The completed boarding consent could not be saved.');
        }
        if (
            (signedDocumentPath && !signedDocumentReceipt)
            || (physicalConsentPath && !physicalConsentReceipt)
        ) {
            throw new Error('The secure consent upload could not be verified. Please try again.');
        }

        return {
            consent_file_id: Number(template.id) || null,
            consent_type: template.title,
            signer_name: signerName,
            signed_at: signedAt,
            signed_document_path: signedDocumentPath || null,
            signed_document_receipt: signedDocumentReceipt || null,
            physical_consent_path: physicalConsentPath || null,
            physical_consent_receipt: physicalConsentReceipt || null,
            consent_form: {
                id: Number(template.id) || template.id,
                title: template.title,
                category: template.category || 'boarding',
                content: template.content,
                signerName,
                signedAt,
                documentPath: signedDocumentPath || undefined,
                physicalConsentPath: physicalConsentPath || undefined,
                serviceType: 'Boarding',
            },
        };
    };

    const closeReservationConsent = () => {
        setIsReservationConsentOpen(false);
        setReservationBooking(null);
        setReservationUnit(null);
        setReservationConsentPurpose('reserve');
        setReservationForceConsentCapture(false);
        setReservationConsentMode('sign');
        setReservationConsentSignature(null);
        setReservationConsentFile(null);
    };

    const handleReservationConsentTemplateChange = (templateId) => {
        setReservationConsentTemplateId(templateId);
        setReservationConsentSignature(null);
        setReservationConsentFile(null);
    };

    const handleReservationConsentModeChange = (mode) => {
        setReservationConsentMode(mode);
        setReservationConsentSignature(null);
        setReservationConsentFile(null);
    };

    const openReservationConsent = (booking, {
        purpose = 'reserve',
        unit = null,
        forceCapture = false,
    } = {}) => {
        setReservationBooking(booking);
        setReservationUnit(unit);
        setReservationConsentPurpose(purpose);
        setReservationForceConsentCapture(forceCapture);
        setReservationConsentTemplateId(consentTemplates[0]?.id || '');
        setReservationConsentMode('sign');
        setReservationConsentSignature(null);
        setReservationConsentFile(null);
        setIsReservationConsentOpen(true);
    };

    const submitReservationConsent = async () => {
        const booking = reservationBooking;
        if (!booking) return;

        const isCheckIn = reservationConsentPurpose === 'check-in';
        const unit = reservationUnit;
        const actionKey = isCheckIn ? `check-in-${unit?.id || booking.id}` : `reserve-${booking.id}`;
        setActionLoading(actionKey);
        let consentPayload = {};
        try {
            consentPayload = await prepareBoardingConsent({
                booking,
                templateId: reservationConsentTemplateId,
                mode: reservationConsentMode,
                signature: reservationConsentSignature,
                uploadFile: reservationConsentFile,
                allowExisting: !reservationForceConsentCapture,
                scopeBookingId: booking.id,
            });

            if (isCheckIn) {
                await checkInBoardingBooking(booking.id, consentPayload);
                toast.success('Pet boarded.');
                setIsDetailOpen(false);
            } else {
                await assignBoardingRoom(booking.id, consentPayload);
                toast.success(`${booking.bookingNumber} reserved.`);
            }

            closeReservationConsent();
            fetchBoardingData();
        } catch (error) {
            console.error(isCheckIn ? 'Failed to check in the reserved pet:' : 'Failed to reserve a boarding room:', error);
            cleanupUnusedBoardingConsent(consentPayload, error);

            if (isBoardingConsentRequiredError(error)) {
                setReservationForceConsentCapture(true);
                setReservationConsentSignature(null);
                setReservationConsentFile(null);
                toast.error('The previous consent PDF is unavailable. Capture a new signature or upload the completed PDF.');
            } else {
                toast.error(
                    isCheckIn
                        ? 'The reserved pet could not be checked in. Review the consent and try again.'
                        : 'The room could not be reserved. Review the consent and try again.'
                );
            }
        } finally {
            setActionLoading('');
        }
    };

    const addRoom = async () => {
        const quantity = Number(addRoomForm.quantity);
        const targetBranchId = String(addRoomForm.branchId || branchId || '');
        const targetBranch = branches.find(branch => String(branch.id) === targetBranchId);
        if (!targetBranchId || !targetBranch) {
            toast.error('Select the clinic location that will receive these rooms.');
            return;
        }
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
            toast.error('Enter a valid room quantity.');
            return;
        }

        setActionLoading('add-room');
        try {
            const result = await createBoardingRooms({
                branch_id: Number(targetBranchId),
                room_type: `${addRoomForm.type}-${addRoomForm.roomSize}`,
                hotel_boarding_type: addRoomForm.type,
                room_size: addRoomForm.roomSize,
                quantity,
                description: addRoomForm.description
            });

            toast.success(`${quantity} ${quantity === 1 ? 'room' : 'rooms'} added to ${targetBranch.name}. Total capacity: ${result.totalCapacity}.`);
            setBranchId(targetBranchId);
            setFacilityView(addRoomForm.type);
            setIsAddRoomOpen(false);
            setAddRoomForm({ ...emptyAddRoomForm });
            const refreshedRooms = await fetchBoardingRooms({ branch_id: targetBranchId });
            setUnits(Array.isArray(refreshedRooms.units) ? refreshedRooms.units : []);
        } catch (error) {
            console.error('Failed to add a boarding room:', error);
            toast.error(error.message || 'The room could not be added. Review the details and try again.');
        } finally {
            setActionLoading('');
        }
    };

    const directCheckIn = async () => {
        if (!directCheckInForm.petId || !directCheckInForm.checkOutDate) {
            toast.error('Select a pet and desired out date.');
            return;
        }

        if (!selectedBoardingCatalogService) {
            toast.error('Select a boarding service catalog price.');
            return;
        }

        const emergencyContactError = getPhilippinePhoneError(directCheckInForm.emergencyContact, { optional: true });
        if (emergencyContactError) {
            toast.error(emergencyContactError);
            return;
        }

        const normalizedEmergencyContact = normalizePhilippinePhoneForSubmit(directCheckInForm.emergencyContact, { optional: true });
        const selectedPet = pets.find((pet) => getPetOptionValue(pet) === String(directCheckInForm.petId));
        setActionLoading('direct-check-in');
        let consentPayload = {};
        try {
            consentPayload = await prepareBoardingConsent({
                booking: {
                    ...selectedPet,
                    petName: getPetName(selectedPet),
                    ownerName: getPetOwnerName(selectedPet),
                    branchName: getBranchDisplayName(branches, branchId) || '',
                },
                templateId: directConsentTemplateId,
                mode: directConsentMode,
                signature: directConsentSignature,
                uploadFile: directConsentFile,
                allowExisting: false,
                scopePetId: Number(getPetOptionValue(selectedPet)) || 0,
            });
            const result = await directBoardingCheckIn({
                branch_id: Number(branchId),
                pet_id: directCheckInForm.petId,
                type: directCheckInForm.type,
                room_size: directCheckInForm.roomSize,
                room_number: directCheckInForm.roomNumber || null,
                check_out_date: directCheckInForm.checkOutDate,
                emergency_contact: normalizedEmergencyContact,
                service_catalog_id: directCheckInForm.serviceCatalogId,
                service_catalog_name: getCatalogServiceName(selectedBoardingCatalogService),
                price: directCheckInEstimatedTotal,
                notes: directCheckInForm.notes,
                ...consentPayload,
            });

            toast.success('Pet boarded. Opening Point-Of-Sale payment.');
            setIsDirectCheckInOpen(false);
            setDirectCheckInForm(emptyDirectCheckInForm);
            setDirectConsentSignature(null);
            setDirectConsentFile(null);
            if (result?.assignment) {
                localStorage.setItem('ipawcus-pos-prefill', JSON.stringify(buildPaymentPrefill({
                    roomLabel: result.assignment.roomLabel,
                    hotelBoardingType: result.assignment.hotelBoardingType,
                    assignment: result.assignment
                })));
                navigate('/dashboard/pos');
                return;
            }
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to check in the pet for boarding:', error);
            cleanupUnusedBoardingConsent(consentPayload, error);
            toast.error('The pet could not be checked in. Review the consent and details, then try again.');
        } finally {
            setActionLoading('');
        }
    };

    const checkInReservedPet = async (unit) => {
        if (!unit.assignment?.bookingId) return;

        const booking = boardingBookings.find((item) => (
            String(item.id) === String(unit.assignment.bookingId)
        )) || {
            ...unit.assignment,
            id: unit.assignment.bookingId,
        };

        if (!boardingConsentPath(booking)) {
            setIsDetailOpen(false);
            openReservationConsent(booking, {
                purpose: 'check-in',
                unit,
                forceCapture: true,
            });
            return;
        }

        setActionLoading(`check-in-${unit.id}`);
        try {
            await checkInBoardingBooking(unit.assignment.bookingId, {});

            toast.success('Pet boarded.');
            setIsDetailOpen(false);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to check in the reserved pet:', error);
            if (isBoardingConsentRequiredError(error)) {
                setIsDetailOpen(false);
                openReservationConsent(booking, {
                    purpose: 'check-in',
                    unit,
                    forceCapture: true,
                });
                toast.error('The previous consent PDF is unavailable. Capture a new signature or upload the completed PDF.');
            } else {
                toast.error('The reserved pet could not be checked in. Please try again.');
            }
        } finally {
            setActionLoading('');
        }
    };

    const checkOutPet = async (unit) => {
        if (!unit.assignment?.bookingId) return;
        const assignmentId = unit.assignment?.assignmentId ? String(unit.assignment.assignmentId) : '';
        const hasPendingLocalMaterial = getAssignmentMaterialLines(materialUsage, assignmentId)
            .some((line) => !line.usageId);
        if (hasPendingLocalMaterial) {
            toast.error('Synchronize or remove locally staged materials before checking this pet out.');
            return;
        }

        setActionLoading(`check-out-${unit.id}`);
        try {
            await checkOutBoardingBooking(unit.assignment.bookingId);

            toast.success('Pet checked out.');
            setIsDetailOpen(false);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to check out the boarded pet:', error);
            toast.error('The pet could not be checked out. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const updateDesiredOut = async () => {
        if (!selectedUnit?.assignment?.bookingId || !desiredOutDate) {
            toast.error('Choose a desired out date.');
            return;
        }

        setActionLoading('desired-out');
        try {
            await updateDesiredCheckOut(selectedUnit.assignment.bookingId, { check_out_date: desiredOutDate });

            toast.success('Desired out date updated.');
            setIsDesiredOutOpen(false);
            setIsDetailOpen(false);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to update the desired boarding checkout date:', error);
            toast.error('The desired checkout date could not be updated. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const addMaterialUsage = async () => {
        if (materialSchemaReady !== true || materialBillingTraceReady !== true) {
            toast.error(materialSyncMessage || 'Boarding materials are temporarily unavailable. Refresh the page or contact support.');
            return;
        }

        if (!materialForm.assignmentId || !materialForm.inventoryId) {
            toast.error('Select a pet room and inventory item.');
            return;
        }

        const quantity = Number(materialForm.quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
            toast.error('Enter a positive whole-number material quantity.');
            return;
        }

        const unitPrice = Number(materialForm.unitPrice || 0);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            toast.error('Enter a valid material price.');
            return;
        }

        const item = selectedMaterialItem;
        if (!item) {
            toast.error('Selected inventory item was not found.');
            return;
        }

        if (quantity > item.quantity) {
            toast.error(`${item.name} has only ${item.quantity} ${item.unit} in stock.`);
            return;
        }

        const selectedAssignment = activeAssignments.find(({ value }) => value === materialForm.assignmentId);
        const clientReference = materialForm.clientReference || createBoardingMaterialClientReference();
        if (!materialForm.clientReference) {
            setMaterialForm((current) => ({ ...current, clientReference }));
        }
        setActionLoading('material');
        materialMutationVersionRef.current += 1;
        try {
            const savedLine = (await createBoardingMaterial({
                assignment_id: Number(materialForm.assignmentId),
                pet_id: selectedAssignment?.assignment?.petId || null,
                item_id: item.itemId,
                quantity,
                unit_price: unitPrice,
                notes: materialForm.notes.trim() || null,
                client_reference: clientReference
            })).material;

            if (!savedLine) {
                throw new Error('The boarding material could not be saved.');
            }

            materialMutationVersionRef.current += 1;
            setMaterialUsage((current) => {
                const key = String(materialForm.assignmentId);
                const currentLines = getAssignmentMaterialLines(current, key);
                const nextLines = currentLines.some((existingLine) => (
                    String(existingLine.usageId || existingLine.id) === String(savedLine.usageId || savedLine.id)
                ))
                    ? currentLines
                    : [...currentLines, savedLine];

                return {
                    ...current,
                    [key]: nextLines
                };
            });
            toast.success('Boarding material added to checkout.');
            setIsMaterialOpen(false);
            setMaterialForm(emptyMaterialForm);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to save a boarding material:', error);
            toast.error(error?.message || 'The material entry could not be saved. Review it and try again.');
        } finally {
            setActionLoading('');
        }
    };

    const removeMaterialUsage = async (assignmentId, lineId) => {
        const line = getAssignmentMaterialLines(materialUsage, assignmentId)
            .find((candidate) => candidate.id === lineId);

        materialMutationVersionRef.current += 1;
        try {
            if (line?.usageId) {
                await removeBoardingMaterial(line.usageId);
            }

            materialMutationVersionRef.current += 1;
            setMaterialUsage((current) => {
                const key = String(assignmentId);
                const nextLines = getAssignmentMaterialLines(current, key).filter((candidate) => candidate.id !== lineId);
                const next = { ...current };
                if (nextLines.length > 0) {
                    next[key] = nextLines;
                } else {
                    delete next[key];
                }
                return next;
            });
        } catch (error) {
            console.error('Failed to remove a boarding material:', error);
            toast.error('The material entry could not be removed. Please try again.');
        }
    };

    const addObservation = async () => {
        if (!observationForm.assignmentId || !observationForm.notes.trim()) {
            toast.error('Select a pet room and enter an observation.');
            return;
        }

        setActionLoading('observation');
        try {
            await createBoardingObservation({
                assignment_id: Number(observationForm.assignmentId),
                observation_type: observationForm.observationType,
                notes: observationForm.notes
            });

            toast.success('Observation added.');
            setIsObservationOpen(false);
            setObservationForm(emptyObservationForm);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to add a boarding observation:', error);
            toast.error('The observation could not be added. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const addTask = async () => {
        if (!taskForm.assignmentId || !taskForm.dueAt) {
            toast.error('Select a pet room and due time.');
            return;
        }

        setActionLoading('task');
        try {
            await createBoardingTask({
                assignment_id: Number(taskForm.assignmentId),
                task_type: taskForm.taskType,
                due_at: taskForm.dueAt,
                assigned_to: taskForm.assignedTo,
                notes: taskForm.notes
            });

            toast.success('Task scheduled.');
            setIsTaskOpen(false);
            setTaskForm(emptyTaskForm);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to schedule a boarding task:', error);
            toast.error('The task could not be scheduled. Review the details and try again.');
        } finally {
            setActionLoading('');
        }
    };

    const completeTask = async (task) => {
        setActionLoading(`task-${task.taskId}`);
        try {
            await completeBoardingTask(task.taskId);

            toast.success('Task completed.');
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to complete a boarding task:', error);
            toast.error('The task could not be completed. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const saveBoardingDocument = async () => {
        if (documentSchemaMessage) {
            toast.error(documentSchemaMessage);
            return;
        }

        if (!selectedDocumentSubject) {
            toast.error('Select a boarding stay or history.');
            return;
        }

        if (!documentForm.title.trim()) {
            toast.error('Document title is required.');
            return;
        }

        if (!documentForm.file) {
            toast.error('Choose a document to upload.');
            return;
        }

        setActionLoading('boarding-document');
        try {
            const documentPath = await uploadDocumentFile(documentForm.file, 'boarding_document');

            if (!documentPath) {
                throw new Error('The document upload completed without a usable file path.');
            }

            await createBoardingDocument({
                assignment_id: selectedDocumentSubject.assignmentId || null,
                booking_id: selectedDocumentSubject.bookingId,
                pet_id: selectedDocumentSubject.petId || null,
                document_type: documentForm.documentType,
                title: documentForm.title.trim(),
                document_path: documentPath,
                file_name: documentForm.file.name,
                mime_type: documentForm.file.type,
                notes: documentForm.notes.trim() || null
            });

            toast.success('Boarding document attached.');
            setIsDocumentOpen(false);
            setDocumentForm(emptyDocumentForm);
            fetchBoardingData();
        } catch (error) {
            console.error('Failed to save a boarding document:', error);
            toast.error(error?.message || 'The document could not be attached. Please try again.');
        } finally {
            setActionLoading('');
        }
    };

    const printBoardingHistory = (subject) => {
        if (!subject) {
            toast.error('Select a boarding stay or history to print.');
            return;
        }

        const subjectTasks = tasks.filter((task) => (
            String(task.assignmentId || '') === String(subject.assignmentId || '')
            || String(task.bookingId || '') === String(subject.bookingId || '')
        ));
        const subjectObservations = observations.filter((observation) => (
            String(observation.assignmentId || '') === String(subject.assignmentId || '')
            || String(observation.bookingId || '') === String(subject.bookingId || '')
        ));
        const subjectDocuments = documents.filter((document) => (
            String(document.assignmentId || '') === String(subject.assignmentId || '')
            || String(document.bookingId || '') === String(subject.bookingId || '')
        ));

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Allow popups to print the boarding history.');
            return;
        }

        printWindow.document.write(buildHistoryPrintHtml({
            title: `${subject.petName || 'Pet'} Boarding Monitoring History`,
            booking: subject.booking,
            assignment: subject.assignment,
            tasks: subjectTasks,
            observations: subjectObservations,
            documents: subjectDocuments
        }));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const goToPayment = (unit) => {
        const assignmentId = unit?.assignment?.assignmentId ? String(unit.assignment.assignmentId) : '';
        const materialLines = getAssignmentMaterialLines(materialUsage, assignmentId);
        if (materialBillingTraceReady !== true) {
            toast.error('Material charges cannot be sent to payment right now. Try again later or contact support.');
            return;
        }
        if (!materialBackendReady && materialLines.some((line) => !line.usageId)) {
            toast.error('Wait for locally staged boarding materials to synchronize before opening payment.');
            return;
        }
        localStorage.setItem('ipawcus-pos-prefill', JSON.stringify(buildPaymentPrefill(unit, materialLines)));
        navigate('/dashboard/pos');
    };

    const currentFacilityMeta = getFacilityMeta(facilityView);
    const CurrentFacilityIcon = currentFacilityMeta.Icon;
    const previewDocumentUrl = getBoardingDocumentUrl(previewDocument);
    const previewDocumentIsImage = isImageBoardingDocument(previewDocument);
    const previewDocumentIsPdf = isPdfBoardingDocument(previewDocument);

    const renderFacilityToggle = () => (
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-inner">
            <button
                type="button"
                onClick={() => setFacilityView('boarding')}
                className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                    facilityView === 'boarding'
                        ? 'bg-white text-[#155dfc] shadow-sm'
                        : 'text-slate-600 hover:text-[#101828]'
                }`}
            >
                <Home className="size-4" />
                Kennel Boarding
            </button>
            <button
                type="button"
                onClick={() => setFacilityView('hotel')}
                className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                    facilityView === 'hotel'
                        ? 'bg-white text-[#155dfc] shadow-sm'
                        : 'text-slate-600 hover:text-[#101828]'
                }`}
            >
                <Hotel className="size-4" />
                Pet Hotel Boarding
            </button>
        </div>
    );

    const renderUnitCard = (unit) => {
        const assignment = unit.assignment || {};
        const PetIcon = getPetIcon(assignment.petSpecies);
        const statusMeta = getRoomStatusMeta(unit.status);
        const StatusIcon = statusMeta.Icon;
        const FacilityIcon = unit.hotelBoardingType === 'hotel' ? Hotel : Home;

        return (
            <button
                key={unit.id}
                type="button"
                onClick={() => openUnitDetails(unit)}
                className={`group min-h-[204px] overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusMeta.card}`}
            >
                <div className={`h-1.5 ${statusMeta.rail}`} />
                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${statusMeta.iconBox}`}>
                                <FacilityIcon className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase text-slate-400">{ROOM_SIZE_LABELS[unit.roomSize]}</p>
                                <p className="mt-0.5 text-2xl font-black text-[#101828]">{getRoomCode(unit)}</p>
                            </div>
                        </div>
                        <Badge className={`${statusMeta.badge} shrink-0`}>
                            <StatusIcon className="mr-1 size-3" />
                            {statusMeta.label}
                        </Badge>
                    </div>

                    <div className="mt-4 min-h-[72px] border-t border-slate-100 pt-3">
                        {assignment.petName ? (
                            <>
                                <div className="flex min-w-0 items-center gap-2">
                                    <PetIcon className="size-4 shrink-0 text-slate-500" />
                                    <p className="truncate text-sm font-black text-[#101828]">{assignment.petName}</p>
                                </div>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{assignment.ownerName}</p>
                                <p className="mt-2 truncate text-xs text-slate-500">{assignment.bookingNumber}</p>
                            </>
                        ) : (
                            <div className="flex h-full items-center gap-3 text-sm font-semibold text-slate-500">
                                <StatusIcon className="size-5 shrink-0" />
                                <span>{unit.status === 'maintenance' ? 'Under maintenance' : `${currentFacilityMeta.unitSingular} ready`}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2">
                            <p className="font-black uppercase text-slate-400">{unit.status === 'occupied' ? 'Boarded On' : 'Start'}</p>
                            <p className="mt-1 truncate font-semibold text-slate-700">
                                {assignment.petName ? formatDateTime(assignment.actualCheckInAt || assignment.checkInDate, 'Pending') : statusMeta.note}
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                            <p className="font-black uppercase text-slate-400">Desired Out</p>
                            <p className="mt-1 truncate font-semibold text-slate-700">
                                {assignment.petName ? formatDate(assignment.desiredCheckOutDate || assignment.checkOutDate) : '-'}
                            </p>
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    const renderRoomGroup = (roomSize) => {
        const groupUnits = filteredUnits.filter((unit) => unit.roomSize === roomSize);
        if (groupUnits.length === 0) return null;
        const groupStats = ['available', 'reserved', 'occupied', 'maintenance'].reduce((counts, status) => {
            counts[status] = groupUnits.filter((unit) => unit.status === status).length;
            return counts;
        }, {});

        return (
            <section key={roomSize} className="space-y-4">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className={`flex size-10 items-center justify-center rounded-lg ${currentFacilityMeta.surface} ${currentFacilityMeta.text}`}>
                                <CurrentFacilityIcon className="size-5" />
                            </span>
                            <div>
                                <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
                                    {ROOM_SIZE_LABELS[roomSize]} {currentFacilityMeta.unitLabel}
                                </h3>
                                <p className="text-sm font-semibold text-slate-500">{groupUnits.length} total units</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs sm:min-w-[360px]">
                        {['available', 'reserved', 'occupied', 'maintenance'].map((status) => {
                            const statusMeta = getRoomStatusMeta(status);
                            return (
                                <div key={status} className="rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="font-black text-[#101828]">{groupStats[status]}</p>
                                    <p className="truncate font-semibold text-slate-500">{statusMeta.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                    {['occupied', 'reserved', 'available', 'maintenance'].map((status) => {
                        const count = groupStats[status];
                        if (!count) return null;
                        return (
                            <span
                                key={status}
                                className={getRoomStatusMeta(status).rail}
                                style={{ width: `${(count / groupUnits.length) * 100}%` }}
                            />
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {groupUnits.map(renderUnitCard)}
                </div>
            </section>
        );
    };

    const renderRoomsTable = () => (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead>Room</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Desired Out</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUnits.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-500">
                                    <Search className="mb-2 size-8" />
                                    <p className="font-semibold">No rooms match the current search.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredUnits.map((unit) => {
                            const assignment = unit.assignment || {};
                            const statusMeta = getRoomStatusMeta(unit.status);
                            const StatusIcon = statusMeta.Icon;
                            const FacilityIcon = unit.hotelBoardingType === 'hotel' ? Hotel : Home;

                            return (
                                <TableRow
                                    key={unit.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openUnitDetails(unit)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openUnitDetails(unit);
                                        }
                                    }}
                                    className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc]"
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${statusMeta.iconBox}`}>
                                                <FacilityIcon className="size-5" />
                                            </span>
                                            <div>
                                                <p className="font-black text-[#101828]">{getRoomCode(unit)}</p>
                                                <p className="text-xs font-semibold text-slate-500">{unit.roomLabel}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-slate-700">{ROOM_SIZE_LABELS[unit.roomSize]}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={statusMeta.badge}>
                                            <StatusIcon className="mr-1 size-3" />
                                            {statusMeta.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p className="max-w-44 truncate font-semibold text-[#101828]">{assignment.petName || '-'}</p>
                                        {assignment.bookingNumber && (
                                            <p className="text-xs font-semibold text-slate-500">{assignment.bookingNumber}</p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <p className="max-w-44 truncate font-semibold text-slate-700">{assignment.ownerName || '-'}</p>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-slate-700">
                                            {assignment.petName ? formatDateTime(assignment.actualCheckInAt || assignment.checkInDate, 'Pending') : '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-slate-700">
                                            {assignment.petName ? formatDate(assignment.desiredCheckOutDate || assignment.checkOutDate) : '-'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </section>
    );

    const renderAssignmentSelect = (value, onValueChange) => (
        <Select
            value={value}
            onValueChange={onValueChange}
            disabled={activeAssignments.length === 0}
        >
            <SelectTrigger>
                <SelectValue
                    placeholder="Select pet room"
                    displayValue={
                        activeAssignments.find((item) => item.value === value)
                            ? `${activeAssignments.find((item) => item.value === value).assignment.petName} - ${activeAssignments.find((item) => item.value === value).unit.roomLabel}`
                            : undefined
                    }
                />
            </SelectTrigger>
            <SelectContent>
                {activeAssignments.map(({ unit, assignment, value: optionValue }) => (
                    <SelectItem key={optionValue} value={optionValue}>
                        {assignment.petName} - {unit.roomLabel}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const renderDocumentSubjectSelect = (value, onValueChange) => (
        <Select
            value={value}
            onValueChange={onValueChange}
            disabled={documentSubjects.length === 0}
        >
            <SelectTrigger>
                <SelectValue
                    placeholder="Select boarding stay or history"
                    displayValue={
                        documentSubjects.find((item) => item.value === value)
                            ? `${documentSubjects.find((item) => item.value === value).petName} - ${documentSubjects.find((item) => item.value === value).bookingNumber}`
                            : undefined
                    }
                />
            </SelectTrigger>
            <SelectContent>
                {documentSubjects.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                        {subject.petName} - {subject.bookingNumber} {subject.source === 'history' ? '(History)' : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                icon={CurrentFacilityIcon}
                title="Pet Hotel & Kennel Boarding Management"
                description="Manage kennel and hotel units, active stays, daily care, and boarding availability."
                petHover
                petKind="dog"
                petAccent="mint"
                meta={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${currentFacilityMeta.surface} ${currentFacilityMeta.text}`}>
                            {FACILITY_LABELS[facilityView]}
                        </Badge>
                        <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {stats.total} units
                        </Badge>
                        {stats.overdue > 0 && (
                            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                                {stats.overdue} missed task{stats.overdue === 1 ? '' : 's'}
                            </Badge>
                        )}
                    </div>
                )}
                layout="stacked"
                toolbar={(
                    <div className="grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center">
                        <div className="min-w-0 lg:max-w-md">
                            {branchSelectionLocked ? (
                                <div className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    <Building2 className="size-4 shrink-0 text-slate-500" />
                                    <span className="truncate">{getBranchDisplayName(branches, branchId, 'Assigned clinic location')}</span>
                                </div>
                            ) : (
                                <Select value={branchId} onValueChange={setBranchId}>
                                    <SelectTrigger aria-label="Boarding clinic location">
                                        <Building2 className="mr-2 size-4 text-slate-500" />
                                        <SelectValue placeholder="Select clinic location" displayValue={getBranchDisplayName(branches, branchId)} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.map(branch => (
                                            <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="flex justify-end">{renderFacilityToggle()}</div>
                    </div>
                )}
            />

            {schemaMessage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-black">Boarding tools are temporarily unavailable</p>
                            <p className="mt-1">{schemaMessage}</p>
                            <p className="mt-1">Refresh the page or contact support if the problem continues.</p>
                        </div>
                    </div>
                </div>
            )}

            {stats.overdue > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <div className="flex items-start justify-between gap-3">
                        <span className="flex items-start gap-3">
                            <Bell className="mt-0.5 size-5 shrink-0" />
                            <span>
                                <span className="font-black">{stats.overdue} missed task{stats.overdue === 1 ? '' : 's'}</span> need attention.
                            </span>
                        </span>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab('monitoring')}>
                            View
                        </Button>
                    </div>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-xl grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms</TabsTrigger>
                    <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            { status: 'available', value: stats.available },
                            { status: 'reserved', value: stats.reserved },
                            { status: 'occupied', value: stats.occupied },
                            { status: 'maintenance', value: stats.maintenance }
                        ].map((item) => {
                            const statusMeta = getRoomStatusMeta(item.status);
                            const StatusIcon = statusMeta.Icon;
                            return (
                                <div key={item.status} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`flex size-11 items-center justify-center rounded-lg ${statusMeta.iconBox}`}>
                                            <StatusIcon className="size-5" />
                                        </span>
                                        <p className="text-3xl font-black text-[#101828]">{item.value}</p>
                                    </div>
                                    <p className="mt-4 text-sm font-black text-slate-700">{statusMeta.label}</p>
                                    <p className="text-xs font-semibold text-slate-500">{statusMeta.note}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">Reservation Queue</h3>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">{FACILITY_LABELS[facilityView]}</p>
                                    </div>
                                    <Badge className="w-fit bg-amber-50 text-amber-700">
                                        {pendingReservationCount} need room
                                    </Badge>
                                </div>
                            </div>

                            {visibleBoardingBookings.length === 0 ? (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center text-slate-500">
                                    <Receipt className="mb-3 size-9" />
                                    <p className="font-semibold">No reservation requests for this facility.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {visibleBoardingBookings.map((booking) => (
                                        <div key={booking.id} className="p-4 transition hover:bg-slate-50">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-black text-[#101828]">{booking.bookingNumber}</p>
                                                        <Badge className={booking.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>
                                                            {booking.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-2 truncate text-sm font-semibold text-slate-700">
                                                        {booking.petName || 'Pet'} / {booking.ownerName || 'Owner'}
                                                    </p>
                                                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                                        <InfoPanel label="Size" value={ROOM_SIZE_LABELS[booking.roomSize] || booking.roomSize} compact />
                                                        <InfoPanel label="Stay" value={`${formatDate(booking.checkInDate)} to ${formatDate(booking.checkOutDate)}`} compact />
                                                    </div>
                                                    {booking.boardingAssignment && (
                                                        <p className="mt-3 text-sm font-semibold text-blue-700">
                                                            Reserved: {booking.boardingAssignment.roomLabel}
                                                        </p>
                                                    )}
                                                </div>
                                                {booking.boardingAssignment ? (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('rooms')}>
                                                        <Eye className="size-4" />
                                                        View Room
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => openReservationConsent(booking)}
                                                        disabled={actionLoading === `reserve-${booking.id}`}
                                                        className="bg-[#155dfc] hover:bg-[#0d4acf]"
                                                    >
                                                        {actionLoading === `reserve-${booking.id}` ? <Loader2 className="size-4 animate-spin" /> : <Hotel className="size-4" />}
                                                        Reserve
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">Active Stays</h3>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">{FACILITY_LABELS[facilityView]}</p>
                                    </div>
                                    <Badge className="bg-blue-50 text-blue-700">{activeUnits.length} active</Badge>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex min-h-48 items-center justify-center text-slate-500">
                                    <Loader2 className="mr-2 size-5 animate-spin" />
                                    Loading stays...
                                </div>
                            ) : activeUnits.length === 0 ? (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center text-slate-500">
                                    <PawPrint className="mb-3 size-9" />
                                    <p className="font-semibold">No active stays for this facility.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {activeUnits.map((unit) => {
                                        const assignment = unit.assignment;
                                        const PetIcon = getPetIcon(assignment.petSpecies);
                                        const statusMeta = getRoomStatusMeta(unit.status);

                                        return (
                                            <button
                                                key={unit.id}
                                                type="button"
                                                onClick={() => openUnitDetails(unit)}
                                                className="block w-full p-4 text-left transition hover:bg-slate-50"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className={`flex size-12 shrink-0 items-center justify-center rounded-lg font-black ${statusMeta.iconBox}`}>
                                                            {getRoomCode(unit)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <PetIcon className="size-4 shrink-0 text-slate-500" />
                                                                <p className="truncate font-black text-[#101828]">{assignment.petName}</p>
                                                            </div>
                                                            <p className="truncate text-sm font-semibold text-slate-500">{assignment.ownerName}</p>
                                                        </div>
                                                    </div>
                                                    <Badge className={statusMeta.badge}>{statusMeta.label}</Badge>
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                    <InfoPanel label="In" value={formatDate(assignment.actualCheckInAt || assignment.checkInDate)} compact />
                                                    <InfoPanel label="Desired Out" value={formatDate(assignment.desiredCheckOutDate || assignment.checkOutDate)} compact />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="rooms" className="space-y-6">
                    <section className={`overflow-hidden rounded-lg border border-l-4 border-slate-200 bg-white shadow-sm ${currentFacilityMeta.accent}`}>
                        <div className="p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${currentFacilityMeta.surface} ${currentFacilityMeta.text}`}>
                                        <CurrentFacilityIcon className="size-6" />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="font-['Arimo:Bold',sans-serif] text-[20px] text-[#101828]">
                                            {currentFacilityMeta.title}
                                        </h3>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">
                                            {stats.available} available, {stats.reserved} reserved, {stats.occupied} boarded
                                        </p>
                                    </div>
                                </div>

                                <div className="flex w-full flex-col gap-3 xl:max-w-3xl">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setRoomViewMode('cards')}
                                                aria-pressed={roomViewMode === 'cards'}
                                                className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                                                    roomViewMode === 'cards'
                                                        ? 'bg-white text-[#155dfc] shadow-sm'
                                                        : 'text-slate-600 hover:text-[#101828]'
                                                }`}
                                            >
                                                <LayoutGrid className="size-4" />
                                                Cards
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRoomViewMode('table')}
                                                aria-pressed={roomViewMode === 'table'}
                                                className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-black transition ${
                                                    roomViewMode === 'table'
                                                        ? 'bg-white text-[#155dfc] shadow-sm'
                                                        : 'text-slate-600 hover:text-[#101828]'
                                                }`}
                                            >
                                                <Table2 className="size-4" />
                                                Table
                                            </button>
                                        </div>
                                        <Button variant="outline" onClick={openAddRoom}>
                                            <Plus className="size-4" />
                                            Add Room
                                        </Button>
                                        <Button className="bg-[#155dfc] hover:bg-[#0d4acf]" onClick={() => openWalkInCheckIn()}>
                                            <Plus className="size-4" />
                                            Check-in
                                        </Button>
                                    </div>
                                    <div>
                                        <Input
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Search room or booking"
                                            leftIcon={<Search className="size-4" />}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {[
                                    { status: 'available', value: stats.available },
                                    { status: 'reserved', value: stats.reserved },
                                    { status: 'occupied', value: stats.occupied },
                                    { status: 'maintenance', value: stats.maintenance }
                                ].map((item) => {
                                    const statusMeta = getRoomStatusMeta(item.status);
                                    const StatusIcon = statusMeta.Icon;
                                    return (
                                        <div key={item.status} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className={`flex size-10 items-center justify-center rounded-lg ${statusMeta.iconBox}`}>
                                                    <StatusIcon className="size-5" />
                                                </span>
                                                <p className="text-2xl font-black text-[#101828]">{item.value}</p>
                                            </div>
                                            <p className="mt-3 text-sm font-black text-slate-700">{statusMeta.label}</p>
                                            <p className="text-xs font-semibold text-slate-500">{statusMeta.note}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {roomViewMode === 'cards' ? (
                        <div className="space-y-10">
                            {ROOM_SIZE_ORDER.map(renderRoomGroup)}
                        </div>
                    ) : renderRoomsTable()}
                </TabsContent>

                <TabsContent value="monitoring" className="space-y-6">
                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                    <ClipboardList className="size-5" />
                                </span>
                                <div>
                                    <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">Monitoring</h3>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">{activeAssignments.length} active pet room assignments</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="outline" onClick={() => openObservation()}>
                                    <ClipboardList className="size-4" />
                                    Add Observation
                                </Button>
                                <Button variant="outline" onClick={() => openMaterialUsage()} disabled={activeAssignments.length === 0 || activeInventoryItems.length === 0 || materialSchemaReady !== true || materialBillingTraceReady !== true}>
                                    <Package className="size-4" />
                                    Add Material
                                </Button>
                                <Button variant="outline" onClick={() => openDocumentUpload()} disabled={documentSubjects.length === 0 || Boolean(documentSchemaMessage)}>
                                    <Upload className="size-4" />
                                    Upload Document
                                </Button>
                                <Button variant="outline" onClick={() => printBoardingHistory(documentSubjects[0])} disabled={documentSubjects.length === 0}>
                                    <Printer className="size-4" />
                                    Print History
                                </Button>
                                <Button className="bg-[#155dfc] hover:bg-[#0d4acf]" onClick={() => openTask()}>
                                    <CalendarClock className="size-4" />
                                    Schedule Task
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-5">
                            {[
                                { label: 'Pending Tasks', value: stats.pending, icon: Clock, className: 'bg-amber-50 text-amber-700' },
                                { label: 'Missed Tasks', value: stats.overdue, icon: AlertCircle, className: 'bg-red-50 text-red-700' },
                                { label: 'Observations', value: observations.length, icon: ClipboardList, className: 'bg-blue-50 text-blue-700' },
                                { label: 'Materials', value: stats.materials, icon: Package, className: 'bg-cyan-50 text-cyan-700' },
                                { label: 'Documents', value: documents.length, icon: FileText, className: 'bg-emerald-50 text-emerald-700' }
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`flex size-10 items-center justify-center rounded-lg ${item.className}`}>
                                                <Icon className="size-5" />
                                            </span>
                                            <p className="text-3xl font-black text-[#101828]">{item.value}</p>
                                        </div>
                                        <p className="mt-3 text-sm font-black text-slate-700">{item.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {documentSchemaMessage && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                            {documentSchemaMessage}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                                <h4 className="font-black text-[#101828]">Task Alerts</h4>
                                <Badge className={stats.overdue > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}>
                                    {tasks.length} total
                                </Badge>
                            </div>
                            {tasks.length === 0 ? (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center text-slate-500">
                                    <Clock className="mb-3 size-9" />
                                    <p className="font-semibold">No care tasks yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {tasks.map((task) => (
                                        <div key={task.taskId} className="p-4">
                                            <div className={`rounded-lg border p-4 ${getTaskStatusStyle(task.status)}`}>
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge className="border border-current bg-white/40 text-current">
                                                                {(TASK_LABELS[task.taskType] || task.taskType).toUpperCase()}
                                                            </Badge>
                                                            <span className="text-sm font-semibold">{formatDateTime(task.dueAt)}</span>
                                                        </div>
                                                        <p className="mt-3 truncate font-black text-[#101828]">{task.petName} - {task.roomLabel}</p>
                                                        <p className="text-sm font-semibold opacity-80">{task.ownerName}</p>
                                                        {task.assignedTo && <p className="mt-1 text-sm opacity-80">Assigned to {task.assignedTo}</p>}
                                                        {task.notes && <p className="mt-2 whitespace-pre-wrap text-sm italic opacity-80">{task.notes}</p>}
                                                    </div>
                                                    {task.status !== 'completed' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => completeTask(task)}
                                                            disabled={actionLoading === `task-${task.taskId}`}
                                                            className="bg-[#155dfc] hover:bg-[#0d4acf]"
                                                        >
                                                            {actionLoading === `task-${task.taskId}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                                                            Mark Done
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                                <h4 className="font-black text-[#101828]">Recent Observations</h4>
                                <Badge className="bg-blue-50 text-blue-700">{observations.length} records</Badge>
                            </div>
                            {observations.length === 0 ? (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center text-slate-500">
                                    <ClipboardList className="mb-3 size-9" />
                                    <p className="font-semibold">No observations recorded yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {observations.map((observation) => (
                                        <div key={observation.observationId} className="p-4 transition hover:bg-slate-50">
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0">
                                                    <Badge className="bg-blue-50 text-blue-700">
                                                        {OBSERVATION_LABELS[observation.observationType] || observation.observationType}
                                                    </Badge>
                                                    <p className="mt-3 truncate font-black text-[#101828]">{observation.petName} - {observation.roomLabel}</p>
                                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{observation.notes}</p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-500">{formatDateTime(observation.observedAt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h4 className="font-black text-[#101828]">Materials Used</h4>
                                <p className="text-sm font-semibold text-slate-500">Inventory items recorded during monitoring and added to checkout payment.</p>
                            </div>
                            <Button variant="outline" onClick={() => openMaterialUsage()} disabled={activeAssignments.length === 0 || activeInventoryItems.length === 0 || materialSchemaReady !== true || materialBillingTraceReady !== true}>
                                <Package className="size-4" />
                                Add Material
                            </Button>
                        </div>

                        {materialSyncMessage && (
                            <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                <p>{materialSyncMessage}</p>
                            </div>
                        )}

                        {visibleMaterialUsage.length === 0 ? (
                            <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center text-slate-500">
                                <Package className="mb-3 size-9" />
                                <p className="font-semibold">No boarding materials recorded.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {visibleMaterialUsage.map((line) => (
                                    <div key={line.id} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge className="bg-cyan-50 text-cyan-700">{line.roomLabel || 'Boarding stay'}</Badge>
                                                <span className="text-xs font-semibold text-slate-500">{formatDateTime(line.createdAt)}</span>
                                            </div>
                                            <p className="mt-2 font-black text-[#101828]">{line.itemName}</p>
                                            <p className="text-sm font-semibold text-slate-500">
                                                {line.petName} / {line.quantity} {line.unit} x {formatPhpCurrency(line.unitPrice)}
                                            </p>
                                            {line.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{line.notes}</p>}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeMaterialUsage(line.assignmentId, line.id)}
                                            disabled={line.canRemove === false}
                                        >
                                            <Trash2 className="size-4" />
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h4 className="font-black text-[#101828]">Boarding Documents</h4>
                                <p className="text-sm font-semibold text-slate-500">Monitoring reports, checkout summaries, and boarding history attachments.</p>
                            </div>
                            <Button variant="outline" onClick={() => openDocumentUpload()} disabled={documentSubjects.length === 0 || Boolean(documentSchemaMessage)}>
                                <Upload className="size-4" />
                                Upload Document
                            </Button>
                        </div>

                        {visibleDocuments.length === 0 ? (
                            <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center text-slate-500">
                                <FileText className="mb-3 size-9" />
                                <p className="font-semibold">No boarding documents attached.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {visibleDocuments.map((document) => (
                                    <div key={document.documentId} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge className="bg-emerald-50 text-emerald-700">{documentTypeLabel(document.documentType)}</Badge>
                                                <span className="text-xs font-semibold text-slate-500">{formatDateTime(document.createdAt)}</span>
                                            </div>
                                            <p className="mt-2 font-black text-[#101828]">{document.title}</p>
                                            <p className="text-sm font-semibold text-slate-500">{document.petName} - {document.bookingNumber}</p>
                                            {document.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{document.notes}</p>}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPreviewDocument(document)}
                                            >
                                                <Eye className="size-4" />
                                                Preview
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => printBoardingHistory(documentSubjects.find((subject) => (
                                                    String(subject.assignmentId || '') === String(document.assignmentId || '')
                                                    || String(subject.bookingId || '') === String(document.bookingId || '')
                                                )))}
                                            >
                                                <Printer className="size-4" />
                                                Print
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                {selectedUnit && (
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>{selectedUnit.roomLabel}</DialogTitle>
                            <DialogDescription>Room status and active pet stay details.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <InfoPanel label="Status" value={getRoomStatusMeta(selectedUnit.status).label} />
                                <InfoPanel label="Facility" value={FACILITY_LABELS[selectedUnit.hotelBoardingType]} />
                                <InfoPanel label="Size" value={ROOM_SIZE_LABELS[selectedUnit.roomSize]} />
                            </div>

                            {selectedUnit.assignment && (
                                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="font-black text-[#101828]">Assigned Pet</h4>
                                        <Badge className="bg-white text-blue-700">{selectedUnit.assignment.bookingNumber}</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <InfoPanel label="Pet" value={selectedUnit.assignment.petName} />
                                        <InfoPanel label="Owner" value={selectedUnit.assignment.ownerName} />
                                        <InfoPanel label="Checked In" value={formatDateTime(selectedUnit.assignment.actualCheckInAt, 'Not checked in')} />
                                        <InfoPanel label="Desired Out" value={formatDate(selectedUnit.assignment.desiredCheckOutDate || selectedUnit.assignment.checkOutDate)} />
                                        <InfoPanel label="Estimated Total" value={selectedUnit.assignment.price > 0 ? formatPhpCurrency(selectedUnit.assignment.price) : 'Not set'} />
                                        <InfoPanel label="Stay Status" value={getRoomStatusMeta(selectedUnit.assignment.status).label} />
                                    </div>
                                </div>
                            )}

                            {selectedUnit.assignment && (
                                <section className="rounded-lg border border-slate-200 bg-white">
                                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="font-black text-[#101828]">Room / Pet Records</h4>
                                            <p className="text-sm font-semibold text-slate-500">Observations and tasks for this stay.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openObservation(selectedUnit)}>
                                                <ClipboardList className="size-4" />
                                                Add Observation
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => openTask(selectedUnit)}>
                                                <CalendarClock className="size-4" />
                                                Schedule Task
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => openMaterialUsage(selectedUnit)} disabled={activeInventoryItems.length === 0 || materialSchemaReady !== true || materialBillingTraceReady !== true}>
                                                <Package className="size-4" />
                                                Add Material
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => openDocumentUpload(selectedUnit)} disabled={Boolean(documentSchemaMessage)}>
                                                <Upload className="size-4" />
                                                Upload Document
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => printBoardingHistory(documentSubjects.find((subject) => String(subject.assignmentId) === String(selectedUnit.assignment.assignmentId)))}
                                            >
                                                <Printer className="size-4" />
                                                Print
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-black text-slate-700">Observations</p>
                                                <Badge className="bg-blue-50 text-blue-700">{selectedUnitObservations.length}</Badge>
                                            </div>
                                            {selectedUnitObservations.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                                                    No observations recorded for this stay.
                                                </p>
                                            ) : (
                                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                                    {selectedUnitObservations.map((observation) => (
                                                        <div key={observation.observationId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <Badge className="bg-blue-50 text-blue-700">
                                                                    {OBSERVATION_LABELS[observation.observationType] || observation.observationType}
                                                                </Badge>
                                                                <span className="shrink-0 text-xs font-semibold text-slate-500">{formatDateTime(observation.observedAt)}</span>
                                                            </div>
                                                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{observation.notes}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-black text-slate-700">Scheduled Tasks</p>
                                                <Badge className="bg-amber-50 text-amber-700">{selectedUnitTasks.length}</Badge>
                                            </div>
                                            {selectedUnitTasks.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                                                    No tasks scheduled for this stay.
                                                </p>
                                            ) : (
                                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                                    {selectedUnitTasks.map((task) => (
                                                        <div key={task.taskId} className={`rounded-lg border p-3 ${getTaskStatusStyle(task.status)}`}>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <Badge className="border border-current bg-white/40 text-current">
                                                                    {(TASK_LABELS[task.taskType] || task.taskType).toUpperCase()}
                                                                </Badge>
                                                                <span className="shrink-0 text-xs font-semibold">{formatDateTime(task.dueAt)}</span>
                                                            </div>
                                                            {task.assignedTo && <p className="mt-2 text-sm font-semibold opacity-80">Assigned to {task.assignedTo}</p>}
                                                            {task.notes && <p className="mt-2 whitespace-pre-wrap text-sm opacity-80">{task.notes}</p>}
                                                            {task.status !== 'completed' && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => completeTask(task)}
                                                                    disabled={actionLoading === `task-${task.taskId}`}
                                                                    className="mt-3 bg-[#155dfc] hover:bg-[#0d4acf]"
                                                                >
                                                                    {actionLoading === `task-${task.taskId}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                                                                    Mark Done
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-black text-slate-700">Materials</p>
                                                <Badge className="bg-cyan-50 text-cyan-700">{selectedUnitMaterials.length}</Badge>
                                            </div>
                                            {selectedUnitMaterials.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                                                    No materials recorded for checkout.
                                                </p>
                                            ) : (
                                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                                    {selectedUnitMaterials.map((line) => (
                                                        <div key={line.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <Badge className="bg-cyan-50 text-cyan-700">
                                                                    {line.quantity} {line.unit}
                                                                </Badge>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => removeMaterialUsage(line.assignmentId, line.id)}
                                                                    disabled={line.canRemove === false}
                                                                    aria-label={`Remove ${line.itemName}`}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            </div>
                                                            <p className="mt-2 font-black text-[#101828]">{line.itemName}</p>
                                                            <p className="text-xs font-semibold text-slate-500">{formatPhpCurrency(line.unitPrice)} each</p>
                                                            {line.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{line.notes}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-black text-slate-700">Documents</p>
                                                <Badge className="bg-emerald-50 text-emerald-700">{selectedUnitDocuments.length}</Badge>
                                            </div>
                                            {selectedUnitDocuments.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                                                    No documents attached for this stay.
                                                </p>
                                            ) : (
                                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                                    {selectedUnitDocuments.map((document) => (
                                                        <div key={document.documentId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                            <Badge className="bg-emerald-50 text-emerald-700">
                                                                {documentTypeLabel(document.documentType)}
                                                            </Badge>
                                                            <p className="mt-2 font-black text-[#101828]">{document.title}</p>
                                                            <p className="text-xs font-semibold text-slate-500">{formatDateTime(document.createdAt)}</p>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setPreviewDocument(document)}
                                                                className="mt-3 h-8 bg-white px-3 text-xs"
                                                            >
                                                                <Eye className="size-3" />
                                                                Preview
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                            {selectedUnit.status === 'available' && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (window.confirm(`Remove ${selectedUnit.roomLabel} from active capacity? Existing history will be preserved.`)) {
                                                updateRoomStatus(selectedUnit, 'retired');
                                            }
                                        }}
                                        disabled={actionLoading === `room-${selectedUnit.id}`}
                                    >
                                        <Trash2 className="size-4" />
                                        Remove Room
                                    </Button>
                                    <Button variant="outline" onClick={() => updateRoomStatus(selectedUnit, 'maintenance')} disabled={actionLoading === `room-${selectedUnit.id}`}>
                                        <Wrench className="size-4" />
                                        Maintenance
                                    </Button>
                                    <Button className="bg-[#155dfc]" onClick={() => openWalkInCheckIn(selectedUnit)}>
                                        <Plus className="size-4" />
                                        Check In
                                    </Button>
                                </>
                            )}
                            {selectedUnit.status === 'maintenance' && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (window.confirm(`Remove ${selectedUnit.roomLabel} from active capacity? Existing history will be preserved.`)) {
                                                updateRoomStatus(selectedUnit, 'retired');
                                            }
                                        }}
                                        disabled={actionLoading === `room-${selectedUnit.id}`}
                                    >
                                        <Trash2 className="size-4" />
                                        Remove Room
                                    </Button>
                                    <Button className="bg-[#0c6a3c]" onClick={() => updateRoomStatus(selectedUnit, 'available')} disabled={actionLoading === `room-${selectedUnit.id}`}>
                                        <CheckCircle className="size-4" />
                                        Mark Available
                                    </Button>
                                </>
                            )}
                            {selectedUnit.status === 'reserved' && (
                                <Button className="bg-[#155dfc]" onClick={() => checkInReservedPet(selectedUnit)} disabled={actionLoading === `check-in-${selectedUnit.id}`}>
                                    <CheckCircle className="size-4" />
                                    Mark Boarded
                                </Button>
                            )}
                            {selectedUnit.status === 'occupied' && (
                                <>
                                    <Button variant="outline" onClick={() => setIsDesiredOutOpen(true)}>
                                        <CalendarClock className="size-4" />
                                        Desired Out
                                    </Button>
                                    <Button className="bg-[#155dfc]" onClick={() => goToPayment(selectedUnit)}>
                                        <CreditCard className="size-4" />
                                        Pay
                                    </Button>
                                    <Button variant="outline" onClick={() => checkOutPet(selectedUnit)} disabled={actionLoading === `check-out-${selectedUnit.id}`}>
                                        Check Out
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>

            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add Rooms</DialogTitle>
                        <DialogDescription>Increase capacity for a pet hotel room or kennel boarding category.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Clinic Location</Label>
                            <Select
                                value={String(addRoomForm.branchId || '')}
                                onValueChange={(value) => {
                                    setAddRoomForm(current => ({ ...current, branchId: value }));
                                    setBranchId(value);
                                }}
                            >
                                <SelectTrigger aria-label="Room clinic location">
                                    <Building2 className="mr-2 size-4 text-slate-500" />
                                    <SelectValue
                                        placeholder="Select clinic location"
                                        displayValue={getBranchDisplayName(branches, addRoomForm.branchId)}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map(branch => (
                                        <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">Rooms are added only to this location.</p>
                        </div>
                        <FieldSelect
                            label="Facility"
                            value={addRoomForm.type}
                            displayValue={FACILITY_LABELS[addRoomForm.type]}
                            onChange={(value) => setAddRoomForm({ ...addRoomForm, type: value })}
                            options={[
                                { value: 'boarding', label: 'Kennel Boarding' },
                                { value: 'hotel', label: 'Pet Hotel Boarding' }
                            ]}
                        />
                        <FieldSelect
                            label="Room Size"
                            value={addRoomForm.roomSize}
                            displayValue={ROOM_SIZE_LABELS[addRoomForm.roomSize]}
                            onChange={(value) => setAddRoomForm({ ...addRoomForm, roomSize: value })}
                            options={ROOM_SIZE_OPTIONS}
                        />
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                min="1"
                                restriction="integer"
                                value={addRoomForm.quantity}
                                onChange={(event) => setAddRoomForm({ ...addRoomForm, quantity: event.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={addRoomForm.description}
                                onChange={(event) => setAddRoomForm({ ...addRoomForm, description: event.target.value })}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddRoomOpen(false)}>Cancel</Button>
                        <Button onClick={addRoom} disabled={actionLoading === 'add-room'} className="bg-[#155dfc]">
                            {actionLoading === 'add-room' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isReservationConsentOpen}
                onOpenChange={(open) => {
                    if (actionLoading.startsWith('reserve-') || actionLoading.startsWith('check-in-')) return;
                    if (!open) closeReservationConsent();
                }}
            >
                <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
                    <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6">
                        <DialogTitle>
                            {reservationConsentPurpose === 'check-in'
                                ? 'Boarding Consent Required Before Check-in'
                                : 'Boarding Consent and Room Reservation'}
                        </DialogTitle>
                        <DialogDescription>
                            {reservationConsentPurpose === 'check-in'
                                ? 'The previous consent PDF is missing or could not be verified. Capture a signature or upload the completed PDF before marking the pet boarded.'
                                : 'Review the boarding consent, capture the owner signature or upload the completed PDF, then reserve the room.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" tabIndex={0} aria-label="Scrollable boarding consent form">
                        <BoardingConsentCapture
                            booking={reservationBooking}
                            templates={consentTemplates}
                            templateId={reservationConsentTemplateId}
                            onTemplateIdChange={handleReservationConsentTemplateChange}
                            mode={reservationConsentMode}
                            onModeChange={handleReservationConsentModeChange}
                            signature={reservationConsentSignature}
                            onSignatureChange={setReservationConsentSignature}
                            uploadFile={reservationConsentFile}
                            onUploadFileChange={setReservationConsentFile}
                            disabled={actionLoading.startsWith('reserve-') || actionLoading.startsWith('check-in-')}
                            ignoreExisting={reservationForceConsentCapture}
                        />
                    </div>
                    <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
                        <Button
                            variant="outline"
                            onClick={closeReservationConsent}
                            disabled={actionLoading.startsWith('reserve-') || actionLoading.startsWith('check-in-')}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={submitReservationConsent}
                            disabled={
                                !reservationBooking
                                || actionLoading.startsWith('reserve-')
                                || actionLoading.startsWith('check-in-')
                                || ((reservationForceConsentCapture || !boardingConsentPath(reservationBooking)) && (
                                    !reservationConsentTemplateId
                                    || (reservationConsentMode === 'sign' ? !reservationConsentSignature : !reservationConsentFile)
                                ))
                            }
                            className="bg-[#155dfc]"
                        >
                            {(actionLoading.startsWith('reserve-') || actionLoading.startsWith('check-in-'))
                                ? <Loader2 className="size-4 animate-spin" />
                                : (reservationConsentPurpose === 'check-in' ? <CheckCircle className="size-4" /> : <Hotel className="size-4" />)}
                            {reservationConsentPurpose === 'check-in' ? 'Record consent and mark boarded' : 'Record consent and reserve'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDirectCheckInOpen} onOpenChange={handleDirectCheckInOpenChange}>
                <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Check-in</DialogTitle>
                        <DialogDescription>Create a boarding stay for a pet already at the clinic.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <SearchablePetField
                            value={directCheckInForm.petId}
                            pets={pets}
                            onChange={handleDirectPetChange}
                        />
                        <FieldSelect
                            label="Facility"
                            value={directCheckInForm.type}
                            displayValue={FACILITY_LABELS[directCheckInForm.type]}
                            onChange={(value) => setDirectCheckInForm({ ...directCheckInForm, type: value, roomNumber: '' })}
                            options={[
                                { value: 'boarding', label: 'Kennel Boarding' },
                                { value: 'hotel', label: 'Pet Hotel Boarding' }
                            ]}
                        />
                        <FieldSelect
                            label="Room Size"
                            value={directCheckInForm.roomSize}
                            displayValue={ROOM_SIZE_LABELS[directCheckInForm.roomSize]}
                            onChange={(value) => setDirectCheckInForm({ ...directCheckInForm, roomSize: value, roomNumber: '' })}
                            options={ROOM_SIZE_OPTIONS}
                        />
                        <FieldSelect
                            label="Available Room"
                            value={directCheckInForm.roomNumber}
                            displayValue={availableDirectRooms.find((unit) => String(unit.roomNumber) === directCheckInForm.roomNumber)?.roomLabel}
                            onChange={(value) => setDirectCheckInForm({ ...directCheckInForm, roomNumber: value })}
                            options={availableDirectRooms.map((unit) => ({ value: String(unit.roomNumber), label: unit.roomLabel }))}
                            placeholder="Auto assign"
                        />
                        <div className="space-y-2">
                            <Label>Check-in Date</Label>
                            <Input value={todayIso()} readOnly className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                            <Label>Desired Out *</Label>
                            <Input
                                type="date"
                                min={todayIso()}
                                value={directCheckInForm.checkOutDate}
                                onChange={(event) => setDirectCheckInForm({ ...directCheckInForm, checkOutDate: event.target.value })}
                            />
                        </div>
                        <section className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4 sm:col-span-2">
                            <div>
                                <h4 className="font-black text-[#101828]">Catalog Price Selection</h4>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    Select the boarding service from the service catalog to compute the estimated total.
                                </p>
                            </div>
                            {catalogSchemaMessage && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                                    {catalogSchemaMessage}
                                </div>
                            )}
                            {boardingCatalogServices.length === 0 ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                                    No active boarding services found in the service catalog. Add a Boarding service first.
                                </div>
                            ) : (
                                <FieldSelect
                                    label="Boarding Catalog"
                                    value={directCheckInForm.serviceCatalogId}
                                    displayValue={
                                        selectedBoardingCatalogService
                                            ? `${getCatalogServiceLabel(selectedBoardingCatalogService)} - ${formatPhpCurrency(directCheckInUnitPrice)} / day`
                                            : ''
                                    }
                                    onChange={(value) => setDirectCheckInForm({ ...directCheckInForm, serviceCatalogId: value })}
                                    options={boardingCatalogServices.map((service) => ({
                                        value: getCatalogServiceId(service),
                                        label: `${getCatalogServiceLabel(service)} - ${formatPhpCurrency(getCatalogServicePrice(service))} / day`
                                    }))}
                                    placeholder="Select boarding catalog"
                                />
                            )}
                            <div className="grid gap-3 sm:grid-cols-3">
                                <InfoPanel
                                    label="Catalog Rate"
                                    value={selectedBoardingCatalogService ? `${formatPhpCurrency(directCheckInUnitPrice)} / day` : 'Select catalog'}
                                    compact
                                />
                                <InfoPanel
                                    label="Stay Length"
                                    value={directCheckInStayDays > 0 ? `${directCheckInStayDays} day(s)` : 'Select out date'}
                                    compact
                                />
                                <div className="rounded-lg border border-blue-200 bg-white p-2">
                                    <p className="text-xs font-black uppercase text-slate-400">Estimated Total</p>
                                    <p className="mt-0.5 text-base font-black text-[#155dfc]">
                                        {selectedBoardingCatalogService && directCheckInStayDays > 0
                                            ? formatPhpCurrency(directCheckInEstimatedTotal)
                                            : 'Not ready'}
                                    </p>
                                </div>
                            </div>
                            {selectedBoardingCatalogService && directCheckInUnitPrice <= 0 && (
                                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                                    This catalog service has a zero base price. Update the Boarding service in Service Catalog if this should produce a paid estimate.
                                </p>
                            )}
                        </section>
                        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#155dfc]" />
                                <div>
                                    <h4 className="font-black text-[#101828]">Required Boarding Consent</h4>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">A signed PDF or uploaded completed PDF is required before direct room assignment.</p>
                                </div>
                            </div>
                            <BoardingConsentCapture
                                booking={(() => {
                                    const pet = pets.find((item) => getPetOptionValue(item) === String(directCheckInForm.petId));
                                    return {
                                        ...pet,
                                        petName: getPetName(pet),
                                        ownerName: getPetOwnerName(pet),
                                        branchName: getBranchDisplayName(branches, branchId) || '',
                                    };
                                })()}
                                templates={consentTemplates}
                                templateId={directConsentTemplateId}
                                onTemplateIdChange={handleDirectConsentTemplateChange}
                                mode={directConsentMode}
                                onModeChange={handleDirectConsentModeChange}
                                signature={directConsentSignature}
                                onSignatureChange={setDirectConsentSignature}
                                uploadFile={directConsentFile}
                                onUploadFileChange={setDirectConsentFile}
                                disabled={actionLoading === 'direct-check-in' || !directCheckInForm.petId}
                            />
                        </section>
                        <div className="space-y-2">
                            <Label>Emergency Contact</Label>
                            <Input
                                value={directCheckInForm.emergencyContact}
                                onChange={(event) => setDirectCheckInForm({ ...directCheckInForm, emergencyContact: normalizePhilippinePhoneInput(event.target.value) })}
                                inputMode="tel"
                                restriction="phone"
                                maxLength={13}
                                placeholder="+639"
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={directCheckInForm.notes}
                                onChange={(event) => setDirectCheckInForm({ ...directCheckInForm, notes: event.target.value })}
                                placeholder="Care notes"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleDirectCheckInOpenChange(false)}>Cancel</Button>
                        <Button
                            onClick={directCheckIn}
                            disabled={
                                actionLoading === 'direct-check-in'
                                || !directConsentTemplateId
                                || (directConsentMode === 'sign' ? !directConsentSignature : !directConsentFile)
                            }
                            className="bg-[#155dfc]"
                        >
                            {actionLoading === 'direct-check-in' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                            Check In
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isObservationOpen} onOpenChange={setIsObservationOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add Observation</DialogTitle>
                        <DialogDescription>Record eating, bathing, playing, behavior, or other notes for a pet.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pet Room *</Label>
                            {renderAssignmentSelect(observationForm.assignmentId, (value) => setObservationForm({ ...observationForm, assignmentId: value }))}
                        </div>
                        <FieldSelect
                            label="Observation Type"
                            value={observationForm.observationType}
                            displayValue={OBSERVATION_LABELS[observationForm.observationType]}
                            onChange={(value) => setObservationForm({ ...observationForm, observationType: value })}
                            options={Object.entries(OBSERVATION_LABELS).map(([value, label]) => ({ value, label }))}
                        />
                        <div className="space-y-2">
                            <Label>Observation *</Label>
                            <Textarea
                                value={observationForm.notes}
                                onChange={(event) => setObservationForm({ ...observationForm, notes: event.target.value })}
                                rows={4}
                                placeholder="Write the pet observation..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsObservationOpen(false)}>Cancel</Button>
                        <Button onClick={addObservation} disabled={actionLoading === 'observation'} className="bg-[#155dfc]">
                            {actionLoading === 'observation' ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Schedule Room Task</DialogTitle>
                        <DialogDescription>Assign a care task so missed work appears in monitoring.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pet Room *</Label>
                            {renderAssignmentSelect(taskForm.assignmentId, (value) => setTaskForm({ ...taskForm, assignmentId: value }))}
                        </div>
                        <FieldSelect
                            label="Task Type"
                            value={taskForm.taskType}
                            displayValue={TASK_LABELS[taskForm.taskType]}
                            onChange={(value) => setTaskForm({ ...taskForm, taskType: value })}
                            options={Object.entries(TASK_LABELS).map(([value, label]) => ({ value, label }))}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Due At *</Label>
                                <Input
                                    type="datetime-local"
                                    value={taskForm.dueAt}
                                    onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Assigned To</Label>
                                <Input
                                    value={taskForm.assignedTo}
                                    onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })}
                                    restriction="name"
                                    placeholder="Staff name"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Instructions</Label>
                            <Textarea
                                value={taskForm.notes}
                                onChange={(event) => setTaskForm({ ...taskForm, notes: event.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTaskOpen(false)}>Cancel</Button>
                        <Button onClick={addTask} disabled={actionLoading === 'task'} className="bg-[#155dfc]">
                            {actionLoading === 'task' ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                            Save Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isMaterialOpen} onOpenChange={setIsMaterialOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add Boarding Material</DialogTitle>
                        <DialogDescription>
                            Record inventory used while monitoring a boarded pet. These lines are added to POS checkout.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pet Room *</Label>
                            {renderAssignmentSelect(materialForm.assignmentId, (value) => setMaterialForm({ ...materialForm, assignmentId: value }))}
                        </div>

                        <div className="space-y-2">
                            <Label>Inventory Item *</Label>
                            <Select
                                value={materialForm.inventoryId}
                                onValueChange={(value) => {
                                    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === value);
                                    setMaterialForm({
                                        ...materialForm,
                                        inventoryId: value,
                                         unitPrice: item ? String(item.sellingPrice || 0) : materialForm.unitPrice
                                    });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={activeInventoryItems.length === 0 ? 'No stocked items available' : 'Select inventory item'}
                                        displayValue={selectedMaterialItem ? `${selectedMaterialItem.name} - ${selectedMaterialItem.quantity} ${selectedMaterialItem.unit}` : undefined}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeInventoryItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} - {item.quantity} {item.unit}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Quantity *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    restriction="integer"
                                    value={materialForm.quantity}
                                    onChange={(event) => setMaterialForm({ ...materialForm, quantity: event.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Selling Price Each</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    restriction="decimal"
                                    value={materialForm.unitPrice}
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={materialForm.notes}
                                onChange={(event) => setMaterialForm({ ...materialForm, notes: event.target.value })}
                                rows={3}
                                placeholder="e.g., Extra food"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMaterialOpen(false)}>Cancel</Button>
                        <Button onClick={addMaterialUsage} disabled={actionLoading === 'material' || materialSchemaReady !== true || materialBillingTraceReady !== true} className="bg-[#155dfc]">
                            {actionLoading === 'material' ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
                            Add Material
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDocumentOpen} onOpenChange={setIsDocumentOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Upload Boarding Document</DialogTitle>
                        <DialogDescription>
                            Attach monitoring reports, checkout summaries, or boarding history files for a stay.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <input
                            ref={documentFileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,image/jpeg,image/png,image/gif,image/webp,application/pdf"
                            onChange={handleDocumentFileSelect}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            <Label>Stay / History *</Label>
                            {renderDocumentSubjectSelect(documentForm.assignmentId, (value) => {
                                const subject = documentSubjects.find((item) => item.value === value);
                                setDocumentForm({
                                    ...documentForm,
                                    assignmentId: value,
                                    bookingId: subject?.bookingId ? String(subject.bookingId) : documentForm.bookingId,
                                    title: documentForm.title || (subject?.petName ? `${subject.petName} monitoring document` : '')
                                });
                            })}
                        </div>

                        <FieldSelect
                            label="Document Type"
                            value={documentForm.documentType}
                            displayValue={documentTypeLabel(documentForm.documentType)}
                            onChange={(value) => setDocumentForm({ ...documentForm, documentType: value })}
                            options={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                        />

                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={documentForm.title}
                                onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })}
                                placeholder="Example: Daily monitoring sheet"
                                maxLength={180}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Document *</Label>
                            <button
                                type="button"
                                onClick={() => documentFileInputRef.current?.click()}
                                className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-300 hover:bg-blue-50"
                            >
                                <Upload className="mb-3 size-9 text-slate-500" />
                                <span className="font-bold text-slate-900">{documentForm.fileName || 'Choose file'}</span>
                                <span className="mt-1 text-sm font-medium text-slate-500">JPG, PNG, GIF, WEBP, or PDF up to 8 MB</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={documentForm.notes}
                                onChange={(event) => setDocumentForm({ ...documentForm, notes: event.target.value })}
                                rows={3}
                                placeholder="Document notes"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDocumentOpen(false)}>Cancel</Button>
                        <Button onClick={saveBoardingDocument} disabled={actionLoading === 'boarding-document'} className="bg-[#155dfc]">
                            {actionLoading === 'boarding-document' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                            Save Document
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(previewDocument)} onOpenChange={(open) => !open && setPreviewDocument(null)}>
                <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{previewDocument?.title || previewDocument?.fileName || 'Boarding Document'}</DialogTitle>
                        <DialogDescription>
                            {[
                                previewDocument ? documentTypeLabel(previewDocument.documentType) : '',
                                previewDocument?.petName,
                                previewDocument?.bookingNumber
                            ].filter(Boolean).join(' - ')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-[55vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {previewDocumentIsImage && previewDocumentUrl ? (
                            <div className="flex h-[65vh] items-center justify-center p-3">
                                <ProtectedImage
                                    src={previewDocumentUrl}
                                    alt={previewDocument?.title || 'Boarding document preview'}
                                    className="max-h-full max-w-full object-contain"
                                    fallbackClassName="h-full w-full"
                                />
                            </div>
                        ) : previewDocumentIsPdf && previewDocumentUrl ? (
                            <div className="flex h-[55vh] flex-col items-center justify-center p-6 text-center">
                                <FileText className="mb-3 size-12 text-blue-500" />
                                <p className="font-black text-slate-900">{previewDocument?.fileName || previewDocument?.title || 'Boarding document'}</p>
                                <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">Open the protected PDF in a new tab to review it.</p>
                                <Button
                                    type="button"
                                    className="mt-4 bg-[#155dfc] hover:bg-[#0d4acf]"
                                    onClick={() => openProtectedDocument(previewDocumentUrl).catch((error) => {
                                        console.error('Failed to open boarding document:', error);
                                        toast.error(error?.message || 'The boarding document could not be opened.');
                                    })}
                                >
                                    <Eye className="size-4" />
                                    Open Document
                                </Button>
                            </div>
                        ) : (
                            <div className="flex h-[55vh] flex-col items-center justify-center p-6 text-center">
                                <FileText className="mb-3 size-12 text-slate-300" />
                                <p className="font-black text-slate-900">{previewDocument?.fileName || previewDocument?.title || 'Document preview unavailable'}</p>
                                <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                                    This file type cannot be rendered inline. Download it to view the full document.
                                </p>
                                {previewDocumentUrl && (
                                    <Button
                                        type="button"
                                        className="mt-4 bg-[#155dfc] hover:bg-[#0d4acf]"
                                        onClick={() => openProtectedDocument(previewDocumentUrl).catch((error) => {
                                            console.error('Failed to open boarding document:', error);
                                            toast.error(error?.message || 'The boarding document could not be opened.');
                                        })}
                                    >
                                        <Eye className="size-4" />
                                        Open Document
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isDesiredOutOpen} onOpenChange={setIsDesiredOutOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change Desired Out</DialogTitle>
                        <DialogDescription>Adjust the pet stay end date for room rearrangement.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Desired Out Date</Label>
                        <Input
                            type="date"
                            min={todayIso()}
                            value={desiredOutDate}
                            onChange={(event) => setDesiredOutDate(event.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDesiredOutOpen(false)}>Cancel</Button>
                        <Button onClick={updateDesiredOut} disabled={actionLoading === 'desired-out'} className="bg-[#155dfc]">
                            {actionLoading === 'desired-out' ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                            Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoPanel({ label, value, compact = false }) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-white ${compact ? 'p-2' : 'p-3'}`}>
            <p className="text-xs font-black uppercase text-slate-400">{label}</p>
            <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} break-words font-semibold text-[#101828]`}>{value || 'Not set'}</p>
        </div>
    );
}

function SearchablePetField({ value, pets = [], onChange }) {
    const containerRef = useRef(null);
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectablePets = useMemo(() => (
        pets.filter((pet) => getPetOptionValue(pet))
    ), [pets]);

    const selectedPet = useMemo(() => (
        selectablePets.find((pet) => getPetOptionValue(pet) === value)
    ), [selectablePets, value]);

    const filteredPets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const matches = normalizedQuery
            ? selectablePets.filter((pet) => getPetSearchText(pet).includes(normalizedQuery))
            : selectablePets;

        return matches.slice(0, 8);
    }, [query, selectablePets]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectPet = (pet) => {
        onChange(getPetOptionValue(pet));
        setQuery(getPetSearchLabel(pet));
        setIsOpen(false);
    };

    const handleQueryChange = (event) => {
        const nextQuery = event.target.value;

        setQuery(nextQuery);
        setIsOpen(true);

        if (selectedPet && nextQuery !== getPetSearchLabel(selectedPet)) {
            onChange('');
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if (event.key === 'Enter' && isOpen && filteredPets.length > 0) {
            event.preventDefault();
            selectPet(filteredPets[0]);
        }
    };

    return (
        <div ref={containerRef} className="relative space-y-2 sm:col-span-2">
            <Label>Pet *</Label>
            <div>
                <Input
                    value={query}
                    onChange={handleQueryChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search pet or owner"
                    leftIcon={<Search className="size-4" />}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-autocomplete="list"
                />
            </div>

            {selectedPet && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                    <PetSpeciesIcon species={selectedPet.species} className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">
                        Selected: {getPetSearchLabel(selectedPet)}
                    </span>
                </div>
            )}

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                    {filteredPets.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                            {selectablePets.length === 0 ? 'No pet records available.' : 'No matching pets found.'}
                        </div>
                    ) : (
                        filteredPets.map((pet) => {
                            const petValue = getPetOptionValue(pet);
                            const ownerName = getPetOwnerName(pet);
                            const isSelected = petValue === value;

                            return (
                                <button
                                    key={petValue}
                                    type="button"
                                    onClick={() => selectPet(pet)}
                                    className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition hover:bg-blue-50 ${
                                        isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                    }`}
                                >
                                    <PetSpeciesIcon species={pet.species} className="mt-0.5 size-4 shrink-0 text-slate-500" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black text-[#101828]">{getPetSearchLabel(pet)}</span>
                                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                                            {[ownerName && `Owner: ${ownerName}`, pet.breed].filter(Boolean).join(' / ') || 'Pet details unavailable'}
                                        </span>
                                    </span>
                                    {isSelected && <CheckCircle className="mt-0.5 size-4 shrink-0 text-blue-700" />}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function FieldSelect({ label, value, displayValue, onChange, options, placeholder = 'Select' }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} displayValue={displayValue} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
