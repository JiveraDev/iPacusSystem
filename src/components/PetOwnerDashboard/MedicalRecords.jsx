import { useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    Camera,
    ClipboardList,
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
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';
import { emailPetMedicalRecords, fetchPetMedicalRecords } from '../../services/petService';

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

function doctorNoteRows(source) {
    const rows = [
        ['Chief Complaint', source.chiefComplaint || source.chief_complaint],
        ['Major Symptoms', source.majorSymptoms || source.symptoms || source.major_symptoms],
        ['Physical Exam', source.physicalExam || source.physical_exam],
        ['Diagnosis', source.diagnosis],
        ['Treatment', source.treatment],
        ['Lab Results', source.labResults || source.lab_results],
        ['Doctor Notes', source.notes],
        ['Follow-up', source.followUp || source.follow_up_date]
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

    const loadRecords = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const data = await fetchPetMedicalRecords(petId, { ownerOnly: true });
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
    const serviceHistoryCount = asArray(records?.serviceHistory).length;

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
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print-break-inside">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-[#155dfc]">iPawcus Veterinary Clinic</p>
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
                        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3">
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
                            <OrganizedGroup key={group.groupId} group={group} onPreview={setViewer} />
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

function OrganizedGroup({ group, onPreview }) {
    return (
        <article className="print-break-inside overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        <OrganizedItem key={item.itemId} item={item} onPreview={onPreview} />
                    ))
                )}
            </div>
        </article>
    );
}

function OrganizedItem({ item, onPreview }) {
    const source = item.sourceSnapshot || {};
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
        <section className="p-5 print-break-inside">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Stethoscope className="size-4 text-[#155dfc]" />
                        <h3 className="text-base font-black text-slate-900">{item.title}</h3>
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
                        {attachments.map((attachment, index) => {
                            const url = imageUrl(attachment);
                            const canPreview = isImage(attachment);
                            const title = attachment.name || 'Attachment';
                            const tile = (
                                <>
                                    <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-white">
                                        {canPreview && url ? (
                                            <img src={url} alt={title} className="h-full w-full object-cover" />
                                        ) : (
                                            <FileText className="size-7 text-slate-300" />
                                        )}
                                    </div>
                                    <p className="mt-2 truncate text-xs font-bold text-slate-700">{title}</p>
                                </>
                            );

                            if (!canPreview && url) {
                                return (
                                    <a
                                        key={attachment.id || `${url}-${index}`}
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                                    >
                                        {tile}
                                    </a>
                                );
                            }

                            return (
                                <button
                                    key={attachment.id || `${url}-${index}`}
                                    type="button"
                                    onClick={() => canPreview && onPreview({ src: url, alt: title })}
                                    disabled={!canPreview || !url}
                                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                                >
                                    {tile}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
