import { createElement, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Package, TrendingDown } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchInventoryItems } from '../../services/inventoryApi';
import { useNavigate } from '../dashboardRouter.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import InventoryBranchScope from './InventoryBranchScope.jsx';
import { useInventoryBranchScope } from '../../hooks/useInventoryBranchScope.js';

const INVENTORY_SELECTION_KEY = 'ipawcus-inventory-report-selection';

export default function LowStockPage() {
  const navigate = useNavigate();
  const branchScope = useInventoryBranchScope();
  const { branchId } = branchScope;
  const [inventoryItems, setInventoryItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useAutoRefresh(async ({ isAutoRefresh = false } = {}) => {
    if (!isAutoRefresh) setIsLoading(true);
    try {
      const response = await fetchInventoryItems({ branchId });
      setInventoryItems(Array.isArray(response?.items) ? response.items : []);
      setErrorMessage('');
    } catch (error) {
      if (!isAutoRefresh) setErrorMessage(error.message || 'Stock-level inventory could not be loaded.');
      throw error;
    } finally {
      if (!isAutoRefresh) setIsLoading(false);
    }
  }, {
    enabled: Boolean(branchId),
    refreshKey: `inventory-low-stock-${branchId || 'unassigned'}`
  });

  useEffect(() => {
    setInventoryItems([]);
  }, [branchId]);

  const attentionItems = useMemo(() => inventoryItems.flatMap((item) => {
    const availableQuantity = Number(item.availableQuantity ?? item.quantity ?? 0);
    const onHandQuantity = Number(item.quantity ?? 0);
    const reorderLevel = Number(item.reorderLevel || 0);
    const stockStatus = item.stockStatus || (availableQuantity <= 0 ? 'out-of-stock' : availableQuantity <= reorderLevel ? 'low-stock' : 'in-stock');
    if (!['low-stock', 'out-of-stock'].includes(stockStatus)) return [];

    return [{
      ...item,
      availableQuantity,
      onHandQuantity,
      reorderLevel,
      stockStatus,
      severity: stockStatus === 'out-of-stock' || availableQuantity <= Math.max(1, Math.floor(reorderLevel / 2)) ? 'critical' : 'warning'
    }];
  }), [inventoryItems]);

  const filteredItems = attentionItems.filter((item) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'critical') return item.severity === 'critical';
    return item.stockStatus === statusFilter;
  });
  const outOfStockCount = attentionItems.filter((item) => item.stockStatus === 'out-of-stock').length;
  const lowStockCount = attentionItems.filter((item) => item.stockStatus === 'low-stock').length;
  const criticalCount = attentionItems.filter((item) => item.severity === 'critical').length;

  const viewItem = (itemId) => {
    sessionStorage.setItem(INVENTORY_SELECTION_KEY, JSON.stringify({ itemId }));
    navigate('/dashboard/inventory');
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader icon={TrendingDown} title="Low & Out-of-Stock Items" description="Live usable-stock levels compared with each product's reorder threshold." />

      <InventoryBranchScope
        branches={branchScope.branches}
        branchId={branchScope.branchId}
        selectedBranch={branchScope.selectedBranch}
        canSelectBranch={branchScope.canSelectBranch}
        isLoading={branchScope.isLoadingBranches}
        error={branchScope.branchError}
        onBranchChange={branchScope.setBranchId}
      />

      {outOfStockCount > 0 && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-red-300 bg-red-50 p-4 sm:flex-row sm:items-center dark:border-red-900 dark:bg-red-950/30">
          <AlertTriangle className="size-6 shrink-0 text-red-700 dark:text-red-300" />
          <div className="flex-1"><h3 className="font-bold text-slate-950 dark:text-slate-100">Usable stock is unavailable</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{outOfStockCount} product{outOfStockCount === 1 ? '' : 's'} cannot be issued, sold, or used because no unexpired quantity remains.</p></div>
          <Button variant="destructive" size="sm" onClick={() => setStatusFilter('out-of-stock')}>Review out of stock</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={TrendingDown} label="Needs Restocking" value={attentionItems.length} tone="amber" />
        <SummaryCard icon={AlertTriangle} label="Out of Stock" value={outOfStockCount} tone="red" />
        <SummaryCard icon={Package} label="Low Stock" value={lowStockCount} tone="amber" />
        <SummaryCard icon={AlertTriangle} label="Critical" value={criticalCount} tone="red" />
      </div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Stock condition</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All restocking needs</SelectItem>
            <SelectItem value="out-of-stock">Out of stock</SelectItem>
            <SelectItem value="low-stock">Low stock</SelectItem>
            <SelectItem value="critical">Critical level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{errorMessage}</div>}

      <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table className="min-w-[940px]">
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Usable Stock</TableHead><TableHead>On Hand</TableHead><TableHead>Reorder At</TableHead><TableHead>Supplier</TableHead><TableHead>Stock Status</TableHead><TableHead>Expiry Alert</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {!isLoading && filteredItems.map((item) => (
                <TableRow key={item.itemId || item.id}>
                  <TableCell><p className="font-bold text-slate-950 dark:text-slate-100">{item.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.category}</p></TableCell>
                  <TableCell className={item.stockStatus === 'out-of-stock' ? 'font-black text-red-700 dark:text-red-300' : 'font-black text-amber-700 dark:text-amber-300'}>{item.availableQuantity} {item.unit}</TableCell>
                  <TableCell><p className="font-bold">{item.onHandQuantity} {item.unit}</p>{Number(item.expiredQuantity || 0) > 0 && <p className="mt-0.5 text-xs font-semibold text-red-700 dark:text-red-300">{item.expiredQuantity} expired</p>}</TableCell>
                  <TableCell>{item.reorderLevel} {item.unit}</TableCell>
                  <TableCell>{item.supplier || 'No supplier recorded'}</TableCell>
                  <TableCell><StockBadge status={item.stockStatus} /></TableCell>
                  <TableCell>{item.expiryStatus ? <StockBadge status={item.expiryStatus} /> : <span className="text-sm text-slate-400">None</span>}</TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => viewItem(item.itemId || item.id)}><Eye className="size-4" />View item</Button></TableCell>
                </TableRow>
              ))}
              {isLoading && <MessageRow message="Loading live stock levels…" />}
              {!isLoading && filteredItems.length === 0 && <MessageRow message="No products match this stock condition." />}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }) {
  const tones = tone === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return <div className="rounded-[14px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-lg ${tones}`}>{createElement(icon, { className: 'size-5' })}</span><div><p className="text-2xl font-black text-slate-950 dark:text-slate-100">{value}</p><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p></div></div></div>;
}

function StockBadge({ status }) {
  const labels = { 'out-of-stock': 'Out of Stock', 'low-stock': 'Low Stock', 'near-expiry': 'Near Expiry', expired: 'Expired' };
  const danger = ['out-of-stock', 'expired'].includes(status);
  return <Badge className={danger ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'}>{labels[status] || status}</Badge>;
}

function MessageRow({ message }) {
  return <TableRow><TableCell colSpan={8} className="h-40 text-center text-sm text-slate-500 dark:text-slate-400">{message}</TableCell></TableRow>;
}
