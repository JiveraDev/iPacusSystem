import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { PhotoViewer } from "../../ui/photo-viewer";
import {
    ClipboardList,
    CheckCircle,
    Dog,
    Cat,
    Bird,
    Upload,
    X,
    Image as ImageIcon,
    ShieldCheck,
    Stethoscope,
    FileSignature,
    MapPin,
    Wifi,
    Clock3
} from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import SubmissionStatus from "../shared/SubmissionStatus";
import ConsentDocument from "../shared/ConsentDocument.jsx";
import UploadImagePreview from "../shared/UploadImagePreview.jsx";
import { createAndUploadConsentDocumentPdf } from "../../services/consentDocumentPdf.js";
import { formatQueueReference } from "../../lib/referenceNumbers";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { addQueueItem } from "../../services/queueService";
import { checkSelfServiceAccess, fetchPublicWanIp } from "../../services/selfServiceService";
import { fetchUserPets } from "../../services/petService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { uploadImageFile } from "../../services/uploadService";
import BranchBookingSelect from "../shared/BranchBookingSelect.jsx";
import ProtectedImage from "../shared/ProtectedImage.jsx";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";

const MAX_CONCERN_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_CONCERN_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
]);

const SERVICES = [
    "General Check-up",
    "Surgery",
    "Dental Services",
    "Pet Boarding",
    "Vaccination",
    "Laboratory Testing",
    "Emergency Care",
    "Parasite Control or Deworming"
];

const SERVICE_CONSENT_ALIASES = {
    "General Check-up": ["general check-up", "general checkup", "consultation"],
    Surgery: ["surgery", "special surgery", "kapon"],
    "Dental Services": ["dental services", "dental", "dental check-up", "dental checkup"],
    "Pet Boarding": ["pet boarding", "boarding", "pet hotel & boarding", "pet hotel boarding", "kennel boarding"],
    Vaccination: ["vaccination", "vaccine"],
    "Laboratory Testing": ["laboratory testing", "lab testing", "laboratory", "lab"],
    "Emergency Care": ["emergency care", "emergency"],
    "Parasite Control or Deworming": ["parasite control or deworming", "parasite control", "parasite-control", "deworming"]
};

function normalizeConsentKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeConsentTemplate(file) {
    return {
        id: String(file.file_id || file.id || ""),
        fileId: file.file_id || file.id || null,
        title: file.file_name || file.title || "Consent Form",
        content: file.content || "",
        category: file.category || "General"
    };
}

function findConsentTemplateForService(templates, serviceName) {
    if (!serviceName) return null;

    const serviceKey = normalizeConsentKey(serviceName);
    const aliasKeys = (SERVICE_CONSENT_ALIASES[serviceName] || [serviceName]).map(normalizeConsentKey);
    const keys = new Set([serviceKey, ...aliasKeys]);

    return templates.find((template) => keys.has(normalizeConsentKey(template.category)))
        || templates.find((template) => {
            const searchable = normalizeConsentKey(`${template.title} ${template.category}`);
            return Array.from(keys).some((key) => key && searchable.includes(key));
        })
        || null;
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
        return {};
    }
}

function getOwnerName(user) {
    return [
        user.firstName || user.first_Name || user.first_name,
        user.lastName || user.last_Name || user.last_name
    ].filter(Boolean).join(" ").trim() || user.name || user.fullName || "Pet owner";
}

