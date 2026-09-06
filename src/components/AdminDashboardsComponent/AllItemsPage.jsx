import { useEffect, useState } from 'react';
import { Search, Filter, Plus, Trash2, Eye, Package, Pill, Syringe, Thermometer, FileText, MinusCircle, Pencil, Save, X, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from '../dashboardRouter.jsx';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import InventoryStatusBadge from './InventoryStatusBadge';
import { createStockOut, deleteInventoryItem, fetchInventoryItems, fetchInventoryMeta, getCurrentUser, transferInventoryStock, updateInventoryItem } from '../../services/inventoryApi';
import { formatDisplayDate } from '../../lib/date';
import { formatPhpCurrency } from '../../lib/currency';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import TablePagination from '../shared/TablePagination.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import InventoryResponsibilityDialog from './InventoryResponsibilityDialog.jsx';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import InventoryLocationFields from './InventoryLocationFields.jsx';
import { DEFAULT_STORAGE_AREA, matchingLocation } from './inventoryLocationUtils.js';

const REPORT_INVENTORY_SELECTION_KEY = 'ipawcus-inventory-report-selection';
const INVENTORY_PAGE_SIZE = 20;
const INVENTORY_CATEGORIES = ['Medicines', 'Vaccines', 'Medical Supplies', 'Retail Products', 'Equipment', 'Consumables'];

function createEditItemForm(item = {}) {
  return {
    itemName: item.name || '',
    genericName: item.genericName || '',
    description: item.description || '',
    category: item.category || '',
    brand: item.brand || '',
    unit: item.unit || '',
    reorderLevel: String(item.reorderLevel ?? 0),
    expiryWarningDays: String(item.expiryWarningDays ?? 90),
    unitCost: String(item.costPrice ?? ''),
    sellingPrice: String(item.sellingPrice ?? item.costPrice ?? ''),
    locationId: String(item.locationId ?? ''),
    locationName: item.locationName || String(item.location || '').split(' / ')[0] || '',
    storageArea: item.storageArea || DEFAULT_STORAGE_AREA
  };
}

export default function AllItemsPage() {
  const navigate = useNavigate();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Select Categories');
  const [locationFilter, setLocationFilter] = useState('Select Location');
  const [statusFilter, setStatusFilter] = useState('Select Status');
  const viewMode = 'list';
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [stockOutItem, setStockOutItem] = useState(null);
  const [stockOutBatchId, setStockOutBatchId] = useState('');
  const [stockOutQuantity, setStockOutQuantity] = useState('');
  const [batchSort, setBatchSort] = useState('newest');
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editItemForm, setEditItemForm] = useState(createEditItemForm());
  const [transferItem, setTransferItem] = useState(null);
  const [transferBatchId, setTransferBatchId] = useState('');
  const [transferDestinationId, setTransferDestinationId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [inventoryConfirmation, setInventoryConfirmation] = useState(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const loadInventory = async ({ isAutoRefresh = false } = {}) => {
    if (!isAutoRefresh) {
      setIsLoading(true);
      setErrorMessage('');
    }
    try {
      const [itemsData, metaData] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryMeta()
      ]);
      const loadedItems = itemsData.items || [];
      setInventoryItems(loadedItems);
      setLocations(metaData.locations || []);
      return loadedItems;
    } catch (error) {
      if (!isAutoRefresh) {
        setErrorMessage(error.message || 'Failed to load inventory.');
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(loadInventory);

  const openItemDetails = (item) => {
    setSelectedItem(item);
    setEditItemForm(createEditItemForm(item));
    setIsEditingItem(false);
    setIsDetailModalOpen(true);
  };

  const handleItemClick = (item) => {
    openItemDetails(item);
  };

  useEffect(() => {
    if (isLoading || inventoryItems.length === 0) {
      return;
    }

    let pendingSelection = null;
    try {
      const rawSelection = sessionStorage.getItem(REPORT_INVENTORY_SELECTION_KEY);
      pendingSelection = rawSelection ? JSON.parse(rawSelection) : null;
    } catch {
      sessionStorage.removeItem(REPORT_INVENTORY_SELECTION_KEY);
      return;
    }

    const pendingItemId = pendingSelection?.itemId;
    if (!pendingItemId) {
      return;
    }

    const matchedItem = inventoryItems.find((item) => (
      String(item.itemId || item.item_id || item.id) === String(pendingItemId)
    ));

    sessionStorage.removeItem(REPORT_INVENTORY_SELECTION_KEY);

    if (!matchedItem) {
      toast.error('Inventory item from reports was not found.');
      return;
    }

    setSearchQuery('');
    setCategoryFilter('Select Categories');
    setLocationFilter('Select Location');
    setStatusFilter('Select Status');
    openItemDetails(matchedItem);
  }, [inventoryItems, isLoading]);

  const openStockOutModal = (item) => {
    const batches = getItemBatches(item, 'newest');
    setStockOutItem(item);
    setStockOutBatchId(batches[0]?.id || '');
    setStockOutQuantity('');
  };

  const handleStockOut = () => {
    const quantityToRemove = Number(stockOutQuantity);
    const selectedBatch = getItemBatches(stockOutItem, 'newest').find((batch) => String(batch.id) === String(stockOutBatchId));

    if (!stockOutItem || !selectedBatch || !Number.isFinite(quantityToRemove) || quantityToRemove <= 0) {
      return;
    }

    if (quantityToRemove > Number(selectedBatch.quantity || 0)) {
      const message = `Stock out quantity cannot exceed ${selectedBatch.quantity} ${stockOutItem.unit} in the selected stock entry.`;
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setInventoryConfirmation({
      type: 'stock-out',
      title: 'Confirm Stock Reduction',
      description: 'A reason and your password are required before stock is deducted.',
      requiresReason: true,
      confirmLabel: 'Reduce stock',
      itemId: stockOutItem.itemId || stockOutItem.id,
      itemName: stockOutItem.name,
      payload: {
        item_id: stockOutItem.itemId || stockOutItem.id,
        batch_id: stockOutBatchId,
        quantity: quantityToRemove
      },
      summary: [
        { label: 'Product', value: stockOutItem.name },
        { label: 'Expiry', value: formatInventoryDate(selectedBatch.expiryDate) },
        { label: 'Location', value: selectedBatch.location || stockOutItem.location },
        { label: 'Quantity', value: `${quantityToRemove} ${stockOutItem.unit}` },
        { label: 'Remaining in entry', value: `${Number(selectedBatch.quantity) - quantityToRemove} ${stockOutItem.unit}` }
      ]
    });
    setStockOutItem(null);
  };

  const handleEditItem = () => {
    if (!selectedItem) return;
    setEditItemForm(createEditItemForm(selectedItem));
    setIsEditingItem(true);
  };

  const handleSaveItem = () => {
    if (!selectedItem) return;

    const unitCost = Number(editItemForm.unitCost);
    const sellingPrice = Number(editItemForm.sellingPrice);
    const reorderLevel = Number(editItemForm.reorderLevel);
    const expiryWarningDays = Number(editItemForm.expiryWarningDays);
    if (!editItemForm.itemName.trim() || !editItemForm.category || !editItemForm.unit.trim()) {
      const message = 'Product name, category, and unit are required.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      const message = 'Enter a valid unit cost.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      const message = 'Enter a valid selling price.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!editItemForm.locationName || !editItemForm.storageArea) {
      const message = 'Choose or add an inventory location and storage area.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || !Number.isInteger(expiryWarningDays) || expiryWarningDays < 1) {
      const message = 'Reorder level must be zero or higher, and expiry warning days must be at least 1.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const nextLocation = matchingLocation(locations, editItemForm.locationName, editItemForm.storageArea);
    const changes = [
      { label: 'Product name', before: selectedItem.name, after: editItemForm.itemName.trim() },
      { label: 'Generic name', before: selectedItem.genericName || 'Not set', after: editItemForm.genericName.trim() || 'Not set' },
      { label: 'Description', before: selectedItem.description || 'Not set', after: editItemForm.description.trim() || 'Not set' },
      { label: 'Category', before: selectedItem.category, after: editItemForm.category },
      { label: 'Brand', before: selectedItem.brand || 'Not set', after: editItemForm.brand.trim() || 'Not set' },
      { label: 'Unit', before: selectedItem.unit, after: editItemForm.unit.trim() },
      { label: 'Reorder level', before: String(selectedItem.reorderLevel ?? 0), after: String(reorderLevel) },
      { label: 'Expiry warning', before: `${selectedItem.expiryWarningDays ?? 90} days`, after: `${expiryWarningDays} days` },
      { label: 'Unit cost', before: formatPhpCurrency(selectedItem.costPrice), after: formatPhpCurrency(unitCost) },
      { label: 'Selling price', before: formatPhpCurrency(selectedItem.sellingPrice ?? selectedItem.costPrice), after: formatPhpCurrency(sellingPrice) },
      { label: 'Location', before: selectedItem.location, after: `${editItemForm.locationName} / ${editItemForm.storageArea}` }
    ].filter((change) => change.before !== change.after);

    if (changes.length === 0) {
      toast.info('No inventory changes to save.');
      return;
    }

    setInventoryConfirmation({
      type: 'edit',
      title: 'Confirm Inventory Changes',
      description: 'Review the old and new values, then verify the update with your password.',
      confirmLabel: 'Save changes',
      itemId: selectedItem.itemId || selectedItem.id,
      itemName: selectedItem.name,
      payload: {
        item_id: selectedItem.itemId || selectedItem.id,
        item_name: editItemForm.itemName.trim(),
        generic_name: editItemForm.genericName.trim() || null,
        description: editItemForm.description.trim() || null,
        category: editItemForm.category,
        brand: editItemForm.brand.trim() || null,
        unit: editItemForm.unit.trim(),
        reorder_level: reorderLevel,
        expiry_warning_days: expiryWarningDays,
        unit_cost: unitCost,
        selling_price: sellingPrice,
        location_id: nextLocation?.id || null,
        location_name: editItemForm.locationName,
        storage_area: editItemForm.storageArea
      },
      summary: changes
    });
  };

  const openTransferModal = (item) => {
    const batches = getItemBatches(item, 'newest').filter((batch) => Number(batch.quantity) > 0);
    setTransferItem(item);
    setTransferBatchId(String(batches[0]?.id || ''));
    setTransferDestinationId('');
    setTransferQuantity('');
  };

  const handleTransferReview = () => {
    const sourceBatch = getItemBatches(transferItem, 'newest').find((batch) => String(batch.id) === String(transferBatchId));
    const destination = locations.find((location) => String(location.id) === String(transferDestinationId));
    const quantity = Number(transferQuantity);
    if (!transferItem || !sourceBatch || !destination || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Select the source stock entry, destination, and a valid quantity.');
      return;
    }
    if (String(sourceBatch.locationId) === String(destination.id)) {
      toast.error('Choose a destination different from the source location.');
      return;
    }
    if (quantity > Number(sourceBatch.quantity || 0)) {
      toast.error(`Transfer quantity cannot exceed ${sourceBatch.quantity} ${transferItem.unit}.`);
      return;
    }

    setInventoryConfirmation({
      type: 'transfer',
      title: 'Confirm Stock Transfer',
      description: 'Verify the full transfer route and quantity. A reason and your password are required.',
      requiresReason: true,
      confirmLabel: 'Transfer stock',
      itemId: transferItem.itemId || transferItem.id,
      itemName: transferItem.name,
      payload: {
        item_id: transferItem.itemId || transferItem.id,
        batch_id: sourceBatch.id,
        destination_location_id: destination.id,
        quantity
      },
      summary: [
        { label: 'Product', value: transferItem.name },
        { label: 'Source expiry', value: formatInventoryDate(sourceBatch.expiryDate) },
        { label: 'Source', value: sourceBatch.location || transferItem.location },
        { label: 'Destination', value: destination.displayName || destination.name },
        { label: 'Quantity', value: `${quantity} ${transferItem.unit}` }
      ]
    });
    setTransferItem(null);
  };

  const handleDeleteReview = () => {
    if (!selectedItem) return;
    setInventoryConfirmation({
      type: 'delete',
      title: 'Permanently delete product',
      description: 'This permanently removes the product, its stock entries, and its inventory receipt lines. This action cannot be undone.',
      requiresReason: true,
      destructive: true,
      confirmLabel: 'Delete permanently',
      itemId: selectedItem.itemId || selectedItem.id,
      itemName: selectedItem.name,
      payload: { item_id: selectedItem.itemId || selectedItem.id },
      summary: [
        { label: 'Product', value: selectedItem.name },
        { label: 'Current stock', value: `${selectedItem.quantity} ${selectedItem.unit}` },
        { label: 'Location', value: selectedItem.location },
        { label: 'Result', value: 'Permanently removed from inventory' }
      ]
    });
  };

  const handleConfirmInventoryAction = async (confirmation) => {
    if (!inventoryConfirmation) return;
    const action = inventoryConfirmation;
    const currentUser = getCurrentUser();
    const payload = {
      ...action.payload,
      user_id: currentUser?.id || currentUser?.user_id,
      ...confirmation
    };
    setIsConfirmingAction(true);
    setErrorMessage('');

    try {
      if (action.type === 'edit') await updateInventoryItem(payload);
      if (action.type === 'stock-out') await createStockOut(payload);
      if (action.type === 'transfer') await transferInventoryStock(payload);
      if (action.type === 'delete') await deleteInventoryItem(payload);

      const updatedItems = await loadInventory();
      const updatedItem = updatedItems.find((item) => String(item.itemId || item.id) === String(action.itemId));
      if (updatedItem) {
        setSelectedItem(updatedItem);
        setEditItemForm(createEditItemForm(updatedItem));
      }
      if (action.type === 'delete') {
        setSelectedItem(null);
        setIsDetailModalOpen(false);
      }
      if (action.type === 'edit') setIsEditingItem(false);
      setStockOutQuantity('');
      setTransferQuantity('');
      setInventoryConfirmation(null);
      const messages = {
        edit: `${action.itemName} inventory details updated.`,
        'stock-out': `${action.itemName} stock-out recorded.`,
        transfer: `${action.itemName} stock transferred.`,
        delete: `${action.itemName} permanently deleted.`
      };
      toast.success(messages[action.type]);
    } catch (error) {
      const message = error.message || 'Failed to confirm the inventory change.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const hasInventoryQuery = Boolean(
    searchQuery.trim()
    || categoryFilter !== 'Select Categories'
    || locationFilter !== 'Select Location'
    || statusFilter !== 'Select Status'
  );
  const filteredItems = inventoryItems.filter(item => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(normalizedQuery)
      || (item.genericName && item.genericName.toLowerCase().includes(normalizedQuery))
      || (item.brand && item.brand.toLowerCase().includes(normalizedQuery));
    const matchesCategory = categoryFilter === 'Select Categories' || item.category === categoryFilter;
    const matchesLocation = locationFilter === 'Select Location'
      || String(item.locationId) === String(locationFilter)
      || (item.batches || []).some((batch) => String(batch.locationId) === String(locationFilter));
    const matchesStatus = statusFilter === 'Select Status' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / INVENTORY_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const firstItemIndex = (activePage - 1) * INVENTORY_PAGE_SIZE;
  const paginatedItems = filteredItems.slice(firstItemIndex, firstItemIndex + INVENTORY_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, locationFilter, statusFilter]);

  useEffect(() => {
    if (
      locationFilter !== 'Select Location'
      && locations.length > 0
      && !locations.some((location) => String(location.id) === String(locationFilter))
    ) {
      setLocationFilter('Select Location');
    }
  }, [locationFilter, locations]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeInventoryItems = inventoryItems;
  const lowStockCount = activeInventoryItems.filter(item => item.status === 'low-stock').length;
  const nearExpiryCount = activeInventoryItems.filter(item => item.status === 'near-expiry').length;

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Medicines': return <Pill className="size-5 text-[#155dfc]" />;
      case 'Vaccines': return <Syringe className="size-5 text-[#155dfc]" />;
      default: return <Package className="size-5 text-[#155dfc]" />;
    }
  };

  const batchSortLabels = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    expiry: 'Expiry soonest'
  };
  const stockOutBatches = stockOutItem ? getItemBatches(stockOutItem, 'newest') : [];
  const selectedStockOutBatch = stockOutBatches.find((batch) => String(batch.id) === String(stockOutBatchId));
  const transferBatches = transferItem ? getItemBatches(transferItem, 'newest').filter((batch) => Number(batch.quantity) > 0) : [];
  const selectedTransferBatch = transferBatches.find((batch) => String(batch.id) === String(transferBatchId));
  const transferDestinations = locations.filter((location) => String(location.id) !== String(selectedTransferBatch?.locationId));
  const selectedItemBatches = selectedItem ? getItemBatches(selectedItem, batchSort) : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={Package}
        title="All Inventory Items"
        description="Manage all products, medicines, and supplies."
        petHover
        petKind="parrot"
        petAccent="blue"
        layout="stacked"
        toolbar={(
          <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button
              className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]"
              size="sm"
              onClick={() => navigate('/dashboard/inventory/add')}
            >
              <Plus className="size-4" />
              <span>Add Item</span>
            </Button>
          </div>
        )}
      />

      {/* Filters Section */}
      <div data-filter-bar data-session-persist="off" className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {/* Search */}
          <div className="md:col-span-2">
            <Input
              placeholder="Search product, generic name, or brand"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="size-4" />}
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Select Categories">All Categories</SelectItem>
              <SelectItem value="Medicines">Medicines</SelectItem>
              <SelectItem value="Vaccines">Vaccines</SelectItem>
              <SelectItem value="Medical Supplies">Medical Supplies</SelectItem>
              <SelectItem value="Retail Products">Retail Products</SelectItem>
              <SelectItem value="Equipment">Equipment</SelectItem>
              <SelectItem value="Consumables">Consumables</SelectItem>
            </SelectContent>
          </Select>

          {/* Location Filter */}
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger>
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="Select Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Select Location">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={String(location.id)}>{location.displayName || `${location.name} / ${location.storageArea || 'General Storage'}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Select Status">All Status</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low-stock">Low Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              <SelectItem value="near-expiry">Near Expiry</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Inventory Summary */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.1)] p-3 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">
              Total Products
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#101828]">
              {activeInventoryItems.length}
            </p>
          </div>
          <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.1)] p-3 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">
              Low Stock
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#b54708]">
              {lowStockCount}
            </p>
          </div>
          <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.1)] p-3 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">
              Near Expiry
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[22px] text-[#d92d20]">
              {nearExpiryCount}
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-[10px] border border-[#fecdca] bg-[#fffbfa] p-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#b42318]">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-6 text-center sm:p-12">
          <Package className="size-10 text-[#4a5565] mx-auto mb-3" />
          <p className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">Loading inventory...</p>
        </div>
      )}

      {/* Content - List View */}
      {!isLoading && viewMode === 'list' && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Product Name</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Category</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Brand</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Location</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Quantity</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                  <TableHead className="w-[90px] text-right font-['Arimo:Bold',sans-serif]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-[#f9fafb] cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <TableCell>
                      <div className="size-[50px] rounded-[8px] bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <ProtectedImage
                            src={item.image}
                            alt={item.name}
                            className="size-full object-cover"
                            fallbackClassName="size-full"
                          />
                        ) : (
                          getCategoryIcon(item.category)
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                      {item.brand}
                    </TableCell>
                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      {item.location}
                    </TableCell>
                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell>
                      <InventoryStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openItemDetails(item)} className="gap-2"><Eye className="size-4" />View</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <Package className="mx-auto mb-3 size-8 text-slate-400" />
                      <p className="font-bold text-slate-800 dark:text-slate-100">No inventory products found</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try clearing the filters or add a new item.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

        </div>
      )}

      {/* Content - Card View */}
      {!isLoading && viewMode === 'card' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.1)] p-3 hover:border-[#155dfc]/30 hover:shadow-md transition cursor-pointer sm:p-4"
              onClick={() => handleItemClick(item)}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-['Arimo:Bold',sans-serif] text-[16px] leading-5 text-[#101828] mb-1 line-clamp-2">
                    {item.name}
                  </h3>
                  {item.genericName && (
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] leading-4 text-[#4a5565] line-clamp-1">
                      {item.genericName}
                    </p>
                  )}
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eff6ff]">
                  {getCategoryIcon(item.category)}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="secondary" className="text-[11px]">
                  {item.category}
                </Badge>
                {item.isControlled && (
                  <Badge className="bg-[#ffe6e6] text-[#d92d20] hover:bg-[#ffe6e6] text-[11px]">
                    Controlled
                  </Badge>
                )}
                {item.requiresPrescription && (
                  <Badge className="bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6] text-[11px]">
                    Rx Required
                  </Badge>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Brand:
                  </span>
                  <span className="truncate text-right font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                    {item.brand}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Available:
                  </span>
                  <span className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                    {item.quantity} {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Location:
                  </span>
                  <span className="truncate text-right font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828]">
                    {item.location}
                  </span>
                </div>
              </div>

              {/* Stock entries */}
              <div className="rounded-[8px] border border-[rgba(0,0,0,0.08)] p-2.5 mb-3">
                <p className="font-['Arimo:Bold',sans-serif] text-[11px] text-[#101828] mb-2">
                  Stock entries
                </p>
                <div className="max-h-24 space-y-2 overflow-y-auto pr-1">
                  {getItemBatches(item, 'newest').map((batch) => (
                    <div key={batch.id} className="flex items-center justify-between gap-3 text-[11px]">
                      <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[#4a5565]">Expires {formatInventoryDate(batch.expiryDate, { compact: true })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-['Arimo:Bold',sans-serif] text-[#101828]">{batch.quantity} {item.unit}</p>
                      </div>
                    </div>
                  ))}
                  {getItemBatches(item, 'newest').length === 0 && (
                    <p className="font-['Arimo:Regular',sans-serif] text-[11px] text-[#4a5565]">
                      No available stock entries
                    </p>
                  )}
                </div>
              </div>

              {/* Prices */}
              <div className="flex justify-between items-center gap-4 mb-3 pb-3 border-b border-[rgba(0,0,0,0.05)]">
                <div>
                  <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Unit Cost
                  </p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {formatPhpCurrency(item.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Selling Price
                  </p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {formatPhpCurrency(item.sellingPrice ?? item.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <InventoryStatusBadge status={item.status} />
                <Button variant="ghost" size="sm">
                  <Eye className="size-4 mr-2" />
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredItems.length > 0 && (
        <TablePagination
          currentPage={activePage}
          totalItems={filteredItems.length}
          pageSize={INVENTORY_PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="inventory items"
          className="rounded-[12px] border border-slate-200 bg-white p-4"
        />
      )}

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <div className="rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-6 text-center sm:p-12">
          <Package className="size-12 text-[#4a5565] mx-auto mb-4" />
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-2">
            {hasInventoryQuery ? 'No items found' : 'No inventory items available'}
          </h3>
          <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
            {hasInventoryQuery
              ? 'Try adjusting your search or filter criteria.'
              : 'Inventory records will appear here when items are available.'}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-3 font-['Arimo:Bold',sans-serif] text-[20px] sm:text-[24px]">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[#eff6ff]">
                        {getCategoryIcon(selectedItem.category)}
                      </div>
                      {selectedItem.name}
                    </DialogTitle>
                    <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[16px]">
                      {selectedItem.genericName || `${selectedItem.category} - ${selectedItem.brand}`}
                    </DialogDescription>
                  </div>
                  <Button type="button" variant={isEditingItem ? 'ghost' : 'outline'} size="sm" onClick={isEditingItem ? () => setIsEditingItem(false) : handleEditItem}>
                    {isEditingItem ? <><X className="size-4 mr-2" />Cancel edit</> : <><Pencil className="size-4 mr-2" />Edit</>}
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedItem.category}</Badge>
                  <InventoryStatusBadge status={selectedItem.status} />
                  {selectedItem.isControlled && (
                    <Badge className="bg-[#ffe6e6] text-[#d92d20] hover:bg-[#ffe6e6]">
                      Controlled
                    </Badge>
                  )}
                  {selectedItem.requiresPrescription && (
                    <Badge className="bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]">
                      Rx Required
                    </Badge>
                  )}
                  {selectedItem.formType && (
                    <Badge variant="outline">{selectedItem.formType}</Badge>
                  )}
                </div>

                {isEditingItem && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                    <h4 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">Product Metadata</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-name">Product name</Label>
                        <Input id="inventory-edit-name" value={editItemForm.itemName} onChange={(event) => setEditItemForm((current) => ({ ...current, itemName: event.target.value }))} maxLength={180} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-generic">Generic name</Label>
                        <Input id="inventory-edit-generic" value={editItemForm.genericName} onChange={(event) => setEditItemForm((current) => ({ ...current, genericName: event.target.value }))} maxLength={150} placeholder="Optional generic name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={editItemForm.category} onValueChange={(value) => setEditItemForm((current) => ({ ...current, category: value }))}>
                          <SelectTrigger><SelectValue placeholder="Select category" displayValue={editItemForm.category} /></SelectTrigger>
                          <SelectContent>
                            {INVENTORY_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-brand">Brand</Label>
                        <Input id="inventory-edit-brand" value={editItemForm.brand} onChange={(event) => setEditItemForm((current) => ({ ...current, brand: event.target.value }))} maxLength={120} placeholder="Optional brand" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-unit">Unit</Label>
                        <Input id="inventory-edit-unit" value={editItemForm.unit} onChange={(event) => setEditItemForm((current) => ({ ...current, unit: event.target.value }))} maxLength={50} placeholder="e.g. pcs or vials" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-reorder">Reorder level</Label>
                        <Input id="inventory-edit-reorder" type="number" min="0" restriction="integer" value={editItemForm.reorderLevel} onChange={(event) => setEditItemForm((current) => ({ ...current, reorderLevel: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inventory-edit-warning">Expiry warning days</Label>
                        <Input id="inventory-edit-warning" type="number" min="1" restriction="integer" value={editItemForm.expiryWarningDays} onChange={(event) => setEditItemForm((current) => ({ ...current, expiryWarningDays: event.target.value }))} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="inventory-edit-description">Description</Label>
                        <Textarea id="inventory-edit-description" value={editItemForm.description} onChange={(event) => setEditItemForm((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="Optional product description" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Temperature Alert for Vaccines */}
                {selectedItem.category === 'Vaccines' && selectedItem.tempStatus && (
                  <div className={`rounded-[10px] p-4 ${
                    selectedItem.tempStatus === 'critical'
                      ? 'bg-[#ffe6e6] border border-[#d92d20]'
                      : selectedItem.tempStatus === 'warning'
                      ? 'bg-[#fff4e6] border border-[#b54708]'
                      : 'bg-[#e0f2e9] border border-[#0c6a3c]'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Thermometer className={`size-5 ${
                        selectedItem.tempStatus === 'critical'
                          ? 'text-[#d92d20]'
                          : selectedItem.tempStatus === 'warning'
                          ? 'text-[#b54708]'
                          : 'text-[#0c6a3c]'
                      }`} />
                      <div className="flex-1">
                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                          Storage Temperature: {selectedItem.storageTemp}
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                          {selectedItem.tempStatus === 'critical'
                            ? 'Critical - Outside safe range'
                            : selectedItem.tempStatus === 'warning'
                            ? 'Warning - Near threshold'
                            : 'Optimal temperature'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-4">
                      Basic Information
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Brand</p>
                        <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.brand}</p>
                      </div>
                      <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Supplier</p>
                        <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.supplier}</p>
                        {selectedItem.supplierContact && (
                          <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                            {selectedItem.supplierContact}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Inventory Location</p>
                        {isEditingItem ? (
                          <div className="mt-2">
                            <InventoryLocationFields
                              locations={locations}
                              locationName={editItemForm.locationName}
                              storageArea={editItemForm.storageArea}
                              onChange={(nextLocation) => setEditItemForm((current) => ({ ...current, ...nextLocation }))}
                              idPrefix="edit-item-location"
                              compact
                            />
                          </div>
                        ) : (
                          <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.location}</p>
                        )}
                      </div>
                      {selectedItem.vaccineType && (
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Vaccine Type</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.vaccineType}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-4">
                      Stock Information
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Quantity Available</p>
                        <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">
                          {selectedItem.quantity} {selectedItem.unit}
                        </p>
                      </div>
                      {selectedItem.variant && (
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Variant</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.variant}</p>
                        </div>
                      )}
                      {selectedItem.reorderLevel && (
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Reorder Level</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">
                            {selectedItem.reorderLevel} {selectedItem.unit}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock entry information */}
                <div className="bg-[#f9fafb] rounded-[10px] p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
                      Stock entries
                    </h4>
                    <div className="w-full sm:w-44">
                      <Select value={batchSort} onValueChange={setBatchSort}>
                        <SelectTrigger>
                          <SelectValue displayValue={batchSortLabels[batchSort]} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest first</SelectItem>
                          <SelectItem value="oldest">Oldest first</SelectItem>
                          <SelectItem value="expiry">Expiry soonest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {selectedItemBatches.map((batch) => (
                      <div key={batch.id} className="grid grid-cols-1 gap-3 rounded-[8px] bg-white border border-[rgba(0,0,0,0.08)] p-3 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950">
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">Quantity</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{batch.quantity} {selectedItem.unit}</p>
                        </div>
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">Expiry</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{formatInventoryDate(batch.expiryDate)}</p>
                        </div>
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">Location</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{batch.location || selectedItem.location}</p>
                        </div>
                      </div>
                    ))}
                    {selectedItemBatches.length === 0 && (
                      <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                        No available stock entries
                      </p>
                    )}
                  </div>
                </div>

                {/* Storage Instructions */}
                {selectedItem.storageInstructions && (
                  <div className="bg-[#f9fafb] rounded-[10px] p-4">
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-2">
                      Storage Instructions
                    </h4>
                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      {selectedItem.storageInstructions}
                    </p>
                  </div>
                )}

                {/* Prices */}
                <div className="grid grid-cols-1 gap-4 rounded-[10px] bg-[#f9fafb] p-4 sm:grid-cols-2">
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">Unit Cost</p>
                    {isEditingItem ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editItemForm.unitCost}
                        onChange={(event) => setEditItemForm((current) => ({ ...current, unitCost: event.target.value }))}
                        restriction="decimal"
                        className="max-w-xs"
                      />
                    ) : (
                    <p className="font-['Arimo:Bold',sans-serif] text-[20px] text-[#101828]">
                      {formatPhpCurrency(selectedItem.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    )}
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">Selling Price</p>
                    {isEditingItem ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editItemForm.sellingPrice}
                        onChange={(event) => setEditItemForm((current) => ({ ...current, sellingPrice: event.target.value }))}
                        restriction="decimal"
                        className="max-w-xs"
                      />
                    ) : (
                      <p className="font-['Arimo:Bold',sans-serif] text-[20px] text-[#101828]">
                        {formatPhpCurrency(selectedItem.sellingPrice ?? selectedItem.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {isEditingItem && (
                    <Button className="bg-[#155dfc] hover:bg-[#0d4acf]" onClick={handleSaveItem}>
                      <Save className="size-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate('/dashboard/inventory/stock-in')}>
                    <FileText className="size-4 mr-2" />
                    Stock In
                  </Button>
                  <Button variant="outline" onClick={() => openStockOutModal(selectedItem)}>
                    <MinusCircle className="size-4 mr-2" />
                    Stock Out
                  </Button>
                  <Button variant="outline" onClick={() => openTransferModal(selectedItem)} disabled={Number(selectedItem.quantity || 0) <= 0}>
                    <ArrowRightLeft className="size-4 mr-2" />
                    Transfer
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteReview}>
                    <Trash2 className="size-4 mr-2" />
                    Delete permanently
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Out Modal */}
      <Dialog open={Boolean(stockOutItem)} onOpenChange={(open) => !open && setStockOutItem(null)}>
        <DialogContent className="max-w-lg">
          {stockOutItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[22px]">Stock Out</DialogTitle>
                <DialogDescription>
                  Select the stock entry and quantity that will be deducted from {stockOutItem.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">Stock entry</p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      {stockOutBatches.length} available
                    </p>
                  </div>
                  {stockOutBatches.length > 0 ? (
                    <Select value={stockOutBatchId} onValueChange={setStockOutBatchId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select stock entry"
                          displayValue={selectedStockOutBatch ? formatBatchOption(selectedStockOutBatch, stockOutItem.unit) : undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {stockOutBatches.map((batch) => (
                          <SelectItem key={batch.id} value={String(batch.id)}>
                            {formatBatchOption(batch, stockOutItem.unit)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[#f9fafb] p-3 font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      No available stock entries for this item.
                    </div>
                  )}
                </div>

                <div>
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-2">Quantity to Reduce</p>
                  <Input
                    type="number"
                    min="1"
                    max={selectedStockOutBatch?.quantity || undefined}
                    value={stockOutQuantity}
                    onChange={(event) => setStockOutQuantity(event.target.value)}
                    placeholder={`Enter quantity in ${stockOutItem.unit}`}
                    restriction="integer"
                    disabled={!selectedStockOutBatch}
                  />
                  {selectedStockOutBatch && (
                    <p className="mt-1 font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      Available in selected entry: {selectedStockOutBatch.quantity} {stockOutItem.unit}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setStockOutItem(null)}>Cancel</Button>
                  <Button className="bg-[#155dfc] hover:bg-[#0d4acf]" onClick={handleStockOut} disabled={!selectedStockOutBatch}>
                    Apply Stock Out
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={Boolean(transferItem)} onOpenChange={(open) => !open && setTransferItem(null)}>
        <DialogContent className="max-w-lg">
          {transferItem && (
            <>
              <DialogHeader>
                <DialogTitle>Transfer Stock</DialogTitle>
                <DialogDescription>Select a source stock entry, destination, and quantity for {transferItem.name}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Source stock entry</p>
                  <Select value={transferBatchId} onValueChange={(value) => {
                    setTransferBatchId(value);
                    setTransferDestinationId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Select source stock entry"
                        displayValue={selectedTransferBatch ? formatBatchOption(selectedTransferBatch, transferItem.unit) : undefined}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {transferBatches.map((batch) => (
                        <SelectItem key={batch.id} value={String(batch.id)}>{formatBatchOption(batch, transferItem.unit)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Destination location</p>
                  <Select value={transferDestinationId} onValueChange={setTransferDestinationId} disabled={!selectedTransferBatch}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder="Select destination"
                        displayValue={locations.find((location) => String(location.id) === String(transferDestinationId))?.displayName}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {transferDestinations.map((location) => (
                        <SelectItem key={location.id} value={String(location.id)}>{location.displayName || location.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quantity</p>
                  <Input
                    type="number"
                    min="1"
                    max={selectedTransferBatch?.quantity || undefined}
                    value={transferQuantity}
                    onChange={(event) => setTransferQuantity(event.target.value)}
                    restriction="integer"
                    placeholder="Enter transfer quantity"
                    disabled={!selectedTransferBatch}
                  />
                  {selectedTransferBatch && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Available: {selectedTransferBatch.quantity} {transferItem.unit}</p>
                  )}
                </div>
                <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setTransferItem(null)}>Cancel</Button>
                  <Button onClick={handleTransferReview} disabled={!selectedTransferBatch || !transferDestinationId}>Review transfer</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <InventoryResponsibilityDialog
        open={Boolean(inventoryConfirmation)}
        onOpenChange={(open) => !open && setInventoryConfirmation(null)}
        title={inventoryConfirmation?.title || 'Confirm Inventory Change'}
        description={inventoryConfirmation?.description || ''}
        summary={inventoryConfirmation?.summary || []}
        requiresReason={inventoryConfirmation?.requiresReason}
        confirmLabel={inventoryConfirmation?.confirmLabel}
        destructive={inventoryConfirmation?.destructive}
        isSubmitting={isConfirmingAction}
        onConfirm={handleConfirmInventoryAction}
      />

    </div>
  );
}

function getItemBatches(item, sortBy = 'newest') {
  if (!item) return [];

  const batches = item?.batches?.length
    ? item.batches
    : [{
      id: `${item.id}-batch-1`,
      batchNumber: item.batchNumber || 'NO-BATCH',
      quantity: item.quantity || 0,
      manufacturingDate: item.manufacturingDate || '',
      expiryDate: item.expiryDate || 'No expiry',
      createdAt: item.lastUpdated || ''
    }];

  return batches
    .filter((batch) => Number(batch.quantity || 0) > 0)
    .sort((a, b) => compareBatches(a, b, sortBy));
}

function GET_TOTAL_BATCH_QUANTITY(batches) {
  return batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
}

function compareBatches(a, b, sortBy) {
  if (sortBy === 'expiry') {
    return getDateTime(a.expiryDate, Number.MAX_SAFE_INTEGER) - getDateTime(b.expiryDate, Number.MAX_SAFE_INTEGER);
  }

  const aTime = getDateTime(a.createdAt || a.manufacturingDate || a.expiryDate, 0);
  const bTime = getDateTime(b.createdAt || b.manufacturingDate || b.expiryDate, 0);

  if (sortBy === 'oldest') {
    return aTime - bTime;
  }

  return bTime - aTime;
}

function getDateTime(value, fallback) {
  if (!value || value === 'No expiry') return fallback;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? fallback : time;
}

function formatBatchOption(batch, unit) {
  return `${batch.quantity} ${unit} · ${batch.location || 'Saved location'} · expires ${formatInventoryDate(batch.expiryDate, { compact: true })}`;
}

function formatInventoryDate(value, options = {}) {
  if (!value || value === 'No expiry') return 'No expiry';
  return formatDisplayDate(value, options);
}

function GET_STOCK_STATUS(quantity, reorderLevel, currentStatus) {
  if (quantity <= 0) return 'out-of-stock';
  if (reorderLevel && quantity <= reorderLevel) return 'low-stock';
  if (currentStatus === 'near-expiry') return 'near-expiry';
  return 'in-stock';
}

// Enhanced mock data with all fields
const INITIAL_INVENTORY_ITEMS = [
  {
    id: '1',
    image: '',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    sku: 'MED-AMX-500',
    category: 'Medicines',
    brand: 'Pfizer',
    supplier: 'MedSupply Corp',
    supplierContact: '+63 917 123 4567',
    location: 'Pharmacy Storage',
    quantity: 150,
    unit: 'pcs',
    variant: '500mg Capsule',
    batchNumber: 'AMX-2024-03',
    costPrice: 12.50,
    manufacturingDate: '2024-03-01',
    expiryDate: '2026-12-31',
    batches: [
      { id: '1-b1', batchNumber: 'AMX-2024-03A', quantity: 80, manufacturingDate: '2024-03-01', expiryDate: '2026-12-31' },
      { id: '1-b2', batchNumber: 'AMX-2024-06B', quantity: 70, manufacturingDate: '2024-06-10', expiryDate: '2027-03-31' }
    ],
    daysUntilExpiry: 230,
    status: 'in-stock',
    lastUpdated: '2026-05-15',
    formType: 'Capsule',
    isControlled: false,
    requiresPrescription: true,
    storageInstructions: 'Store at room temperature (15-30°C), away from moisture',
    reorderLevel: 50,
    avgDailyUsage: 3.5
  },
  {
    id: '2',
    image: '',
    name: 'Rabies Vaccine',
    genericName: 'Rabies Immunoglobulin',
    sku: 'VAC-RAB-001',
    category: 'Vaccines',
    brand: 'Nobivac',
    supplier: 'VetPharm Inc',
    supplierContact: '+63 917 234 5678',
    location: 'Cold Storage',
    quantity: 8,
    unit: 'vials',
    variant: '1ml',
    batchNumber: 'RAB-2024-08',
    costPrice: 450.00,
    manufacturingDate: '2024-08-01',
    expiryDate: '2026-08-30',
    batches: [
      { id: '2-b1', batchNumber: 'RAB-2024-08', quantity: 5, manufacturingDate: '2024-08-01', expiryDate: '2026-08-30' },
      { id: '2-b2', batchNumber: 'RAB-2025-01', quantity: 3, manufacturingDate: '2025-01-12', expiryDate: '2027-01-30' }
    ],
    daysUntilExpiry: 106,
    status: 'low-stock',
    lastUpdated: '2026-05-14',
    vaccineType: 'Core Vaccine',
    storageTemp: '4°C',
    tempStatus: 'optimal',
    storageInstructions: 'Store at 2-8°C, do not freeze',
    reorderLevel: 15,
    avgDailyUsage: 2.5
  },
  {
    id: '3',
    image: '',
    name: 'Surgical Gloves',
    sku: 'SUP-GLV-L',
    category: 'Medical Supplies',
    brand: 'SafeTouch',
    supplier: 'MedSupply Corp',
    supplierContact: '+63 917 123 4567',
    location: 'Surgery Room',
    quantity: 45,
    unit: 'boxes',
    variant: 'Large',
    costPrice: 180.00,
    expiryDate: '2027-06-30',
    batches: [
      { id: '3-b1', batchNumber: 'GLV-2025-02', quantity: 25, manufacturingDate: '2025-02-01', expiryDate: '2027-06-30' },
      { id: '3-b2', batchNumber: 'GLV-2025-05', quantity: 20, manufacturingDate: '2025-05-01', expiryDate: '2027-09-30' }
    ],
    daysUntilExpiry: 410,
    status: 'in-stock',
    lastUpdated: '2026-05-13',
    reorderLevel: 20,
    avgDailyUsage: 4.2
  },
  {
    id: '4',
    image: '',
    name: 'Heartworm Prevention',
    genericName: 'Ivermectin + Pyrantel',
    sku: 'MED-HW-001',
    category: 'Medicines',
    brand: 'HeartGard Plus',
    supplier: 'VetPharm Inc',
    supplierContact: '+63 917 234 5678',
    location: 'Pharmacy Storage',
    quantity: 3,
    unit: 'boxes',
    variant: '68mcg + 57mg Tablet',
    batchNumber: 'HG-2024-01',
    costPrice: 850.00,
    expiryDate: '2026-07-15',
    batches: [
      { id: '4-b1', batchNumber: 'HG-2024-01', quantity: 3, manufacturingDate: '2024-01-15', expiryDate: '2026-07-15' }
    ],
    daysUntilExpiry: 60,
    status: 'near-expiry',
    lastUpdated: '2026-05-12',
    formType: 'Tablet',
    requiresPrescription: true,
    storageInstructions: 'Store below 30°C in a dry place',
    reorderLevel: 10,
    avgDailyUsage: 0.8
  },
  {
    id: '5',
    image: '',
    name: 'Dog Food Premium',
    sku: 'RET-DF-5KG',
    category: 'Retail Products',
    brand: 'Pedigree',
    supplier: 'Pet Supplies Co',
    supplierContact: '+63 918 345 6789',
    location: 'Retail Area',
    quantity: 22,
    unit: 'bags',
    variant: '5kg',
    costPrice: 580.00,
    expiryDate: '2026-10-30',
    batches: [
      { id: '5-b1', batchNumber: 'DF-2025-04', quantity: 12, manufacturingDate: '2025-04-01', expiryDate: '2026-10-30' },
      { id: '5-b2', batchNumber: 'DF-2025-07', quantity: 10, manufacturingDate: '2025-07-01', expiryDate: '2027-01-30' }
    ],
    status: 'in-stock',
    lastUpdated: '2026-05-09',
    reorderLevel: 30,
    avgDailyUsage: 1.8
  },
  {
    id: '6',
    image: '',
    name: 'Distemper Vaccine (DHPP)',
    sku: 'VAC-DHP-001',
    category: 'Vaccines',
    brand: 'Zoetis',
    supplier: 'VetPharm Inc',
    supplierContact: '+63 917 234 5678',
    location: 'Cold Storage',
    quantity: 24,
    unit: 'vials',
    variant: '1ml',
    batchNumber: 'DHPP-2025-01',
    costPrice: 380.00,
    manufacturingDate: '2025-01-15',
    expiryDate: '2027-01-15',
    batches: [
      { id: '6-b1', batchNumber: 'DHPP-2025-01', quantity: 14, manufacturingDate: '2025-01-15', expiryDate: '2027-01-15' },
      { id: '6-b2', batchNumber: 'DHPP-2025-03', quantity: 10, manufacturingDate: '2025-03-15', expiryDate: '2027-03-15' }
    ],
    daysUntilExpiry: 244,
    status: 'in-stock',
    lastUpdated: '2026-05-08',
    vaccineType: 'Core Vaccine',
    storageTemp: '2-8°C',
    tempStatus: 'optimal',
    storageInstructions: 'Store at 2-8°C, protect from light',
    reorderLevel: 15
  },
  {
    id: '7',
    image: '',
    name: 'Deworming Syrup',
    genericName: 'Pyrantel Pamoate',
    sku: 'MED-DW-SYR',
    category: 'Medicines',
    brand: 'Drontal',
    supplier: 'VetPharm Inc',
    location: 'Pharmacy Storage',
    quantity: 45,
    unit: 'bottles',
    variant: '50mg/ml',
    batchNumber: 'DT-2024-05',
    costPrice: 180.00,
    expiryDate: '2026-11-30',
    batches: [
      { id: '7-b1', batchNumber: 'DT-2024-05', quantity: 20, manufacturingDate: '2024-05-01', expiryDate: '2026-11-30' },
      { id: '7-b2', batchNumber: 'DT-2024-08', quantity: 25, manufacturingDate: '2024-08-01', expiryDate: '2027-02-28' }
    ],
    daysUntilExpiry: 198,
    status: 'in-stock',
    lastUpdated: '2026-05-07',
    formType: 'Syrup',
    requiresPrescription: false,
    storageInstructions: 'Store at room temperature, shake well before use'
  },
  {
    id: '8',
    image: '',
    name: 'IV Catheter Set',
    sku: 'SUP-IV-22G',
    category: 'Medical Supplies',
    brand: 'MediFlow',
    supplier: 'MedSupply Corp',
    location: 'Surgery Room',
    quantity: 12,
    unit: 'sets',
    variant: '22G',
    costPrice: 95.00,
    expiryDate: '2027-12-31',
    batches: [
      { id: '8-b1', batchNumber: 'IVC-2025-02', quantity: 12, manufacturingDate: '2025-02-01', expiryDate: '2027-12-31' }
    ],
    status: 'low-stock',
    lastUpdated: '2026-05-05',
    reorderLevel: 20,
    avgDailyUsage: 1.5
  }
];
