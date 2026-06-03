import { useCallback, useMemo, useState } from 'react';
import {
    CalendarClock,
    Eye,
    FileText,
    History,
    Loader2,
    MessageSquare,
    Paperclip,
    Pill,
    RefreshCw,
    Search,
    Stethoscope,
    Syringe,
    Video
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { PhotoViewer } from '../../ui/photo-viewer';
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

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

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function resolveFileUrl(path) {
    if (!path) return '';

    const value = String(path).trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:)/i.test(value)) return value;

    return `/${value.replace(/^\/+/, '').replace(/^public\//, '')}`;
}

function pathFileName(path) {
    const cleanPath = String(path || '').split('?')[0].replace(/\\/g, '/');
    return cleanPath.split('/').filter(Boolean).pop() || 'Attachment';
}

function isImageFile(attachment) {
    const mimeType = attachment?.mimeType || attachment?.type || '';
    const url = attachment?.preview || attachment?.url || attachment?.relativeUrl || '';

    return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

async function fetchJson(url, fallbackMessage) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || data.error || fallbackMessage);
    }

    return data;
}

function customDiagnosisSummary(sections) {
    return safeArray(sections)
        .map(section => {
            const label = section?.label || section?.serviceName || 'Custom service';
            const value = section?.value || section?.notes || section?.majorSymptoms || '';

            return value ? `${label}: ${value}` : label;
        })
        .filter(Boolean)
        .join(' ');
}

function clinicDiagnosisText(record) {
    if (record.diagnosis) return record.diagnosis;

    return customDiagnosisSummary(record.customSections);
}

function hasOnlineDiagnosis(consultation) {
    return [
        consultation.diagnosis,
        consultation.recommendations,
        consultation.treatment,
        consultation.medications,
        consultation.diagnosisNotes
    ].some(value => String(value || '').trim());
}

function removeBookingMarker(complaint) {
    return String(complaint || '').replace(/\[Booking:\s*[^\]]+\]\s*/g, '').trim();
}

function mapClinicRecord(record) {
    return {
        id: `clinic-${record.diagnosisId || record.id}`,
        source: 'clinic',
        sourceLabel: 'Clinic',
        sourceIcon: Stethoscope,
        recordId: record.diagnosisId || record.id,
        petName: record.petName || 'Unknown Pet',
        petDetails: [record.petSpecies, record.petBreed].filter(Boolean).join(' - '),
        ownerName: record.ownerName || 'Unknown Owner',
        serviceName: getServiceDisplayName(record.serviceName, record.serviceName || 'Clinic Diagnosis'),
        bookingNumber: record.bookingNumber || '',
        queueNumber: record.queueNumber || '',
        date: record.finalizedAt || record.updatedAt || record.createdAt,
        diagnosis: clinicDiagnosisText(record),
        diagnosisType: record.diagnosisType || 'general',
        raw: record
    };
}

function mapOnlineRecord(consultation) {
    return {
        id: `online-${consultation.id}`,
        source: 'online',
        sourceLabel: 'Online',
        sourceIcon: Video,
        recordId: consultation.id,
        petName: consultation.petName || 'Unnamed Pet',
        petDetails: [consultation.petSpecies, consultation.petBreed].filter(Boolean).join(' - '),
        ownerName: consultation.ownerName || 'Pet owner',
        serviceName: 'Online Consultation',
        bookingNumber: consultation.bookingNumber || '',
        queueNumber: '',
        date: consultation.endedAt || consultation.updatedAt || consultation.scheduledStart,
        diagnosis: consultation.diagnosis || '',
        diagnosisType: 'online',
        raw: consultation
    };
}

function compareByDateDesc(left, right) {
    const leftTime = new Date(left.date || 0).getTime() || 0;
    const rightTime = new Date(right.date || 0).getTime() || 0;

    return rightTime - leftTime;
}

function recordSearchText(record) {
    return [
        record.petName,
        record.petDetails,
        record.ownerName,
        record.serviceName,
        record.bookingNumber,
        record.queueNumber ? `#${record.queueNumber}` : '',
        record.sourceLabel,
        record.diagnosis,
        record.raw?.chiefComplaint,
        record.raw?.majorSymptoms,
        record.raw?.symptoms,
        record.raw?.treatment,
        record.raw?.recommendations,
        record.raw?.medications,
        record.raw?.diagnosisNotes
    ].join(' ');
}

