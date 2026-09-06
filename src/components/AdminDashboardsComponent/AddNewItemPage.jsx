import { createElement, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Boxes, CircleDollarSign, ImagePlus, PackagePlus, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useNavigate } from '../dashboardRouter.jsx';
import { createInventoryItem, fetchInventoryMeta, getCurrentUser, uploadInventoryFile } from '../../services/inventoryApi';
import { formatDisplayDate } from '../../lib/date';
import { toast } from '../../reusecomponent/toast.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import InventoryResponsibilityDialog from './InventoryResponsibilityDialog.jsx';
import InventoryLocationFields from './InventoryLocationFields.jsx';
import { DEFAULT_STORAGE_AREA } from './inventoryLocationUtils.js';

const DEFAULT_UNITS = ['pcs', 'boxes', 'bottles', 'vials', 'bags', 'kg', 'liters'];
const INVENTORY_CATEGORIES = ['Medicines', 'Vaccines', 'Medical Supplies', 'Retail Products', 'Equipment', 'Consumables'];
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

function cleanText(value) {
    return String(value ?? '').trim();
}

function optionName(option) {
    return typeof option === 'string' ? option : option?.name;
}

function uniqueOptionNames(values) {
    const seen = new Set();
    return values
        .map(optionName)
        .map(cleanText)
        .filter(Boolean)
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((left, right) => left.localeCompare(right));
}

function formatMoney(value) {
    return `PHP ${Number(value || 0).toFixed(2)}`;
}

