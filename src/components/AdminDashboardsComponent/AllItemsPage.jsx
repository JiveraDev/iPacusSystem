import { useState } from 'react';
import { Search, Filter, Download, Plus, Trash2, Eye, Package, List, LayoutGrid, Pill, Syringe, Thermometer, FileText, MinusCircle, Pencil, Save, X } from 'lucide-react';
import { useNavigate } from '../dashboardRouter.jsx';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import InventoryStatusBadge from './InventoryStatusBadge';
import { createStockOut, fetchInventoryItems, fetchInventoryMeta, getCurrentUser, updateInventoryItem } from '../../services/inventoryApi';
import { formatDisplayDate } from '../../lib/date';
import { formatPhpCurrency } from '../../lib/currency';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';

export default function AllItemsPage() {
  const navigate = useNavigate();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewMode, setViewMode] = useState('card');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [stockOutItem, setStockOutItem] = useState(null);
  const [stockOutBatchId, setStockOutBatchId] = useState('');
  const [stockOutQuantity, setStockOutQuantity] = useState('');
  const [batchSort, setBatchSort] = useState('newest');
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [editItemForm, setEditItemForm] = useState({ unitCost: '', locationId: '' });

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

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(filteredItems.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId, checked) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setEditItemForm({
      unitCost: String(item.costPrice ?? ''),
      locationId: String(item.locationId ?? '')
    });
    setIsEditingItem(false);
    setIsDetailModalOpen(true);
  };

  const openStockOutModal = (item) => {
    const batches = getItemBatches(item, 'newest');
    setStockOutItem(item);
    setStockOutBatchId(batches[0]?.id || '');
    setStockOutQuantity('');
  };

  const handleStockOut = async () => {
    const quantityToRemove = Number(stockOutQuantity);
    const selectedBatch = getItemBatches(stockOutItem, 'newest').find((batch) => String(batch.id) === String(stockOutBatchId));

    if (!stockOutItem || !selectedBatch || !Number.isFinite(quantityToRemove) || quantityToRemove <= 0) {
      return;
    }

    if (quantityToRemove > Number(selectedBatch.quantity || 0)) {
      const message = `Stock out quantity cannot exceed ${selectedBatch.quantity} ${stockOutItem.unit} in ${selectedBatch.batchNumber}.`;
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const currentUser = getCurrentUser();
      const stockOutName = stockOutItem.name;
      await createStockOut({
        user_id: currentUser?.id || currentUser?.user_id,
        item_id: stockOutItem.itemId || stockOutItem.id,
        batch_id: stockOutBatchId,
        quantity: quantityToRemove
      });
      setStockOutItem(null);
      setStockOutQuantity('');
      const updatedItems = await loadInventory();
      const updatedItem = updatedItems.find((item) => String(item.itemId || item.id) === String(stockOutItem.itemId || stockOutItem.id));
      if (updatedItem) {
        setSelectedItem(updatedItem);
        setEditItemForm({
          unitCost: String(updatedItem.costPrice ?? ''),
          locationId: String(updatedItem.locationId ?? '')
        });
      }
      toast.success(`${stockOutName} stock-out recorded.`);
    } catch (error) {
      const message = error.message || 'Failed to record stock out.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleEditItem = () => {
    if (!selectedItem) return;
    setEditItemForm({
      unitCost: String(selectedItem.costPrice ?? ''),
      locationId: String(selectedItem.locationId ?? '')
    });
    setIsEditingItem(true);
  };

  const handleSaveItem = async () => {
    if (!selectedItem) return;

    const unitCost = Number(editItemForm.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      const message = 'Enter a valid unit cost.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!editItemForm.locationId) {
      const message = 'Select an inventory location.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSavingItem(true);
    setErrorMessage('');

    try {
      const currentUser = getCurrentUser();
      await updateInventoryItem({
        user_id: currentUser?.id || currentUser?.user_id,
        item_id: selectedItem.itemId || selectedItem.id,
        unit_cost: unitCost,
        location_id: editItemForm.locationId
      });
      const updatedItems = await loadInventory();
      const updatedItem = updatedItems.find((item) => String(item.itemId || item.id) === String(selectedItem.itemId || selectedItem.id));
      if (updatedItem) {
        setSelectedItem(updatedItem);
        setEditItemForm({
          unitCost: String(updatedItem.costPrice ?? ''),
          locationId: String(updatedItem.locationId ?? '')
        });
      }
      setIsEditingItem(false);
      toast.success(`${updatedItem?.name || selectedItem.name} inventory details updated.`);
    } catch (error) {
      const message = error.message || 'Failed to update inventory item.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSavingItem(false);
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.genericName && item.genericName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
  });

  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const lowStockCount = inventoryItems.filter(item => item.status === 'low-stock').length;
  const nearExpiryCount = inventoryItems.filter(item => item.status === 'near-expiry').length;

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
  const selectedItemBatches = selectedItem ? getItemBatches(selectedItem, batchSort) : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
            All Inventory Items
          </h2>
          <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
            Manage all products, medicines, and supplies
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">

          <Button
            className="w-full bg-[#155dfc] hover:bg-[#0d4acf] sm:w-auto"
            size="sm"
            onClick={() => navigate('/dashboard/inventory/add')}
          >
            <Plus className="size-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5565]" />
            <Input
              placeholder="Search by name, SKU, or generic name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
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
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.name}>{location.name}</SelectItem>
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
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low-stock">Low Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              <SelectItem value="near-expiry">Near Expiry</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards & View Toggle */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Total Products
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828]">
              {inventoryItems.length}
            </p>
          </div>
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Total Value
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#155dfc]">
              {formatPhpCurrency(totalValue)}
            </p>
          </div>
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Low Stock
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#b54708]">
              {lowStockCount}
            </p>
          </div>
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 min-w-0">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Near Expiry
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#d92d20]">
              {nearExpiryCount}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex w-full gap-2 rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-2 sm:w-auto">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={`flex-1 sm:flex-none ${viewMode === 'list' ? 'bg-[#155dfc]' : ''}`}
          >
            <List className="size-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === 'card' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('card')}
            className={`flex-1 sm:flex-none ${viewMode === 'card' ? 'bg-[#155dfc]' : ''}`}
          >
            <LayoutGrid className="size-4 mr-2" />
            Card
          </Button>
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

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-[#155dfc] bg-[#eff6ff] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">
            {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-wrap gap-2">

            <Button variant="destructive" size="sm" onClick={() => setSelectedItems([])}>
              <Trash2 className="size-4 mr-2" />
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Content - List View */}
      {!isLoading && viewMode === 'list' && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Product Name</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">SKU</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Category</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Brand</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Location</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Quantity</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Unit Cost</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Batch / Expiry</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
                  <TableHead className="font-['Arimo:Bold',sans-serif] w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-[#f9fafb] cursor-pointer"
                    onClick={(e) => {
                      if (!e.target.closest('input, button')) {
                        handleItemClick(item);
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="size-[50px] rounded-[8px] bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="size-full object-cover" />
                        ) : (
                          getCategoryIcon(item.category)
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                      {item.name}
                    </TableCell>
                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      {item.sku}
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
                    <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                      {formatPhpCurrency(item.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      {getNearestExpiryBatch(item)?.batchNumber || 'No batch'} - {formatInventoryDate(getNearestExpiryBatch(item)?.expiryDate, { compact: true })}
                    </TableCell>
                    <TableCell>
                      <InventoryStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleItemClick(item)}>
                        <Eye className="size-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-[rgba(0,0,0,0.1)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Showing {filteredItems.length} of {inventoryItems.length} items
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button variant="outline" size="sm" className="bg-[#155dfc] text-white">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </div>
      )}

      {/* Content - Card View */}
      {!isLoading && viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4 hover:shadow-lg transition-shadow cursor-pointer sm:p-6"
              onClick={() => handleItemClick(item)}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-1">
                    {item.name}
                  </h3>
                  {item.genericName && (
                    <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                      {item.genericName}
                    </p>
                  )}
                </div>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[#eff6ff]">
                  {getCategoryIcon(item.category)}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="text-[12px]">
                  {item.category}
                </Badge>
                {item.isControlled && (
                  <Badge className="bg-[#ffe6e6] text-[#d92d20] hover:bg-[#ffe6e6] text-[12px]">
                    Controlled
                  </Badge>
                )}
                {item.requiresPrescription && (
                  <Badge className="bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6] text-[12px]">
                    Rx Required
                  </Badge>
                )}
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                    Brand:
                  </span>
                  <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {item.brand}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                    Available:
                  </span>
                  <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {item.quantity} {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                    SKU:
                  </span>
                  <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                    {item.sku}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                    Location:
                  </span>
                  <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {item.location}
                  </span>
                </div>
              </div>

              {/* Batch Information */}
              <div className="rounded-[8px] border border-[rgba(0,0,0,0.08)] p-3 mb-4">
                <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-[#101828] mb-2">
                  Batch Information
                </p>
                <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                  {getItemBatches(item, 'newest').map((batch) => (
                    <div key={batch.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <div>
                        <p className="font-['Arimo:Bold',sans-serif] text-[#101828]">{batch.batchNumber}</p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[#4a5565]">Expires {formatInventoryDate(batch.expiryDate, { compact: true })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-['Arimo:Bold',sans-serif] text-[#101828]">{batch.quantity} {item.unit}</p>
                      </div>
                    </div>
                  ))}
                  {getItemBatches(item, 'newest').length === 0 && (
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      No available batches
                    </p>
                  )}
                </div>
              </div>

              {/* Cost */}
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-[rgba(0,0,0,0.05)]">
                <div>
                  <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                    Unit Cost
                  </p>
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                    {formatPhpCurrency(item.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <div className="rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-6 text-center sm:p-12">
          <Package className="size-12 text-[#4a5565] mx-auto mb-4" />
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-2">
            No items found
          </h3>
          <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
            Try adjusting your search or filter criteria
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
                  <Button
                    type="button"
                    variant={isEditingItem ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={isEditingItem ? () => setIsEditingItem(false) : handleEditItem}
                  >
                    {isEditingItem ? (
                      <>
                        <X className="size-4 mr-2" />
                        Cancel Edit
                      </>
                    ) : (
                      <>
                        <Pencil className="size-4 mr-2" />
                        Edit
                      </>
                    )}
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
                        <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">SKU</p>
                        <p className="font-['Arimo:Bold',sans-serif] text-[15px] text-[#101828]">{selectedItem.sku}</p>
                      </div>
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
                          <Select
                            value={editItemForm.locationId}
                            onValueChange={(value) => setEditItemForm((current) => ({ ...current, locationId: value }))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue
                                placeholder="Select location"
                                displayValue={locations.find((location) => String(location.id) === String(editItemForm.locationId))?.name}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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

                {/* Batch Information */}
                <div className="bg-[#f9fafb] rounded-[10px] p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
                      Batch Information
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
                      <div key={batch.id} className="grid grid-cols-1 gap-3 rounded-[8px] bg-white border border-[rgba(0,0,0,0.08)] p-3 sm:grid-cols-4">
                        <div>
                          <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">Batch</p>
                          <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{batch.batchNumber}</p>
                        </div>
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
                        No available batches
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

                {/* Cost */}
                <div className="p-4 bg-[#f9fafb] rounded-[10px]">
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] mb-1">Unit Cost</p>
                    {isEditingItem ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editItemForm.unitCost}
                        onChange={(event) => setEditItemForm((current) => ({ ...current, unitCost: event.target.value }))}
                        className="max-w-xs"
                      />
                    ) : (
                    <p className="font-['Arimo:Bold',sans-serif] text-[20px] text-[#101828]">
                      {formatPhpCurrency(selectedItem.costPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
                  {isEditingItem && (
                    <Button className="flex-1 bg-[#155dfc] hover:bg-[#0d4acf]" onClick={handleSaveItem} disabled={isSavingItem}>
                      <Save className="size-4 mr-2" />
                      {isSavingItem ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/inventory/stock-in')}>
                    <FileText className="size-4 mr-2" />
                    Stock In
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => openStockOutModal(selectedItem)}>
                    <MinusCircle className="size-4 mr-2" />
                    Stock Out
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
                  Select the batch and quantity that will be deducted from {stockOutItem.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">Batch</p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      {stockOutBatches.length} available
                    </p>
                  </div>
                  {stockOutBatches.length > 0 ? (
                    <Select value={stockOutBatchId} onValueChange={setStockOutBatchId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Select batch"
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
                      No available batches for this item.
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
                    disabled={!selectedStockOutBatch}
                  />
                  {selectedStockOutBatch && (
                    <p className="mt-1 font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      Available in selected batch: {selectedStockOutBatch.quantity} {stockOutItem.unit}
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

function getNearestExpiryBatch(item) {
  return getItemBatches(item, 'expiry')[0];
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
  return `${batch.batchNumber} - ${batch.quantity} ${unit} - expires ${formatInventoryDate(batch.expiryDate, { compact: true })}`;
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
