import { apiRequest } from './apiClient';
import {
    filterVisibleBranches,
    isVisibleBranch,
    normalizeVisibleBranchCode,
} from './branchService';

export async function fetchStatusDisplay({ branch, ...options } = {}) {
    const requestedBranchCode = normalizeVisibleBranchCode(branch);
    const query = `?branch=${encodeURIComponent(requestedBranchCode)}`;
    const data = await apiRequest(`/status-display${query}`, {
        timeoutMs: 12000,
        ...options
    });

    const branches = filterVisibleBranches(data?.branches);
    const selectedBranch = isVisibleBranch(data?.branch)
        ? data.branch
        : branches.find((item) => normalizeVisibleBranchCode(item) === requestedBranchCode)
            || branches[0]
            || {
                code: 'MAIN',
                name: 'VFC Pharmacy / Main Clinic',
            };

    return {
        ...data,
        branch: selectedBranch,
        branches,
    };
}
