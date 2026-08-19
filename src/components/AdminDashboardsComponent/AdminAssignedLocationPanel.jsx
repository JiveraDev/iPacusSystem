import { useEffect, useMemo, useState } from 'react';
import { Building2, Clock3, Loader2, LockKeyhole, MapPin } from 'lucide-react';

import { fetchBranches } from '../../services/branchService';
import { useDashboardUser } from '../dashboardRouter.jsx';

export default function AdminAssignedLocationPanel() {
    const currentUser = useDashboardUser();
    const preferredBranchId = currentUser?.preferred_branch_id || currentUser?.preferredBranchId || '';
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isActive = true;
        fetchBranches({ assignedOnly: true })
            .then((response) => {
                if (!isActive) return;
                setBranches(Array.isArray(response?.branches) ? response.branches : []);
                setError('');
            })
            .catch((loadError) => {
                if (isActive) setError(loadError.message || 'Assigned branch could not be loaded.');
            })
            .finally(() => {
                if (isActive) setIsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, []);

    const assignedBranch = useMemo(
        () => branches.find((branch) => String(branch.id) === String(preferredBranchId)) || branches[0],
        [branches, preferredBranchId]
    );

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {isLoading ? <Loader2 className="size-5 animate-spin" /> : <Building2 className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-950 dark:text-slate-100">
                            {assignedBranch?.name || 'Assigned clinic branch'}
                        </h2>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <LockKeyhole className="size-3" /> Assigned by Super Admin
                        </span>
                    </div>
                    {assignedBranch && (
                        <div className="mt-2 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400 lg:flex-row lg:flex-wrap lg:gap-x-5">
                            <span className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-4 shrink-0" />{assignedBranch.address}</span>
                            <span className="flex items-center gap-1.5"><Clock3 className="size-4 shrink-0" />Mon-Sat, 8:00 AM–6:00 PM</span>
                        </div>
                    )}
                    {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
                </div>
            </div>
        </section>
    );
}
