import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, requireArray, requireObject, sectionErrorMessage } from './errorPolicy.js';

test('write uncertainty, conflicts, validation and access failures are never automatically retried', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
        assert.equal(classifyError({ status }).retryable, false);
    }
    assert.equal(classifyError(new Error('Connection lost'), { method: 'POST' }).kind, 'uncertain');
    assert.equal(classifyError({ data: { code: 'mutation_result_unknown' } }, { method: 'PATCH' }).retryable, false);
    assert.equal(classifyError({ status: 503 }).retryable, true);
    assert.equal(classifyError({ name: 'AbortError' }).kind, 'cancelled');
});

test('valid empty collections are distinct from incompatible responses', () => {
    assert.deepEqual(requireArray([]), []);
    assert.deepEqual(requireObject({}), {});
    for (const value of [null, {}, '[]', false]) assert.throws(() => requireArray(value));
    for (const value of [null, [], 'record', false]) assert.throws(() => requireObject(value));
});

test('section messages hide database and implementation details', () => {
    const message = sectionErrorMessage(new Error('SQLSTATE[42S02] table secret_records does not exist'), 'Please refresh this section.');
    assert.equal(message, 'Please refresh this section.');
});
