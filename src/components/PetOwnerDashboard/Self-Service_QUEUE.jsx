import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
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
import { resolveImageUrl } from "../../lib/image";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";

const SERVICES = [
    "General Check-Up",
    "Surgery",
    "Dental Services",
    "Pet Boarding",
    "Vaccination",
    "Laboratory Testing",
    "Emergency Care",
    "Parasite Control or Deworming"
];

const SERVICE_CONSENTS = {
    "General Check-Up": {
        title: "General Check-Up Service Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to perform a comprehensive physical examination on my pet.",
            "I understand that the veterinarian will assess my pet's overall health, vital signs, and may recommend additional tests or treatments."
        ]
    },
    "Surgery": {
        title: "Surgical Procedure Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to perform the necessary surgical procedure on my pet.",
            "I understand that all surgery involves risks including infection, adverse reactions to anesthesia, and in rare cases, death."
        ]
    },
    "Dental Services": {
        title: "Dental Service Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to perform dental examination, cleaning, and necessary dental procedures on my pet.",
            "I understand that dental procedures may require anesthesia and carry associated risks."
        ]
    },
    "Pet Boarding": {
        title: "Pet Boarding Service Consent",
        items: [
            "I certify that my pet is in good health and has not been exposed to any contagious diseases in the past 30 days.",
            "I agree that my pet has current vaccinations as required by Vetfocus Care Animal Clinic."
        ]
    },
    "Vaccination": {
        title: "Vaccination Service Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to administer vaccines to my pet as recommended.",
            "I understand that vaccines may cause mild reactions including lethargy, soreness, or mild fever."
        ]
    },
    "Laboratory Testing": {
        title: "Laboratory Testing Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to collect specimens and perform laboratory tests on my pet.",
            "I understand that some tests may require blood samples, urine samples, or other specimen collection."
        ]
    },
    "Emergency Care": {
        title: "Emergency Care Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to provide immediate emergency medical care to my pet.",
            "I understand that emergency situations may require rapid decision-making and life-saving interventions."
        ]
    },
    "Parasite Control or Deworming": {
        title: "Parasite Control & Deworming Consent",
        items: [
            "I authorize Vetfocus Care Animal Clinic to perform parasite screening and administer deworming treatment to my pet.",
            "I understand that fecal examination may be required to identify parasites."
        ]
    }
};

