import { useState } from 'react';
import { Clock, AlertTriangle, Package, Archive } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

export default function NearExpiryPage() {
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  const filteredItems = mockExpiringItems.filter(item =>
    urgencyFilter === 'all' || item.urgencyLevel === urgencyFilter
  );

  const criticalCount = mockExpiringItems.filter(i => i.urgencyLevel === 'critical').length;
  const highCount = mockExpiringItems.filter(i => i.urgencyLevel === 'high').length;
  const totalValue = mockExpiringItems.reduce((sum, item) => sum + item.costValue, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
          Near Expiry Items
        </h2>
        <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
          Monitor and manage items approaching expiration
        </p>
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="bg-[#ffe6e6] border border-[#d92d20] rounded-[14px] p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <AlertTriangle className="size-6 text-[#d92d20] mt-0.5" />
            <div className="flex-1">
              <h3 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-1">
                Urgent Action Required
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                {criticalCount} item{criticalCount > 1 ? 's' : ''} expiring within 30 days. Review and take action immediately to prevent losses.
              </p>
            </div>
            <Button variant="destructive" size="sm" className="w-full sm:w-auto">
              Review Now
            </Button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#fff4e6] flex items-center justify-center">
              <Clock className="size-6 text-[#b54708]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#b54708]">
                {mockExpiringItems.length}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Total Items
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
                Critical (≤30 days)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#fff4e6] flex items-center justify-center">
              <Clock className="size-6 text-[#b54708]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#b54708]">
                {highCount}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                High (31-60 days)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#f9fafb] flex items-center justify-center">
              <Package className="size-6 text-[#4a5565]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#101828]">
                ₱{totalValue.toLocaleString()}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Total Value at Risk
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
            Filter by Urgency:
          </span>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="critical">Critical (≤30 days)</SelectItem>
              <SelectItem value="high">High (31-60 days)</SelectItem>
              <SelectItem value="medium">Medium (61-90 days)</SelectItem>
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
              <TableHead className="font-['Arimo:Bold',sans-serif]">Batch Number</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Quantity</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Expiry Date</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Days Remaining</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Cost Value</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Urgency</TableHead>
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
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                  {item.batchNumber}
                </TableCell>
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  {item.quantity} {item.unit}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {item.expiryDate}
                </TableCell>
                <TableCell>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-[8px] ${
                    item.urgencyLevel === 'critical'
                      ? 'bg-[#ffe6e6]'
                      : item.urgencyLevel === 'high'
                      ? 'bg-[#fff4e6]'
                      : 'bg-[#f9fafb]'
                  }`}>
                    <Clock className={`size-4 ${
                      item.urgencyLevel === 'critical'
                        ? 'text-[#d92d20]'
                        : item.urgencyLevel === 'high'
                        ? 'text-[#b54708]'
                        : 'text-[#4a5565]'
                    }`} />
                    <span className={`font-['Arimo:Bold',sans-serif] text-[14px] ${
                      item.urgencyLevel === 'critical'
                        ? 'text-[#d92d20]'
                        : item.urgencyLevel === 'high'
                        ? 'text-[#b54708]'
                        : 'text-[#4a5565]'
                    }`}>
                      {item.daysRemaining} days
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  ₱{item.costValue.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.urgencyLevel === 'critical' ? 'destructive' : 'secondary'}
                    className={
                      item.urgencyLevel === 'high'
                        ? 'bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]'
                        : item.urgencyLevel === 'medium'
                        ? 'bg-[#f3f3f5] text-[#4a5565] hover:bg-[#f3f3f5]'
                        : ''
                    }
                  >
                    {item.urgencyLevel.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" size="sm">
                      <Archive className="size-4 mr-2" />
                      Mark for Disposal
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Suggested Actions */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
        <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
          Suggested Actions
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-[#f9fafb] rounded-[10px]">
            <div className="size-8 rounded-[8px] bg-[#eff6ff] flex items-center justify-center shrink-0">
              <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">1</span>
            </div>
            <div>
              <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                Review Critical Items First
              </p>
              <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                Prioritize items expiring within 30 days to prevent financial losses.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#f9fafb] rounded-[10px]">
            <div className="size-8 rounded-[8px] bg-[#eff6ff] flex items-center justify-center shrink-0">
              <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">2</span>
            </div>
            <div>
              <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                Offer Discounts or Promotions
              </p>
              <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                Consider discounting items with 60-90 days remaining to increase turnover.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#f9fafb] rounded-[10px]">
            <div className="size-8 rounded-[8px] bg-[#eff6ff] flex items-center justify-center shrink-0">
              <span className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">3</span>
            </div>
            <div>
              <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                Document and Report Disposal
              </p>
              <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">
                Properly log all expired items for regulatory compliance and inventory tracking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const mockExpiringItems = [
  {
    id: '1',
    name: 'Vitamin Supplement',
    category: 'Medicines',
    batchNumber: 'VIT-2024-03',
    quantity: 65,
    unit: 'bottles',
    expiryDate: '2026-06-30',
    daysRemaining: 15,
    costValue: 18200,
    urgencyLevel: 'critical'
  },
  {
    id: '2',
    name: 'Eye Drops',
    category: 'Medicines',
    batchNumber: 'OPT-2024-02',
    quantity: 5,
    unit: 'bottles',
    expiryDate: '2026-06-30',
    daysRemaining: 25,
    costValue: 625,
    urgencyLevel: 'critical'
  },
  {
    id: '3',
    name: 'Feline Leukemia Vaccine',
    category: 'Vaccines',
    batchNumber: 'FELV-2024-06',
    quantity: 3,
    unit: 'vials',
    expiryDate: '2026-06-15',
    daysRemaining: 30,
    costValue: 1260,
    urgencyLevel: 'critical'
  },
  {
    id: '4',
    name: 'Heartworm Prevention',
    category: 'Medicines',
    batchNumber: 'HG-2024-01',
    quantity: 18,
    unit: 'tabs',
    expiryDate: '2026-07-15',
    daysRemaining: 45,
    costValue: 2556,
    urgencyLevel: 'high'
  },
  {
    id: '5',
    name: 'Deworming Tablets',
    category: 'Medicines',
    batchNumber: 'DW-2024-05',
    quantity: 42,
    unit: 'pcs',
    expiryDate: '2026-08-10',
    daysRemaining: 55,
    costValue: 1470,
    urgencyLevel: 'high'
  },
  {
    id: '6',
    name: 'Antibiotic Cream',
    category: 'Medicines',
    batchNumber: 'NEO-2024-04',
    quantity: 32,
    unit: 'tubes',
    expiryDate: '2026-09-15',
    daysRemaining: 85,
    costValue: 3040,
    urgencyLevel: 'medium'
  }
];
