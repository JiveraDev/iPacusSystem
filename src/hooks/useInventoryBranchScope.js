import { useEffect, useMemo, useState } from 'react';
import { fetchBranches } from '../services/branchService.js';
import { assignedBranchId, normalizeUserRole, storedDashboardUser } from '../lib/branchAccess.js';

const INVENTORY_BRANCH_STORAGE_KEY = 'ipawcus-inventory-branch-id';

export function useInventoryBranchScope() {
    const user = useMemo(() => storedDashboardUser(), []);
    const role = normalizeUserRole(user?.role);
    const canSelectBranch = role === 'super_admin';
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchIdState] = useState('');
    const [isLoadingBranches, setIsLoadingBranches] = useState(true);
    const [branchError, setBranchError] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetchBranches({ assignedOnly: !canSelectBranch })
            .then((data) => {
                if (cancelled) return;
                const availableBranches = Array.isArray(data) ? data : (data?.branches || []);
                const preferredId = assignedBranchId(user);
                const storedId = canSelectBranch
                    ? window.localStorage.getItem(INVENTORY_BRANCH_STORAGE_KEY) || ''
                    : '';
                const requestedId = storedId || preferredId || String(data?.mainBranchId || '');
                const selected = availableBranches.find((branch) => String(branch.id) === String(requestedId))
                    || availableBranches[0]
                    || null;

                setBranches(availableBranches);
                setBranchIdState(selected ? String(selected.id) : '');
                setBranchError(selected
                    ? ''
                    : canSelectBranch
                        ? 'No active inventory branches are available.'
                        : 'This account has no active branch assignment. Assign a location in Account Management.');
            })
            .catch((error) => {
                if (cancelled) return;
                setBranches([]);
                setBranchIdState('');
                setBranchError(error.message || 'Inventory branch access could not be loaded.');
            })
            .finally(() => {
                if (!cancelled) setIsLoadingBranches(false);
            });

        return () => { cancelled = true; };
    }, [canSelectBranch, user]);

    const setBranchId = (value) => {
        if (!canSelectBranch) return;
        const nextId = String(value || '');
        if (!branches.some((branch) => String(branch.id) === nextId)) return;
        window.localStorage.setItem(INVENTORY_BRANCH_STORAGE_KEY, nextId);
        setBranchIdState(nextId);
    };

    const selectedBranch = branches.find((branch) => String(branch.id) === String(branchId)) || null;

    return {
        branches,
        branchId,
        selectedBranch,
        canSelectBranch,
        isLoadingBranches,
        branchError,
        setBranchId,
    };
}