export default function QueueDashboard() {

    const API_BASE = import.meta.env.VITE_API_BASE_URL;
    const [pets, setPets] = useState([]);
    const [isAccessLoading, setIsAccessLoading] = useState(true);
    const [isAccessAllowed, setIsAccessAllowed] = useState(false);
    const [accessDebug, setAccessDebug] = useState({ client_ip: "", allowed_rules: [] });
    const [publicWanIp, setPublicWanIp] = useState("");
    const [selectedPet, setSelectedPet] = useState(null);
    const [selectedService, setSelectedService] = useState("");
    const [signature, setSignature] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [concernStatement, setConcernStatement] = useState("");
    const [uploadedImages, setUploadedImages] = useState([]);
    const [viewingImage, setViewingImage] = useState(null);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                let wanIp = "";
                try {
                    const wanRes = await fetch("https://api.ipify.org?format=json");
                    if (wanRes.ok) {
                        const wanData = await wanRes.json();
                        wanIp = wanData?.ip || "";
                        setPublicWanIp(wanIp);
                    }
                } catch (e) {
                    console.error("Failed to fetch WAN IP:", e);
                }

                const response = await fetch(`${API_BASE}/self-service/access`, {
                    headers: wanIp ? { "X-Client-Public-IP": wanIp } : {}
                });
                const data = await response.json().catch(() => ({}));
                setAccessDebug({
                    client_ip: data.client_ip || "",
                    allowed_rules: Array.isArray(data.allowed_rules) ? data.allowed_rules : []
                });
                if (response.ok && data.allowed) {
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
    }, [API_BASE]);

    const loadPets = async () => {
        try {
            const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;
            if (!userId) {
                setPets([]);
                return;
            }

            const response = await fetch(`${API_BASE}/users/${userId}/pets`);
            if (!response.ok) {
                return;
            }

            const data = await response.json();
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

    const handleCancelQueue = async (queueId, petName) => {
        if (!window.confirm(`Are you sure you want to cancel the queue for ${petName}?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/queues/status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    queue_id: queueId,
                    status: "cancelled"
                })
            });

            if (response.ok) {
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
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setUploadedImages((prev) => [...prev, event.target.result]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveImage = (index) => {
        setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    };

    const dataUrlToFile = async (dataUrl, fileName) => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const extension = blob.type.includes("png") ? "png" : "jpg";
        return new File([blob], `${fileName}.${extension}`, { type: blob.type || "image/png" });
    };

    const uploadDataUrl = async (dataUrl, type, fileNamePrefix) => {
        const file = await dataUrlToFile(dataUrl, `${fileNamePrefix}_${Date.now()}`);
        const formData = new FormData();
        formData.append("image", file);
        formData.append("type", type);

        const response = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Upload failed");
        }

        const result = await response.json();
        return result.relative_url || null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!signature) {
            toast.error("Please provide your signature to approve the service consent.");
            return;
        }

        try {
            const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;
            const selectedPetData = pets.find((pet) => pet.id === selectedPet);
            if (!selectedPetData) {
                toast.error("Please select a pet.");
                return;
            }

            let signaturePath = null;
            if (signature?.startsWith("data:image")) {
                signaturePath = await uploadDataUrl(signature, "booking_signature", "queue_signature");
            }

            let imagePath = null;
            if (uploadedImages.length > 0 && uploadedImages[0]?.startsWith("data:image")) {
                imagePath = await uploadDataUrl(uploadedImages[0], "booking_concern", "queue_concern");
            }

            const queueResponse = await fetch(`${API_BASE}/queues`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(publicWanIp ? { "X-Client-Public-IP": publicWanIp } : {})
                },
                body: JSON.stringify({
                    pet_id: Number(selectedPetData.id),
                    user_id: userId ? Number(userId) : null,
                    service_name: selectedService,
                    priority: "normal",
                    complaint: concernStatement || "",
                    image_path: imagePath,
                    signiture_self_service_path: signaturePath,
                    queue_source: "self_service"
                })
            });

            const queueData = await queueResponse.json().catch(() => ({}));
            if (!queueResponse.ok || !queueData.success) {
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
                setSignature(null);
                setConcernStatement("");
                setUploadedImages([]);
            }, 3000);
        } catch (error) {
            console.error("Failed to submit self-service queue:", error);
            toast.error("Failed to add to queue.");
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
    const selectedConsent = selectedService ? SERVICE_CONSENTS[selectedService] : null;
    const canSubmit = selectedPet && selectedService && signature;

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
                                                            onClick={() => !pet.activeQueue && setSelectedPet(pet.id)}
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
                                                                                        IN QUEUE #{pet.activeQueue.queue_number}
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
                                            <select
                                                id="service"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedService}
                                                onChange={(e) => setSelectedService(e.target.value)}
                                                required
                                            >
                                                <option value="">Select a service</option>
                                                {SERVICES.map(service => (
                                                    <option key={service} value={service}>{service}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Service Consent Display */}
                                        {selectedConsent && (
                                            <div className="border rounded-lg p-4 bg-gray-50">
                                                <h3 className="font-semibold text-gray-900 mb-3">{selectedConsent.title}</h3>
                                                <div className="space-y-2 mb-4">
                                                    {selectedConsent.items.map((item, index) => (
                                                        <div key={index} className="flex gap-2">
                                                            <span className="text-blue-600 font-semibold text-sm mt-0.5">{index + 1}.</span>
                                                            <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
                                                        </div>
                                                    ))}
                                                </div>
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
                                                                <img
                                                                    src={image}
                                                                    alt={`Uploaded ${index + 1}`}
                                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onClick={() => setViewingImage(image)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveImage(index)}
                                                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
                                        {selectedService && (
                                            <div className="space-y-3">
                                                <Label>Signature Approval *</Label>
                                                <p className="text-sm text-gray-600">
                                                    By signing below, I acknowledge that I have read and agree to the service consent terms for{" "}
                                                    <span className="font-semibold text-blue-600">{selectedService}</span>
                                                    {selectedPetData && (
                                                        <span> for my pet <span className="font-semibold text-blue-600">{selectedPetData.name}</span></span>
                                                    )}.
                                                </p>
                                                <SignatureCapture
                                                    onSignatureChange={setSignature}
                                                    signature={signature}
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={!canSubmit}
                                            >
                                                Add to Queue
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
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

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                            aria-label="Close image viewer"
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={viewingImage}
                            alt="Viewing uploaded image"
                            className="w-full h-full object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
