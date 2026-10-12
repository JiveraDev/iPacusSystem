import assert from 'node:assert/strict';
import test from 'node:test';
import { isBranchSelectionLocked, resolveAssignedBranch } from './branchAccess.js';

const branches = [{ id: 1, name: 'Main Clinic' }, { id: 2, name: 'Enriquez Clinic' }];
test('admins use a fixed account branch; super admins retain branch selection', () => {
    assert.equal(isBranchSelectionLocked({ role: 'admin' }), true);
    assert.equal(isBranchSelectionLocked({ role: 'Super Admin' }), false);
});
test('assigned branch comes from the account, not the grooming job list', () => {
    assert.equal(resolveAssignedBranch(branches, { preferred_branch_id: 2 }).name, 'Enriquez Clinic');
    assert.equal(resolveAssignedBranch(branches, { preferredBranchId: '1' }).name, 'Main Clinic');
});
test('a removed or stale preference resolves only within current assignments', () => {
    assert.equal(resolveAssignedBranch([branches[1]], { preferred_branch_id: 1 }).id, 2);
});
test('unassigned accounts never default to all branches', () => {
    assert.equal(resolveAssignedBranch([], { preferred_branch_id: 1 }), null);
    assert.equal(resolveAssignedBranch(null, {}), null);
});
test('legacy branch account fields are supported', () => {
    assert.equal(resolveAssignedBranch(branches, { branch_id: 2 }).id, 2);
    assert.equal(resolveAssignedBranch(branches, { branchId: '2' }).id, 2);
});
