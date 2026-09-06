import { useEffect, useState } from 'react';
import { ArrowLeft, Minus, PackageCheck, Plus, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useNavigate } from '../dashboardRouter.jsx';
import { createStockReceipt, fetchInventoryItems, fetchInventoryMeta, getCurrentUser, uploadInventoryFile } from '../../services/inventoryApi';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import InventoryResponsibilityDialog from './InventoryResponsibilityDialog.jsx';
import InventoryLocationFields from './InventoryLocationFields.jsx';
import { DEFAULT_STORAGE_AREA } from './inventoryLocationUtils.js';

const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024;

const emptyStockInItem = () => ({
  productId: '',
  productName: '',
  supplier: '',
  supplierName: '',
  locationId: '',
  locationName: '',
  storageArea: DEFAULT_STORAGE_AREA,
  quantity: 0,
  expiryDate: '',
  unitCost: '',
  sellingPrice: ''
});

const NEW_SUPPLIER_PREFIX = 'new-supplier:';

function newSupplierValue(name) {
  return `${NEW_SUPPLIER_PREFIX}${name}`;
}

function isNewSupplierValue(value) {
  return String(value || '').startsWith(NEW_SUPPLIER_PREFIX);
}

function supplierDisplayName(item, suppliers) {
  if (item.supplierName) {
    return item.supplierName;
  }

  return suppliers.find((supplier) => String(supplier.id) === String(item.supplier))?.name || '';
}

function formatInventoryQuantity(inventoryItem) {
  if (!inventoryItem) return 'Select product first';
  return `${inventoryItem.quantity ?? 0} ${inventoryItem.unit || ''}`.trim();
}

