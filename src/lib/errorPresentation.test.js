import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_ERROR_MESSAGE,
    getHttpErrorMessage,
    getUserFacingErrorMessage,
    isTechnicalErrorMessage,
    sanitizeErrorPayload,
} from './errorPresentation.js';

test('ordinary selection and update instructions remain readable', () => {
    for (const message of [
        'Select a consent form first.',
        'Select a consent form from the list.',
        'Record update request submitted.',
        'The service could not be updated. Please try again.',
        'This service is already used in billing history. Deactivate it instead of deleting it.',
    ]) {
        assert.equal(isTechnicalErrorMessage(message), false, message);
        assert.equal(getUserFacingErrorMessage(message), message);
    }
});

test('database statements and server internals are hidden', () => {
    for (const message of [
        'SELECT * FROM users',
        'select user_id, email from users',
        'UPDATE users SET password = ?',
        'INSERT INTO users (email) VALUES (?)',
        'DELETE FROM users WHERE id = 1',
        'SQLSTATE[23000]: Integrity constraint violation',
        'PDOException: connection failed',
        'Fatal error: undefined function',
        '<html><body>Server Error</body></html>',
    ]) {
        assert.equal(isTechnicalErrorMessage(message), true, message);
        assert.equal(getUserFacingErrorMessage(message, DEFAULT_ERROR_MESSAGE, { log: false }), DEFAULT_ERROR_MESSAGE);
    }
});

test('HTTP errors give status-specific recovery instructions', () => {
    for (const [status, phrase] of [
        [401, 'Log in again'], [403, 'permission'], [404, 'find that record'],
        [409, 'already in use'], [413, 'smaller file'], [415, 'file type'],
        [422, 'Review the form'], [429, 'Wait a moment'], [503, 'temporarily unavailable'],
    ]) {
        assert.ok(getHttpErrorMessage(status).includes(phrase));
        assert.equal(getUserFacingErrorMessage({ status }), getHttpErrorMessage(status));
    }
});

test('safe server validation keeps the specific reason', () => {
    const message = 'This service code is already in use. Choose a different code or leave it blank.';
    assert.equal(getUserFacingErrorMessage({ message, status: 409 }), message);
});

test('payload sanitation preserves machine codes and translates only message fields', () => {
    const clean = sanitizeErrorPayload({
        code: 'conflict', status: 409, field: 'update', type: 'error',
        message: 'Conflict', errors: { serviceCode: 'Validation failed' },
        detail: { code: 'conflict', message: 'Forbidden' },
        debug: 'SELECT * FROM users',
        nested: { trace: 'private trace', message: 'SQLSTATE[HY000]: failure' },
    }, DEFAULT_ERROR_MESSAGE, { log: false });
    assert.equal(clean.code, 'conflict');
    assert.equal(clean.status, 409);
    assert.equal(clean.field, 'update');
    assert.equal(clean.type, 'error');
    assert.equal(clean.detail.code, 'conflict');
    assert.equal(clean.message, getHttpErrorMessage(409));
    assert.equal(clean.detail.message, getHttpErrorMessage(403));
    assert.equal(clean.errors.serviceCode, getHttpErrorMessage(422));
    assert.equal(clean.nested.message, DEFAULT_ERROR_MESSAGE);
    assert.equal('debug' in clean, false);
    assert.equal('trace' in clean.nested, false);
    assert.equal(clean.technicalDetailsHidden, true);
});

test('network, unreadable responses, cancellation and unknown errors have safe fallbacks', () => {
    assert.match(getUserFacingErrorMessage(new Error('Failed to fetch'), undefined, { log: false }), /connection/);
    assert.match(getUserFacingErrorMessage('JSON.parse: unexpected character', undefined, { log: false }), /unreadable/);
    assert.match(getUserFacingErrorMessage({ name: 'AbortError' }), /cancelled/);
    assert.equal(getUserFacingErrorMessage(null), DEFAULT_ERROR_MESSAGE);
});