export default function QueueDashboard() {

    const [pets, setPets] = useState([]);
    const [isAccessLoading, setIsAccessLoading] = useState(true);
    const [isAccessAllowed, setIsAccessAllowed] = useState(false);
    const [accessDebug, setAccessDebug] = useState({ client_ip: "", allowed_rules: [] });
    const [publicWanIp, setPublicWanIp] = useState("");
    const [selectedPet, setSelectedPet] = useState(null);
    const [selectedService, setSelectedService] = useState("");
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [signature, setSignature] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [concernStatement, setConcernStatement] = useState("");
    const [uploadedImages, setUploadedImages] = useState([]);
    const [viewingImage, setViewingImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [consentTemplates, setConsentTemplates] = useState([]);
    const [isLoadingConsentTemplates, setIsLoadingConsentTemplates] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                let wanIp = "";
                try {
                    wanIp = await fetchPublicWanIp();
                    setPublicWanIp(wanIp);
                } catch (e) {
                    console.error("Failed to fetch WAN IP:", e);
                }

                const data = await checkSelfServiceAccess(wanIp);
                setAccessDebug({
                    client_ip: data.client_ip || "",
                    allowed_rules: Array.isArray(data.allowed_rules) ? data.allowed_rules : []
                });
                if (data.ok && data.allowed) {
                    setIsAccessAllowed(true);
                } else {
                    setIsAccessAllowed(false);
                }
            } catch (error) {
                console.error("Failed to validate self-service access:", error);
                setIsAccessAllowed(false);
            } finally {
                setIsAccessLoading(false);
            }
        };

        checkAccess();
    }, []);

    const loadPets = async () => {
        try {
            const currentUser = getCurrentUser();
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;
            if (!userId) {
                setPets([]);
                return;
            }

            const data = await fetchUserPets(userId);
            if (!Array.isArray(data) || data.length === 0) {
                setPets([]);
                return;
            }

            const mappedPets = data.map((pet) => ({
                id: String(pet.db_id ?? pet.id ?? ""),
                name: pet.name || pet.petName || "Unnamed Pet",
                species: pet.species || "Dog",
                breed: pet.breed || "Unknown Breed",
                regId: pet.id || "",
                profileImage: pet.profileImage || "",
                activeQueue: pet.active_queue || null
            })).filter((pet) => pet.id);

            setPets(mappedPets);
        } catch (error) {
            console.error("Failed to load pets for self-service queue:", error);
        }
    };

    useAutoRefresh(loadPets, { refreshKey: submitted });

    useEffect(() => {
        setSelectedPet((currentPetId) => {
            const currentPetIsEligible = pets.some((pet) => pet.id === currentPetId && !pet.activeQueue);
            if (currentPetIsEligible) return currentPetId;
            if (pets.length === 1 && !pets[0].activeQueue) return pets[0].id;
            return null;
        });
    }, [pets]);

    const loadConsentTemplates = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoadingConsentTemplates(true);
        }

        try {
            const data = await fetchConsentFiles();
            setConsentTemplates(Array.isArray(data)
                ? data.map(normalizeConsentTemplate).filter((template) => template.id)
                : []);
        } catch (error) {
            console.error("Failed to load self-service consent templates:", error);
            if (!isAutoRefresh) {
                toast.error("Could not load assigned consent forms.");
            }
        } finally {
            if (!isAutoRefresh) {
                setIsLoadingConsentTemplates(false);
            }
        }
    };

    useAutoRefresh(loadConsentTemplates, {
        enabled: isAccessAllowed,
        intervalMs: 15000,
        refreshKey: "self-service-queue-consent-templates"
    });

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (!SUPPORTED_CONCERN_IMAGE_TYPES.has(file.type)) {
            toast.error("Upload a JPG, PNG, WEBP, or GIF image.");
            return;
        }
        if (file.size <= 0 || file.size > MAX_CONCERN_IMAGE_BYTES) {
            toast.error("The image must be smaller than 8 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const previewUrl = String(event.target?.result || "");
            if (!previewUrl.startsWith("data:image")) {
                toast.error(`${file.name} could not be prepared for preview.`);
                return;
            }
            setUploadedImages([{ file, previewUrl }]);
        };
        reader.onerror = () => toast.error(`${file.name} could not be read. Please choose another image.`);
        reader.onabort = () => toast.error(`${file.name} preview was cancelled.`);
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = (index) => {
        setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) {
            return;
        }

        if (!signature) {
            toast.error("Please provide your signature to approve the service consent.");
            return;
        }

        const selectedConsent = findConsentTemplateForService(consentTemplates, selectedService);
        if (!selectedConsent) {
            toast.error("No consent form is assigned to this service. Please ask an admin to assign one in Consent Files Management.");
            return;
        }

        setIsSubmitting(true);
        try {
            const currentUser = getCurrentUser();
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;
            const signerName = getOwnerName(currentUser);
            const selectedPetData = pets.find((pet) => pet.id === selectedPet);
            if (!selectedPetData) {
                toast.error("Please select a pet.");
                return;
            }

            const signedAtDate = new Date();
            const signedAtIso = signedAtDate.toISOString();
            const signaturePath = await createAndUploadConsentDocumentPdf({
                title: selectedConsent.title,
                content: selectedConsent.content,
                signatureImage: signature,
                signerName,
                signedAt: signedAtDate.toLocaleString(),
                veterinarianName: "Clinic Intake",
                veterinarianLicense: "",
                templateContext: {
                    ownerName: signerName,
                    ownerAddress: currentUser.personal_Address || currentUser.address || '',
                    ownerPhone: currentUser.phoneNumber || currentUser.phone || '',
                    petName: selectedPetData.name || selectedPetData.pet_name || '',
                    petSpecies: selectedPetData.species || selectedPetData.pet_species || '',
                    petBreed: selectedPetData.breed || selectedPetData.pet_breed || '',
                    serviceName: selectedService,
                    branchName: selectedPetData.branch_name || ''
                }
            }, "queue_consent");
            if (!signaturePath) {
                throw new Error("Signed consent document could not be uploaded.");
            }

            let imagePath = null;
            if (uploadedImages[0]?.file) {
                imagePath = await uploadImageFile(uploadedImages[0].file, "booking_concern");
            }

            const queueData = await addQueueItem({
                pet_id: Number(selectedPetData.id),
                user_id: userId ? Number(userId) : null,
                service_name: selectedService,
                branch_id: selectedBranchId ? Number(selectedBranchId) : null,
                priority: "normal",
                complaint: concernStatement || "",
                image_path: imagePath,
                signiture_self_service_path: signaturePath,
                consent_file_id: selectedConsent.fileId,
                consent_type: selectedConsent.title,
                consent_signed_at: signedAtIso,
                signer_name: signerName,
                queue_source: "self_service"
            }, {
                headers: publicWanIp ? { "X-Client-Public-IP": publicWanIp } : {}
            });

            if (!queueData.success) {
                toast.error(queueData.message || "Failed to add to queue.");
                return;
            }

            toast.success("Successfully added to queue.");
            setSubmitted(true);
            loadPets();
            setTimeout(() => {
                setSubmitted(false);
                setSelectedPet(null);
                setSelectedService("");
                setSelectedBranchId("");
                setSignature(null);
                setConcernStatement("");
                setUploadedImages([]);
            }, 3000);
        } catch (error) {
            console.error("Failed to submit self-service queue:", error);
            toast.error(error.message || "Failed to add to queue.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPetIcon = (species) => {
        switch (species.toLowerCase()) {
            case "dog":
                return Dog;
            case "cat":
                return Cat;
            case "bird":
                return Bird;
            default:
                return Dog;
        }
    };

    const selectedPetData = pets.find(pet => pet.id === selectedPet);
    const selectedConsent = selectedService ? findConsentTemplateForService(consentTemplates, selectedService) : null;
    const currentUser = getCurrentUser();
    const ownerName = getOwnerName(currentUser);
    const canSubmit = selectedPet && selectedService && selectedBranchId && selectedConsent && signature && !isSubmitting;
    const queueSteps = [
        { label: "Pet", complete: Boolean(selectedPet), icon: Dog },
        { label: "Visit details", complete: Boolean(selectedService && selectedBranchId), icon: Stethoscope },
        { label: "Consent", complete: Boolean(selectedConsent && signature), icon: FileSignature }
    ];

    if (isAccessLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
                <Card className="w-full max-w-md" petHover={false}>
                    <CardContent className="flex flex-col items-center py-10 text-center">
                        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                            <Wifi className="size-6 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                        </span>
                        <p className="font-bold text-slate-900 dark:text-white">Checking clinic access</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Confirming that you are connected to the clinic network.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!isAccessAllowed) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
                <Card className="w-full max-w-xl border-red-200 dark:border-red-900/70" petHover={false}>
                    <CardHeader className="border-b border-red-100 dark:border-red-900/50">
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                                <Wifi className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <CardTitle className="text-red-700 dark:text-red-300">Clinic network required</CardTitle>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Connect to the clinic Wi-Fi before joining the self-service queue.</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-5">
                        <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                            <p>Detected IP: <span className="font-mono text-slate-700 dark:text-slate-200">{accessDebug.client_ip || "unknown"}</span></p>
                            <p>Detected WAN IP: <span className="font-mono text-slate-700 dark:text-slate-200">{publicWanIp || "unknown"}</span></p>
                            <p>Allowed rules: <span className="font-mono text-slate-700 dark:text-slate-200">{accessDebug.allowed_rules.join(", ") || "none"}</span></p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-[#2b2d31]">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-5 lg:px-6 lg:py-7">
                {submitted && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                        <CheckCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="font-bold">Queue entry submitted</p>
                            <p className="mt-0.5 text-sm">The clinic team will review the entry and provide the queue number shortly.</p>
                        </div>
                    </div>
                )}

                <DashboardPageHeader
                    icon={ClipboardList}
                    title="Self-Service Queue"
                    description="Join the clinic queue in three clear steps: choose a pet, provide visit details, and sign the assigned consent form."
                    layout="stacked"
                    meta={(
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Wifi className="size-3.5" aria-hidden="true" />
                            Clinic network verified
                        </span>
                    )}
                    toolbar={(
                        <ol className="grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-3" aria-label="Queue registration progress">
                            {queueSteps.map((step, index) => {
                                const StepIcon = step.icon;
                                return (
                                    <li
                                        key={step.label}
                                        className={`flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold ${
                                            step.complete
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                                : "bg-slate-50 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"
                                        }`}
                                    >
                                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                                            step.complete ? "bg-emerald-600 text-white" : "bg-white text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-300"
                                        }`}>
                                            {step.complete ? <CheckCircle className="size-4" /> : index + 1}
                                        </span>
                                        <StepIcon className="size-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{step.label}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                />

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <Card className="overflow-hidden" petHover={false}>
                        <CardHeader className="border-b border-slate-100 bg-white pb-4 dark:border-slate-800 dark:bg-slate-900">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ClipboardList className="size-5 text-[#155dfc]" aria-hidden="true" />
                                Queue registration
                            </CardTitle>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Required fields are marked with an asterisk.</p>
                        </CardHeader>
                        <CardContent className="p-0">
                            <form onSubmit={handleSubmit}>
                                <section className="space-y-4 p-4 sm:p-6" aria-labelledby="queue-pet-heading">
                                    <div className="flex items-start gap-3">
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">1</span>
                                        <div>
                                            <h2 id="queue-pet-heading" className="font-bold text-slate-950 dark:text-white">Choose your pet *</h2>
                                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                                {pets.length === 1 && !pets[0]?.activeQueue ? "Your only eligible pet was selected automatically." : "Select the pet that needs clinic service today."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {pets.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/60">
                                                <p className="font-bold text-slate-900 dark:text-white">No linked pets found</p>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Register or link a pet before joining the queue.</p>
                                            </div>
                                        )}
                                        {pets.map((pet) => {
                                            const Icon = getPetIcon(pet.species);
                                            const isSelected = selectedPet === pet.id;
                                            const isUnavailable = Boolean(pet.activeQueue);
                                            return (
                                                <button
                                                    key={pet.id}
                                                    type="button"
                                                    disabled={isSubmitting || isUnavailable}
                                                    aria-pressed={isSelected}
                                                    onClick={() => {
                                                        setSelectedPet(pet.id);
                                                        setSignature(null);
                                                    }}
                                                    className={`group flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-offset-slate-900 ${
                                                        isSelected
                                                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-950/40"
                                                            : isUnavailable
                                                                ? "border-slate-200 bg-slate-50 opacity-80 dark:border-slate-700 dark:bg-slate-800/60"
                                                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                                                    }`}
                                                >
                                                    <span className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${isSelected ? "bg-[#155dfc] text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
                                                        {pet.profileImage ? (
                                                            <ProtectedImage
                                                                src={pet.profileImage}
                                                                alt=""
                                                                className="size-full object-cover"
                                                                fallbackClassName="size-full"
                                                            />
                                                        ) : (
                                                            <Icon className="size-6" aria-hidden="true" />
                                                        )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-bold text-slate-950 dark:text-white">{pet.name}</span>
                                                        <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{pet.species} · {pet.breed}</span>
                                                        {isUnavailable && (
                                                            <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                                <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                                                                <span className="truncate">In queue {formatQueueReference(pet.activeQueue)}</span>
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isSelected && <CheckCircle className="size-5 shrink-0 text-[#155dfc]" aria-hidden="true" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {pets.some((pet) => pet.activeQueue) && (
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Active queue entries are managed by clinic staff. Contact the front desk if an entry needs to be changed.
                                        </p>
                                    )}
                                </section>

                                <section className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-6" aria-labelledby="queue-details-heading">
                                    <div className="flex items-start gap-3">
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">2</span>
                                        <div>
                                            <h2 id="queue-details-heading" className="font-bold text-slate-950 dark:text-white">Visit details *</h2>
                                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Choose the service and clinic location, then describe the concern.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="service">Service *</Label>
                                            <Select
                                                value={selectedService}
                                                onValueChange={(service) => {
                                                    setSelectedService(service);
                                                    setSignature(null);
                                                }}
                                                disabled={isSubmitting}
                                                searchPlaceholder="Search service"
                                            >
                                                <SelectTrigger id="service">
                                                    <SelectValue placeholder="Select service" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SERVICES.map(service => (
                                                        <SelectItem key={service} value={service} searchText={service}>{service}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedService && (
                                            <div className="min-w-0">
                                                <BranchBookingSelect
                                                    service={selectedService}
                                                    value={selectedBranchId}
                                                    onChange={setSelectedBranchId}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {selectedService && (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="concern">Concern or symptoms</Label>
                                                <Textarea
                                                    id="concern"
                                                    rows={5}
                                                    placeholder="Describe the main concern"
                                                    value={concernStatement}
                                                    onChange={(event) => setConcernStatement(event.target.value)}
                                                    disabled={isSubmitting}
                                                    className="min-h-32 resize-y"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="imageUpload">Concern image <span className="font-normal text-slate-400">(optional)</span></Label>
                                                <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20">
                                                    <input
                                                        type="file"
                                                        id="imageUpload"
                                                        accept=".jpg,.jpeg,.png,.gif,.webp"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                        disabled={isSubmitting}
                                                    />
                                                    <label htmlFor="imageUpload" className={`block ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                                                        <Upload className="mx-auto mb-2 size-7 text-slate-400" aria-hidden="true" />
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Choose an image</p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG, WEBP, or GIF · 8 MB maximum</p>
                                                    </label>
                                                </div>
                                            </div>
                                            {uploadedImages.length > 0 && (
                                                <div className="md:col-start-2">
                                                    {uploadedImages.map((image, index) => (
                                                        <div key={image.previewUrl} className="group relative aspect-video max-w-sm overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <UploadImagePreview src={image.previewUrl} alt="Concern upload preview" onPreview={setViewingImage} />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveImage(index)}
                                                                disabled={isSubmitting}
                                                                className="absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-full bg-slate-950/75 text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                                                                aria-label="Remove concern image"
                                                            >
                                                                <X className="size-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>

                                {selectedService && (
                                    <section className="space-y-5 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-6" aria-labelledby="queue-consent-heading">
                                        <div className="flex items-start gap-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">3</span>
                                            <div>
                                                <h2 id="queue-consent-heading" className="font-bold text-slate-950 dark:text-white">Review and sign consent *</h2>
                                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Read the assigned form before adding your signature.</p>
                                            </div>
                                        </div>

                                        {isLoadingConsentTemplates ? (
                                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">Loading assigned consent form...</div>
                                        ) : selectedConsent ? (
                                            <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700">
                                                <ConsentDocument
                                                    title={selectedConsent.title}
                                                    content={selectedConsent.content}
                                                    signatureImage={signature}
                                                    signerName={signature ? ownerName : ""}
                                                    signedAt={signature ? "Pending submission" : ""}
                                                    veterinarianName="Clinic Intake"
                                                    variant="compact"
                                                    templateContext={{
                                                        ownerName,
                                                        ownerAddress: currentUser.personal_Address || currentUser.address || '',
                                                        ownerPhone: currentUser.phoneNumber || currentUser.phone || '',
                                                        petName: selectedPetData?.name || selectedPetData?.pet_name || '',
                                                        petSpecies: selectedPetData?.species || selectedPetData?.pet_species || '',
                                                        petBreed: selectedPetData?.breed || selectedPetData?.pet_breed || '',
                                                        serviceName: selectedService
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                                                No consent form is assigned to {selectedService}. Ask clinic staff to assign one before continuing.
                                            </div>
                                        )}

                                        {selectedConsent && (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#155dfc]" aria-hidden="true" />
                                                    <p>
                                                        Signing confirms that you reviewed the consent for <strong>{selectedService}</strong>
                                                        {selectedPetData ? <> for <strong>{selectedPetData.name}</strong></> : null}.
                                                    </p>
                                                </div>
                                                <SignatureCapture onSignatureChange={setSignature} signature={signature} disabled={isSubmitting} />
                                            </div>
                                        )}
                                    </section>
                                )}

                                <div className="border-t border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                                    <SubmissionStatus active={isSubmitting} label="Adding queue entry..." slowLabel="Still adding queue entry..." />
                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setSelectedPet(pets.length === 1 && !pets[0]?.activeQueue ? pets[0].id : null);
                                                setSelectedService("");
                                                setSelectedBranchId("");
                                                setSignature(null);
                                                setConcernStatement("");
                                                setUploadedImages([]);
                                            }}
                                            className="w-full sm:w-auto"
                                        >
                                            Clear details
                                        </Button>
                                        <Button type="submit" className="w-full sm:min-w-40 sm:w-auto" disabled={!canSubmit}>
                                            {isSubmitting ? "Adding to queue..." : "Join queue"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <aside className="space-y-4 xl:sticky xl:top-4">
                        <Card petHover={false}>
                            <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <ShieldCheck className="size-5 text-[#155dfc]" aria-hidden="true" />
                                    Ready check
                                </CardTitle>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Review the essentials before joining.</p>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-5">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                                        {selectedPetData?.profileImage ? (
                                            <ProtectedImage src={selectedPetData.profileImage} alt="" className="size-full object-cover" fallbackClassName="size-full" />
                                        ) : selectedPetData ? (
                                            (() => {
                                                const PetIcon = getPetIcon(selectedPetData.species);
                                                return <PetIcon className="size-5" aria-hidden="true" />;
                                            })()
                                        ) : (
                                            <Dog className="size-5" aria-hidden="true" />
                                        )}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pet</p>
                                        <p className={`truncate font-bold ${selectedPetData ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{selectedPetData?.name || "Not selected"}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Stethoscope className="size-5" aria-hidden="true" /></span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Service</p>
                                        <p className={`truncate font-bold ${selectedService ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{selectedService || "Not selected"}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><MapPin className="size-5" aria-hidden="true" /></span>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Location</p>
                                        <p className={`font-bold ${selectedBranchId ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{selectedBranchId ? "Selected" : "Not selected"}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><FileSignature className="size-5" aria-hidden="true" /></span>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Consent</p>
                                        <p className={`font-bold ${signature ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>{signature ? "Signed" : "Signature required"}</p>
                                    </div>
                                </div>

                                {uploadedImages.length > 0 && (
                                    <div className="flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                                        <ImageIcon className="size-4 text-[#155dfc]" aria-hidden="true" />
                                        Concern image ready
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                            <p className="font-bold">After you join</p>
                            <p className="mt-1 leading-5">Clinic staff will manage the active queue. Ask the front desk if the entry needs to be changed or cancelled.</p>
                        </div>
                    </aside>
                </div>
            </div>

            <PhotoViewer
                open={Boolean(viewingImage)}
                src={viewingImage || ""}
                alt="Self-service concern preview"
                onOpenChange={(open) => !open && setViewingImage(null)}
            />
        </div>
    );
}
