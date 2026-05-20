import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, Plus, Minus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useNavigate } from '../PetOwnerDashboard/dashboardRouter';
import { createStockReceipt, fetchInventoryItems, fetchInventoryMeta, getCurrentUser, uploadInventoryFile } from '../../services/inventoryApi';

const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024;

const emptyStockInItem = () => ({
  productId: '',
  productName: '',
  supplier: '',
  location: '',
  quantity: 0,
  batchNumber: '',
  expiryDate: ''
});

function getItemLocationOptions(inventoryItem) {
  if (!inventoryItem) return [];

  const locationsById = new Map();
  const addLocation = (id, name) => {
    if (!id || !name) return;
    locationsById.set(String(id), { id: String(id), name });
  };

  addLocation(inventoryItem.locationId, inventoryItem.location);
  (inventoryItem.batches || []).forEach((batch) => addLocation(batch.locationId, batch.location));

  return Array.from(locationsById.values());
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
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchInventoryItems(), fetchInventoryMeta()])
      .then(([itemsData, metaData]) => {
        setInventoryItems(itemsData.items || []);
        setSuppliers(metaData.suppliers || []);
      })
      .catch((error) => setErrorMessage(error.message || 'Failed to load stock-in data.'));
  }, []);

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

  const getInventoryItem = (productId) => (
    inventoryItems.find((inventoryItem) => String(inventoryItem.itemId) === String(productId))
  );

  const handleProductSelect = (index, value) => {
    const selectedItem = getInventoryItem(value);
    const defaultLocation = getItemLocationOptions(selectedItem)[0]?.id || '';

    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index
        ? {
          ...item,
          productId: value,
          productName: selectedItem?.name || '',
          location: defaultLocation
        }
      : item
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const incompleteIndex = items.findIndex((item) => (
        !item.productId ||
        !item.supplier ||
        !item.location ||
        item.quantity <= 0 ||
        !item.batchNumber ||
        !item.expiryDate
      ));

      if (incompleteIndex >= 0) {
        throw new Error(`Complete all required fields for Item #${incompleteIndex + 1}.`);
      }

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
        items: items.map((item) => {
          const selectedItem = inventoryItems.find((inventoryItem) => String(inventoryItem.itemId) === String(item.productId));
          return {
            item_id: item.productId,
            supplier_id: item.supplier,
            location_id: item.location,
            batch_number: item.batchNumber,
            quantity_received: item.quantity,
            expiry_date: item.expiryDate || null,
            unit_cost: selectedItem?.costPrice || 0
          };
        })
      });
      navigate('/dashboard/inventory');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to record stock in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedItems = items.map((item, index) => ({ item, index })).reverse();
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const supplierCount = new Set(items.map((item) => item.supplier).filter(Boolean)).size;
  const locationCount = new Set(items.map((item) => item.location).filter(Boolean)).size;
  const completedItems = items.filter((item) => (
    item.productId &&
    item.supplier &&
    item.location &&
    item.quantity > 0 &&
    item.batchNumber &&
    item.expiryDate
  )).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
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
            Stock In - Receive Inventory
          </h2>
          <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
            Record incoming inventory from supplier deliveries
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-[10px] border border-[#fecdca] bg-[#fffbfa] p-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#b42318]">
          {errorMessage}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Receiving Information */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Receiving Information
          </h3>

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
                Delivery Note #
              </Label>
              <Input
                id="deliveryNote"
                placeholder="DN-2026-001"
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
              />
            </div>

            {/* Received By */}
            <div>
              <Label htmlFor="receivedBy" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Received By *
              </Label>
              <Input
                id="receivedBy"
                placeholder="Staff Name"
                value={(() => {
                  const currentUser = getCurrentUser();
                  return [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || 'Logged-in staff';
                })()}
                readOnly
                required
              />
            </div>

            {/* Storage Location */}

          </div>
        </div>

        {/* Items to Receive */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
              Items to Receive
            </h3>
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
              const itemLocationOptions = getItemLocationOptions(selectedInventoryItem);
              const selectedLocationName = itemLocationOptions.find((location) => String(location.id) === String(item.location))?.name;

              return (
              <div
                key={index}
                className="bg-[#f9fafb] rounded-[10px] p-4 space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    Item #{index + 1}
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

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Product Selection */}
                  <div className="md:col-span-2">
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Product *
                    </Label>
                    <Select
                      value={item.productId}
                      onValueChange={(value) => handleProductSelect(index, value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select product"
                          displayValue={selectedInventoryItem ? `${selectedInventoryItem.name} - ${selectedInventoryItem.sku}` : undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((inventoryItem) => (
                          <SelectItem key={inventoryItem.itemId} value={String(inventoryItem.itemId)}>
                            <div className="flex flex-col">
                              <span>{inventoryItem.name}</span>
                              <span className="font-['Arimo:Regular',sans-serif] text-[11px] text-[#4a5565]">
                                {[inventoryItem.brand || 'No brand', inventoryItem.sku, inventoryItem.location].filter(Boolean).join(' - ')}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Item Brand */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Brand
                    </Label>
                    <Input
                      value={selectedInventoryItem ? (selectedInventoryItem.brand || 'No brand') : 'Select product first'}
                      readOnly
                    />
                  </div>

                  {/* Supplier */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Supplier *
                    </Label>
                    <Select
                      value={item.supplier}
                      onValueChange={(value) => handleItemChange(index, 'supplier', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select supplier"
                          displayValue={suppliers.find((supplier) => String(supplier.id) === String(item.supplier))?.name}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Inventory Location */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Inventory Location *
                    </Label>
                    {selectedInventoryItem ? (
                      <Select
                        value={item.location}
                        onValueChange={(value) => handleItemChange(index, 'location', value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder="Select location"
                            displayValue={selectedLocationName}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {itemLocationOptions.map((location) => (
                            <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value="Select product first" readOnly />
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Quantity Received *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  {/* Batch Number */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Batch Number *
                    </Label>
                    <Input
                      placeholder="BATCH-2026-001"
                      value={item.batchNumber}
                      onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)}
                      required
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <Label className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                      Expiry Date *
                    </Label>
                    <Input
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Invoice Upload */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
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
                className="block border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[10px] p-6 text-center hover:border-[#155dfc] transition-colors cursor-pointer"
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
                placeholder="Add any relevant notes about this delivery..."
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

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                    const selectedLocation = getItemLocationOptions(selectedInventoryItem).find((location) => String(location.id) === String(item.location));

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
                          {suppliers.find((supplier) => String(supplier.id) === String(item.supplier))?.name || 'Not selected'}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] truncate">
                          {selectedLocation?.name || 'Not selected'}
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
        <div className="flex gap-3 justify-end">
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
    </div>
  );
}
