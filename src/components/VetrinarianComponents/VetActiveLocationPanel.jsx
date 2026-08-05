import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, MapPin } from 'lucide-react';

import { toast } from '../../reusecomponent/toast.jsx';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { fetchBranches } from '../../services/branchService';
import { fetchProfile, updateProfile } from '../../services/profileService';
import { useDashboardUser, useUserUpdate } from '../dashboardRouter.jsx';

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

export default function VetActiveLocationPanel() {
    const dashboardUser = useDashboardUser();
    const onUserUpdate = useUserUpdate();
    const currentUser = dashboardUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = getUserId(currentUser);
    const role = currentUser?.role || 'Veterinarian';
    const storedPreferredBranchId = currentUser?.preferred_branch_id || currentUser?.preferredBranchId || '';
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [savedBranchId, setSavedBranchId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isActive = true;

        async function loadLocation() {
            if (!userId) {
                setError('Your account session could not be identified.');
                setIsLoading(false);
                return;
            }

            try {
                const [branchResponse, profile] = await Promise.all([
                    fetchBranches(),
                    fetchProfile({ userId, role })
                ]);
                if (!isActive) return;

                const branchList = Array.isArray(branchResponse?.branches) ? branchResponse.branches : [];
                const preferredId = String(
                    profile?.preferred_branch_id
                    || storedPreferredBranchId
                    || branchResponse?.mainBranchId
                    || branchList[0]?.id
                    || ''
                );
                setBranches(branchList);
                setSelectedBranchId(preferredId);
                setSavedBranchId(preferredId);
                setError(branchList.length ? '' : 'No active clinic locations are available.');
            } catch (loadError) {
                if (!isActive) return;
                setError(loadError.message || 'Clinic locations could not be loaded.');
            } finally {
                if (isActive) setIsLoading(false);
            }
        }

        loadLocation();
        return () => {
            isActive = false;
        };
    }, [role, storedPreferredBranchId, userId]);

    const selectedBranch = useMemo(
        () => branches.find(branch => String(branch.id) === selectedBranchId),
        [branches, selectedBranchId]
    );

    const saveLocation = async () => {
        if (!selectedBranchId || selectedBranchId === savedBranchId) return;

        setIsSaving(true);
        setError('');
        try {
            await updateProfile({
                userId,
                role,
                payload: { preferredBranchId: Number(selectedBranchId) }
            });

            const updatedUser = {
                ...currentUser,
                preferred_branch_id: Number(selectedBranchId),
                preferredBranchId: Number(selectedBranchId),
                preferred_branch_name: selectedBranch?.name || '',
                preferredBranchName: selectedBranch?.name || ''
            };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            onUserUpdate?.(updatedUser);
            setSavedBranchId(selectedBranchId);
            toast.success(`Active location set to ${selectedBranch?.name || 'the selected branch'}.`);
        } catch (saveError) {
            setError(saveError.message || 'The active location could not be updated.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/70 dark:bg-slate-950 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        <Building2 className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-slate-950 dark:text-slate-100">Active clinic location</h2>
                            {savedBranchId && !isLoading && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="size-3.5" /> Saved
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Sets the location shown first in your worklists. You can still search and receive queues from every branch.
                        </p>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:min-w-[430px]">
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isLoading || isSaving || !branches.length}>
                        <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900 sm:flex-1" aria-label="Active clinic location">
                            <MapPin className="mr-2 size-4 shrink-0 text-slate-500" />
                            <SelectValue
                                placeholder={isLoading ? 'Loading locations…' : 'Select a location'}
                                displayValue={selectedBranch?.name}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map(branch => (
                                <SelectItem key={branch.id} value={String(branch.id)}>
                                    {branch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        onClick={saveLocation}
                        disabled={isLoading || isSaving || !selectedBranchId || selectedBranchId === savedBranchId}
                        className="h-10 shrink-0 sm:w-auto"
                    >
                        {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Set active
                    </Button>
                </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}
