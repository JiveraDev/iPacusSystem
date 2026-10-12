import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchProtectedImageObjectUrl, fetchProtectedMediaObjectUrl, resolveImageUrl, runtimeImagePath } from './image.js';

test('profile and pet paths use the authenticated API, including legacy and query forms', () => {
    const paths = [
        ['uploads/avatar.jpg', 'uploads/avatar.jpg'],
        ['/public/uploads/avatar.jpg', 'uploads/avatar.jpg'],
        ['public\\pet_profile_images\\pet.jpg', 'pet_profile_images/pet.jpg'],
        ['/set/pet_profile_images/pet.jpg', 'pet_profile_images/pet.jpg'],
        ['/api/uploads/media/pet_profile_images/pet.jpg', 'pet_profile_images/pet.jpg'],
        ['/php/index.php/api/uploads/media/uploads/avatar.jpg', 'uploads/avatar.jpg'],
        ['/api/uploads/media?path=pet_profile_images%2Fpet.jpg', 'pet_profile_images/pet.jpg'],
        ['/set/php/index.php/uploads/media?path=uploads%2Favatar.jpg', 'uploads/avatar.jpg']
    ];
    for (const [source, expected] of paths) {
        assert.equal(runtimeImagePath(source), expected, source);
        assert.equal(resolveImageUrl(source), `/api/uploads/media/${expected}`, source);
    }
});

test('absolute paths from the app/API are recognized, while external photo hosts are preserved', async (t) => {
    const options = { origin: 'https://clinic.test', apiBaseUrl: 'https://api.clinic.test/set/php/index.php' };
    assert.equal(runtimeImagePath('https://clinic.test/set/pet_profile_images/pet.jpg', options), 'pet_profile_images/pet.jpg');
    assert.equal(runtimeImagePath('https://api.clinic.test/api/uploads/media?path=uploads%2Favatar.jpg', options), 'uploads/avatar.jpg');
    assert.equal(runtimeImagePath('https://other.test/uploads/avatar.jpg', options), '');
    assert.equal(runtimeImagePath('//other.test/uploads/avatar.jpg', options), '');
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('External pictures must not use the app media API.'); });
    const external = 'https://other.test/uploads/avatar.jpg?size=200';
    assert.equal(await fetchProtectedImageObjectUrl(external), external);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('blank/invalid sources are safe and local preview/static images do not trigger media fetches', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('No fetch expected.'); });
    for (const source of [null, undefined, '', '   ', {}, 10]) assert.equal(resolveImageUrl(source), null);
    for (const source of ['blob:local-preview', 'data:image/png;base64,aGVsbG8=']) {
        assert.equal(await fetchProtectedImageObjectUrl(source), source);
    }
    assert.equal(resolveImageUrl('public/logo.png'), '/logo.png');
    assert.equal(await fetchProtectedImageObjectUrl('/assets/logo.png'), '/assets/logo.png');
    assert.equal(runtimeImagePath('/api/uploads/media?path=uploads%2F..%2Fprivate.jpg'), '');
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('all runtime directories, including profile, pet and QR pictures, use the media route', () => {
    for (const directory of ['uploads', 'pet_profile_images', 'payment_qr', 'grooming_photos', 'boarding_documents', 'concerns', 'diagnosis', 'inventory_items', 'inventory_receipts', 'invoices', 'payments', 'signatures']) {
        assert.equal(resolveImageUrl(`${directory}/photo.png`), `/api/uploads/media/${directory}/photo.png`);
    }
    assert.equal(resolveImageUrl('/public/pet_profile_images/Mochi%20photo.jpg'), '/api/uploads/media/pet_profile_images/Mochi%20photo.jpg');
});

test('protected pictures send the stored token and decoded path, and support cancellation', async (t) => {
    const previousWindow = globalThis.window;
    globalThis.window = { location: { origin: 'https://clinic.test' }, localStorage: { getItem: key => key === 'authToken' ? 'test-token' : null } };
    t.after(() => { globalThis.window = previousWindow; });
    const controller = new AbortController();
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(new Blob(['picture'], { type: 'image/png' })));
    const objectUrlMock = t.mock.method(URL, 'createObjectURL', () => 'blob:loaded-photo');
    const result = await fetchProtectedImageObjectUrl('/api/uploads/media?path=pet_profile_images%2FMochi%20photo.png', { signal: controller.signal });
    assert.equal(result, 'blob:loaded-photo');
    const [url, request] = fetchMock.mock.calls[0].arguments;
    assert.equal(new URL(url, 'https://clinic.test').searchParams.get('path'), 'pet_profile_images/Mochi photo.png');
    assert.equal(request.headers.Authorization, 'Bearer test-token');
    assert.equal(request.signal, controller.signal);
    assert.equal(objectUrlMock.mock.callCount(), 1);
});

test('missing/unauthorized files and successful HTML fallbacks fail without creating object URLs', async (t) => {
    const objectUrlMock = t.mock.method(URL, 'createObjectURL', () => 'blob:unexpected');
    const fetchMock = t.mock.method(globalThis, 'fetch');
    for (const status of [401, 404]) {
        fetchMock.mock.mockImplementation(async () => new Response('{}', { status, headers: { 'Content-Type': 'application/json' } }));
        await assert.rejects(fetchProtectedImageObjectUrl('uploads/avatar.png'), /Could not load/);
    }
    fetchMock.mock.mockImplementation(async () => new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
    await assert.rejects(fetchProtectedImageObjectUrl('pet_profile_images/pet.png'), /not an image/);
    assert.equal(objectUrlMock.mock.callCount(), 0);
});

test('an aborted image request never creates a stale preview blob', async (t) => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(globalThis, 'fetch', async () => new Response(new Blob(['picture'], { type: 'image/png' })));
    const objectUrlMock = t.mock.method(URL, 'createObjectURL', () => 'blob:unexpected');
    await assert.rejects(fetchProtectedImageObjectUrl('uploads/avatar.png', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(objectUrlMock.mock.callCount(), 0);
});

test('protected consent PDFs remain viewable, while image thumbnails reject document content', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(new Blob(['%PDF'], { type: 'application/pdf' })));
    const objectUrlMock = t.mock.method(URL, 'createObjectURL', () => 'blob:consent-document');
    assert.equal(await fetchProtectedMediaObjectUrl('signatures/consent.pdf'), 'blob:consent-document');
    await assert.rejects(fetchProtectedImageObjectUrl('signatures/consent.pdf'), /not an image/);
    assert.equal(objectUrlMock.mock.callCount(), 1);
});
