import { useMemo, useState } from 'react';
import {
    ClipboardList,
    Loader2,
    Package,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { formatPhpCurrency } from '../../lib/currency';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const SERVICE_TYPES = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'grooming', label: 'Grooming' },
    { value: 'boarding', label: 'Boarding' },
    { value: 'dental', label: 'Dental' },
    { value: 'home_service', label: 'Home Service' },
    { value: 'other', label: 'Other' }
];

const BILLABLE_POLICIES = [
    { value: 'included', label: 'Included' },
    { value: 'separate', label: 'Separate' },
    { value: 'optional', label: 'Optional' }
];

const emptyServiceForm = {
    serviceCode: '',
    serviceName: '',
    serviceType: 'consultation',
    basePrice: '0',
    description: '',
    isMajorService: false,
    isActive: true
};

const emptyMaterialDraft = {
    materialName: '',
    qtyUsed: '1',
    billablePolicy: 'included'
};

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function serviceTypeLabel(value) {
    return SERVICE_TYPES.find((type) => type.value === value)?.label || value || 'Other';
}

function policyLabel(value) {
    return BILLABLE_POLICIES.find((policy) => policy.value === value)?.label || value || 'Included';
}

function normalizeInventoryItems(data) {
    return (Array.isArray(data?.items) ? data.items : []).map((item) => ({
        itemId: Number(item.itemId || item.item_id || item.id),
        itemName: item.name || item.item_name || 'Inventory item',
        sku: item.sku || '',
        unit: item.unit || '',
        category: item.category || '',
        costPrice: Number(item.costPrice || item.unit_cost || 0),
        quantity: Number(item.quantity || 0)
    })).filter((item) => item.itemId > 0);
}

