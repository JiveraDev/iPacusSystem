import { useState } from 'react';
import { Archive, FileText, Download, Search, CheckCircle, AlertCircle, User } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { formatDisplayDate } from '../../lib/date';

export default function DisposalLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const filteredLogs = mockDisposalLogs.filter(log => {
    const matchesSearch = log.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.disposalId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesReason = reasonFilter === 'all' || log.disposalReason === reasonFilter;
    const matchesMethod = methodFilter === 'all' || log.disposalMethod === methodFilter;
    return matchesSearch && matchesReason && matchesMethod;
  });

  const totalDisposed = mockDisposalLogs.length;
  const totalValue = mockDisposalLogs.reduce((sum, log) => sum + log.costValue, 0);
  const pendingDocs = mockDisposalLogs.filter(l => l.status === 'pending-documentation').length;

  const getReasonLabel = (reason) => {
    const labels = {
      'expired': 'Expired',
      'damaged': 'Damaged',
      'recalled': 'Product Recall',
      'contaminated': 'Contaminated',
      'temperature-abuse': 'Temperature Abuse',
      'other': 'Other'
    };
    return labels[reason] || reason;
  };

  const getMethodLabel = (method) => {
    const labels = {
      'incineration': 'Incineration',
      'chemical-treatment': 'Chemical Treatment',
      'landfill': 'Landfill',
      'return-supplier': 'Return to Supplier',
      'donation': 'Donation',
      'other': 'Other'
    };
    return labels[method] || method;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[#e0f2e9] text-[#0c6a3c] hover:bg-[#e0f2e9]">Completed</Badge>;
      case 'pending-documentation':
        return <Badge className="bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]">Pending Docs</Badge>;
      case 'awaiting-pickup':
        return <Badge className="bg-[#eff6ff] text-[#155dfc] hover:bg-[#eff6ff]">Awaiting Pickup</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
        <div>
          <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
            Disposal Logs
          </h2>
          <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
            Complete record of all disposed inventory items for regulatory compliance
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="size-4 mr-2" />
            Export Report
          </Button>
          <Button className="w-full bg-[#155dfc] hover:bg-[#0d4acf] sm:w-auto" size="sm">
            <FileText className="size-4 mr-2" />
            Generate Compliance Report
          </Button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-[#eff6ff] border border-[#155dfc] rounded-[14px] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="size-6 text-[#155dfc] mt-0.5" />
          <div className="flex-1">
            <h3 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-1">
              Regulatory Compliance
            </h3>
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              All disposal records are maintained for 5 years as per FDA and DEA regulations. Ensure proper documentation is attached for controlled substances.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#f9fafb] flex items-center justify-center">
              <Archive className="size-6 text-[#4a5565]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#101828]">
                {totalDisposed}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Total Disposals
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#e0f2e9] flex items-center justify-center">
              <CheckCircle className="size-6 text-[#0c6a3c]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#0c6a3c]">
                {mockDisposalLogs.filter(l => l.status === 'completed').length}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Completed
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#fff4e6] flex items-center justify-center">
              <FileText className="size-6 text-[#b54708]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#b54708]">
                {pendingDocs}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Pending Docs
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-[10px] bg-[#f9fafb] flex items-center justify-center">
              <AlertCircle className="size-6 text-[#4a5565]" />
            </div>
            <div>
              <h3 className="font-['Arimo:Bold',sans-serif] text-[28px] text-[#101828]">
                ₱{totalValue.toLocaleString()}
              </h3>
              <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                Total Loss Value
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#4a5565]" />
            <Input
              placeholder="Search by product, SKU, or disposal ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="recalled">Product Recall</SelectItem>
              <SelectItem value="contaminated">Contaminated</SelectItem>
              <SelectItem value="temperature-abuse">Temperature Abuse</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="incineration">Incineration</SelectItem>
              <SelectItem value="chemical-treatment">Chemical Treatment</SelectItem>
              <SelectItem value="landfill">Landfill</SelectItem>
              <SelectItem value="return-supplier">Return to Supplier</SelectItem>
              <SelectItem value="donation">Donation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Disposal Logs Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Disposal ID</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Product Name</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Batch Number</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Quantity</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Reason</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Method</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Disposal Date</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Authorized By</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Cost Value</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Status</TableHead>
              <TableHead className="font-['Arimo:Bold',sans-serif]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id} className="hover:bg-[#f9fafb]">
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#155dfc]">
                  {log.disposalId}
                </TableCell>
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  {log.productName}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {log.batchNumber}
                </TableCell>
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  {log.quantityDisposed} {log.unit}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[12px]">
                    {getReasonLabel(log.disposalReason)}
                  </Badge>
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {getMethodLabel(log.disposalMethod)}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {formatDisplayDate(log.disposalDate, { compact: true })}
                </TableCell>
                <TableCell className="font-['Arimo:Regular',sans-serif] text-[14px]">
                  {log.authorizedBy}
                </TableCell>
                <TableCell className="font-['Arimo:Bold',sans-serif] text-[14px]">
                  ₱{log.costValue.toLocaleString()}
                </TableCell>
                <TableCell>
                  {getStatusBadge(log.status)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(log)}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.1)] p-6">
        <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
          Disposal Summary - May 2026
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#f9fafb] rounded-[10px] p-4">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Items Disposed This Month
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828]">
              {mockDisposalLogs.filter(l => l.disposalDate.startsWith('2026-05')).length}
            </p>
          </div>
          <div className="bg-[#f9fafb] rounded-[10px] p-4">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Value Loss This Month
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828]">
              ₱{mockDisposalLogs
                .filter(l => l.disposalDate.startsWith('2026-05'))
                .reduce((sum, log) => sum + log.costValue, 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="bg-[#f9fafb] rounded-[10px] p-4">
            <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-1">
              Most Common Reason
            </p>
            <p className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828]">
              Expired
            </p>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[20px]">
              Disposal Log Details - {selectedLog?.disposalId}
            </DialogTitle>
            <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
              Complete disposal record and compliance documentation
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Product Information */}
              <div className="bg-[#f9fafb] rounded-[10px] p-4 space-y-3">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                  Product Information
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Product Name</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.productName}</p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">SKU</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.sku}</p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Category</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.category}</p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Batch Number</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.batchNumber}</p>
                  </div>
                </div>
              </div>

              {/* Disposal Details */}
              <div className="bg-[#f9fafb] rounded-[10px] p-4 space-y-3">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                  Disposal Details
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Quantity Disposed</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                      {selectedLog.quantityDisposed} {selectedLog.unit}
                    </p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Cost Value</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                      ₱{selectedLog.costValue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Disposal Reason</p>
                    <Badge variant="outline">{getReasonLabel(selectedLog.disposalReason)}</Badge>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Disposal Method</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">
                      {getMethodLabel(selectedLog.disposalMethod)}
                    </p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Disposal Date</p>
                    <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{formatDisplayDate(selectedLog.disposalDate)}</p>
                  </div>
                  <div>
                    <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Status</p>
                    {getStatusBadge(selectedLog.status)}
                  </div>
                </div>
              </div>

              {/* Authorization */}
              <div className="bg-[#f9fafb] rounded-[10px] p-4 space-y-3">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-3">
                  Authorization & Witnesses
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-[#4a5565]" />
                    <div>
                      <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Authorized By</p>
                      <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.authorizedBy}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-[#4a5565]" />
                    <div>
                      <p className="font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565]">Witnessed By</p>
                      <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828]">{selectedLog.witnessedBy}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-[#f9fafb] rounded-[10px] p-4">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-2">
                  Notes
                </h4>
                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                  {selectedLog.notes}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button variant="outline">
                  <Download className="size-4 mr-2" />
                  Download Certificate
                </Button>
                <Button variant="outline">
                  <FileText className="size-4 mr-2" />
                  Print Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const mockDisposalLogs = [
  {
    id: '1',
    disposalId: 'DSP-2026-0045',
    productName: 'Rabies Vaccine',
    sku: 'VAC-RAB-001',
    category: 'Vaccines',
    batchNumber: 'RAB-2024-08',
    quantityDisposed: 5,
    unit: 'vials',
    disposalReason: 'temperature-abuse',
    disposalMethod: 'incineration',
    disposalDate: '2026-05-16',
    authorizedBy: 'Dr. Maria Santos',
    witnessedBy: 'Nurse Ana Cruz',
    costValue: 2100,
    complianceCertificate: 'CERT-2026-0045.pdf',
    notes: 'Refrigerator malfunction resulted in temperature excursion. All affected vials properly documented and sent for medical waste incineration. Certificate of destruction obtained.',
    status: 'completed'
  },
  {
    id: '2',
    disposalId: 'DSP-2026-0044',
    productName: 'Surgical Gloves Box',
    sku: 'SUP-GLV-M',
    category: 'Medical Supplies',
    batchNumber: 'GLV-2024-12',
    quantityDisposed: 3,
    unit: 'boxes',
    disposalReason: 'damaged',
    disposalMethod: 'landfill',
    disposalDate: '2026-05-15',
    authorizedBy: 'Admin Manager',
    witnessedBy: 'Staff John Reyes',
    costValue: 450,
    notes: 'Water-damaged packaging from ceiling leak. Sterility compromised. Items segregated and disposed via general waste contractor.',
    status: 'completed'
  },
  {
    id: '3',
    disposalId: 'DSP-2026-0043',
    productName: 'Antibiotic Syrup',
    sku: 'MED-AMX-SYR',
    category: 'Medicines',
    batchNumber: 'AMX-2024-05',
    quantityDisposed: 2,
    unit: 'bottles',
    disposalReason: 'damaged',
    disposalMethod: 'chemical-treatment',
    disposalDate: '2026-05-14',
    authorizedBy: 'Dr. Peter Tan',
    witnessedBy: 'Pharmacist Lisa Wong',
    costValue: 680,
    complianceCertificate: 'CERT-2026-0043.pdf',
    notes: 'Broken bottles during handling. Contents neutralized using approved chemical treatment protocol before disposal.',
    status: 'completed'
  },
  {
    id: '4',
    disposalId: 'DSP-2026-0042',
    productName: 'Flea & Tick Shampoo',
    sku: 'RET-SHP-FT',
    category: 'Retail Products',
    brand: 'Pedigree',
    supplier: 'Pet Supplies Co',
    supplierContact: '+63 918 345 6789',
    quantityDisposed: 8,
    unit: 'bottles',
    disposalReason: 'expired',
    disposalMethod: 'landfill',
    disposalDate: '2026-05-11',
    authorizedBy: 'Admin Staff',
    witnessedBy: 'Staff Member',
    costValue: 1920,
    notes: 'Expired retail products past shelf life. Defaced labels and disposed per standard protocol.',
    status: 'completed'
  },
  {
    id: '5',
    disposalId: 'DSP-2026-0041',
    productName: 'Heartworm Prevention',
    sku: 'MED-HW-PREV',
    category: 'Medicines',
    batchNumber: 'HW-2024-09',
    quantityDisposed: 12,
    unit: 'tablets',
    disposalReason: 'contaminated',
    disposalMethod: 'return-supplier',
    disposalDate: '2026-05-10',
    authorizedBy: 'Dr. Peter Tan',
    witnessedBy: 'Pharmacist',
    costValue: 1800,
    notes: 'Contaminated batch with visible mold. Supplier notified, RMA issued. Items returned for credit and manufacturer investigation.',
    status: 'awaiting-pickup'
  },
  {
    id: '6',
    disposalId: 'DSP-2026-0040',
    productName: 'Vitamin Supplement',
    sku: 'MED-VIT-MUL',
    category: 'Medicines',
    batchNumber: 'VIT-2024-02',
    quantityDisposed: 48,
    unit: 'bottles',
    disposalReason: 'expired',
    disposalMethod: 'incineration',
    disposalDate: '2026-05-08',
    authorizedBy: 'Dr. Maria Santos',
    witnessedBy: 'Nurse Ana Cruz',
    costValue: 13440,
    notes: 'Large batch of expired vitamin supplements. Sent to approved medical waste facility for incineration. Awaiting compliance certificate.',
    status: 'pending-documentation'
  },
  {
    id: '7',
    disposalId: 'DSP-2026-0039',
    productName: 'Eye Drops',
    sku: 'MED-EYE-001',
    category: 'Medicines',
    batchNumber: 'OPT-2024-01',
    quantityDisposed: 8,
    unit: 'bottles',
    disposalReason: 'expired',
    disposalMethod: 'chemical-treatment',
    disposalDate: '2026-05-05',
    authorizedBy: 'Pharmacist Lisa Wong',
    witnessedBy: 'Staff Member',
    costValue: 1000,
    complianceCertificate: 'CERT-2026-0039.pdf',
    notes: 'Expired ophthalmic solutions. Contents neutralized and disposed following pharmaceutical waste protocols.',
    status: 'completed'
  },
  {
    id: '8',
    disposalId: 'DSP-2026-0038',
    productName: 'Disinfectant Spray',
    sku: 'CON-DIS-500',
    category: 'Consumables',
    batchNumber: 'DIS-2024-11',
    quantityDisposed: 4,
    unit: 'bottles',
    disposalReason: 'damaged',
    disposalMethod: 'landfill',
    disposalDate: '2026-05-03',
    authorizedBy: 'Admin Staff',
    witnessedBy: 'Cleaning Staff',
    costValue: 520,
    notes: 'Defective spray nozzles causing leakage. Product integrity compromised. Disposed as general waste.',
    status: 'completed'
  }
];