function formatFileSize(size) {
    if (!size) return '0 KB';
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddNewItemPage() {
    const navigate = useNavigate();
    const [meta, setMeta] = useState({ locations: [], brands: [], units: [] });
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [unit, setUnit] = useState('');
    const [location, setLocation] = useState({ locationName: '', storageArea: DEFAULT_STORAGE_AREA });
    const [productImage, setProductImage] = useState(null);
    const [viewerImage, setViewerImage] = useState(null);
    const [pendingItem, setPendingItem] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResponsibilityOpen, setIsResponsibilityOpen] = useState(false);

    useEffect(() => {
        fetchInventoryMeta()
            .then((data) => setMeta({
                locations: data.locations || [],
                brands: data.brands || [],
                units: data.units || [],
            }))
            .catch((error) => setErrorMessage(error.message || 'Failed to load inventory options.'));
    }, []);

    useEffect(() => () => {
        if (productImage?.previewUrl) URL.revokeObjectURL(productImage.previewUrl);
    }, [productImage?.previewUrl]);

    const brandOptions = useMemo(() => uniqueOptionNames(meta.brands), [meta.brands]);
    const unitOptions = useMemo(() => uniqueOptionNames([...DEFAULT_UNITS, ...meta.units]), [meta.units]);
    const clearReview = () => setPendingItem(null);
    const updateChoice = (setter) => (value) => {
        setter(value);
        clearReview();
    };

    const handleProductImageFiles = (files) => {
        const [file] = Array.from(files || []);
        if (!file) return;
        setErrorMessage('');
        if (!file.type.startsWith('image/')) {
            setErrorMessage('Product image must be a JPG, PNG, or WEBP file.');
            return;
        }
        if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
            setErrorMessage('Product image must be 5MB or smaller.');
            return;
        }
        setProductImage({ file, name: file.name, size: file.size, previewUrl: URL.createObjectURL(file) });
        clearReview();
    };

    const handleRemoveProductImage = () => {
        setProductImage(null);
        setViewerImage(null);
        clearReview();
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setErrorMessage('');
        try {
            const formData = new FormData(event.currentTarget);
            const currentUser = getCurrentUser();
            const productName = cleanText(formData.get('productName'));
            const description = cleanText(formData.get('description'));
            const quantity = Number(formData.get('quantity') || 0);
            const reorderLevel = Number(formData.get('reorderLevel') || 0);
            const unitCost = Number(formData.get('unitCost') || 0);
            const sellingPrice = Number(formData.get('sellingPrice') || 0);
            const expiryDate = cleanText(formData.get('expiryDate'));
            const warningDays = Number(formData.get('warningDays') || 90);

            if (!productName) throw new Error('Product name is required.');
            if (!category) throw new Error('Category is required.');
            if (!unit) throw new Error('Unit is required.');
            if (!location.locationName) throw new Error('Inventory location is required.');
            if (!location.storageArea) throw new Error('Storage area is required.');
            if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Starting quantity must be a whole number of zero or higher.');
            if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Unit cost must be zero or higher.');
            if (!Number.isFinite(sellingPrice) || sellingPrice < 0) throw new Error('Selling price must be zero or higher.');
            if (!Number.isInteger(reorderLevel) || reorderLevel < 0) throw new Error('Reorder level must be a whole number of zero or higher.');
            if (!Number.isInteger(warningDays) || warningDays < 1) throw new Error('Expiry warning days must be at least 1.');

            const payload = {
                user_id: currentUser?.id || currentUser?.user_id,
                item_name: productName,
                description: description || null,
                category,
                brand: brand || null,
                unit,
                location_name: location.locationName,
                storage_area: location.storageArea,
                quantity,
                reorder_level: reorderLevel,
                unit_cost: unitCost,
                selling_price: sellingPrice,
                expiry_date: expiryDate || null,
                expiry_warning_days: warningDays,
                profile_image_path: '',
            };

            setPendingItem({
                payload,
                summary: {
                    productName,
                    category,
                    unit,
                    locationName: location.locationName,
                    storageArea: location.storageArea,
                    quantity,
                    reorderLevel,
                    unitCost,
                    sellingPrice,
                    expiryDate,
                },
            });
        } catch (error) {
            setPendingItem(null);
            setErrorMessage(error.message || 'Please review the item details.');
        }
    };

    const handleConfirmAddItem = async (confirmation) => {
        if (!pendingItem) return;
        setErrorMessage('');
        setIsSubmitting(true);
        try {
            let profileImagePath = pendingItem.payload.profile_image_path;
            if (productImage?.file) {
                const uploadResult = await uploadInventoryFile(productImage.file, 'inventory_item');
                profileImagePath = uploadResult.relative_url || uploadResult.url || '';
            }
            await createInventoryItem({ ...pendingItem.payload, profile_image_path: profileImagePath, ...confirmation });
            toast.success(`${pendingItem.summary.productName} added to inventory.`);
            setIsResponsibilityOpen(false);
            navigate('/dashboard/inventory');
        } catch (error) {
            const message = error.message || 'Failed to add inventory item.';
            setErrorMessage(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <DashboardPageHeader
                icon={PackagePlus}
                title="Add inventory item"
                description="Create the product once. Internal stock codes are generated automatically."
                navigation={(
                    <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/inventory')} className="gap-2">
                        <ArrowLeft className="size-4" />
                        Back to inventory
                    </Button>
                )}
            />

            {errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {errorMessage}
                </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit} onChange={clearReview}>
                <FormSection icon={PackagePlus} title="Product details" description="The information staff will use to identify this item.">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
                        <div className="grid content-start gap-4 sm:grid-cols-2">
                            <Field label="Product name *" htmlFor="productName" className="sm:col-span-2">
                                <Input id="productName" name="productName" placeholder="e.g. Rabies Vaccine" required />
                            </Field>
                            <Field label="Description" htmlFor="description" className="sm:col-span-2">
                                <Textarea id="description" name="description" placeholder="Optional notes that help staff identify the product" rows={3} />
                            </Field>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category *</Label>
                                <Select value={category} onValueChange={updateChoice(setCategory)}>
                                    <SelectTrigger id="category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                                    <SelectContent>{INVENTORY_CATEGORIES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="brand">Brand</Label>
                                <Select value={brand} onValueChange={updateChoice(setBrand)} searchPlaceholder="Search or type a brand" allowCustom customOptionLabel={(value) => `Use new brand “${value}”`} onCreateOption={updateChoice(setBrand)}>
                                    <SelectTrigger id="brand"><SelectValue placeholder="Choose or add brand" displayValue={brand} /></SelectTrigger>
                                    <SelectContent>{brandOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:max-w-xs">
                                <Label htmlFor="unit">Stock unit *</Label>
                                <Select value={unit} onValueChange={updateChoice(setUnit)} searchPlaceholder="Search or type a unit" allowCustom customOptionLabel={(value) => `Use new unit “${value}”`} onCreateOption={updateChoice(setUnit)}>
                                    <SelectTrigger id="unit"><SelectValue placeholder="e.g. pcs or vials" displayValue={unit} /></SelectTrigger>
                                    <SelectContent>{unitOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="productImage">Product image</Label>
                            <label htmlFor="productImage" className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-blue-500 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-blue-950/20" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleProductImageFiles(event.dataTransfer.files); }}>
                                <ImagePlus className="mb-3 size-8 text-slate-400 transition group-hover:text-blue-600" />
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Upload an image</span>
                                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG or WEBP · 5MB max</span>
                                <input id="productImage" type="file" accept="image/*" className="sr-only" onChange={(event) => handleProductImageFiles(event.target.files)} />
                            </label>
                            {productImage && (
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
                                    <button type="button" className="size-14 shrink-0 overflow-hidden rounded-lg" onClick={() => setViewerImage({ src: productImage.previewUrl, alt: productImage.name })}><img src={productImage.previewUrl} alt={productImage.name} className="size-full object-cover" /></button>
                                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{productImage.name}</p><p className="text-xs text-slate-500">{formatFileSize(productImage.size)}</p></div>
                                    <Button type="button" variant="ghost" size="icon" aria-label="Remove product image" onClick={handleRemoveProductImage}><X className="size-4" /></Button>
                                </div>
                            )}
                        </div>
                    </div>
                </FormSection>

                <FormSection icon={Boxes} title="Location" description="Choose a saved place or add a custom room, cabinet, shelf, refrigerator, or display.">
                    <InventoryLocationFields locations={meta.locations} locationName={location.locationName} storageArea={location.storageArea} onChange={(nextLocation) => { setLocation(nextLocation); clearReview(); }} idPrefix="new-item-location" />
                </FormSection>

                <FormSection icon={CircleDollarSign} title="Stock and pricing" description="Only the operational numbers needed to start tracking this product.">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Starting quantity *" htmlFor="quantity"><Input id="quantity" name="quantity" type="number" min="0" placeholder="0" restriction="integer" required /></Field>
                        <Field label="Reorder level" htmlFor="reorderLevel" help="Warn when stock reaches this amount."><Input id="reorderLevel" name="reorderLevel" type="number" min="0" placeholder="0" restriction="integer" /></Field>
                        <Field label="Unit cost *" htmlFor="unitCost" help="What the clinic pays for one unit."><Input id="unitCost" name="unitCost" type="number" min="0" step="0.01" placeholder="0.00" restriction="decimal" leftIcon={<span className="text-xs font-bold">₱</span>} required /></Field>
                        <Field label="Selling price *" htmlFor="sellingPrice" help="What the client is charged for one unit."><Input id="sellingPrice" name="sellingPrice" type="number" min="0" step="0.01" placeholder="0.00" restriction="decimal" leftIcon={<span className="text-xs font-bold">₱</span>} required /></Field>
                        <Field label="Expiry date" htmlFor="expiryDate" help="Leave blank if this item does not expire."><Input id="expiryDate" name="expiryDate" type="date" /></Field>
                        <Field label="Expiry warning" htmlFor="warningDays" help="Days before expiry to show a warning."><Input id="warningDays" name="warningDays" type="number" min="1" defaultValue="90" restriction="integer" /></Field>
                    </div>
                </FormSection>

                {pendingItem && (
                    <div className="overflow-hidden rounded-2xl border border-blue-300 bg-white dark:border-blue-800 dark:bg-slate-950">
                        <div className="border-b border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/30"><h3 className="font-bold text-slate-950 dark:text-slate-100">Ready to add</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Review the useful details below. Internal codes are handled automatically.</p></div>
                        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                            <SummaryValue label="Product" value={pendingItem.summary.productName} />
                            <SummaryValue label="Category" value={pendingItem.summary.category} />
                            <SummaryValue label="Location" value={`${pendingItem.summary.locationName} / ${pendingItem.summary.storageArea}`} />
                            <SummaryValue label="Starting stock" value={`${pendingItem.summary.quantity} ${pendingItem.summary.unit}`} />
                            <SummaryValue label="Unit cost" value={formatMoney(pendingItem.summary.unitCost)} />
                            <SummaryValue label="Selling price" value={formatMoney(pendingItem.summary.sellingPrice)} />
                            <SummaryValue label="Reorder at" value={`${pendingItem.summary.reorderLevel} ${pendingItem.summary.unit}`} />
                            <SummaryValue label="Expiry" value={formatDisplayDate(pendingItem.summary.expiryDate, { fallback: 'No expiry' })} />
                        </div>
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={() => setPendingItem(null)} disabled={isSubmitting}>Edit details</Button>
                            <Button type="button" onClick={() => setIsResponsibilityOpen(true)} disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Confirm and add item'}</Button>
                        </div>
                    </div>
                )}

                <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-950/95">
                    <Button type="button" variant="outline" onClick={() => navigate('/dashboard/inventory')}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{pendingItem ? 'Refresh review' : 'Review item'}</Button>
                </div>
            </form>

            <PhotoViewer src={viewerImage?.src} alt={viewerImage?.alt} open={Boolean(viewerImage)} onOpenChange={() => setViewerImage(null)} />
            <InventoryResponsibilityDialog
                open={isResponsibilityOpen}
                onOpenChange={setIsResponsibilityOpen}
                title="Confirm new inventory product"
                description="Verify the product and initial stock with your account password."
                summary={pendingItem ? [
                    { label: 'Product', value: pendingItem.summary.productName },
                    { label: 'Initial stock', value: `${pendingItem.summary.quantity} ${pendingItem.summary.unit}` },
                    { label: 'Location', value: `${pendingItem.summary.locationName} / ${pendingItem.summary.storageArea}` },
                    { label: 'Unit cost', value: formatMoney(pendingItem.summary.unitCost) },
                    { label: 'Selling price', value: formatMoney(pendingItem.summary.sellingPrice) },
                ] : []}
                confirmLabel="Add product"
                isSubmitting={isSubmitting}
                onConfirm={handleConfirmAddItem}
            />
        </div>
    );
}

function FormSection({ icon, title, description, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-5 flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{createElement(icon, { className: 'size-5' })}</div><div><h2 className="text-base font-bold text-slate-950 dark:text-slate-100">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p></div></div>
            {children}
        </section>
    );
}

function Field({ label, htmlFor, help, className = '', children }) {
    return <div className={`space-y-2 ${className}`}><Label htmlFor={htmlFor}>{label}</Label>{children}{help && <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>}</div>;
}

function SummaryValue({ label, value }) {
    return <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-slate-100">{value}</p></div>;
}