export default function VetDiagnosisHistory() {
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const veterinarianUserId = getUserId(currentUser);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const loadHistory = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!veterinarianUserId) {
            setRecords([]);
            setIsLoading(false);
            return;
        }

        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        const errors = [];
        const nextRecords = [];

        const clinicUrl = `${API_BASE}/vet-diagnoses?veterinarianUserId=${encodeURIComponent(veterinarianUserId)}`;
        const onlineUrl = `${API_BASE}/online-consultations?vetId=${encodeURIComponent(veterinarianUserId)}`;

        const [clinicResult, onlineResult] = await Promise.allSettled([
            fetchJson(clinicUrl, 'Failed to load clinic diagnosis histories.'),
            fetchJson(onlineUrl, 'Failed to load online consultation histories.')
        ]);

        if (clinicResult.status === 'fulfilled') {
            const data = clinicResult.value;

            if (data.schemaReady === false) {
                errors.push(data.message || 'Diagnosis table is not ready.');
            } else {
                nextRecords.push(...safeArray(data.records).map(mapClinicRecord));
            }
        } else {
            errors.push(clinicResult.reason?.message || 'Failed to load clinic diagnosis histories.');
        }

        if (onlineResult.status === 'fulfilled') {
            nextRecords.push(...safeArray(onlineResult.value).filter(hasOnlineDiagnosis).map(mapOnlineRecord));
        } else {
            errors.push(onlineResult.reason?.message || 'Failed to load online consultation histories.');
        }

        setRecords(nextRecords.sort(compareByDateDesc));

        if (!isAutoRefresh && errors.length > 0) {
            setErrorMessage(errors.join(' '));
        }

        setIsLoading(false);
    }, [veterinarianUserId]);

    useAutoRefresh(loadHistory, {
        enabled: Boolean(veterinarianUserId),
        refreshKey: `vet-diagnosis-history-${veterinarianUserId}`
    });

    const filteredRecords = useMemo(() => {
        const query = normalize(searchQuery);

        return records.filter(record => {
            if (sourceFilter !== 'all' && record.source !== sourceFilter) {
                return false;
            }

            if (!query) {
                return true;
            }

            return normalize(recordSearchText(record)).includes(query);
        });
    }, [records, searchQuery, sourceFilter]);

    const clinicCount = records.filter(record => record.source === 'clinic').length;
    const onlineCount = records.filter(record => record.source === 'online').length;
    const latestRecordDate = records[0]?.date;

    if (!veterinarianUserId) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <History className="mx-auto mb-3 size-10 text-slate-300" />
                <h2 className="text-xl font-bold text-slate-900">Diagnosis Histories</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                    Could not identify the current veterinarian account. Please log in again.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#101828]">Diagnosis Histories</h2>
                    <p className="text-sm font-medium text-slate-500">
                        Past clinic and online diagnosis records saved by this veterinarian.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadHistory()}
                    disabled={isLoading}
                    className="w-full gap-2 sm:w-auto"
                >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={History} label="Total Records" value={records.length} tone="blue" />
                <StatCard icon={Stethoscope} label="Clinic Diagnoses" value={clinicCount} tone="green" />
                <StatCard icon={Video} label="Online Diagnoses" value={onlineCount} tone="purple" />
                <StatCard
                    icon={CalendarClock}
                    label="Latest Review"
                    value={latestRecordDate ? formatDisplayDate(latestRecordDate, { compact: true }) : 'None'}
                    tone="slate"
                />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search pet, owner, service, booking, diagnosis, or symptoms"
                            className="h-10 pl-10"
                        />
                    </div>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                        <SelectTrigger>
                            <SelectValue
                                placeholder="Filter source"
                                displayValue={sourceFilter === 'all' ? 'All Sources' : sourceFilter === 'clinic' ? 'Clinic' : 'Online'}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="clinic">Clinic</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {errorMessage}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-44">Date</TableHead>
                            <TableHead className="w-28">Source</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead className="hidden lg:table-cell">Owner</TableHead>
                            <TableHead className="hidden xl:table-cell">Service</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && records.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading diagnosis histories...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : filteredRecords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                                    No diagnosis history records found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRecords.map(record => (
                                <TableRow key={record.id} className="hover:bg-slate-50">
                                    <TableCell className="whitespace-nowrap text-xs font-semibold text-slate-500">
                                        {formatDisplayDateTime(record.date, undefined, { fallback: 'Not dated' })}
                                    </TableCell>
                                    <TableCell>
                                        <SourceBadge record={record} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900">{record.petName}</p>
                                            <p className="text-xs font-medium text-slate-500">{record.petDetails || 'No pet profile details'}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell font-medium text-slate-700">
                                        {record.ownerName}
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell text-sm font-semibold text-slate-600">
                                        <div>{record.serviceName}</div>
                                        <p className="text-xs font-medium text-slate-400">
                                            {record.bookingNumber ? `Booking ${record.bookingNumber}` : record.queueNumber ? `Queue #${record.queueNumber}` : 'No reference number'}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRecord(record)}>
                                            <Eye className="size-4" />
                                            Review
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <RecordDialog
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
                onPreview={setPreviewImage}
            />

            <PhotoViewer
                src={previewImage?.src || ''}
                alt={previewImage?.alt || 'Diagnosis attachment'}
                open={Boolean(previewImage)}
                onOpenChange={(open) => {
                    if (!open) setPreviewImage(null);
                }}
            />
        </div>
    );
}

