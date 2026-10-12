import { Building2, LockKeyhole } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

export default function InventoryBranchScope({
    branches,
    branchId,
    selectedBranch,
    canSelectBranch,
    isLoading,
    error,
    onBranchChange,
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950" aria-label="Inventory branch scope">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        <Building2 className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventory location</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {canSelectBranch
                                ? 'Select the clinic branch you want to view and manage.'
                                : 'Access is limited to the branch assigned in Account Management.'}
                        </p>
                    </div>
                </div>

                {canSelectBranch ? (
                    <Select value={branchId} onValueChange={onBranchChange} disabled={isLoading || branches.length === 0}>
                        <SelectTrigger className="w-full sm:w-[280px]">
                            <SelectValue placeholder={isLoading ? 'Loading branches...' : 'Select branch'} displayValue={selectedBranch?.name} />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map((branch) => (
                                <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto sm:min-w-[240px]">
                        <LockKeyhole className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                        <span className="truncate">{isLoading ? 'Loading assigned branch...' : selectedBranch?.name || 'No branch assigned'}</span>
                    </div>
                )}
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        </section>
    );
}
