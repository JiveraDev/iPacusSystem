import { createElement, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Eye, Package } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { formatDisplayDate } from '../../lib/date';
import { formatPhpCurrency } from '../../lib/currency';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchInventoryItems } from '../../services/inventoryApi';
import { useNavigate } from '../dashboardRouter.jsx';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import InventoryBranchScope from './InventoryBranchScope.jsx';
import { useInventoryBranchScope } from '../../hooks/useInventoryBranchScope.js';

const INVENTORY_SELECTION_KEY = 'ipawcus-inventory-report-selection';

export default function NearExpiryPage() {
  const navigate = useNavigate();
  const branchScope = useInventoryBranchScope();
  const { branchId } = branchScope;
  const [inventoryItems, setInventoryItems] = useState([]);
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useAutoRefresh(async ({ isAutoRefresh = false } = {}) => {
    if (!isAutoRefresh) setIsLoading(true);
    try {
      const response = await fetchInventoryItems({ branchId });
      setInventoryItems(Array.isArray(response?.items) ? response.items : []);
      setErrorMessage('');
    } catch (error) {
      if (!isAutoRefresh) setErrorMessage(error.message || 'Near-expiry inventory could not be loaded.');
      throw error;
    } finally {
      if (!isAutoRefresh) setIsLoading(false);
    }
  }, {
    enabled: Boolean(branchId),
    refreshKey: `inventory-near-expiry-${branchId || 'unassigned'}`
  });

  useEffect(() => {
    setInventoryItems([]);
  }, [branchId]);

  const expiringItems = useMemo(() => inventoryItems.flatMap((item) => (
    (item.batches || []).flatMap((batch) => {
      const quantity = Number(batch.quantity || 0);
      const daysRemaining = daysUntilExpiry(batch.expiryDate);
      const warningDays = Number(item.expiryWarningDays || 90);
      if (quantity <= 0 || daysRemaining === null || daysRemaining < 0 || daysRemaining > warningDays) return [];

      return [{
        id: `${item.itemId || item.id}-${batch.batchId || batch.id}`,
        itemId: item.itemId || item.id,
        name: item.name,
        category: item.category,
        batchNumber: batch.batchNumber || 'Unnumbered',
        quantity,
        unit: item.unit,
        expiryDate: batch.expiryDate,
        daysRemaining,
        costValue: quantity * Number(batch.unitCost ?? item.costPrice ?? 0),
        urgencyLevel: daysRemaining <= 30 ? 'critical' : daysRemaining <= 60 ? 'high' : 'medium'
      }];
    })
  )), [inventoryItems]);

  const filteredItems = expiringItems.filter((item) => urgencyFilter === 'all' || item.urgencyLevel === urgencyFilter);
  const criticalCount = expiringItems.filter((item) => item.urgencyLevel === 'critical').length;
  const highCount = expiringItems.filter((item) => item.urgencyLevel === 'high').length;
  const totalValue = expiringItems.reduce((sum, item) => sum + item.costValue, 0);

  const viewItem = (itemId) => {
    sessionStorage.setItem(INVENTORY_SELECTION_KEY, JSON.stringify({ itemId }));
    navigate('/dashboard/inventory');
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader icon={Clock} title="Near Expiry Items" description="Live batch-level expiry warnings for stock that is still on hand." />

      <InventoryBranchScope
        branches={branchScope.branches}
        branchId={branchScope.branchId}
        selectedBranch={branchScope.selectedBranch}
        canSelectBranch={branchScope.canSelectBranch}
        isLoading={branchScope.isLoadingBranches}
        error={branchScope.branchError}
        onBranchChange={branchScope.setBranchId}
      />

      {criticalCount > 0 && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-red-300 bg-red-50 p-4 sm:flex-row sm:items-center dark:border-red-900 dark:bg-red-950/30">
          <AlertTriangle className="size-6 shrink-0 text-red-700 dark:text-red-300" />
          <div className="flex-1">
            <h3 className="font-bold text-slate-950 dark:text-slate-100">Urgent batch review required</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{criticalCount} batch{criticalCount === 1 ? '' : 'es'} expire within 30 days.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setUrgencyFilter('critical')}>Review critical</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Clock} label="Expiring Batches" value={expiringItems.length} tone="amber" />
        <SummaryCard icon={AlertTriangle} label="Critical (30 days)" value={criticalCount} tone="red" />
        <SummaryCard icon={Clock} label="High (31–60 days)" value={highCount} tone="amber" />
        <SummaryCard icon={Package} label="Value at Risk" value={formatPhpCurrency(totalValue)} tone="slate" />
      </div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Urgency</span>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All near-expiry batches</SelectItem>
            <SelectItem value="critical">Critical (30 days)</SelectItem>
            <SelectItem value="high">High (31–60 days)</SelectItem>
            <SelectItem value="medium">Medium (61+ days)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{errorMessage}</div>}

      <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Quantity</TableHead><TableHead>Expiry</TableHead>
                <TableHead>Remaining</TableHead><TableHead>Value at Risk</TableHead><TableHead>Urgency</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><p className="font-bold text-slate-950 dark:text-slate-100">{item.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.category}</p></TableCell>
                  <TableCell><BatchLabel value={item.batchNumber} /></TableCell>
                  <TableCell className="font-bold">{item.quantity} {item.unit}</TableCell>
                  <TableCell>{formatDisplayDate(item.expiryDate, { compact: true })}</TableCell>
                  <TableCell className={item.urgencyLevel === 'critical' ? 'font-bold text-red-700 dark:text-red-300' : 'font-bold text-amber-700 dark:text-amber-300'}>{item.daysRemaining} days</TableCell>
                  <TableCell className="font-bold">{formatPhpCurrency(item.costValue)}</TableCell>
                  <TableCell><UrgencyBadge urgency={item.urgencyLevel} /></TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => viewItem(item.itemId)}><Eye className="size-4" />View item</Button></TableCell>
                </TableRow>
              ))}
              {isLoading && <MessageRow message="Loading live expiry data…" />}
              {!isLoading && filteredItems.length === 0 && <MessageRow message="No batches match this expiry range." />}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function daysUntilExpiry(value) {
  if (!value || value === 'No expiry') return null;
  const expiry = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.floor((expiry.getTime() - today.getTime()) / 86400000);
}

function SummaryCard({ icon, label, value, tone }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
  };
  return <div className="rounded-[14px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-lg ${tones[tone]}`}>{createElement(icon, { className: 'size-5' })}</span><div><p className="text-2xl font-black text-slate-950 dark:text-slate-100">{value}</p><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p></div></div></div>;
}

function BatchLabel({ value }) {
  return <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{value}</span>;
}

function UrgencyBadge({ urgency }) {
  const styles = urgency === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : urgency === 'high' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300';
  return <Badge className={styles}>{urgency}</Badge>;
}

function MessageRow({ message }) {
  return <TableRow><TableCell colSpan={8} className="h-40 text-center text-sm text-slate-500 dark:text-slate-400">{message}</TableCell></TableRow>;
}
