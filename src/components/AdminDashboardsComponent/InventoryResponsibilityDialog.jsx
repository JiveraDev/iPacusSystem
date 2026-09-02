import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import PasswordInput from '../shared/PasswordInput.jsx';

export default function InventoryResponsibilityDialog({
  open,
  onOpenChange,
  title,
  description,
  summary = [],
  requiresReason = false,
  reasonLabel = 'Reason',
  confirmLabel = 'Confirm change',
  destructive = false,
  isSubmitting = false,
  onConfirm
}) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) return undefined;

    const resetTimer = window.setTimeout(() => {
      setPassword('');
      setReason('');
      setAcknowledged(false);
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [open]);

  const canConfirm = password.length > 0 && acknowledged && (!requiresReason || reason.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm || isSubmitting) return;
    await onConfirm?.({
      confirmation_password: password,
      responsibility_acknowledged: true,
      reason: reason.trim() || null
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange?.(nextOpen)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className={`mb-2 flex size-10 items-center justify-center rounded-xl ${destructive ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>
            {destructive ? <AlertTriangle className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {summary.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {summary.map((entry, index) => (
                <div
                  key={`${entry.label}-${index}`}
                  className="grid gap-1 border-b border-slate-200 px-3 py-2.5 last:border-b-0 dark:border-slate-700 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{entry.label}</span>
                  {entry.before !== undefined ? (
                    <span className="min-w-0 text-sm text-slate-800 dark:text-slate-100">
                      <span className="text-slate-500 line-through dark:text-slate-400">{String(entry.before || 'Not set')}</span>
                      <span className="mx-2" aria-hidden="true">→</span>
                      <span className="font-semibold">{String(entry.after || 'Not set')}</span>
                    </span>
                  ) : (
                    <span className="min-w-0 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{String(entry.value ?? 'Not set')}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="inventory-action-reason">{reasonLabel}</Label>
              <Textarea
                id="inventory-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this inventory change is required"
                maxLength={1000}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="inventory-confirmation-password">Your account password</Label>
            <PasswordInput
              id="inventory-confirmation-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter password"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">The password is verified securely and is never stored in the inventory audit.</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={setAcknowledged}
              disabled={isSubmitting}
              aria-label="Accept responsibility for this inventory change"
              className="mt-0.5 shrink-0"
            />
            <span>I reviewed this inventory change and accept responsibility for submitting it under my account.</span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>Cancel</Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? 'Confirming...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
