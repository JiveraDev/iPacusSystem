import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    Camera,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Download,
    Eye,
    FileText,
    Loader2,
    Mail,
    Pill,
    Printer,
    Stethoscope,
    Syringe
} from 'lucide-react';
import ipawcusLogo from '../../assets/logo-no-bg.png';
import { useNavigate, useParams } from '../dashboardRouter.jsx';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { PhotoViewer } from '../../ui/photo-viewer';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { downloadConsentDocument, openProtectedDocument } from '../../hooks/useConsentDocumentSource';
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date';
import { dedupeClinicalFields } from '../../lib/clinicalRecord';
import { resolveImageUrl } from '../../lib/image';
import { emailPetMedicalRecords, fetchPetMedicalRecords } from '../../services/petService';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import ServicePetPeek from '../shared/ServicePetPeek.jsx';

const MEDICAL_SEARCH_FOCUS_KEY = 'ipawcus-medical-search-focus';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function imageUrl(attachment) {
    return resolveImageUrl(attachment?.url || attachment?.relativeUrl || '');
}

function isImage(attachment) {
    const mime = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || attachment?.relativeUrl || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

function prescriptionLabel(prescription) {
    const medicine = prescription?.medicine || prescription?.name || 'Medication';
    const times = prescription?.times || 1;
    const frequency = prescription?.frequency || 'per day';
    const durationNumber = prescription?.durationNumber || 1;
    const durationUnit = prescription?.durationUnit || 'week';

    return `${medicine} - ${times} time(s) ${frequency} for ${durationNumber} ${durationUnit}${Number(durationNumber) === 1 ? '' : 's'}`;
}

function editorLabel(name) {
    const value = String(name || '').trim();
    if (!value) return '';

    return value.toLowerCase().startsWith('dr.') ? value : `Dr. ${value}`;
}

function compactText(value) {
    return String(value || '').trim();
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase().replace(/[ -]+/g, '_');
}

function medicalRecordTargetId(record) {
    const rawId = record?.id || `${record?.sourceType || 'record'}-${record?.sourceId || 'unknown'}`;
    return `medical-service-${String(rawId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function highlightTargetClass(targetId, highlightedTarget) {
    return targetId === highlightedTarget
        ? 'ring-2 ring-amber-400 ring-offset-2 bg-amber-50/50 transition-colors duration-500'
        : '';
}

function recordContainsQuery(record, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return false;

    return doctorNoteRows(record)
        .some((row) => String(row.value || '').toLowerCase().includes(normalizedQuery));
}

function resolveSearchFocusTarget(focus, serviceHistory, organizedRecords) {
    const match = focus?.match || {};
    const targetType = match.targetType || '';

    if (targetType === 'allergies') {
        return 'medical-allergies';
    }
    if (targetType === 'organized-group' && match.groupId) {
        return `medical-group-${match.groupId}`;
    }
    if (targetType === 'organized-item' && match.itemId) {
        return `medical-item-${match.itemId}`;
    }

    let matchedRecord = null;
    if (targetType === 'diagnosis') {
        const diagnosisId = Number(match.diagnosisId || match.sourceId || 0);
        matchedRecord = serviceHistory.find((record) => Number(record.diagnosisId || 0) === diagnosisId);
    } else if (targetType === 'online-diagnosis') {
        const onlineDiagnosisId = Number(match.onlineDiagnosisId || match.sourceId || 0);
        const bookingId = Number(match.bookingId || 0);
        matchedRecord = serviceHistory.find((record) => (
            Number(record.onlineDiagnosisId || 0) === onlineDiagnosisId
            || (bookingId > 0 && Number(record.bookingId || 0) === bookingId)
        ));
    }

    if (!matchedRecord && match.sourceType && match.sourceId) {
        matchedRecord = serviceHistory.find((record) => (
            record.sourceType === match.sourceType && Number(record.sourceId || 0) === Number(match.sourceId)
        ));
    }
    if (!matchedRecord) {
        matchedRecord = serviceHistory.find((record) => recordContainsQuery(record, focus?.query));
    }
    if (matchedRecord) {
        return medicalRecordTargetId(matchedRecord);
    }

    const matchingItem = organizedRecords
        .flatMap((group) => asArray(group.items))
        .find((item) => recordContainsQuery(item.sourceSnapshot || item, focus?.query));

    return matchingItem ? `medical-item-${matchingItem.itemId}` : 'medical-clinical-history';
}

function doctorNoteRows(source) {
    const clinical = dedupeClinicalFields([
        ['chiefComplaint', source.chiefComplaint || source.chief_complaint],
        ['majorSymptoms', source.majorSymptoms || source.major_symptoms],
        ['symptoms', source.symptoms],
        ['physicalExam', source.physicalExam || source.physical_exam],
        ['diagnosis', source.diagnosis],
        ['recommendations', source.recommendations],
        ['treatment', source.treatment],
        ['medications', source.medications],
        ['labResults', source.labResults || source.lab_results],
        ['followUp', source.followUp || source.follow_up_date],
        ['notes', source.notes]
    ]);
    const rows = [
        ['Chief Complaint', clinical.chiefComplaint],
        ['Major Symptoms', clinical.majorSymptoms],
        ['Symptoms', clinical.symptoms],
        ['Physical Exam', clinical.physicalExam],
        ['Diagnosis', clinical.diagnosis],
        ['Recommendations', clinical.recommendations],
        ['Treatment', clinical.treatment],
        ['Medications', clinical.medications],
        ['Lab Results', clinical.labResults],
        ['Doctor Notes', clinical.notes],
        ['Follow-up', clinical.followUp]
    ].map(([label, value]) => ({ label, value: compactText(value) })).filter(row => row.value);

    asArray(source.customSections).forEach((section, index) => {
        const value = compactText(section?.value || section?.notes || section?.majorSymptoms || section?.description);
        if (!value) return;

        rows.push({
            label: compactText(section?.title || section?.label || section?.type) || `Clinical Note ${index + 1}`,
            value
        });
    });

    return rows;
}

export default function MedicalRecords() {
    const navigate = useNavigate();
    const { petId } = useParams();
    const [records, setRecords] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEmailing, setIsEmailing] = useState(false);
    const [viewer, setViewer] = useState(null);
    const [searchFocus, setSearchFocus] = useState(null);
    const [highlightedTarget, setHighlightedTarget] = useState('');
    const [highlightedMatch, setHighlightedMatch] = useState(null);
    const searchScrollTimerRef = useRef(null);
    const searchHighlightTimerRef = useRef(null);
    const currentRole = useMemo(() => {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            return normalizeRole(user.role || user.user_role);
        } catch {
            return '';
        }
    }, []);

    const loadRecords = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const data = await fetchPetMedicalRecords(petId, { ownerOnly: currentRole === 'pet_owner' });
            if (data.success === false) {
                throw new Error(data.message || 'Medical records could not be loaded.');
            }
            setRecords(data);
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                toast.error(error.message || 'Could not load medical records.');
            }
            return null;
        } finally {
            if (!isAutoRefresh) {
                setIsLoading(false);
            }
        }
    };

    useAutoRefresh(loadRecords, {
        enabled: Boolean(petId),
        refreshKey: `pet-medical-records-${petId}`
    });

    const pet = records?.pet;
    const organizedRecords = useMemo(() => asArray(records?.organizedRecords), [records]);
    const vaccinations = asArray(records?.vaccinations);
    const serviceHistory = useMemo(() => asArray(records?.serviceHistory), [records]);
    const serviceHistoryCount = serviceHistory.length;
    const clinicalDocuments = useMemo(() => {
        const seen = new Set();

        return serviceHistory.flatMap(record => asArray(record.attachments))
            .filter(attachment => ['additional_consent', 'prescription_document'].includes(attachment.category))
            .filter(attachment => {
                const key = attachment.url || attachment.relativeUrl || attachment.id;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [serviceHistory]);

    useEffect(() => {
        try {
            const storedFocus = JSON.parse(sessionStorage.getItem(MEDICAL_SEARCH_FOCUS_KEY) || 'null');
            sessionStorage.removeItem(MEDICAL_SEARCH_FOCUS_KEY);
            if (storedFocus && Number(storedFocus.expiresAt || 0) > Date.now()) {
                setSearchFocus(storedFocus);
            }
        } catch {
            sessionStorage.removeItem(MEDICAL_SEARCH_FOCUS_KEY);
        }
    }, [petId]);

    useEffect(() => {
        if (!records || !searchFocus) return;

        const targetId = resolveSearchFocusTarget(searchFocus, serviceHistory, organizedRecords);
        setHighlightedTarget(targetId);
        setHighlightedMatch(searchFocus.match || null);
        setSearchFocus(null);

        window.clearTimeout(searchScrollTimerRef.current);
        window.clearTimeout(searchHighlightTimerRef.current);
        searchScrollTimerRef.current = window.setTimeout(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
        searchHighlightTimerRef.current = window.setTimeout(() => {
            setHighlightedTarget('');
            setHighlightedMatch(null);
        }, 10_000);
    }, [organizedRecords, records, searchFocus, serviceHistory]);

    useEffect(() => () => {
        window.clearTimeout(searchScrollTimerRef.current);
        window.clearTimeout(searchHighlightTimerRef.current);
    }, []);

    const handleRecordAction = async (action) => {
        if (action === 'print') {
            window.print();
            return;
        }

        if (action !== 'email') {
            return;
        }

        setIsEmailing(true);
        try {
            const response = await emailPetMedicalRecords(petId);
            toast.success(response.message || 'Medical record copy sent.');
        } catch (error) {
            toast.error(error.message || 'Could not send the medical record copy.');
        } finally {
            setIsEmailing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center">
                <Loader2 className="mb-4 size-12 animate-spin text-[#155dfc]" />
                <p className="font-semibold text-slate-500">Loading medical records...</p>
            </div>
        );
    }

    if (!records || !pet) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => navigate('/dashboard/my-pets')}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                </Button>
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="mx-auto mb-4 size-14 text-slate-300" />
                        <h3 className="text-lg font-black text-slate-900">Pet Not Found</h3>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="medical-records-page space-y-6">
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }

                        .medical-print-area,
                        .medical-print-area * {
                            visibility: visible;
                        }

                        .medical-print-area {
                            position: absolute;
                            inset: 0;
                            width: 100%;
                            padding: 0.45in;
                            background: white;
                            color: #111827;
                        }

                        .medical-print-area::before {
                            content: "";
                            position: fixed;
                            inset: 0;
                            background-image: url("${ipawcusLogo}");
                            background-repeat: no-repeat;
                            background-position: center;
                            background-size: min(70%, 520px);
                            opacity: 0.055;
                            pointer-events: none;
                            z-index: 0;
                        }

                        .medical-print-area > * {
                            position: relative;
                            z-index: 1;
                        }

                        .no-print {
                            display: none !important;
                        }

                        .print-break-inside {
                            break-inside: avoid;
                        }
                    }
                `}
            </style>

            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back to Profile
                </Button>
                <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm sm:flex sm:w-auto">
                    <Button
                        type="button"
                        onClick={() => handleRecordAction('print')}
                        className="h-11 rounded-none border-0 bg-[#155dfc] px-4 text-white hover:bg-[#0d4acf] sm:min-w-36"
                    >
                        <Printer className="size-4" />
                        Print
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRecordAction('email')}
                        disabled={isEmailing}
                        className="h-11 rounded-none border-l border-blue-100 px-4 font-bold text-[#155dfc] hover:bg-blue-50 hover:text-[#0d4acf] sm:min-w-40"
                    >
                        {isEmailing ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                        {isEmailing ? 'Sending...' : 'Send copy'}
                    </Button>
                </div>
            </div>

            <main className="medical-print-area space-y-6">
                {highlightedMatch && (
                    <div className="no-print flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <Stethoscope className="mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide">Search match: {highlightedMatch.category}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm font-semibold">{highlightedMatch.text}</p>
                        </div>
                    </div>
                )}
                <section data-header-pet="enabled" className="dashboard-page-header-pet relative isolate overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm print-break-inside">
                    <ServicePetPeek kind="bunny" accent="blue" />
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-[#155dfc]">Vetfocus Animal Care Clinic</p>
                            <h1 className="mt-1 text-2xl font-black text-slate-950">Organized Medical Record</h1>
                            <p className="mt-2 text-sm font-semibold text-slate-500">
                                Curated clinical summary for owner reference and printing.
                            </p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Printed</p>
                            <p className="font-bold text-slate-800">{formatDisplayDateTime(new Date().toISOString())}</p>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <PetInfo label="Pet" value={pet.name || pet.petName} strong />
                        <PetInfo label="Species / Breed" value={[pet.species, pet.breed].filter(Boolean).join(' / ') || 'N/A'} />
                        <PetInfo label="Sex" value={pet.gender || 'N/A'} />
                        <PetInfo label="Pet ID" value={pet.id || pet.dbId} />
                        <PetInfo label="Weight" value={pet.weight ? `${pet.weight} kg` : 'N/A'} />
                        <PetInfo label="Microchip" value={pet.microchipId || 'N/A'} />
                        <PetInfo label="Source Records" value={`${serviceHistoryCount} service record${serviceHistoryCount === 1 ? '' : 's'}`} />
                    </div>

                    {asArray(records.allergies).length > 0 && (
                        <div
                            id="medical-allergies"
                            className={`mt-4 rounded-lg border border-red-100 bg-red-50 p-3 ${highlightTargetClass('medical-allergies', highlightedTarget)}`}
                        >
                            <div className="mb-2 flex items-center gap-2 text-sm font-black text-red-700">
                                <AlertCircle className="size-4" />
                                Allergies
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {records.allergies.map((allergy, index) => (
                                    <Badge key={allergy.id || index} className="border border-red-200 bg-white text-red-700">
                                        {allergy.allergen} {allergy.severity ? `- ${allergy.severity}` : ''}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
	                </section>

                    <VaccinationSection vaccinations={vaccinations} />
                    <ClinicalDocumentsSection documents={clinicalDocuments} onPreview={setViewer} />
                    <ClinicalHistorySection
                        records={serviceHistory}
                        onPreview={setViewer}
                        highlightedTarget={highlightedTarget}
                    />

	                {organizedRecords.length === 0 ? (
                    <Card className="print-break-inside">
                        <CardContent className="py-12 text-center">
                            <ClipboardList className="mx-auto mb-4 size-12 text-slate-300" />
                            <h3 className="text-lg font-black text-slate-900">No Organized Records Yet</h3>
                            <p className="mt-2 text-sm font-semibold text-slate-500">
                                A veterinarian can organize completed service records into printable summaries.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <section className="space-y-5">
                        {organizedRecords.map((group) => (
                            <OrganizedGroup
                                key={group.groupId}
                                group={group}
                                onPreview={setViewer}
                                highlightedTarget={highlightedTarget}
                            />
                        ))}
                    </section>
                )}
            </main>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Medical record image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}

function ClinicalHistorySection({ records, onPreview, highlightedTarget }) {
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const toggleRecord = (record) => {
        const recordId = String(record.id || record.sourceId);
        setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(recordId)) {
                next.delete(recordId);
            } else {
                next.add(recordId);
            }
            return next;
        });
    };

    return (
        <section
            id="medical-clinical-history"
            className={`print-break-inside overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${highlightTargetClass('medical-clinical-history', highlightedTarget)}`}
        >
            <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Stethoscope className="size-5 text-[#155dfc]" />
                        <div>
                            <h2 className="text-lg font-black text-slate-950">Pet Health History</h2>
                            <p className="text-xs font-semibold text-slate-500">Completed consultations, diagnoses, symptoms, treatment, and attachments.</p>
                        </div>
                    </div>
                    <Badge className="w-fit border-0 bg-blue-50 text-[#155dfc]">
                        {records.length} record{records.length === 1 ? '' : 's'}
                    </Badge>
                </div>
            </header>

            {records.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-400">No completed clinical history is available yet.</div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {records.map((record) => {
                        const recordId = String(record.id || record.sourceId);
                        const targetId = medicalRecordTargetId(record);
                        const isExpanded = expandedIds.has(recordId) || targetId === highlightedTarget;
                        const doctorNotes = doctorNoteRows(record);
                        const seenAttachments = new Set();
                        const attachments = [
                            ...asArray(record.attachments),
                            ...asArray(record.sourceUploads)
                        ].filter((attachment) => {
                            const key = attachment.id || attachment.url || attachment.relativeUrl;
                            if (!key || seenAttachments.has(key)) return false;
                            seenAttachments.add(key);
                            return true;
                        });
                        const prescriptions = asArray(record.prescriptions);
                        const summary = compactText(
                            record.summary
                            || record.diagnosis
                            || record.symptoms
                            || record.chiefComplaint
                            || record.notes
                        );

                        return (
                            <article
                                id={targetId}
                                key={recordId}
                                className={`scroll-mt-24 p-4 sm:p-5 ${highlightTargetClass(targetId, highlightedTarget)}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleRecord(record)}
                                    aria-expanded={isExpanded}
                                    className="flex w-full items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                                        <Stethoscope className="size-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="font-black text-slate-900">{record.title || record.serviceName || 'Clinical record'}</span>
                                            {targetId === highlightedTarget && (
                                                <Badge className="border-0 bg-amber-100 text-amber-800">Search match</Badge>
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs font-semibold text-slate-500">
                                            {[formatDisplayDate(record.serviceDate), editorLabel(record.veterinarianName)].filter(Boolean).join(' | ')}
                                        </span>
                                        {summary && <span className="mt-2 block line-clamp-2 text-sm font-medium leading-5 text-slate-600">{summary}</span>}
                                    </span>
                                    {isExpanded
                                        ? <ChevronUp className="mt-1 size-4 shrink-0 text-slate-400" />
                                        : <ChevronDown className="mt-1 size-4 shrink-0 text-slate-400" />}
                                </button>

                                {isExpanded && (
                                    <div className="ml-0 mt-4 space-y-4 sm:ml-12">
                                        {doctorNotes.length > 0 && (
                                            <div className="grid gap-3 md:grid-cols-2">
                                                {doctorNotes.map((row, index) => (
                                                    <div key={`${row.label}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{row.label}</p>
                                                        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{row.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {prescriptions.length > 0 && (
                                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                                                <p className="mb-2 flex items-center gap-2 text-sm font-black text-[#155dfc]">
                                                    <Pill className="size-4" />
                                                    Prescriptions
                                                </p>
                                                <div className="space-y-2">
                                                    {prescriptions.map((prescription, index) => (
                                                        <div key={prescription.id || index} className="rounded-md bg-white p-2 text-sm">
                                                            <p className="font-bold text-slate-900">{prescriptionLabel(prescription)}</p>
                                                            {prescription.instructions && (
                                                                <p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-slate-500">{prescription.instructions}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {attachments.length > 0 && (
                                            <div className="no-print">
                                                <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
                                                    <Camera className="size-4" />
                                                    Images and Documents
                                                </p>
                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                    {attachments.map((attachment, index) => (
                                                        <MedicalRecordAttachmentCard
                                                            key={attachment.id || `${attachment.url || attachment.relativeUrl}-${index}`}
                                                            attachment={attachment}
                                                            onPreview={onPreview}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function VaccinationSection({ vaccinations }) {
    return (
        <section className="print-break-inside overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Syringe className="size-5 text-[#155dfc]" />
                        <h2 className="text-lg font-black text-slate-950">Vaccination Records</h2>
                    </div>
                    <Badge className="w-fit border-0 bg-blue-50 text-[#155dfc]">
                        {vaccinations.length} vaccine{vaccinations.length === 1 ? '' : 's'}
                    </Badge>
                </div>
            </header>

            {vaccinations.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-400">No vaccination records saved.</div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {vaccinations.map((vaccine, index) => (
                        <div
                            key={vaccine.id || index}
                            className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr_1fr_0.7fr] md:items-center"
                        >
                            <VaccineCell label="Vaccine" value={vaccine.name || 'Unnamed vaccine'} strong />
                            <VaccineCell label="Date Given" value={formatDisplayDate(vaccine.date)} />
                            <VaccineCell label="Next Due" value={formatDisplayDate(vaccine.nextDue)} highlight />
                            <VaccineCell label="Veterinarian" value={vaccine.applicator || vaccine.veterinarianName || 'N/A'} />
                            <div className="flex items-center justify-between gap-3 md:block">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
                                <Badge className={`w-fit border-0 ${vaccine.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                                    {vaccine.status || 'completed'}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function ClinicalDocumentsSection({ documents, onPreview }) {
    if (documents.length === 0) {
        return null;
    }

    return (
        <section className="print-break-inside overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <FileText className="size-5 text-[#155dfc]" />
                        <h2 className="text-lg font-black text-slate-950">Clinical Documents</h2>
                    </div>
                    <Badge className="border-0 bg-blue-50 text-[#155dfc]">{documents.length}</Badge>
                </div>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((document, index) => {
                    const url = imageUrl(document);
                    const title = document.category === 'additional_consent'
                        ? document.name || 'Signed consent form'
                        : document.name || 'Prescription document';

                    return (
                        <ClinicalDocumentCard
                            key={document.id || `${url}-${index}`}
                            document={document}
                            title={title}
                            url={url}
                            onPreview={onPreview}
                        />
                    );
                })}
            </div>
        </section>
    );
}

function ClinicalDocumentCard({ document, title, url, onPreview }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const canPreviewImage = Boolean(url && isImage(document));
    const rawPath = document?.url || document?.relativeUrl || url;
    const isPdf = String(document?.mimeType || document?.mime_type || '').toLowerCase() === 'application/pdf'
        || String(rawPath || '').split(/[?#]/)[0].toLowerCase().endsWith('.pdf');

    const handleView = async () => {
        if (!rawPath || isOpening) return;
        if (canPreviewImage) {
            onPreview({ src: rawPath, alt: title });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(rawPath);
        } catch (error) {
            toast.error(error.message || 'Could not open this clinical document.');
        } finally {
            setIsOpening(false);
        }
    };

    const handleDownload = async () => {
        if (!rawPath || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(rawPath, document?.name || title);
        } catch (error) {
            toast.error(error.message || 'Could not download this clinical document.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="no-print overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-white">
                {canPreviewImage ? (
                    <ProtectedImage
                        src={rawPath}
                        alt={title}
                        className="h-full w-full object-contain"
                        fallbackClassName="h-full w-full"
                    />
                ) : (
                    <FileText className="size-8 text-slate-300" />
                )}
            </div>
            <p className="mt-3 truncate text-sm font-black text-slate-800">{title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
                {document.category === 'additional_consent' ? 'Signed consent form' : 'Prescription document'}
            </p>
            <div className={`mt-3 grid gap-2 ${isPdf ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleView}
                    disabled={!rawPath || isOpening}
                    className="h-8 gap-1 text-xs"
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
                    className="h-8 gap-1 text-xs"
                >
                    {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    Download
                </Button>}
            </div>
        </div>
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

function PetInfo({ label, value, strong = false }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`mt-1 break-words text-sm ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-700'}`}>
                {value || 'N/A'}
            </p>
        </div>
    );
}

function OrganizedGroup({ group, onPreview, highlightedTarget }) {
    const targetId = `medical-group-${group.groupId}`;

    return (
        <article
            id={targetId}
            className={`scroll-mt-24 print-break-inside overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${highlightTargetClass(targetId, highlightedTarget)}`}
        >
            <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-950">{group.title}</h2>
                        {group.summary && (
                            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{group.summary}</p>
                        )}
                        {group.updatedByName && (
                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                Edited by {editorLabel(group.updatedByName)}
                            </p>
                        )}
                    </div>
                    <Badge className="w-fit border-0 bg-blue-50 text-[#155dfc]">
                        {asArray(group.items).length} record{asArray(group.items).length === 1 ? '' : 's'}
                    </Badge>
                </div>
            </header>

            <div className="divide-y divide-slate-100">
                {asArray(group.items).length === 0 ? (
                    <div className="p-5 text-sm font-semibold text-slate-400">No service records added to this group.</div>
                ) : (
                    group.items.map((item) => (
                        <OrganizedItem
                            key={item.itemId}
                            item={item}
                            onPreview={onPreview}
                            highlightedTarget={highlightedTarget}
                        />
                    ))
                )}
            </div>
        </article>
    );
}

function OrganizedItem({ item, onPreview, highlightedTarget }) {
    const source = item.sourceSnapshot || {};
    const targetId = `medical-item-${item.itemId}`;
    const doctorNotes = doctorNoteRows(source);
    const attachments = [
        ...asArray(source.attachments),
        ...asArray(source.sourceUploads)
    ];
    const prescriptions = [
        ...asArray(source.prescriptions),
        ...asArray(source.customSections).flatMap(section => asArray(section.prescriptions || section.prescription))
    ];

    return (
        <section
            id={targetId}
            className={`scroll-mt-24 p-5 print-break-inside ${highlightTargetClass(targetId, highlightedTarget)}`}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Stethoscope className="size-4 text-[#155dfc]" />
                        <h3 className="text-base font-black text-slate-900">{item.title}</h3>
                        {targetId === highlightedTarget && (
                            <Badge className="border-0 bg-amber-100 text-amber-800">Search match</Badge>
                        )}
                    </div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <CalendarDays className="size-3" />
                        {formatDisplayDate(item.serviceDate || source.serviceDate)}
                    </p>
                    {item.updatedByName && (
                        <p className="mt-2 text-xs font-bold text-slate-400">Edited by {editorLabel(item.updatedByName)}</p>
                    )}
                </div>
                <Badge className="w-fit border-0 bg-slate-100 text-slate-700">
                    {source.billingStatus === 'paid' ? 'Paid' : source.status || item.sourceType}
                </Badge>
            </div>

            {item.summary && (
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{item.summary}</p>
            )}

            {item.revisionNotes && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700">Veterinarian Revision</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-900">{item.revisionNotes}</p>
                </div>
            )}

            {doctorNotes.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                        <Stethoscope className="size-4 text-[#155dfc]" />
                        Doctor Notes
                    </p>
                    <div className="space-y-2">
                        {doctorNotes.map((row, index) => (
                            <div key={`${row.label}-${index}`} className="rounded-md bg-white p-2">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{row.label}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{row.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {prescriptions.length > 0 && (
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#155dfc]">
                        <Pill className="size-4" />
                        Prescriptions
                    </div>
                    <div className="space-y-2">
                        {prescriptions.map((prescription, index) => (
                            <div key={prescription.id || index} className="rounded-md bg-white p-2 text-sm">
                                <p className="font-bold text-slate-900">{prescriptionLabel(prescription)}</p>
                                {prescription.instructions && (
                                    <p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-slate-500">{prescription.instructions}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {attachments.length > 0 && (
                <div className="mt-4 no-print">
                    <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                        <Camera className="size-4" />
                        Images and Documents
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {attachments.map((attachment, index) => (
                            <MedicalRecordAttachmentCard
                                key={attachment.id || `${attachment.url || attachment.relativeUrl}-${index}`}
                                attachment={attachment}
                                onPreview={onPreview}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function MedicalRecordAttachmentCard({ attachment, onPreview }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const rawPath = attachment?.preview || attachment?.url || attachment?.relativeUrl || '';
    const url = imageUrl(attachment);
    const canPreview = isImage(attachment);
    const title = attachment?.name || 'Attachment';
    const isPdf = String(attachment?.mimeType || attachment?.mime_type || '').toLowerCase() === 'application/pdf'
        || rawPath.split(/[?#]/)[0].toLowerCase().endsWith('.pdf');

    const handleView = async () => {
        if (!rawPath || isOpening) return;
        if (canPreview) {
            onPreview({ src: rawPath, alt: title });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(rawPath);
        } catch (error) {
            toast.error(error.message || 'Could not open this medical-record attachment.');
        } finally {
            setIsOpening(false);
        }
    };

    const handleDownload = async () => {
        if (!rawPath || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(rawPath, title);
        } catch (error) {
            toast.error(error.message || 'Could not download this medical-record attachment.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
            <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-white">
                {canPreview && url ? (
                    <ProtectedImage
                        src={rawPath}
                        alt={title}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                    />
                ) : (
                    <FileText className="size-7 text-slate-300" />
                )}
            </div>
            <p className="mt-2 truncate text-xs font-bold text-slate-700">{title}</p>
            <div className={`mt-2 grid gap-2 ${isPdf ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleView}
                    disabled={!rawPath || isOpening}
                    className="h-8 gap-1 text-xs"
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
                    className="h-8 gap-1 text-xs"
                >
                    {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    Download
                </Button>}
            </div>
        </div>
    );
}
