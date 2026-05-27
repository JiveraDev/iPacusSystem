import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { toast } from "../../reusecomponent/toast.jsx";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Sparkles,
    Scissors,
    Activity,
    PawPrint,
    Loader2,
    ShieldCheck,
    Check,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const EMPTY_SERVICE_FORM = {
    service_code: "",
    service_title: "",
    service_description: "",
    service_details: "",
    price_label: "",
    duration_label: "",
    max_pets: 1,
    sort_order: 0,
    is_active: true,
    date_restriction_type: "none",
    date_start: "",
    date_end: "",
};

function normalizeRole(role) {
    return String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
}

function getServiceIcon(service) {
    const code = String(service?.serviceCode || "").toLowerCase();
    const title = String(service?.serviceTitle || "").toLowerCase();

    if (code.includes("kapon") || title.includes("kapon")) return Scissors;
    if (code.includes("surgery") || title.includes("surgery")) return Activity;
    return Sparkles;
}

function formatCurrencyLabel(value) {
    return value || "To be announced";
}

function formatDateLabel(value) {
    if (!value) return "Not set";

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function getDateRestrictionLabel(service) {
    const type = service?.dateRestrictionType || "none";
    if (type === "single") {
        return `Available on ${formatDateLabel(service?.dateStart)}`;
    }

    if (type === "range") {
        return `Available ${formatDateLabel(service?.dateStart)} to ${formatDateLabel(service?.dateEnd)}`;
    }

    return "No date restriction";
}

function isDateAllowedForService(service, dateValue) {
    if (!service || !dateValue) return false;

    const type = service.dateRestrictionType || "none";
    if (type === "none") return true;
    if (type === "single") return Boolean(service.dateStart) && dateValue === service.dateStart;
    if (type === "range") return Boolean(service.dateStart && service.dateEnd) && dateValue >= service.dateStart && dateValue <= service.dateEnd;

    return true;
}

function buildServiceForm(service) {
    return {
        service_code: service?.serviceCode || "",
        service_title: service?.serviceTitle || "",
        service_description: service?.serviceDescription || "",
        service_details: service?.serviceDetails || "",
        price_label: service?.priceLabel || "",
        duration_label: service?.durationLabel || "",
        max_pets: service?.maxPets || 1,
        sort_order: service?.sortOrder || 0,
        is_active: service?.isActive !== false,
        date_restriction_type: service?.dateRestrictionType || "none",
        date_start: service?.dateStart || "",
        date_end: service?.dateEnd || "",
    };
}

function DateRestrictionFields({ disabled = false, form, idPrefix, onChange }) {
    const updateField = (field, value) => onChange({ ...form, [field]: value });
    const restrictionType = form.date_restriction_type || "none";

    return (
        <>
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${idPrefix}_date_restriction_type`}>Date Restriction</Label>
                <Select
                    disabled={disabled}
                    value={restrictionType}
                    onValueChange={(value) => {
                        onChange({
                            ...form,
                            date_restriction_type: value,
                            date_start: value === "none" ? "" : form.date_start,
                            date_end: value !== "range" ? "" : form.date_end,
                        });
                    }}
                >
                    <SelectTrigger id={`${idPrefix}_date_restriction_type`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No restriction</SelectItem>
                        <SelectItem value="single">Single date only</SelectItem>
                        <SelectItem value="range">Date range</SelectItem>
                    </SelectContent>
                </Select>
                {disabled && (
                    <p className="text-xs text-amber-700">
                        Date restrictions need the database columns added first.
                    </p>
                )}
            </div>

            {restrictionType === "single" && (
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`${idPrefix}_date_start`}>Allowed Date</Label>
                    <Input
                        id={`${idPrefix}_date_start`}
                        type="date"
                        disabled={disabled}
                        value={form.date_start || ""}
                        onChange={(event) => updateField("date_start", event.target.value)}
                    />
                </div>
            )}

            {restrictionType === "range" && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}_date_start`}>Start Date</Label>
                        <Input
                            id={`${idPrefix}_date_start`}
                            type="date"
                            disabled={disabled}
                            value={form.date_start || ""}
                            onChange={(event) => updateField("date_start", event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}_date_end`}>End Date</Label>
                        <Input
                            id={`${idPrefix}_date_end`}
                            type="date"
                            disabled={disabled}
                            value={form.date_end || ""}
                            min={form.date_start || undefined}
                            onChange={(event) => updateField("date_end", event.target.value)}
                        />
                    </div>
                </>
            )}
        </>
    );
}

export default function SpecialServices({ user }) {
    const navigate = useNavigate();
    const currentUser = user || getCurrentUser();
    const currentUserId = currentUser.id || currentUser.user_id || currentUser.userId;
    const isAdminUser = ["admin", "super_admin"].includes(normalizeRole(currentUser.role));

    const [pets, setPets] = useState([]);
    const [services, setServices] = useState([]);
    const [selectedPetIds, setSelectedPetIds] = useState([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState([]);
    const [serviceDate, setServiceDate] = useState("");
    const [notes, setNotes] = useState("");
    const [isNewPet, setIsNewPet] = useState(false);
    const [isLoadingPets, setIsLoadingPets] = useState(true);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdminForm, setShowAdminForm] = useState(false);
    const [isSavingService, setIsSavingService] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [editServiceForm, setEditServiceForm] = useState({ ...EMPTY_SERVICE_FORM });
    const [isUpdatingService, setIsUpdatingService] = useState(false);
    const [availabilityDialogService, setAvailabilityDialogService] = useState(null);

    const [newPetName, setNewPetName] = useState("");
    const [newPetSpecies, setNewPetSpecies] = useState("");
    const [newPetBreed, setNewPetBreed] = useState("");
    const [newPetAge, setNewPetAge] = useState("");
    const [newPetWeight, setNewPetWeight] = useState("");
    const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

    const [serviceForm, setServiceForm] = useState({ ...EMPTY_SERVICE_FORM });

    const selectedServices = useMemo(() => {
        const selectedIds = new Set(selectedServiceIds.map((id) => String(id)));
        return services.filter((service) => selectedIds.has(String(service.id)));
    }, [selectedServiceIds, services]);

    const selectedService = selectedServices[0] || null;

    const selectedServiceLimit = useMemo(() => {
        if (!selectedService) {
            return null;
        }

        return Math.max(0, Number(selectedService.remainingSlots ?? selectedService.maxPets ?? 1));
    }, [selectedService]);

    const todayDate = useMemo(() => new Date().toISOString().split("T")[0], []);

    const serviceDateMin = useMemo(() => {
        if (!selectedService) return todayDate;
        if (selectedService.dateRestrictionType === "single") return selectedService.dateStart || todayDate;
        if (selectedService.dateRestrictionType === "range") {
            return selectedService.dateStart && selectedService.dateStart > todayDate ? selectedService.dateStart : todayDate;
        }

        return todayDate;
    }, [selectedService, todayDate]);

    const serviceDateMax = useMemo(() => {
        if (!selectedService) return undefined;
        if (selectedService.dateRestrictionType === "single") return selectedService.dateStart || undefined;
        if (selectedService.dateRestrictionType === "range") return selectedService.dateEnd || undefined;

        return undefined;
    }, [selectedService]);

    const dateRestrictionSupported = useMemo(() => {
        return services.length === 0 || services.some((service) => service.dateRestrictionSupported !== false);
    }, [services]);

    const loadPets = useCallback(async () => {
        if (!currentUserId) {
            setPets([]);
            setIsLoadingPets(false);
            return;
        }

        setIsLoadingPets(true);
        try {
            const response = await fetch(`${API_BASE}/api/users/${currentUserId}/pets`);
            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error(data.message || "Failed to load pets.");
            }

            setPets(Array.isArray(data) ? data.map((pet) => ({
                id: String(pet.db_id || pet.pet_id || pet.id),
                sharableId: pet.id,
                name: pet.name || pet.petName || "Unnamed Pet",
                species: pet.species || "",
                breed: pet.breed || "",
                age: pet.age || "",
                weight: pet.weight || "",
                profileImage: pet.profileImage || pet.setpetImage_url || "",
            })).filter((pet) => pet.id) : []);
        } catch (error) {
            console.error("Failed to load pets for special services:", error);
            toast.error("Could not load your pets.");
        } finally {
            setIsLoadingPets(false);
        }
    }, [currentUserId]);

    const loadServices = useCallback(async () => {
        setIsLoadingServices(true);
        try {
            const response = await fetch(`${API_BASE}/api/special_services${isAdminUser ? "?includeInactive=1" : ""}`);
            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error(data.message || "Failed to load special services.");
            }

            setServices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load special services:", error);
            toast.error("Could not load special services.");
        } finally {
            setIsLoadingServices(false);
        }
    }, [isAdminUser]);

    useEffect(() => {
        loadPets();
        loadServices();
    }, [loadPets, loadServices]);

    useEffect(() => {
        setSelectedServiceIds((current) => current.filter((serviceId) => {
            const service = services.find((item) => String(item.id) === String(serviceId));
            return service && service.isActive !== false && Number(service.remainingSlots ?? service.maxPets ?? 0) > 0;
        }));
    }, [services]);

    useEffect(() => {
        if (!selectedService) return;

        if (selectedService.dateRestrictionType === "single" && selectedService.dateStart && serviceDate !== selectedService.dateStart) {
            setServiceDate(selectedService.dateStart);
            return;
        }

        if (serviceDate && !isDateAllowedForService(selectedService, serviceDate)) {
            setServiceDate("");
        }
    }, [selectedService, serviceDate]);

    const togglePet = (petId) => {
        const petKey = String(petId);

        if (isNewPet) {
            return;
        }

        setSelectedPetIds((current) => {
            if (current.includes(petKey)) {
                return current.filter((id) => id !== petKey);
            }

            if (selectedServiceLimit !== null && current.length >= selectedServiceLimit) {
                toast.error(`Maximum ${selectedServiceLimit} pet${selectedServiceLimit === 1 ? "" : "s"} allowed for the selected service.`);
                return current;
            }

            return [...current, petKey];
        });
    };

    const toggleService = (service) => {
        const serviceId = String(service.id);

        if (service.isActive === false) {
            toast.error("This special service is currently disabled.");
            return;
        }

        const remainingSlots = Number(service.remainingSlots ?? service.maxPets ?? 0);
        if (remainingSlots <= 0) {
            toast.error("This special service is fully booked.");
            return;
        }

        setSelectedServiceIds((current) => {
            if (current.includes(serviceId)) {
                return [];
            }

            const currentPetCount = isNewPet ? 1 : selectedPetIds.length;
            const serviceLimit = Math.max(0, remainingSlots);
            if (currentPetCount > serviceLimit) {
                toast.error(`This service has only ${serviceLimit} remaining pet slot${serviceLimit === 1 ? "" : "s"}.`);
                return current;
            }

            return [serviceId];
        });
    };

    const handleSaveSpecialService = async () => {
        if (!isAdminUser) {
            toast.error("Only admin users can add special service types.");
            return;
        }

        if (!serviceForm.service_title.trim()) {
            toast.error("Service title is required.");
            return;
        }

        setIsSavingService(true);
        try {
            const response = await fetch(`${API_BASE}/api/special_services`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    created_by_user_id: currentUserId,
                    ...serviceForm,
                }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || "Failed to save special service.");
            }

            toast.success("Special service type saved.");
            setShowAdminForm(false);
            setServiceForm({ ...EMPTY_SERVICE_FORM });
            await loadServices();
        } catch (error) {
            console.error("Failed to save special service:", error);
            toast.error(error.message || "Failed to save special service.");
        } finally {
            setIsSavingService(false);
        }
    };

    const openEditService = (service) => {
        if (!isAdminUser) return;

        setEditingService(service);
        setEditServiceForm(buildServiceForm(service));
        setEditDialogOpen(true);
    };

    const handleUpdateSpecialService = async () => {
        if (!isAdminUser || !editingService) {
            toast.error("Only admin users can update special services.");
            return;
        }

        if (!editServiceForm.service_title.trim()) {
            toast.error("Service title is required.");
            return;
        }

        setIsUpdatingService(true);
        try {
            const response = await fetch(`${API_BASE}/api/special_services/${editingService.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    updated_by_user_id: currentUserId,
                    ...editServiceForm,
                }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || "Failed to update special service.");
            }

            toast.success("Special service updated.");
            setEditDialogOpen(false);
            setEditingService(null);
            setSelectedServiceIds((current) => editServiceForm.is_active ? current : current.filter((id) => id !== String(editingService.id)));
            await loadServices();
        } catch (error) {
            console.error("Failed to update special service:", error);
            toast.error(error.message || "Failed to update special service.");
        } finally {
            setIsUpdatingService(false);
        }
    };

    const handleToggleServiceActive = async (service) => {
        if (!isAdminUser || !service) return;

        const nextIsActive = service.isActive === false;
        const actionLabel = nextIsActive ? "enable" : "disable";

        setIsUpdatingService(true);
        try {
            const response = await fetch(`${API_BASE}/api/special_services/${service.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    updated_by_user_id: currentUserId,
                    is_active: nextIsActive,
                }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || `Failed to ${actionLabel} special service.`);
            }

            if (!nextIsActive) {
                setSelectedServiceIds((current) => current.filter((id) => id !== String(service.id)));
            }

            toast.success(`Special service ${nextIsActive ? "enabled" : "disabled"}.`);
            await loadServices();
        } catch (error) {
            console.error("Failed to update special service availability:", error);
            toast.error(error.message || `Failed to ${actionLabel} special service.`);
        } finally {
            setIsUpdatingService(false);
            setAvailabilityDialogService(null);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (selectedServiceIds.length === 0) {
            toast.error("Please select one special service.");
            return;
        }

        if (!serviceDate) {
            toast.error("Please select the announced service date.");
            return;
        }

        if (selectedService && !isDateAllowedForService(selectedService, serviceDate)) {
            toast.error(getDateRestrictionLabel(selectedService));
            return;
        }

        if (isNewPet) {
            if (!newPetName.trim() || !newPetSpecies.trim() || !newPetAge.trim()) {
                toast.error("Please complete the new pet information.");
                return;
            }
        } else if (selectedPetIds.length === 0) {
            toast.error("Please select at least one pet.");
            return;
        }

        const petCount = isNewPet ? 1 : selectedPetIds.length;
        if (selectedServiceLimit !== null && petCount > selectedServiceLimit) {
            toast.error(`The selected service has only ${selectedServiceLimit} remaining pet slot${selectedServiceLimit === 1 ? "" : "s"}.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE}/api/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: currentUserId,
                    pet_id: isNewPet ? null : selectedPetIds[0] || null,
                    pet_ids: isNewPet ? [] : selectedPetIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
                    service_type: "special services",
                    booking_date: serviceDate,
                    booking_time: "09:00:00",
                    notes: notes.trim(),
                    registered_status: isNewPet ? "Not Registered" : "Registered",
                    petType: isNewPet ? newPetSpecies : null,
                    new_pet_name: isNewPet ? newPetName.trim() : null,
                    new_pet_breed: isNewPet ? newPetBreed.trim() : null,
                    new_pet_age: isNewPet ? newPetAge.trim() : null,
                    new_pet_weight: isNewPet ? newPetWeight.trim() : null,
                    special_service_items: selectedServiceIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
                }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || "Failed to create special services booking.");
            }

            toast.success("Special services booking submitted.");
            navigate("/dashboard/services");
        } catch (error) {
            console.error("Special services booking error:", error);
            toast.error(error.message || "An error occurred while submitting the booking.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 max-w-5xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" onClick={() => navigate("/dashboard/services")} className="self-start">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Special Services</h1>
                        <p className="text-sm text-gray-600">Book Kapon and other special service items using the clinic catalog.</p>
                    </div>
                </div>

                {isAdminUser && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAdminForm((current) => !current)}
                        className="self-start"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {showAdminForm ? "Close Service Form" : "Add Special Service Type"}
                    </Button>
                )}
            </div>

            {isAdminUser && showAdminForm && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                            Add Special Service Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="service_code">Service Code</Label>
                                <Input
                                    id="service_code"
                                    value={serviceForm.service_code}
                                    onChange={(event) => setServiceForm({ ...serviceForm, service_code: event.target.value })}
                                    placeholder="kapon, special-surgery, grooming-plus"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="service_title">Title *</Label>
                                <Input
                                    id="service_title"
                                    value={serviceForm.service_title}
                                    onChange={(event) => setServiceForm({ ...serviceForm, service_title: event.target.value })}
                                    placeholder="Kapon (Spay/Neuter)"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="service_description">Short Description</Label>
                                <Input
                                    id="service_description"
                                    value={serviceForm.service_description}
                                    onChange={(event) => setServiceForm({ ...serviceForm, service_description: event.target.value })}
                                    placeholder="Surgical sterilization procedure"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="service_details">Details / Format</Label>
                                <Textarea
                                    id="service_details"
                                    value={serviceForm.service_details}
                                    onChange={(event) => setServiceForm({ ...serviceForm, service_details: event.target.value })}
                                    rows={4}
                                    placeholder="Use the same style as the Kapon details..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price_label">Price Label</Label>
                                <Input
                                    id="price_label"
                                    value={serviceForm.price_label}
                                    onChange={(event) => setServiceForm({ ...serviceForm, price_label: event.target.value })}
                                    placeholder="Free or PHP 5,000 - PHP 15,000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="duration_label">Duration Label</Label>
                                <Input
                                    id="duration_label"
                                    value={serviceForm.duration_label}
                                    onChange={(event) => setServiceForm({ ...serviceForm, duration_label: event.target.value })}
                                    placeholder="2-3 hours"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_pets">Max Pets</Label>
                                <Input
                                    id="max_pets"
                                    type="number"
                                    min="1"
                                    value={serviceForm.max_pets}
                                    onChange={(event) => setServiceForm({ ...serviceForm, max_pets: event.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sort_order">Sort Order</Label>
                                <Input
                                    id="sort_order"
                                    type="number"
                                    value={serviceForm.sort_order}
                                    onChange={(event) => setServiceForm({ ...serviceForm, sort_order: event.target.value })}
                                />
                            </div>
                            <DateRestrictionFields
                                disabled={!dateRestrictionSupported}
                                form={serviceForm}
                                idPrefix="service"
                                onChange={setServiceForm}
                            />
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowAdminForm(false)} type="button">
                                Cancel
                            </Button>
                            <Button onClick={handleSaveSpecialService} disabled={isSavingService} type="button">
                                {isSavingService ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Service"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open);
                    if (!open) {
                        setEditingService(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Special Service</DialogTitle>
                        <DialogDescription>
                            Update the service information shown to pet owners.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_service_code">Service Code</Label>
                            <Input
                                id="edit_service_code"
                                value={editServiceForm.service_code}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, service_code: event.target.value })}
                                placeholder="kapon, special-surgery, grooming-plus"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_service_title">Title *</Label>
                            <Input
                                id="edit_service_title"
                                value={editServiceForm.service_title}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, service_title: event.target.value })}
                                placeholder="Kapon (Spay/Neuter)"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="edit_service_description">Short Description</Label>
                            <Input
                                id="edit_service_description"
                                value={editServiceForm.service_description}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, service_description: event.target.value })}
                                placeholder="Surgical sterilization procedure"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="edit_service_details">Details / Format</Label>
                            <Textarea
                                id="edit_service_details"
                                value={editServiceForm.service_details}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, service_details: event.target.value })}
                                rows={4}
                                placeholder="Details, preparation notes, or requirements"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_price_label">Price Label</Label>
                            <Input
                                id="edit_price_label"
                                value={editServiceForm.price_label}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, price_label: event.target.value })}
                                placeholder="Free or PHP 5,000 - PHP 15,000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_duration_label">Duration Label</Label>
                            <Input
                                id="edit_duration_label"
                                value={editServiceForm.duration_label}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, duration_label: event.target.value })}
                                placeholder="2-3 hours"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_max_pets">Max Pets</Label>
                            <Input
                                id="edit_max_pets"
                                type="number"
                                min="1"
                                value={editServiceForm.max_pets}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, max_pets: event.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_sort_order">Sort Order</Label>
                            <Input
                                id="edit_sort_order"
                                type="number"
                                value={editServiceForm.sort_order}
                                onChange={(event) => setEditServiceForm({ ...editServiceForm, sort_order: event.target.value })}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="edit_is_active">Availability</Label>
                            <Select
                                value={editServiceForm.is_active ? "active" : "disabled"}
                                onValueChange={(value) => setEditServiceForm({ ...editServiceForm, is_active: value === "active" })}
                            >
                                <SelectTrigger id="edit_is_active">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active / Being served</SelectItem>
                                    <SelectItem value="disabled">Disabled / Not being served</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DateRestrictionFields
                            disabled={!dateRestrictionSupported}
                            form={editServiceForm}
                            idPrefix="edit_service"
                            onChange={setEditServiceForm}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)} type="button">
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateSpecialService} disabled={isUpdatingService} type="button">
                            {isUpdatingService ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update Service"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(availabilityDialogService)}
                onOpenChange={(open) => {
                    if (!open) {
                        setAvailabilityDialogService(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {availabilityDialogService?.isActive === false ? "Enable Special Service" : "Disable Special Service"}
                        </DialogTitle>
                        <DialogDescription>
                            {availabilityDialogService?.isActive === false
                                ? `Enable ${availabilityDialogService?.serviceTitle || "this service"} so pet owners can book it again.`
                                : `Disable ${availabilityDialogService?.serviceTitle || "this service"} so pet owners cannot book it while it is not being served.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAvailabilityDialogService(null)} type="button">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={isUpdatingService}
                            className={availabilityDialogService?.isActive === false ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}
                            onClick={() => handleToggleServiceActive(availabilityDialogService)}
                        >
                            {isUpdatingService ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : availabilityDialogService?.isActive === false ? (
                                "Enable Service"
                            ) : (
                                "Disable Service"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Available Special Services
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingServices ? (
                        <div className="py-10 text-center text-gray-500">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            <p className="mt-2">Loading special services...</p>
                        </div>
                    ) : services.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
                            No special services are available yet.
                            {isAdminUser && <p className="mt-1 text-sm text-gray-500">Use the add form above to create the first one.</p>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {services.map((service) => {
                                const Icon = getServiceIcon(service);
                                const isSelected = selectedServiceIds.includes(String(service.id));
                                const remainingSlots = Number(service.remainingSlots ?? service.maxPets ?? 0);
                                const isInactive = service.isActive === false;
                                const isFullyBooked = remainingSlots <= 0;
                                const isDisabled = isInactive || isFullyBooked;

                                return (
                                    <div
                                        key={service.id}
                                        role={isDisabled ? undefined : "button"}
                                        tabIndex={isDisabled ? undefined : 0}
                                        onClick={() => toggleService(service)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                toggleService(service);
                                            }
                                        }}
                                        className={`rounded-xl border p-4 transition-all ${
                                            isSelected
                                                ? "border-purple-500 bg-purple-50"
                                                : isDisabled
                                                    ? "border-gray-200 bg-gray-50 opacity-75"
                                                    : "cursor-pointer border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{service.serviceTitle}</h3>
                                                        {service.serviceDescription && (
                                                            <p className="mt-1 text-sm text-gray-600">{service.serviceDescription}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                                        {!isDisabled && (
                                                            <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                                                {remainingSlots} left
                                                            </span>
                                                        )}
                                                        {isInactive && (
                                                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                                Disabled
                                                            </span>
                                                        )}
                                                        {!isInactive && isFullyBooked && (
                                                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                                                Fully booked
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {service.serviceDetails && (
                                                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{service.serviceDetails}</p>
                                                )}

                                                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                                                    <p><span className="font-semibold">Price:</span> {formatCurrencyLabel(service.priceLabel)}</p>
                                                    <p><span className="font-semibold">Duration:</span> {service.durationLabel || "To be announced"}</p>
                                                    <p><span className="font-semibold">Capacity:</span> {service.bookedPets || 0}/{service.maxPets || 1} pet slots booked</p>
                                                    <p><span className="font-semibold">Dates:</span> {getDateRestrictionLabel(service)}</p>
                                                </div>

                                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-2 text-sm font-medium">
                                                        {isSelected ? (
                                                            <span className="inline-flex items-center gap-2 text-purple-700">
                                                                <Check className="h-4 w-4" />
                                                                Selected
                                                            </span>
                                                        ) : isInactive ? (
                                                            <span className="text-slate-500">Not currently being served</span>
                                                        ) : isFullyBooked ? (
                                                            <span className="text-red-600">No pet slots remaining</span>
                                                        ) : (
                                                            <span className="text-slate-500">Click this card to select</span>
                                                        )}
                                                    </div>

                                                    {isAdminUser && (
                                                        <div className="flex flex-wrap justify-end gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    openEditService(service);
                                                                }}
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className={isDisabled ? "border-green-200 text-green-700 hover:bg-green-50" : "border-red-200 text-red-700 hover:bg-red-50"}
                                                                disabled={isUpdatingService}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setAvailabilityDialogService(service);
                                                                }}
                                                            >
                                                                {isInactive ? "Enable" : "Disable"}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Selected Service</CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedServices.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                            Select one service from the catalog above.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedServices.map((service) => (
                                <div key={service.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div>
                                        <p className="font-semibold text-gray-900">{service.serviceTitle}</p>
                                        <p className="text-sm text-gray-600">{service.serviceDescription}</p>
                                        <p className="mt-1 text-sm text-gray-600">
                                            {service.remainingSlots ?? service.maxPets ?? 1} pet slot{Number(service.remainingSlots ?? service.maxPets ?? 1) === 1 ? "" : "s"} remaining
                                        </p>
                                        <p className="text-sm text-gray-600">{getDateRestrictionLabel(service)}</p>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleService(service)}>
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Booking Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <Label>Select Pet(s)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsNewPet((current) => !current);
                                        setSelectedPetIds([]);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {isNewPet ? "Use Registered Pets" : "Add New Pet"}
                                </Button>
                            </div>

                            {isNewPet ? (
                                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="newPetName">Pet Name *</Label>
                                            <Input id="newPetName" value={newPetName} onChange={(e) => setNewPetName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPetSpecies">Species *</Label>
                                            <Select value={newPetSpecies} onValueChange={setNewPetSpecies}>
                                                <SelectTrigger id="newPetSpecies">
                                                    <SelectValue placeholder="Select species" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Dog">Dog</SelectItem>
                                                    <SelectItem value="Cat">Cat</SelectItem>
                                                    <SelectItem value="Bird">Bird</SelectItem>
                                                    <SelectItem value="Rabbit">Rabbit</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPetBreed">Breed</Label>
                                            <Input id="newPetBreed" value={newPetBreed} onChange={(e) => setNewPetBreed(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPetAge">Age *</Label>
                                            <Input id="newPetAge" value={newPetAge} onChange={(e) => setNewPetAge(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPetWeight">Weight</Label>
                                            <Input id="newPetWeight" value={newPetWeight} onChange={(e) => setNewPetWeight(e.target.value)} />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="newPetMedicalConditions">Medical Conditions</Label>
                                            <Textarea
                                                id="newPetMedicalConditions"
                                                value={newPetMedicalConditions}
                                                onChange={(e) => setNewPetMedicalConditions(e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {isLoadingPets ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-gray-600 md:col-span-2">
                                            Loading pets...
                                        </div>
                                    ) : pets.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-gray-600 md:col-span-2">
                                            No registered pets found.
                                        </div>
                                    ) : (
                                        pets.map((pet) => {
                                            const isSelected = selectedPetIds.includes(String(pet.id));
                                            return (
                                                <button
                                                    key={pet.id}
                                                    type="button"
                                                    onClick={() => togglePet(pet.id)}
                                                    className={`rounded-xl border p-4 text-left transition-all ${
                                                        isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                                            <PawPrint className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold text-gray-900">{pet.name}</p>
                                                            <p className="text-sm text-gray-600">
                                                                {pet.species || "Unknown"} {pet.breed ? `- ${pet.breed}` : ""}
                                                            </p>
                                                        </div>
                                                        <div className="flex h-5 w-5 items-center justify-center rounded border border-gray-300">
                                                            {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="serviceDate">Announced Service Date *</Label>
                            <Input
                                id="serviceDate"
                                type="date"
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                min={serviceDateMin}
                                max={serviceDateMax}
                            />
                            <p className="text-sm text-gray-600">
                                {selectedService ? getDateRestrictionLabel(selectedService) : "Choose the announced clinic date for the selected special service."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Additional Notes</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                                placeholder="Special instructions, concerns, or preparation notes."
                            />
                        </div>

                        <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="pt-4">
                                <p className="font-semibold text-amber-900">Important Notice</p>
                                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                                    <li>- Special services require admin approval.</li>
                                    <li>- The service list is managed from the database.</li>
                                    <li>- The clinic may contact you for preparation instructions.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || isLoadingServices}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit Special Service Booking"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