function materialKey(material) {
    return String(material.itemId || material.materialName || material.item_name || '');
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export default function ServiceCatalogManagement() {
    const dashboardUser = useDashboardUser();
    const userId = getUserId(dashboardUser);
    const [services, setServices] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('new');
    const [serviceForm, setServiceForm] = useState(emptyServiceForm);
    const [materials, setMaterials] = useState([]);
    const [materialDraft, setMaterialDraft] = useState(emptyMaterialDraft);
    const [searchQuery, setSearchQuery] = useState('');
    const [schemaMessage, setSchemaMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

    const loadCatalog = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }

        try {
            const response = await fetch(`${API_BASE}/service-catalog?includeInactive=1`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load services.');
            }

            if (data.schemaReady === false) {
                setSchemaMessage(data.message || 'Service catalog migration is required.');
                setServices([]);
                return [];
            }

            const nextServices = Array.isArray(data.services) ? data.services : [];
            setSchemaMessage('');
            setServices(nextServices);

            setSelectedServiceId((currentId) => {
                if (currentId === 'new') return currentId;
                const refreshed = nextServices.find((service) => String(service.serviceId) === String(currentId));
                if (refreshed) {
                    setServiceForm(serviceToForm(refreshed));
                    setMaterials(refreshed.materials || []);
                    return currentId;
                }
                return 'new';
            });

            return nextServices;
        } catch (error) {
            if (!isAutoRefresh) {
                setSchemaMessage(error.message || 'Failed to load services.');
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const loadInventory = async () => {
        try {
            const response = await fetch(`${API_BASE}/inventory`);
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setInventoryItems(normalizeInventoryItems(data));
            }
        } catch {
            setInventoryItems([]);
        }
    };

    useAutoRefresh(loadCatalog, { refreshKey: 'service-catalog-management' });
    useAutoRefresh(loadInventory, { intervalMs: 12000, refreshKey: 'service-catalog-inventory' });

    const filteredServices = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return services;

        return services.filter((service) => [
            service.serviceName,
            service.serviceCode,
            service.serviceType,
            service.description
        ].join(' ').toLowerCase().includes(query));
    }, [searchQuery, services]);

    const materialNameQuery = materialDraft.materialName.trim();
    const materialMatches = useMemo(() => {
        const query = normalizeText(materialNameQuery);
        if (!query) return inventoryItems.slice(0, 6);

        return inventoryItems
            .filter((item) => normalizeText(`${item.itemName} ${item.sku} ${item.category}`).includes(query))
            .slice(0, 6);
    }, [inventoryItems, materialNameQuery]);
    const matchedMaterialItem = inventoryItems.find((item) => normalizeText(item.itemName) === normalizeText(materialNameQuery));

    const selectNewService = () => {
        setSelectedServiceId('new');
        setServiceForm(emptyServiceForm);
        setMaterials([]);
        setMaterialDraft(emptyMaterialDraft);
        setIsServiceModalOpen(true);
    };

    const selectService = (service) => {
        setSelectedServiceId(String(service.serviceId));
        setServiceForm(serviceToForm(service));
        setMaterials(service.materials || []);
        setMaterialDraft(emptyMaterialDraft);
        setIsServiceModalOpen(true);
    };

    const updateServiceForm = (field, value) => {
        setServiceForm((current) => {
            const next = { ...current, [field]: value };
            if (field === 'serviceType' && value === 'other') {
                next.isMajorService = false;
            }
            return next;
        });
    };

    const addMaterial = () => {
        const materialName = materialDraft.materialName.trim();
        const matchedItem = matchedMaterialItem || null;
        const itemId = matchedItem?.itemId || null;
        const qtyUsed = Number(materialDraft.qtyUsed);

        if (!materialName) {
            toast.error('Enter a material or medicine name.');
            return;
        }

        if (!Number.isFinite(qtyUsed) || qtyUsed <= 0) {
            toast.error('Material quantity must be greater than 0.');
            return;
        }

        if (materials.some((material) => normalizeText(material.materialName || material.itemName) === normalizeText(materialName))) {
            toast.error('This material is already attached to the service.');
            return;
        }

        setMaterials((current) => [
            ...current,
            {
                serviceMaterialId: `new-${Date.now()}`,
                itemId,
                materialName,
                itemName: matchedItem?.itemName || '',
                sku: matchedItem?.sku || '',
                unit: matchedItem?.unit || '',
                qtyUsed,
                billablePolicy: materialDraft.billablePolicy,
                inventoryStatus: matchedItem ? 'linked' : 'not_in_inventory'
            }
        ]);
        setMaterialDraft(emptyMaterialDraft);
    };

    const removeMaterial = (key) => {
        setMaterials((current) => current.filter((material) => materialKey(material) !== key));
    };

    const saveService = async () => {
        if (!serviceForm.serviceName.trim()) {
            toast.error('Service name is required.');
            return;
        }

        const basePrice = Number(serviceForm.basePrice);
        if (!Number.isFinite(basePrice) || basePrice < 0) {
            toast.error('Base price must be zero or greater.');
            return;
        }

        setIsSaving(true);
        try {
            const isNew = selectedServiceId === 'new';
            const serviceResponse = await fetch(`${API_BASE}/service-catalog${isNew ? '' : `/${selectedServiceId}`}`, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceCode: serviceForm.serviceCode,
                    serviceName: serviceForm.serviceName,
                    serviceType: serviceForm.serviceType,
                    description: serviceForm.description,
                    basePrice,
                    isMajorService: serviceForm.serviceType !== 'other' && serviceForm.isMajorService,
                    isActive: serviceForm.isActive,
                    createdByUserId: userId || null
                })
            });
            const serviceData = await serviceResponse.json().catch(() => ({}));

            if (!serviceResponse.ok || serviceData.success === false) {
                throw new Error(serviceData.message || 'Failed to save service.');
            }

            const serviceId = serviceData.serviceId || selectedServiceId;
            const materialResponse = await fetch(`${API_BASE}/service-catalog/${serviceId}/materials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    materials: materials.map((material) => ({
                        itemId: material.itemId || null,
                        materialName: material.materialName || material.itemName,
                        qtyUsed: material.qtyUsed,
                        billablePolicy: material.billablePolicy
                    }))
                })
            });
            const materialData = await materialResponse.json().catch(() => ({}));

            if (!materialResponse.ok || materialData.success === false) {
                throw new Error(materialData.message || 'Failed to save service materials.');
            }

            toast.success('Service catalog saved.');
            setSelectedServiceId(String(serviceId));
            await loadCatalog();
            setIsServiceModalOpen(false);
        } catch (error) {
            toast.error(error.message || 'Failed to save service catalog.');
        } finally {
            setIsSaving(false);
        }
    };

    const deactivateService = async () => {
        if (selectedServiceId === 'new') return;
        if (!window.confirm('Deactivate this service?')) return;

        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE}/service-catalog/${selectedServiceId}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(data.message || 'Failed to deactivate service.');
            }

            toast.success('Service deactivated.');
            selectNewService();
            setIsServiceModalOpen(false);
            loadCatalog();
        } catch (error) {
            toast.error(error.message || 'Failed to deactivate service.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                            <ClipboardList className="size-6" />
                        </span>
                        <div>
                            <h2 className="text-2xl font-bold text-[#101828]">Service Catalog</h2>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge className="bg-blue-50 text-blue-700">{services.filter((service) => service.isActive).length} active</Badge>
                                <Badge className="bg-slate-100 text-slate-700">{services.length} total</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button type="button" variant="outline" onClick={() => loadCatalog()} disabled={isLoading}>
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Refresh
                        </Button>
                        <Button type="button" onClick={selectNewService} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            <Plus className="size-4" />
                            Add Service
                        </Button>
                    </div>
                </div>
            </section>

            {schemaMessage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {schemaMessage}
                </div>
            )}

            <div className="grid gap-6">
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search service"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="max-h-[720px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex min-h-40 items-center justify-center text-slate-500">
                                <Loader2 className="mr-2 size-5 animate-spin" />
                                Loading services...
                            </div>
                        ) : filteredServices.length === 0 ? (
                            <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center text-slate-500">
                                <ClipboardList className="mb-2 size-8" />
                                <p className="font-semibold">No services found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredServices.map((service) => (
                                    <button
                                        key={service.serviceId}
                                        type="button"
                                        onClick={() => selectService(service)}
                                        className={`block w-full p-4 text-left transition hover:bg-slate-50 ${
                                            String(selectedServiceId) === String(service.serviceId) ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-black text-[#101828]">{service.serviceName}</p>
                                                <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{serviceTypeLabel(service.serviceType)}</p>
                                            </div>
                                            <Badge className={service.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}>
                                                {service.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                                            <span className="font-black text-[#155dfc]">{formatPhpCurrency(service.basePrice)}</span>
                                            <span className="text-xs font-semibold text-slate-500">{service.materials?.length || 0} materials</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
                    <DialogContent className="max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>{selectedServiceId === 'new' ? 'Add Service' : 'Edit Service'}</DialogTitle>
                            <DialogDescription>Set the service details and preset materials used for diagnosis and billing.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-black text-[#101828]">
                                {selectedServiceId === 'new' ? 'New Service' : serviceForm.serviceName || 'Service Details'}
                            </h3>
                            <p className="text-sm font-semibold text-slate-500">Catalog details and preset materials.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedServiceId !== 'new' && (
                                <Button type="button" variant="outline" onClick={deactivateService} disabled={isSaving}>
                                    <Trash2 className="size-4" />
                                    Deactivate
                                </Button>
                            )}
                            <Button type="button" onClick={saveService} disabled={isSaving || Boolean(schemaMessage)} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                Save
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Service Code">
                            <Input
                                value={serviceForm.serviceCode}
                                onChange={(event) => updateServiceForm('serviceCode', event.target.value)}
                                placeholder="Optional code"
                            />
                        </Field>
                        <Field label="Service Name">
                            <Input
                                value={serviceForm.serviceName}
                                onChange={(event) => updateServiceForm('serviceName', event.target.value)}
                                placeholder="Service name"
                            />
                        </Field>
                        <Field label="Service Type">
                            <Select value={serviceForm.serviceType} onValueChange={(value) => updateServiceForm('serviceType', value)}>
                                <SelectTrigger>
                                    <SelectValue displayValue={serviceTypeLabel(serviceForm.serviceType)} />
                                </SelectTrigger>
                                <SelectContent>
                                    {SERVICE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Base Price">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={serviceForm.basePrice}
                                onChange={(event) => updateServiceForm('basePrice', event.target.value)}
                            />
                        </Field>
                        <Field label="Description" className="md:col-span-2">
                            <Textarea
                                value={serviceForm.description}
                                onChange={(event) => updateServiceForm('description', event.target.value)}
                                rows={3}
                            />
                        </Field>
                        <label className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold md:col-span-2 ${
                            serviceForm.serviceType === 'other' ? 'text-slate-400' : 'text-slate-700'
                        }`}>
                            <Checkbox
                                checked={serviceForm.serviceType !== 'other' && serviceForm.isMajorService}
                                onCheckedChange={(checked) => updateServiceForm('isMajorService', checked)}
                                disabled={serviceForm.serviceType === 'other'}
                            />
                            Major service for this service type
                        </label>
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
                            <Checkbox
                                checked={serviceForm.isActive}
                                onCheckedChange={(checked) => updateServiceForm('isActive', checked)}
                            />
                            Active service
                        </label>
                    </div>

                    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="font-black text-[#101828]">Preset Materials</h4>
                                <p className="text-sm font-semibold text-slate-500">Inventory defaults for this service.</p>
                            </div>
                            <Badge className="bg-slate-100 text-slate-700">{materials.length}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_110px_140px_auto]">
                            <div className="space-y-2">
                                <Input
                                    value={materialDraft.materialName}
                                    onChange={(event) => setMaterialDraft((current) => ({ ...current, materialName: event.target.value }))}
                                    placeholder="Type material or medicine"
                                    className="bg-white"
                                />
                                {materialNameQuery && (
                                    <div className="flex flex-wrap gap-2">
                                        <Badge className={matchedMaterialItem ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                                            {matchedMaterialItem ? 'Available in inventory' : 'Not in inventory'}
                                        </Badge>
                                        {materialMatches.map((item) => (
                                            <button
                                                key={item.itemId}
                                                type="button"
                                                onClick={() => setMaterialDraft((current) => ({ ...current, materialName: item.itemName }))}
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-[#155dfc]"
                                            >
                                                {item.itemName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={materialDraft.qtyUsed}
                                onChange={(event) => setMaterialDraft((current) => ({ ...current, qtyUsed: event.target.value }))}
                                className="bg-white"
                            />
                            <Select
                                value={materialDraft.billablePolicy}
                                onValueChange={(value) => setMaterialDraft((current) => ({ ...current, billablePolicy: value }))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue displayValue={policyLabel(materialDraft.billablePolicy)} />
                                </SelectTrigger>
                                <SelectContent>
                                    {BILLABLE_POLICIES.map((policy) => (
                                        <SelectItem key={policy.value} value={policy.value}>{policy.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button type="button" onClick={addMaterial} variant="outline">
                                <Plus className="size-4" />
                                Add
                            </Button>
                        </div>

                        <div className="mt-4 space-y-2">
                            {materials.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                                    No preset materials.
                                </p>
                            ) : (
                                materials.map((material) => (
                                    <div key={materialKey(material)} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Package className="size-4 shrink-0 text-slate-500" />
                                                <p className="truncate font-black text-[#101828]">{material.materialName || material.itemName}</p>
                                                <Badge className={material.itemId ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                                                    {material.itemId ? 'Inventory' : 'Typed'}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                Qty {material.qtyUsed} {material.unit || ''} / {policyLabel(material.billablePolicy)}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeMaterial(materialKey(material))}
                                            className="w-fit text-red-600 hover:bg-red-50 hover:text-red-700"
                                        >
                                            <Trash2 className="size-4" />
                                            Remove
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

function serviceToForm(service) {
    return {
        serviceCode: service.serviceCode || '',
        serviceName: service.serviceName || '',
        serviceType: service.serviceType || 'consultation',
        basePrice: String(service.basePrice ?? 0),
        description: service.description || '',
        isMajorService: Boolean(service.isMajorService),
        isActive: Boolean(service.isActive)
    };
}

function Field({ label, children, className = '' }) {
    return (
        <div className={`space-y-2 ${className}`}>
            <Label className="text-sm font-bold text-slate-900">{label}</Label>
            {children}
        </div>
    );
}
