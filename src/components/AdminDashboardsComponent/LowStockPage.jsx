import { useState } from 'react';
import { AlertTriangle, Package, TrendingDown, ShoppingCart, Phone } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

export default function LowStockPage() {
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredItems = mockLowStockItems.filter(item =>
    priorityFilter === 'all' || item.priority === priorityFilter
  );

  const criticalCount = mockLowStockItems.filter(i => i.priority === 'critical').length;
  const highCount = mockLowStockItems.filter(i => i.priority === 'high').length;
  const totalItems = mockLowStockItems.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
          Low Stock Items
        </h2>
        <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
          Monitor inventory levels and reorder items before stockouts
        </p>
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="bg-[#ffe6e6] border border-[#d92d20] rounded-[14px] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-6 text-[#d92d20] mt-0.5" />
            <div className="flex-1">
              <h3 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-1">
                Critical Stock Levels
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                {criticalCount} item{criticalCount > 1 ? 's are' : ' is'} at critical stock levels. Immediate reordering recommended to avoid service disruption.
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Create Bulk Order
            </Button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#fff4e6] flex items-center justify-center">
              <TrendingDown className="size-6 text-[#b54708]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#b54708]">
                {totalItems}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Low Stock Items
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#ffe6e6] flex items-center justify-center">
              <AlertTriangle className="size-6 text-[#d92d20]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#d92d20]">
                {criticalCount}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Critical Priority
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#fff4e6] flex items-center justify-center">
              <Package className="size-6 text-[#b54708]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#b54708]">
                {highCount}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                High Priority
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#eff6ff] flex items-center justify-center">
              <ShoppingCart className="size-6 text-[#155dfc]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#155dfc]">
                {criticalCount + highCount}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Need Reorder
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4">
        <div className="flex items-center gap-4">
          <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
            Filter by Priority:
          </span>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="critical">Critical Priority</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Product Name</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Category</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Current Stock</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Reorder Level</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Avg Daily Usage</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Days Until Depletion</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Supplier</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Priority</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#f9fafb]">
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  {item.name}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {item.category}
                </TableCell>
                <TableCell>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-[8px] ${
                    item.priority === 'critical'
                      ? 'bg-[#ffe6e6]'
                      : item.priority === 'high'
                      ? 'bg-[#fff4e6]'
                      : 'bg-[#f9fafb]'
                  }`}>
                    <Package className={`size-4 ${
                      item.priority === 'critical'
                        ? 'text-[#d92d20]'
                        : item.priority === 'high'
                        ? 'text-[#b54708]'
                        : 'text-[#4a5565]'
                    }`} />
                    <span className={`font-['Arimo:Bold',sans-serif] text-[14px] ${
                      item.priority === 'critical'
                        ? 'text-[#d92d20]'
                        : item.priority === 'high'
                        ? 'text-[#b54708]'
                        : 'text-[#4a5565]'
                    }`}>
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                  {item.reorderLevel} {item.unit}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {item.avgDailyUsage} {item.unit}/day
                </TableCell>
                <TableCell>
                  <div className={`inline-flex items-center gap-1 ${
                    item.daysUntilDepletion <= 3
                      ? 'text-[#d92d20]'
                      : item.daysUntilDepletion <= 7
                      ? 'text-[#b54708]'
                      : 'text-[#4a5565]'
                  }`}>
                    <AlertTriangle className="size-4" />
                    <span className="font-['Arimo:Bold',sans-serif] text-[14px]">
                      ~{item.daysUntilDepletion} days
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                      {item.supplier}
                    </p>
                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                      {item.supplierContact}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.priority === 'critical' ? 'destructive' : 'secondary'}
                    className={
                      item.priority === 'high'
                        ? 'bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]'
                        : item.priority === 'medium'
                        ? 'bg-[#f3f3f5] text-[#4a5565] hover:bg-[#f3f3f5]'
                        : ''
                    }
                  >
                    {item.priority.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <ShoppingCart className="size-4 mr-2" />
                      Reorder
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Phone className="size-4 mr-2" />
                      Contact
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Reorder Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
            Automated Reorder Suggestions
          </h3>
          <div className="space-y-3">
            {filteredItems.slice(0, 3).map((item, index) => (
              <div key={item.id} className="flex items-start gap-3 p-4 bg-[#f9fafb] rounded-[10px]">
                <div className="size-8 rounded-[8px] bg-[#eff6ff] flex items-center justify-center shrink-0">
                  <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                    {item.name}
                  </p>
                  <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                    Suggested order: {Math.ceil(item.avgDailyUsage * 30)} {item.unit} (30-day supply)
                  </p>
                </div>
                <Button size="sm" className="bg-[#155dfc] hover:bg-[#0d4acf]">
                  Order Now
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start h-auto py-4">
              <ShoppingCart className="size-5 mr-3 text-[#155dfc]" />
              <div className="text-left">
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                  Create Bulk Purchase Order
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                  Generate PO for all critical items
                </p>
              </div>
            </Button>

            <Button variant="outline" className="w-full justify-start h-auto py-4">
              <Phone className="size-5 mr-3 text-[#155dfc]" />
              <div className="text-left">
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                  Contact All Suppliers
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                  Send reorder requests to suppliers
                </p>
              </div>
            </Button>

            <Button variant="outline" className="w-full justify-start h-auto py-4">
              <Package className="size-5 mr-3 text-[#155dfc]" />
              <div className="text-left">
                <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                  Export Stock Report
                </p>
                <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                  Download detailed stock analysis
                </p>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const mockLowStockItems = [
  {
    id: '1',
    name: 'Rabies Vaccine',
    category: 'Vaccines',
    supplier: 'VetPharm Inc',
    supplierContact: '+63 917 234 5678',
    currentStock: 8,
    reorderLevel: 15,
    unit: 'vials',
    lastReorderDate: '2026-03-01',
    avgDailyUsage: 2.5,
    daysUntilDepletion: 3,
    priority: 'critical'
  },
  {
    id: '2',
    name: 'Heartworm Prevention',
    category: 'Medicines',
    supplier: 'VetPharm Inc',
    supplierContact: '+63 917 234 5678',
    currentStock: 3,
    reorderLevel: 10,
    unit: 'boxes',
    lastReorderDate: '2026-04-15',
    avgDailyUsage: 0.8,
    daysUntilDepletion: 4,
    priority: 'critical'
  },
  {
    id: '3',
    name: 'IV Catheter Set',
    category: 'Medical Supplies',
    supplier: 'MedSupply Corp',
    supplierContact: '+63 917 123 4567',
    currentStock: 12,
    reorderLevel: 20,
    unit: 'sets',
    lastReorderDate: '2026-03-20',
    avgDailyUsage: 1.5,
    daysUntilDepletion: 8,
    priority: 'high'
  },
  {
    id: '4',
    name: 'Surgical Gloves',
    category: 'Medical Supplies',
    supplier: 'MedSupply Corp',
    supplierContact: '+63 917 123 4567',
    currentStock: 45,
    reorderLevel: 60,
    unit: 'boxes',
    lastReorderDate: '2026-04-01',
    avgDailyUsage: 4.2,
    daysUntilDepletion: 11,
    priority: 'high'
  },
  {
    id: '5',
    name: 'Dog Food Premium',
    category: 'Retail Products',
    supplier: 'Pet Supplies Co',
    supplierContact: '+63 918 345 6789',
    currentStock: 22,
    reorderLevel: 30,
    unit: 'bags',
    lastReorderDate: '2026-04-10',
    avgDailyUsage: 1.8,
    daysUntilDepletion: 12,
    priority: 'medium'
  },
  {
    id: '6',
    name: 'Disinfectant Spray',
    category: 'Medical Supplies',
    supplier: 'MedSupply Corp',
    supplierContact: '+63 917 123 4567',
    currentStock: 38,
    reorderLevel: 50,
    unit: 'bottles',
    lastReorderDate: '2026-03-25',
    avgDailyUsage: 2.8,
    daysUntilDepletion: 14,
    priority: 'medium'
  }
];
