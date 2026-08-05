import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { PhotoViewer } from "../../ui/photo-viewer";
import {
    ClipboardList,
    CheckCircle,
    Dog,
    Cat,
    Bird,
    Upload,
    X,
    Image as ImageIcon
} from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import SubmissionStatus from "../shared/SubmissionStatus";
import ConsentDocument from "../shared/ConsentDocument.jsx";
import UploadImagePreview from "../shared/UploadImagePreview.jsx";
import { createConsentDocumentImage } from "../../services/consentDocumentImage.js";
import { resolveImageUrl } from "../../lib/image";
import { formatQueueReference } from "../../lib/referenceNumbers";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { addQueueItem, updateQueueStatus } from "../../services/queueService";
import { checkSelfServiceAccess, fetchPublicWanIp } from "../../services/selfServiceService";
import { fetchUserPets } from "../../services/petService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { uploadDataUrlImage } from "../../services/uploadService";
import BranchBookingSelect from "../shared/BranchBookingSelect.jsx";

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

    const handleCancelQueue = async (queueId, petName) => {
        if (!window.confirm(`Are you sure you want to cancel the queue for ${petName}?`)) {
            return;
        }

        try {
            const data = await updateQueueStatus({
                queue_id: queueId,
                status: "cancelled"
            });

            if (data.success !== false) {
                toast.success(`Queue for ${petName} has been cancelled.`);
                // Refresh pets list
                setSubmitted(prev => !prev);
                loadPets();
            } else {
                toast.error("Failed to cancel queue.");
            }
        } catch (error) {
            console.error("Error cancelling queue:", error);
            toast.error("An error occurred while cancelling the queue.");
        }
    };

    const handleImageUpload = (e) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        fileArray.forEach((file) => {
            if (!file.type.startsWith("image/")) {
                toast.error(`${file.name} is not a supported image.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (String(event.target?.result || "").startsWith("data:image")) {
                    setUploadedImages((prev) => [...prev, event.target.result]);
                } else {
                    toast.error(`${file.name} could not be prepared for preview.`);
                }
            };
            reader.onerror = () => toast.error(`${file.name} could not be read. Please choose another image.`);
            reader.onabort = () => toast.error(`${file.name} preview was cancelled.`);
            reader.readAsDataURL(file);
        });
        e.target.value = "";
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
            const signedConsentImage = await createConsentDocumentImage({
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
            });
            const signaturePath = await uploadDataUrlImage(signedConsentImage, "booking_signature", "queue_consent");
            if (!signaturePath) {
                throw new Error("Signed consent document could not be uploaded.");
            }

            let imagePath = null;
            if (uploadedImages.length > 0 && uploadedImages[0]?.startsWith("data:image")) {
                imagePath = await uploadDataUrlImage(uploadedImages[0], "booking_concern", "queue_concern");
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

    if (isAccessLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-white px-4 flex items-center justify-center dark:from-[#313338] dark:via-[#2b2d31] dark:to-[#313338]">
                <Card className="w-full max-w-xl">
                    <CardContent className="py-10 text-center text-gray-600">
                        Checking network access...
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!isAccessAllowed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-white px-4 flex items-center justify-center dark:from-[#313338] dark:via-[#2b2d31] dark:to-[#313338]">
                <Card className="w-full max-w-xl border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700">Cannot Access Self-Service Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-red-700 font-medium">
                            Cannot access: must be connected to clinic WiFi to add queue.
                        </p>
                        <div className="mt-4 text-xs text-red-700/80 space-y-1">
                            <p>Detected IP: <span className="font-mono">{accessDebug.client_ip || "unknown"}</span></p>
                            <p>Detected WAN IP: <span className="font-mono">{publicWanIp || "unknown"}</span></p>
                            <p>Allowed Rules: <span className="font-mono">{accessDebug.allowed_rules.join(", ") || "none"}</span></p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-white dark:from-[#313338] dark:via-[#2b2d31] dark:to-[#313338]">
            <div className="container mx-auto px-4 py-8">
                {/* Success Message */}
                {submitted && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <p className="text-green-800 font-semibold">Successfully added to queue! Your ticket number will be provided shortly.</p>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Page Title */}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Add Queue</h1>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left Side - Form */}
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5 text-blue-600" />
                                        Queue Registration
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Pet Selection */}
                                        <div className="space-y-3">
                                            <Label>Select Your Pet *</Label>
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                {pets.length === 0 && (
                                                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center sm:col-span-2 dark:border-white/10 dark:bg-[#232428]">
                                                        <p className="font-semibold text-gray-900">No pets found</p>
                                                        <p className="mt-1 text-sm text-gray-600">
                                                            Add a pet to your account before using the self-service queue.
                                                        </p>
                                                    </div>
                                                )}
                                                {pets.map((pet) => {
                                                    const Icon = getPetIcon(pet.species);
                                                    const petImage = resolveImageUrl(pet.profileImage);
                                                    return (
                                                        <Card
                                                            key={pet.id}
                                                            className={`relative overflow-hidden transition-all hover:shadow-md ${
                                                                selectedPet === pet.id
                                                                    ? "ring-2 ring-blue-600 bg-blue-50"
                                                                    : "hover:border-blue-300"
                                                            } ${pet.activeQueue ? "opacity-90" : "cursor-pointer"}`}
                                                            onClick={() => {
                                                                if (isSubmitting || pet.activeQueue) return;
                                                                setSelectedPet(pet.id);
                                                                setSignature(null);
                                                            }}
                                                        >
                                                            <CardContent className="pt-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
                                                                        selectedPet === pet.id ? "bg-blue-600" : "bg-gray-200"
                                                                    }`}>
                                                                        {petImage ? (
                                                                            <img
                                                                                src={petImage}
                                                                                alt={`${pet.name} profile`}
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <Icon className={`h-6 w-6 ${
                                                                                selectedPet === pet.id ? "text-white" : "text-gray-600"
                                                                            }`} />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                <p className="font-semibold text-gray-900">{pet.name}</p>
                                                                                <p className="text-sm text-gray-600">{pet.breed}</p>
                                                                            </div>
                                                                            {pet.activeQueue && (
                                                                                <div className="text-right">
                                                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full mb-1">
                                                                                        IN QUEUE {formatQueueReference(pet.activeQueue)}
                                                                                    </span>
                                                                                    <Button 
                                                                                        size="sm" 
                                                                                        variant="destructive" 
                                                                                        className="h-7 px-2 text-xs flex items-center gap-1"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCancelQueue(pet.activeQueue.queue_id, pet.name);
                                                                                        }}
                                                                                    >
                                                                                        <X className="h-3 w-3" />
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Service Selection */}
                                        <div className="space-y-2">
                                            <Label htmlFor="service">Select Service *</Label>
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
                                                    <SelectValue placeholder="Select a service" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SERVICES.map(service => (
                                                        <SelectItem key={service} value={service} searchText={service}>{service}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedService && (
                                            <BranchBookingSelect
                                                service={selectedService}
                                                value={selectedBranchId}
                                                onChange={setSelectedBranchId}
                                            />
                                        )}

                                        {/* Service Consent Display */}
                                        {selectedService && (
                                            <div className="space-y-3">
                                                <div>
                                                    <Label>Assigned Consent Form *</Label>
                                                    <p className="mt-1 text-sm text-gray-600">
                                                        This document is assigned by admins in Consent Files Management.
                                                    </p>
                                                </div>
                                                {isLoadingConsentTemplates ? (
                                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm font-semibold text-gray-500">
                                                        Loading assigned consent form...
                                                    </div>
                                                ) : selectedConsent ? (
                                                    <div className="max-h-[34rem] overflow-y-auto rounded-lg border border-gray-200 bg-white">
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
                                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                                                        No consent form is assigned to {selectedService}. Ask an admin to assign a consent template to this service category.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Statement of Concern */}
                                        {selectedService && (
                                            <div className="space-y-2">
                                                <Label htmlFor="concern">Statement of Concern</Label>
                                                <textarea
                                                    id="concern"
                                                    rows={4}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                    placeholder="Describe any concerns, symptoms, or observations about your pet..."
                                                    value={concernStatement}
                                                    onChange={(e) => setConcernStatement(e.target.value)}
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                        )}

                                        {/* Image Upload */}
                                        {selectedService && (
                                            <div className="space-y-3">
                                                <Label>Upload Images (Optional)</Label>
                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                                                    <input
                                                        type="file"
                                                        id="imageUpload"
                                                        accept="image/*"
                                                        multiple
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                        disabled={isSubmitting}
                                                    />
                                                    <label htmlFor="imageUpload" className="cursor-pointer">
                                                        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                                                        <p className="text-sm text-gray-600 mb-1">
                                                            Click to upload images or drag and drop
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            PNG, JPG, GIF up to 10MB
                                                        </p>
                                                    </label>
                                                </div>

                                                {/* Image Previews */}
                                                {uploadedImages.length > 0 && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {uploadedImages.map((image, index) => (
                                                            <div
                                                                key={index}
                                                                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200"
                                                            >
                                                                <UploadImagePreview
                                                                    src={image}
                                                                    alt={`Uploaded ${index + 1}`}
                                                                    onPreview={setViewingImage}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveImage(index)}
                                                                    disabled={isSubmitting}
                                                                    className="absolute top-2 right-2 z-20 bg-red-500 text-white rounded-full p-1 opacity-100 transition-opacity hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                                                                    aria-label="Remove image"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Signature Capture */}
                                        {selectedService && selectedConsent && (
                                            <div className="space-y-3">
                                                <Label>Signature Approval *</Label>
                                                <p className="text-sm text-gray-600">
                                                    By signing below, I acknowledge that I have read and agree to the assigned consent form for{" "}
                                                    <span className="font-semibold text-blue-600">{selectedService}</span>
                                                    {selectedPetData && (
                                                        <span> for my pet <span className="font-semibold text-blue-600">{selectedPetData.name}</span></span>
                                                    )}.
                                                </p>
                                                <SignatureCapture
                                                    onSignatureChange={setSignature}
                                                    signature={signature}
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                        )}

                                        <SubmissionStatus
                                            active={isSubmitting}
                                            label="Adding queue entry..."
                                            slowLabel="Still adding queue entry..."
                                        />

                                        <div className="flex gap-3">
                                            <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={!canSubmit}
                                            >
                                                {isSubmitting ? "Adding to Queue..." : "Add to Queue"}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={isSubmitting}
                                                onClick={() => {
                                                    setSelectedPet(null);
                                                    setSelectedService("");
                                                    setSignature(null);
                                                    setConcernStatement("");
                                                    setUploadedImages([]);
                                                }}
                                            >
                                                Clear Form
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Side - Summary */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-4">
                                <CardHeader>
                                    <CardTitle className="text-lg">Queue Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {selectedPetData ? (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Selected Pet</p>
                                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                                    {(() => {
                                                        const Icon = getPetIcon(selectedPetData.species);
                                                        const petImage = resolveImageUrl(selectedPetData.profileImage);
                                                        if (petImage) {
                                                            return (
                                                                <img
                                                                    src={petImage}
                                                                    alt={`${selectedPetData.name} profile`}
                                                                    className="h-8 w-8 rounded-full object-cover"
                                                                />
                                                            );
                                                        }
                                                        return <Icon className="h-8 w-8 text-blue-600" />;
                                                    })()}
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{selectedPetData.name}</p>
                                                        <p className="text-sm text-gray-600">{selectedPetData.breed}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Selected Pet</p>
                                                <p className="text-sm text-gray-400 italic">No pet selected</p>
                                            </div>
                                        )}

                                        {selectedService ? (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Selected Service</p>
                                                <div className="p-3 bg-green-50 rounded-lg">
                                                    <p className="font-semibold text-gray-900">{selectedService}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Selected Service</p>
                                                <p className="text-sm text-gray-400 italic">No service selected</p>
                                            </div>
                                        )}

                                        {concernStatement ? (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Statement of Concern</p>
                                                <div className="p-3 bg-purple-50 rounded-lg">
                                                    <p className="text-sm text-gray-700 line-clamp-3">{concernStatement}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Statement of Concern</p>
                                                <p className="text-sm text-gray-400 italic">No concern added</p>
                                            </div>
                                        )}

                                        {uploadedImages.length > 0 ? (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Uploaded Images</p>
                                                <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                                                    <ImageIcon className="h-5 w-5 text-orange-600" />
                                                    <p className="text-sm font-semibold text-orange-700">
                                                        {uploadedImages.length} {uploadedImages.length === 1 ? 'Image' : 'Images'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Uploaded Images</p>
                                                <p className="text-sm text-gray-400 italic">No images uploaded</p>
                                            </div>
                                        )}

                                        {signature ? (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Signature Status</p>
                                                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                                    <p className="text-sm font-semibold text-green-700">Signed</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Signature Status</p>
                                                <p className="text-sm text-gray-400 italic">Not signed</p>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t">
                                            <p className="text-xs text-gray-500">
                                                Please ensure all information is correct before submitting to queue.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
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
