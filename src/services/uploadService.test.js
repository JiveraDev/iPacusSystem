import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadImageFile, uploadDataUrlImage } from './uploadService.js';

test.beforeEach((t) => {
    const previousWindow = globalThis.window;
    globalThis.window = { setTimeout, clearTimeout, localStorage: { getItem: () => null } };
    t.after(() => { globalThis.window = previousWindow; });
});

test('photo uploads save a persistent path from each supported response format', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch');
    const image = new File(['picture'], 'pet.png', { type: 'image/png' });
    for (const response of [
        { relative_url: 'pet_profile_images/pet.png', protected_url: '/api/uploads/media/pet_profile_images/pet.png' },
        { protected_url: '/api/uploads/media/uploads/avatar.png' },
        { url: '/api/uploads/media/pet_profile_images/pet.png' }
    ]) {
        fetchMock.mock.mockImplementation(async () => Response.json(response));
        assert.equal(await uploadImageFile(image, 'pet'), response.relative_url || response.protected_url || response.url);
        const [url, request] = fetchMock.mock.calls.at(-1).arguments;
        assert.equal(url, '/api/upload');
        assert.equal(request.method, 'POST');
        assert.equal(request.body.get('type'), 'pet');
        assert.equal(request.body.get('image').name, 'pet.png');
    }
});

test('missing paths and temporary blob/data responses cannot report a successful photo save', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch');
    const image = new File(['picture'], 'owner.png', { type: 'image/png' });
    for (const response of [{}, { relative_url: '' }, { relative_url: 'blob:temporary' }, { url: 'data:image/png;base64,aGVsbG8=' }]) {
        fetchMock.mock.mockImplementation(async () => Response.json(response));
        await assert.rejects(uploadImageFile(image, 'user'), /could not be saved/);
    }
});

test('drawn/cropped photo uploads also accept the protected URL response', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ protected_url: '/api/uploads/media/uploads/cropped.png' }));
    assert.equal(await uploadDataUrlImage('data:image/png;base64,aGVsbG8=', 'user', 'cropped'), '/api/uploads/media/uploads/cropped.png');
});