function StatCard({ icon, label, value, tone }) {
    const Icon = icon;
    const toneClasses = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-50 text-green-700',
        purple: 'bg-violet-50 text-violet-700',
        slate: 'bg-slate-100 text-slate-700'
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`flex size-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">{label}</p>
                    <p className="truncate text-2xl font-black leading-tight text-slate-900">{value}</p>
                </div>
            </div>
        </div>
    );
}

function SourceBadge({ record }) {
    const Icon = record.sourceIcon;
    const className = record.source === 'online'
        ? 'border-0 bg-violet-50 text-violet-700'
        : 'border-0 bg-blue-50 text-blue-700';

    return (
        <Badge className={className}>
            <Icon className="mr-1 size-3" />
            {record.sourceLabel}
        </Badge>
    );
}

function RecordDialog({ record, onClose, onPreview }) {
    if (!record) return null;

    const isOnline = record.source === 'online';
    const raw = record.raw || {};

    return (
        <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <DialogTitle>Diagnosis Review</DialogTitle>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                {record.petName} - {record.ownerName}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <SourceBadge record={record} />
                            {record.diagnosisType === 'custom' && (
                                <Badge className="border-0 bg-amber-50 text-amber-700">Custom</Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <Detail label="Date" value={formatDisplayDateTime(record.date, undefined, { fallback: 'Not dated' })} />
                        <Detail label="Service" value={record.serviceName} />
                        <Detail label="Booking" value={record.bookingNumber} />
                        <Detail label="Queue" value={record.queueNumber ? `#${record.queueNumber}` : ''} />
                        <Detail label="Pet Details" value={record.petDetails} />
                        <Detail label="Record ID" value={`${record.sourceLabel} #${record.recordId}`} />
                        {isOnline ? (
                            <Detail label="Consult Status" value={raw.status} />
                        ) : (
                            <Detail label="Follow-up" value={raw.followUp ? formatDisplayDate(raw.followUp) : ''} />
                        )}
                    </div>

                    {isOnline ? (
                        <OnlineDetails consultation={raw} />
                    ) : (
                        <ClinicDetails record={raw} onPreview={onPreview} />
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" onClick={onClose} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                        Close Review
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ClinicDetails({ record, onPreview }) {
    return (
        <div className="space-y-4">
            <TextBlock label="Chief Complaint" value={removeBookingMarker(record.chiefComplaint)} icon={MessageSquare} />
            <VaccinationReview record={record.vaccinationRecord} />
            <TextBlock label="Major Symptoms" value={record.majorSymptoms} icon={FileText} />
            <TextBlock label="Symptoms" value={record.symptoms} icon={FileText} />

            {record.diagnosisType === 'custom' ? (
                <CustomSectionList sections={record.customSections} onPreview={onPreview} />
            ) : (
                <>
                    <TextBlock label="Diagnosis" value={record.diagnosis} icon={Stethoscope} highlight />
                    <TextBlock label="Physical Examination" value={record.physicalExam} icon={FileText} />
                    <TextBlock label="Treatment Plan" value={record.treatment} icon={FileText} />
                    <PrescriptionList prescriptions={record.prescriptions} />
                </>
            )}

            <VitalSigns vitalSigns={record.vitalSigns} />
            <TextBlock label="Lab Results" value={record.labResults} icon={FileText} />
            <TextBlock label="Notes" value={record.notes} icon={FileText} />
            <AttachmentList title="Diagnosis Uploads" attachments={record.attachments} onPreview={onPreview} />
            <AttachmentList title="Source Uploads" attachments={record.sourceUploads} onPreview={onPreview} />
        </div>
    );
}

function VaccinationReview({ record }) {
    if (!record) {
        return null;
    }

    return (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="mb-3 flex items-center gap-2">
                <Syringe className="size-4 text-blue-700" />
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-700">Vaccination Record</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Detail label="Vaccine Name" value={record.vaccineName || record.name} />
                <Detail label="Date Administered" value={formatDisplayDate(record.dateAdministered || record.date)} />
                <Detail label="Next Due Date" value={formatDisplayDate(record.nextDueDate || record.nextDue)} />
                <Detail label="Veterinarian" value={record.veterinarianName || record.applicator} />
                <Detail label="License Number" value={record.veterinarianLicense} />
                <Detail label="Notes" value={record.notes} />
            </div>
        </section>
    );
}

function OnlineDetails({ consultation }) {
    return (
        <div className="space-y-4">
            <TextBlock label="Diagnosis" value={consultation.diagnosis} icon={Stethoscope} highlight />
            <TextBlock label="Recommendations" value={consultation.recommendations} icon={FileText} />
            <TextBlock label="Treatment" value={consultation.treatment} icon={FileText} />
            <TextBlock label="Medications" value={consultation.medications} icon={Pill} />
            <TextBlock label="Internal Notes" value={consultation.diagnosisNotes} icon={FileText} />
            {consultation.notes && (
                <TextBlock label="Booking Notes" value={consultation.notes} icon={MessageSquare} />
            )}
        </div>
    );
}

function TextBlock({ label, value, icon, highlight = false }) {
    const Icon = icon;
    const hasValue = String(value || '').trim();

    return (
        <section className={`rounded-xl border p-4 ${highlight ? 'border-blue-100 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <div className="mb-2 flex items-center gap-2">
                <Icon className={`size-4 ${highlight ? 'text-blue-700' : 'text-slate-400'}`} />
                <h3 className={`text-sm font-black uppercase tracking-widest ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>
                    {label}
                </h3>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-700">
                {hasValue ? value : <span className="text-slate-300">Not recorded</span>}
            </p>
        </section>
    );
}

function VitalSigns({ vitalSigns }) {
    const entries = Object.entries(vitalSigns || {}).filter(([, value]) => String(value || '').trim());

    if (entries.length === 0) {
        return null;
    }

    const labels = {
        temperature: 'Temperature',
        heartRate: 'Heart Rate',
        respiratoryRate: 'Respiratory Rate',
        weight: 'Weight'
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Vital Signs</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {entries.map(([key, value]) => (
                    <Detail key={key} label={labels[key] || key} value={value} />
                ))}
            </div>
        </section>
    );
}

function PrescriptionList({ prescriptions }) {
    const items = safeArray(prescriptions);

    if (items.length === 0) {
        return <TextBlock label="Prescription" value="" icon={Pill} />;
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Pill className="size-4 text-slate-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Prescription</h3>
            </div>
            <div className="space-y-2">
                {items.map((prescription, index) => (
                    <div key={prescription.id || index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-800">
                            {prescription.medicine || 'Medication'} - {prescription.times || 1} time(s) {prescription.frequency || 'per day'}
                            {' '}for {prescription.durationNumber || 1} {prescription.durationUnit || 'week'}(s)
                        </p>
                        {prescription.instructions && (
                            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-500">{prescription.instructions}</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

function CustomSectionList({ sections, onPreview }) {
    const items = safeArray(sections);

    if (items.length === 0) {
        return <TextBlock label="Custom Diagnosis Services" value="" icon={FileText} />;
    }

    return (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
                <FileText className="size-4 text-slate-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Custom Diagnosis Services</h3>
            </div>
            {items.map((section, index) => (
                <div key={section.id || index} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                        <p className="text-base font-bold text-slate-900">{section.label || `Service ${index + 1}`}</p>
                        {section.majorSymptoms && (
                            <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-amber-700">{section.majorSymptoms}</p>
                        )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                        {section.value || section.notes || <span className="text-slate-300">No findings recorded</span>}
                    </p>
                    <PrescriptionList prescriptions={section.prescriptions || section.prescription} />
                    <AttachmentList title="Service Uploads" attachments={section.attachments || section.uploads} onPreview={onPreview} compact />
                </div>
            ))}
        </section>
    );
}

function AttachmentList({ title, attachments, onPreview, compact = false }) {
    const items = safeArray(attachments);

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Paperclip className="size-4 text-slate-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</h3>
            </div>
            <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
                {items.map((attachment, index) => {
                    const url = resolveFileUrl(attachment.preview || attachment.url || attachment.relativeUrl);
                    const name = attachment.name || pathFileName(url);
                    const canPreview = isImageFile({ ...attachment, url });

                    return (
                        <div key={attachment.id || `${url}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex h-28 items-center justify-center bg-white">
                                {canPreview && url ? (
                                    <button
                                        type="button"
                                        onClick={() => onPreview?.({ src: url, alt: name })}
                                        className="h-full w-full"
                                    >
                                        <img src={url} alt={name} className="h-full w-full object-cover" />
                                    </button>
                                ) : (
                                    <FileText className="size-8 text-slate-300" />
                                )}
                            </div>
                            <div className="space-y-2 p-3">
                                <p className="truncate text-xs font-semibold text-slate-600">{name}</p>
                                {canPreview && url ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => onPreview?.({ src: url, alt: name })} className="h-8 w-full text-xs">
                                        <Eye className="size-3" />
                                        View
                                    </Button>
                                ) : url ? (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-white"
                                    >
                                        Open
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Detail({ label, value }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-semibold text-slate-700">
                {value || <span className="text-slate-300">N/A</span>}
            </p>
        </div>
    );
}
