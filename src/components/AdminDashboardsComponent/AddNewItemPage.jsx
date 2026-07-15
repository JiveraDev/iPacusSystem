import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Upload, X, Plus } from 'lucide-react';
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

const DEFAULT_UNITS = ['pcs', 'boxes', 'bottles', 'vials', 'bags', 'kg', 'liters'];
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
    .sort((a, b) => a.localeCompare(b));
}

function hasOption(options, value) {
  const normalized = cleanText(value).toLowerCase();
  return Boolean(normalized) && options.some((option) => option.toLowerCase() === normalized);
}

function codePart(value, length, fallback) {
  const cleaned = cleanText(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || fallback;
  return cleaned.padEnd(length, fallback).slice(0, length);
}

function generatedCodes({ productName, category, brand, quantity }) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const sku = [
    codePart(category, 3, 'INV'),
    codePart(brand || productName, 3, 'GEN'),
    codePart(productName, 4, 'ITEM'),
    stamp
  ].join('-');
  const batchNumber = quantity > 0
    ? ['BCH', codePart(productName, 4, 'ITEM'), stamp].join('-')
    : '';

  return { sku, batchNumber };
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
  const [variants, setVariants] = useState([]);
  const [newVariant, setNewVariant] = useState('');
  const [meta, setMeta] = useState({ locations: [], brands: [], units: [] });
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('');
  const [locationName, setLocationName] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInventoryMeta()
      .then((data) => setMeta({
        locations: data.locations || [],
        brands: data.brands || [],
        units: data.units || []
      }))
      .catch((error) => setErrorMessage(error.message || 'Failed to load inventory options.'));
  }, []);

  useEffect(() => () => {
    if (productImage?.previewUrl) {
      URL.revokeObjectURL(productImage.previewUrl);
    }
  }, [productImage?.previewUrl]);

  const brandOptions = useMemo(() => uniqueOptionNames(meta.brands), [meta.brands]);
  const locationOptions = useMemo(() => uniqueOptionNames(meta.locations), [meta.locations]);
  const unitOptions = useMemo(() => uniqueOptionNames([...DEFAULT_UNITS, ...meta.units]), [meta.units]);

  const clearPendingReview = () => {
    if (pendingItem) {
      setPendingItem(null);
    }
  };

  const handleProductImageFiles = (files) => {
    const [file] = Array.from(files || []);
    if (!file) return;

    setErrorMessage('');

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Product image must be a JPG, PNG, or another image file.');
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      setErrorMessage('Product image must be 5MB or smaller.');
      return;
    }

    setProductImage({
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file)
    });
    setPendingItem(null);
  };

  const handleRemoveProductImage = () => {
    setProductImage(null);
    setViewerImage(null);
    setPendingItem(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');

    const formData = new FormData(event.currentTarget);
    const currentUser = getCurrentUser();

    try {
      const productName = cleanText(formData.get('productName'));
      const description = cleanText(formData.get('description'));
      const barcode = cleanText(formData.get('barcode'));
      const selectedBrand = cleanText(brand);
      const selectedUnit = cleanText(unit);
      const selectedLocation = cleanText(locationName);
      const quantity = Number(formData.get('quantity') || 0);
      const reorderLevel = Number(formData.get('reorderLevel') || 0);
      const unitCost = Number(formData.get('costPrice') || 0);
      const expiryDate = cleanText(formData.get('expiryDate'));
      const warningDays = Number(formData.get('warningDays') || 90);

      if (!productName) throw new Error('Product name is required.');
      if (!category) throw new Error('Category is required.');
      if (!selectedUnit) throw new Error('Unit is required.');
      if (!selectedLocation) throw new Error('Inventory location is required.');
      if (Number.isNaN(quantity) || quantity < 0) throw new Error('Quantity must be zero or higher.');
      if (Number.isNaN(unitCost) || unitCost < 0) throw new Error('Unit cost must be zero or higher.');
      if (Number.isNaN(reorderLevel) || reorderLevel < 0) throw new Error('Reorder level must be zero or higher.');
      if (Number.isNaN(warningDays) || warningDays < 1) throw new Error('Expiry warning days must be at least 1.');

      const codes = generatedCodes({
        productName,
        category,
        brand: selectedBrand,
        quantity
      });

      const payload = {
        user_id: currentUser?.id || currentUser?.user_id,
        item_name: productName,
        sku: codes.sku,
        barcode: barcode || null,
        description: description || null,
        category,
        brand: selectedBrand || null,
        unit: selectedUnit,
        location_name: selectedLocation,
        quantity,
        batch_number: codes.batchNumber || null,
        reorder_level: reorderLevel,
        unit_cost: unitCost,
        expiry_date: expiryDate || null,
        expiry_warning_days: warningDays,
        profile_image_path: ''
      };

      setPendingItem({
        payload,
        summary: {
          productName,
          description,
          barcode,
          category,
          brand: selectedBrand,
          unit: selectedUnit,
          locationName: selectedLocation,
          quantity,
          reorderLevel,
          unitCost,
          expiryDate,
          warningDays,
          sku: codes.sku,
          batchNumber: codes.batchNumber,
          imageName: productImage?.name || '',
          imagePreviewUrl: productImage?.previewUrl || ''
        }
      });
    } catch (error) {
      setPendingItem(null);
      setErrorMessage(error.message || 'Please review the item details.');
    }
  };

  const handleConfirmAddItem = async () => {
    if (!pendingItem) return;

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      let profileImagePath = pendingItem.payload.profile_image_path;
      if (productImage?.file) {
        const uploadResult = await uploadInventoryFile(productImage.file, 'inventory_item');
        profileImagePath = uploadResult.relative_url || uploadResult.url || '';
      }

      await createInventoryItem({
        ...pendingItem.payload,
        profile_image_path: profileImagePath
      });
      toast.success(`${pendingItem.summary.productName} added to inventory.`);
      navigate('/dashboard/inventory');
    } catch (error) {
      const message = error.message || 'Failed to add inventory item.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVariant = () => {
    if (newVariant.trim()) {
      setVariants([...variants, newVariant.trim()]);
      setNewVariant('');
      setPendingItem(null);
    }
  };

  const handleRemoveVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
    setPendingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/inventory')}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828]">
            Add New Inventory Item
          </h2>
          <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
            Fill in the details to add a new item to inventory
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-[10px] border border-[#fecdca] bg-[#fffbfa] p-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#b42318]">
          {errorMessage}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit} onChange={clearPendingReview}>
        <datalist id="inventory-brand-options">
          {brandOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="inventory-unit-options">
          {unitOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="inventory-location-options">
          {locationOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="images" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Product Image
              </Label>
              <label
                htmlFor="images"
                className="block border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[10px] p-4 text-center hover:border-[#155dfc] transition-colors cursor-pointer sm:p-8"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleProductImageFiles(event.dataTransfer.files);
                }}
              >
                <Upload className="size-8 text-[#4a5565] mx-auto mb-3" />
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                  PNG, JPG, or WEBP up to 5MB
                </p>
                <input
                  type="file"
                  id="images"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    handleProductImageFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>

              {productImage && (
                <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-[#f9fafb] p-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white"
                    onClick={() => setViewerImage({ src: productImage.previewUrl, alt: productImage.name })}
                  >
                    <img src={productImage.previewUrl} alt={productImage.name} className="size-full object-cover" />
                  </button>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{productImage.name}</p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">{formatFileSize(productImage.size)}</p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#155dfc]">Click thumbnail to view full image.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveProductImage}
                  >
                    <X className="size-4 mr-2" />
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="productName" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Product Name *
              </Label>
              <Input
                id="productName"
                name="productName"
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Enter product description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="skuPreview" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                SKU
              </Label>
              <Input
                id="skuPreview"
                value={pendingItem?.summary.sku || 'Auto-generated after review'}
                readOnly
              />
            </div>

            <div>
              <Label htmlFor="barcode" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Barcode
              </Label>
              <Input
                id="barcode"
                name="barcode"
                placeholder="Optional barcode number"
                restriction="alphanumeric"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Classification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="category" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Category *
              </Label>
              <Select value={category} onValueChange={(value) => {
                setCategory(value);
                setPendingItem(null);
              }}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Medicines">Medicines</SelectItem>
                  <SelectItem value="Vaccines">Vaccines</SelectItem>
                  <SelectItem value="Medical Supplies">Medical Supplies</SelectItem>
                  <SelectItem value="Retail Products">Retail Products</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Consumables">Consumables</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="brand" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Brand
              </Label>
              <Input
                id="brand"
                list="inventory-brand-options"
                placeholder="Type or select a brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="locationName" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Inventory Location *
              </Label>
              <Input
                id="locationName"
                list="inventory-location-options"
                placeholder="Type or select a location"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                required
              />
              <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mt-1">
                New typed locations will be created automatically.
              </p>
            </div>

            <div>
              <Label htmlFor="unit" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Unit *
              </Label>
              <Input
                id="unit"
                list="inventory-unit-options"
                placeholder="Type or select a unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Inventory Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="quantity" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Quantity *
              </Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                placeholder="0"
                min="0"
                restriction="integer"
                required
              />
            </div>

            <div>
              <Label htmlFor="batchPreview" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Batch Number
              </Label>
              <Input
                id="batchPreview"
                value={pendingItem?.summary.batchNumber || 'Auto-generated when quantity is greater than 0'}
                readOnly
              />
            </div>

            <div>
              <Label htmlFor="reorderLevel" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Reorder Level
              </Label>
              <Input
                id="reorderLevel"
                name="reorderLevel"
                type="number"
                placeholder="Minimum quantity"
                min="0"
                restriction="integer"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Cost
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="costPrice" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Unit Cost *
              </Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                restriction="decimal"
                className="pl-12"
                leftIcon={<span className="text-xs font-semibold">PHP</span>}
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Expiry Tracking
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="expiryDate" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Expiry Date
              </Label>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
              />
            </div>

            <div>
              <Label htmlFor="warningDays" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Expiry Warning (Days)
              </Label>
              <Input
                id="warningDays"
                name="warningDays"
                type="number"
                placeholder="90"
                min="1"
                restriction="integer"
              />
              <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mt-1">
                Alert when this many days remain before expiry
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Variants (Optional)
          </h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="e.g., 250mg, 500mg, 1g"
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariant())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddVariant}
              >
                <Plus className="size-4 mr-2" />
                Add
              </Button>
            </div>

            {variants.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className="bg-[#eff6ff] text-[#155dfc] rounded-[8px] px-3 py-2 flex items-center gap-2"
                  >
                    <span className="font-['Arimo:Regular',sans-serif] text-[14px]">
                      {variant}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(index)}
                      className="hover:bg-[#155dfc]/10 rounded-full p-1"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {pendingItem && (
          <div className="bg-white rounded-[14px] border border-[#155dfc] overflow-hidden">
            <div className="bg-[#eff6ff] px-6 py-4 border-b border-[#bfdbfe]">
              <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
                Confirm New Item
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mt-1">
                Review these details before saving the item to inventory.
              </p>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {pendingItem.summary.imagePreviewUrl && (
                <div className="flex flex-col gap-3 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-[#f9fafb] p-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white"
                    onClick={() => setViewerImage({ src: pendingItem.summary.imagePreviewUrl, alt: pendingItem.summary.imageName })}
                  >
                    <img src={pendingItem.summary.imagePreviewUrl} alt={pendingItem.summary.imageName} className="size-full object-cover" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Product Image</p>
                    <p className="truncate font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{pendingItem.summary.imageName}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SummaryValue label="Product" value={pendingItem.summary.productName} />
                <SummaryValue label="SKU" value={pendingItem.summary.sku} />
                <SummaryValue label="Batch" value={pendingItem.summary.batchNumber || 'No starting batch'} />
                <SummaryValue label="Category" value={pendingItem.summary.category} />
                <SummaryValue label="Brand" value={pendingItem.summary.brand || 'No brand'} />
                <SummaryValue label="Unit" value={pendingItem.summary.unit} />
                <SummaryValue label="Location" value={pendingItem.summary.locationName} />
                <SummaryValue label="Starting Qty" value={pendingItem.summary.quantity} />
                <SummaryValue label="Unit Cost" value={formatMoney(pendingItem.summary.unitCost)} />
                <SummaryValue label="Reorder Level" value={pendingItem.summary.reorderLevel} />
                <SummaryValue label="Barcode" value={pendingItem.summary.barcode || 'No barcode'} />
                <SummaryValue label="Expiry" value={formatDisplayDate(pendingItem.summary.expiryDate, { fallback: 'No expiry date' })} />
              </div>

              <div className="rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] p-4 font-['Arimo:Regular',sans-serif] text-[13px] text-[#1e3a8a]">
                {!hasOption(locationOptions, pendingItem.summary.locationName) && (
                  <p>A new inventory location named {pendingItem.summary.locationName} will be created.</p>
                )}
                {pendingItem.summary.brand && !hasOption(brandOptions, pendingItem.summary.brand) && (
                  <p>This brand will be saved as a new brand value for future autocomplete.</p>
                )}
                {!hasOption(unitOptions, pendingItem.summary.unit) && (
                  <p>This unit will be saved as a new unit value for future autocomplete.</p>
                )}
                <p>No data will be saved until you confirm.</p>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingItem(null)}
                  disabled={isSubmitting}
                >
                  Edit Details
                </Button>
                <Button
                  type="button"
                  className="bg-[#155dfc] hover:bg-[#0d4acf]"
                  onClick={handleConfirmAddItem}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Confirm and Save Item'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard/inventory')}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            className="bg-[#155dfc] hover:bg-[#0d4acf]"
            disabled={isSubmitting}
          >
            {pendingItem ? 'Update Review' : 'Review Details'}
          </Button>
        </div>
      </form>
      <PhotoViewer
        src={viewerImage?.src}
        alt={viewerImage?.alt}
        open={!!viewerImage}
        onOpenChange={() => setViewerImage(null)}
      />
    </div>
  );
}

function SummaryValue({ label, value }) {
  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
      <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">{label}</p>
      <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] break-words">{value}</p>
    </div>
  );
}