function formatFileSize(size) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StockInPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([emptyStockInItem()]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResponsibilityOpen, setIsResponsibilityOpen] = useState(false);

  const loadStockInData = async ({ isAutoRefresh = false } = {}) => {
    if (!isAutoRefresh) {
      setErrorMessage('');
    }

    try {
      const [itemsData, metaData] = await Promise.all([fetchInventoryItems(), fetchInventoryMeta()]);
      setInventoryItems(itemsData.items || []);
      setSuppliers(metaData.suppliers || []);
      setLocations(metaData.locations || []);
    } catch (error) {
      if (!isAutoRefresh) {
        setErrorMessage(error.message || 'Failed to load stock-in data.');
      }
    }
  };

  useAutoRefresh(loadStockInData);

  useEffect(() => () => {
    if (receiptFile?.previewUrl) {
      URL.revokeObjectURL(receiptFile.previewUrl);
    }
  }, [receiptFile?.previewUrl]);

  const handleAddItem = () => {
    setItems([...items, emptyStockInItem()]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const handleSupplierSelect = (index, value) => {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, supplier: value, supplierName: '' }
        : item
    )));
  };

  const handleSupplierCreate = (index, supplierName) => {
    const cleanName = String(supplierName || '').trim();
    if (!cleanName) return;

    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, supplier: newSupplierValue(cleanName), supplierName: cleanName }
        : item
    )));
  };

  const getInventoryItem = (productId) => (
    inventoryItems.find((inventoryItem) => String(inventoryItem.itemId) === String(productId))
  );

  const handleProductSelect = (index, value) => {
    const selectedItem = getInventoryItem(value);
    const defaultLocation = locations.find((location) => String(location.id) === String(selectedItem?.locationId));

    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index
        ? {
          ...item,
          productId: value,
          productName: selectedItem?.name || '',
          locationId: defaultLocation ? String(defaultLocation.id) : '',
          locationName: defaultLocation?.name || selectedItem?.locationName || '',
          storageArea: defaultLocation?.storageArea || selectedItem?.storageArea || DEFAULT_STORAGE_AREA,
          unitCost: String(selectedItem?.costPrice ?? ''),
          sellingPrice: String(selectedItem?.sellingPrice ?? selectedItem?.costPrice ?? '')
        }
      : item
    )));
  };

  const handleLocationChange = (index, nextLocation) => {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...nextLocation } : item
    )));
  };

  const handleReceiptFiles = (files) => {
    const [file] = Array.from(files || []);
    if (!file) return;

    setErrorMessage('');

    const isSupportedType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isSupportedType) {
      setErrorMessage('Invoice / receipt must be an image or PDF file.');
      return;
    }

    if (file.size > MAX_RECEIPT_FILE_SIZE) {
      setErrorMessage('Invoice / receipt must be 10MB or smaller.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    setReceiptFile({
      file,
      name: file.name,
      size: file.size,
      isImage,
      previewUrl: isImage ? URL.createObjectURL(file) : ''
    });
  };

  const handleRemoveReceiptFile = () => {
    setReceiptFile(null);
    setViewerImage(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');

    try {
      const incompleteIndex = items.findIndex((item) => (
        !item.productId ||
        (!item.supplier && !item.supplierName) ||
        !item.locationName ||
        !item.storageArea ||
        item.quantity <= 0 ||
        item.unitCost === '' ||
        !Number.isFinite(Number(item.unitCost)) ||
        Number(item.unitCost) < 0 ||
        item.sellingPrice === '' ||
        !Number.isFinite(Number(item.sellingPrice)) ||
        Number(item.sellingPrice) < 0
      ));

      if (incompleteIndex >= 0) {
        throw new Error(`Complete all required fields for Item #${incompleteIndex + 1}.`);
      }

      setIsResponsibilityOpen(true);
    } catch (error) {
      const message = error.message || 'Please review the stock-in receipt.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleConfirmStockIn = async (confirmation) => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {

      const currentUser = getCurrentUser();
      let proofImagePath = '';
      if (receiptFile?.file) {
        const uploadResult = await uploadInventoryFile(receiptFile.file, 'inventory_receipt');
        proofImagePath = uploadResult.relative_url || uploadResult.url || '';
      }

      await createStockReceipt({
        user_id: currentUser?.id || currentUser?.user_id,
        receiving_date: receivingDate,
        delivery_note_number: deliveryNote,
        proof_image_path: proofImagePath,
        notes,
        ...confirmation,
        items: items.map((item) => {
          const selectedItem = inventoryItems.find((inventoryItem) => String(inventoryItem.itemId) === String(item.productId));
          return {
            item_id: item.productId,
            supplier_id: isNewSupplierValue(item.supplier) ? null : item.supplier,
            supplier_name: item.supplierName || null,
            location_id: item.locationId || null,
            location_name: item.locationName,
            storage_area: item.storageArea,
            quantity_received: item.quantity,
            expiry_date: item.expiryDate || null,
            unit_cost: Number(item.unitCost || selectedItem?.costPrice || 0),
            selling_price: Number(item.sellingPrice || selectedItem?.sellingPrice || selectedItem?.costPrice || 0)
          };
        })
      });
      toast.success(`Stock-in recorded for ${items.length} item${items.length === 1 ? '' : 's'}.`);
      setIsResponsibilityOpen(false);
      navigate('/dashboard/inventory');
    } catch (error) {
      const message = error.message || 'Failed to record stock in.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedItems = items.map((item, index) => ({ item, index })).reverse();
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const supplierCount = new Set(items.map((item) => item.supplierName || item.supplier).filter(Boolean)).size;
  const locationCount = new Set(items.map((item) => `${item.locationName}/${item.storageArea}`).filter((value) => value !== '/')).size;
  const completedItems = items.filter((item) => (
    item.productId &&
    (item.supplier || item.supplierName) &&
    item.locationName &&
    item.storageArea &&
    item.quantity > 0 &&
    item.unitCost !== '' && Number(item.unitCost) >= 0 &&
    item.sellingPrice !== '' && Number(item.sellingPrice) >= 0
  )).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <DashboardPageHeader
        icon={PackageCheck}
        title="Receive stock"
        description="Record a delivery with simple product, quantity, location, and pricing details."
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

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Receiving Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Upload className="size-5" /></div>
            <div><h2 className="text-base font-bold text-slate-950 dark:text-slate-100">Delivery details</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Basic reference information for this receipt.</p></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Receiving Date */}
            <div>
              <Label htmlFor="receivingDate" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Receiving Date *
              </Label>
              <Input
                id="receivingDate"
                type="date"
                value={receivingDate}
                onChange={(event) => setReceivingDate(event.target.value)}
                required
              />
            </div>

            {/* Delivery Note Number */}
            <div>
              <Label htmlFor="deliveryNote" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Delivery reference
              </Label>
              <Input
                id="deliveryNote"
                placeholder="Optional invoice or delivery number"
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                restriction="alphanumeric"
              />
            </div>

            {/* Received By */}
            <div>
              <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">Received by</Label>
              <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {(() => { const currentUser = getCurrentUser(); return [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || 'Logged-in staff'; })()}
              </div>
            </div>

            {/* Storage Location */}

          </div>
        </div>

        {/* Items to Receive */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-base font-bold text-slate-950 dark:text-slate-100">Products in this delivery</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add one card per product. Internal batch codes are created automatically.</p></div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
            >
              <Plus className="size-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {displayedItems.map(({ item, index }) => {
              const selectedInventoryItem = getInventoryItem(item.productId);
              return (
              <div
                key={index}
                className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    Product {index + 1}
                  </p>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Minus className="size-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-8">
                  {/* Product Selection */}
                  <div className="lg:col-span-4">
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Product *
                    </Label>
                    <Select
                      value={item.productId}
                      onValueChange={(value) => handleProductSelect(index, value)}
                      searchPlaceholder="Search product, brand, or category"
                      required
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select product"
                          displayValue={selectedInventoryItem ? `${selectedInventoryItem.name} · ${formatInventoryQuantity(selectedInventoryItem)}` : undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((inventoryItem) => (
                          <SelectItem
                            key={inventoryItem.itemId}
                            value={String(inventoryItem.itemId)}
                            searchText={[
                              inventoryItem.name,
                              inventoryItem.brand,
                              inventoryItem.location,
                              inventoryItem.category,
                              inventoryItem.unit
                            ].filter(Boolean).join(' ')}
                          >
                            <div className="flex flex-col">
                              <span>{inventoryItem.name}</span>
                              <span className="font-['Arimo:Regular',sans-serif] text-[11px] text-[#4a5565]">
                                {[inventoryItem.brand || 'No brand', inventoryItem.category, `Current: ${formatInventoryQuantity(inventoryItem)}`].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Supplier */}
                  <div className="lg:col-span-4">
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Supplier *
                    </Label>
                    <Select
                      value={item.supplier}
                      onValueChange={(value) => handleSupplierSelect(index, value)}
                      searchPlaceholder="Search or type supplier"
                      emptyMessage="No supplier found."
                      allowCustom
                      customOptionLabel={(supplierName) => `Add supplier "${supplierName}"`}
                      onCreateOption={(supplierName) => handleSupplierCreate(index, supplierName)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select supplier"
                          displayValue={supplierDisplayName(item, suppliers)}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={String(supplier.id)} searchText={supplier.name}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-8">
                    <InventoryLocationFields
                      locations={locations}
                      locationName={item.locationName}
                      storageArea={item.storageArea}
                      onChange={(nextLocation) => handleLocationChange(index, nextLocation)}
                      disabled={!selectedInventoryItem}
                      idPrefix={`stock-in-${index}`}
                      compact
                    />
                  </div>

                  {/* Quantity */}
                  <div className="lg:col-span-2">
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Quantity Received *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      restriction="integer"
                      required
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="lg:col-span-2">
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Expiry date
                    </Label>
                    <Input
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave blank for non-expiring stock.</p>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="mb-2 block text-sm font-bold">Unit cost *</Label>
                    <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => handleItemChange(index, 'unitCost', event.target.value)} restriction="decimal" leftIcon={<span className="text-xs font-bold">₱</span>} disabled={!selectedInventoryItem} required />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Clinic cost per unit.</p>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="mb-2 block text-sm font-bold">Selling price *</Label>
                    <Input type="number" min="0" step="0.01" value={item.sellingPrice} onChange={(event) => handleItemChange(index, 'sellingPrice', event.target.value)} restriction="decimal" leftIcon={<span className="text-xs font-bold">₱</span>} disabled={!selectedInventoryItem} required />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Client price per unit.</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Invoice Upload */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 sm:p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Supporting Documents
          </h3>

          <div className="space-y-4">
            {/* Invoice Upload */}
            <div>
              <Label htmlFor="invoice" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Invoice / Receipt
              </Label>
              <label
                htmlFor="invoice"
                className="block border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[10px] p-4 text-center hover:border-[#155dfc] transition-colors cursor-pointer sm:p-6"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleReceiptFiles(event.dataTransfer.files);
                }}
              >
                <Upload className="size-6 text-[#4a5565] mx-auto mb-2" />
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                  Click to upload invoice
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                  PDF, JPG, PNG up to 10MB
                </p>
                <input
                  type="file"
                  id="invoice"
                  accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    handleReceiptFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>

              {receiptFile && (
                <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-[#f9fafb] p-3 sm:flex-row sm:items-center">
                  {receiptFile.isImage ? (
                    <button
                      type="button"
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white"
                      onClick={() => setViewerImage({ src: receiptFile.previewUrl, alt: receiptFile.name })}
                    >
                      <img src={receiptFile.previewUrl} alt={receiptFile.name} className="size-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white font-['Arimo:Bold',sans-serif] text-[13px] text-[#4a5565]">
                      PDF
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{receiptFile.name}</p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">{formatFileSize(receiptFile.size)}</p>
                    {receiptFile.isImage && (
                      <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#155dfc]">Click thumbnail to view full image.</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveReceiptFile}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Notes / Remarks
              </Label>
              <Textarea
                id="notes"
                      placeholder="Delivery notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-[14px] border border-[#155dfc] overflow-hidden">
          <div className="bg-[#eff6ff] px-6 py-4 border-b border-[#bfdbfe]">
            <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
              Stock In Summary
            </h3>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-5">
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Line Items</p>
                <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#101828]">{items.length}</p>
              </div>
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Total Units</p>
                <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#101828]">{totalQuantity}</p>
              </div>
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Suppliers</p>
                <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#101828]">{supplierCount}</p>
              </div>
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Locations</p>
                <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#101828]">{locationCount}</p>
              </div>
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4">
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mb-1">Complete</p>
                <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#155dfc]">{completedItems}/{items.length}</p>
              </div>
            </div>

            <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1fr_140px_100px_150px_150px] gap-3 bg-[#f9fafb] px-4 py-2">
                  <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#4a5565]">Product</p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#4a5565]">Brand</p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#4a5565] text-right">Quantity</p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#4a5565]">Supplier</p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#4a5565]">Location</p>
                </div>
                <div className="divide-y divide-[rgba(0,0,0,0.06)]">
                  {items.map((item, index) => {
                    const selectedInventoryItem = getInventoryItem(item.productId);

                    return (
                      <div key={index} className="grid grid-cols-[1fr_140px_100px_150px_150px] gap-3 px-4 py-3">
                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] truncate">
                          {item.productName || `Item #${index + 1}`}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] truncate">
                          {selectedInventoryItem?.brand || 'No brand'}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#101828] text-right">
                          {item.quantity || 0}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] truncate">
                          {supplierDisplayName(item, suppliers) || 'Not selected'}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] truncate">
                          {item.locationName ? `${item.locationName} / ${item.storageArea}` : 'Not selected'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
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
            {isSubmitting ? 'Recording...' : 'Confirm Stock In'}
          </Button>
        </div>
      </form>
      <PhotoViewer
        src={viewerImage?.src}
        alt={viewerImage?.alt}
        open={!!viewerImage}
        onOpenChange={() => setViewerImage(null)}
      />
      <InventoryResponsibilityDialog
        open={isResponsibilityOpen}
        onOpenChange={setIsResponsibilityOpen}
        title="Confirm Stock-In Receipt"
        description="One password confirmation covers every product line in this receipt."
        summary={[
          { label: 'Products', value: `${items.length} line${items.length === 1 ? '' : 's'}` },
          { label: 'Total received', value: `${totalQuantity} units` },
          { label: 'Receiving date', value: receivingDate },
          { label: 'Delivery note', value: deliveryNote || 'Not provided' },
          { label: 'Locations', value: `${locationCount} location${locationCount === 1 ? '' : 's'}` }
        ]}
        confirmLabel="Record receipt"
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmStockIn}
      />
    </div>
  );
}
