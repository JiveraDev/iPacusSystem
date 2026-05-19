import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, X, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useNavigate } from '../PetOwnerDashboard/dashboardRouter';
import { createInventoryItem, fetchInventoryMeta, getCurrentUser } from '../../services/inventoryApi';

export default function AddNewItemPage() {
  const navigate = useNavigate();
  const [variants, setVariants] = useState([]);
  const [newVariant, setNewVariant] = useState('');
  const [locations, setLocations] = useState([]);
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [locationId, setLocationId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInventoryMeta()
      .then((data) => setLocations(data.locations || []))
      .catch((error) => setErrorMessage(error.message || 'Failed to load inventory locations.'));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const currentUser = getCurrentUser();

    try {
      if (!category || !unit || !locationId) {
        throw new Error('Category, unit, and inventory location are required.');
      }

      await createInventoryItem({
        user_id: currentUser?.id || currentUser?.user_id,
        item_name: formData.get('productName'),
        sku: formData.get('sku'),
        barcode: formData.get('barcode'),
        description: formData.get('description'),
        category,
        brand: formData.get('brand'),
        unit,
        location_id: locationId,
        quantity: Number(formData.get('quantity') || 0),
        batch_number: formData.get('batchNumber'),
        reorder_level: Number(formData.get('reorderLevel') || 0),
        unit_cost: Number(formData.get('costPrice') || 0),
        expiry_date: formData.get('expiryDate') || null,
        expiry_warning_days: Number(formData.get('warningDays') || 90),
        profile_image_path: ''
      });
      navigate('/dashboard/inventory');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to add inventory item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVariant = () => {
    if (newVariant.trim()) {
      setVariants([...variants, newVariant.trim()]);
      setNewVariant('');
    }
  };

  const handleRemoveVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

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

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Basic Information Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Image Upload */}
            <div className="md:col-span-2">
              <Label htmlFor="images" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Product Images
              </Label>
              <div className="border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[10px] p-8 text-center hover:border-[#155dfc] transition-colors cursor-pointer">
                <Upload className="size-8 text-[#4a5565] mx-auto mb-3" />
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                  PNG, JPG up to 5MB (Max 5 images)
                </p>
                <input type="file" id="images" multiple accept="image/*" className="hidden" />
              </div>
            </div>

            {/* Product Name */}
            <div className="md:col-span-2">
              <Label htmlFor="productName" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Product Name *
              </Label>
              <Input
                id="productName"
                placeholder="Enter product name"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <Label htmlFor="description" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Enter product description"
                rows={3}
              />
            </div>

            {/* SKU */}
            <div>
              <Label htmlFor="sku" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                SKU *
              </Label>
              <Input
                id="sku"
                placeholder="e.g., MED-AMX-500"
                required
              />
            </div>

            {/* Barcode */}
            <div>
              <Label htmlFor="barcode" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Barcode
              </Label>
              <Input
                id="barcode"
                placeholder="Enter barcode number"
              />
            </div>
          </div>
        </div>

        {/* Classification Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Classification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div>
              <Label htmlFor="category" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Category *
              </Label>
              <Select value={category} onValueChange={setCategory} required>
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

            {/* Brand */}
            <div>
              <Label htmlFor="brand" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Brand
              </Label>
              <Input
                id="brand"
                placeholder="Enter brand name"
              />
            </div>

            {/* Storage Location */}
            <div>
              <Label htmlFor="location" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Inventory Location *
              </Label>
              <Select value={locationId} onValueChange={setLocationId} required>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Inventory Details Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Inventory Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quantity */}
            <div>
              <Label htmlFor="quantity" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                min="0"
                required
              />
            </div>

            {/* Unit */}
            <div>
              <Label htmlFor="unit" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Unit *
              </Label>
              <Select value={unit} onValueChange={setUnit} required>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                  <SelectItem value="bottles">Bottles</SelectItem>
                  <SelectItem value="vials">Vials</SelectItem>
                  <SelectItem value="bags">Bags</SelectItem>
                  <SelectItem value="kg">Kilograms</SelectItem>
                  <SelectItem value="liters">Liters</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Batch Number */}
            <div>
              <Label htmlFor="batchNumber" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Batch Number
              </Label>
              <Input
                id="batchNumber"
                placeholder="e.g., BATCH-2024-001"
              />
            </div>

            {/* Reorder Level */}
            <div>
              <Label htmlFor="reorderLevel" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Reorder Level
              </Label>
              <Input
                id="reorderLevel"
                type="number"
                placeholder="Minimum quantity"
                min="0"
              />
            </div>


          </div>
        </div>

        {/* Cost Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Cost
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Unit Cost */}
            <div>
              <Label htmlFor="costPrice" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Unit Cost *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                  ₱
                </span>
                <Input
                  id="costPrice"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="pl-8"
                  required
                />
              </div>
            </div>

          </div>
        </div>

        {/* Expiry Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Expiry Tracking
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Expiry Date */}
            <div>
              <Label htmlFor="expiryDate" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Expiry Date
              </Label>
              <Input
                id="expiryDate"
                type="date"
              />
            </div>

            {/* Warning Days */}
            <div>
              <Label htmlFor="warningDays" className="font-['Arimo:Bold',sans-serif] text-[14px] mb-2 block">
                Expiry Warning (Days)
              </Label>
              <Input
                id="warningDays"
                type="number"
                placeholder="90"
                min="1"
              />
              <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mt-1">
                Alert when this many days remain before expiry
              </p>
            </div>
          </div>
        </div>

        {/* Variants Section */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-6">
            Variants (Optional)
          </h3>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 250mg, 500mg, 1g"
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariant())}
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
            {isSubmitting ? 'Adding...' : 'Add to Inventory'}
          </Button>
        </div>
      </form>
    </div>
  );
}
