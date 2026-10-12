import assert from 'node:assert/strict';
import test from 'node:test';
import {
    closeDocumentPreview,
    completeDocumentPreview,
    documentDownloadFileName,
    getDocumentPreview,
    loadDocumentPreviewSource,
    requestDocumentPreview,
    subscribeDocumentPreview
} from './documentPreview.js';

test('PDF downloads retain their file type even for generated URLs and old image names', () => {
    const pdf = { mimeType: 'application/pdf', fileName: 'document.pdf' };
    assert.equal(documentDownloadFileName(pdf, 'Signed consent'), 'Signed consent.pdf');
    assert.equal(documentDownloadFileName(pdf, 'Signed consent.png'), 'Signed consent.pdf');
    assert.equal(documentDownloadFileName(pdf, 'Consent.pdf'), 'Consent.pdf');
    assert.equal(documentDownloadFileName({ mimeType: 'image/jpeg', fileName: 'document-image.png' }, 'Signature.jpg'), 'Signature.jpg');
    assert.equal(documentDownloadFileName({ mimeType: 'image/jpeg', fileName: 'signature.jpg' }, 'Owner:Signature'), 'Owner-Signature.jpg');
});

test('opening another document cancels the earlier request without closing the new preview', async (t) => {
    t.after(() => closeDocumentPreview());
    let updates = 0;
    const unsubscribe = subscribeDocumentPreview(() => { updates += 1; });
    t.after(unsubscribe);
    const first = requestDocumentPreview('signatures/first.pdf');
    const firstId = getDocumentPreview().id;
    const second = requestDocumentPreview('signatures/second.pdf', { title: 'Second consent' });
    const secondId = getDocumentPreview().id;
    assert.equal(await first, false);
    completeDocumentPreview(firstId);
    closeDocumentPreview(firstId);
    assert.equal(getDocumentPreview().source, 'signatures/second.pdf');
    assert.equal(getDocumentPreview().title, 'Second consent');
    completeDocumentPreview(secondId);
    assert.equal(await second, true);
    closeDocumentPreview(secondId);
    assert.equal(getDocumentPreview(), null);
    assert.equal(updates, 3);
});

test('closing a loading preview settles its caller and failed previews remain available to retry', async (t) => {
    t.after(() => closeDocumentPreview());
    const pending = requestDocumentPreview('signatures/consent.pdf');
    closeDocumentPreview();
    assert.equal(await pending, false);
    const failed = requestDocumentPreview('signatures/missing.pdf');
    const rejected = assert.rejects(failed, /Missing document/);
    completeDocumentPreview(getDocumentPreview().id, new Error('Missing document'));
    await rejected;
    assert.equal(getDocumentPreview().source, 'signatures/missing.pdf');
    await assert.rejects(requestDocumentPreview('  '), /unavailable/);
    assert.equal(getDocumentPreview().source, 'signatures/missing.pdf');
});

test('stored PDFs load with authentication and keep their real MIME type and download name', async (t) => {
    const previousWindow = globalThis.window;
    globalThis.window = { location: { origin: 'https://clinic.test' }, localStorage: { getItem: key => key === 'authToken' ? 'test-token' : null } };
    t.after(() => { globalThis.window = previousWindow; });
    const pdf = new Blob(['%PDF-1.7\n'], { type: 'application/pdf' });
    const controller = new AbortController();
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(pdf));
    const createMock = t.mock.method(URL, 'createObjectURL', () => 'blob:protected-pdf');
    const revokeMock = t.mock.method(URL, 'revokeObjectURL', () => {});
    const file = await loadDocumentPreviewSource('/api/uploads/media?path=signatures%2FConsent%20form.pdf', { signal: controller.signal });
    assert.deepEqual(file, { url: 'blob:protected-pdf', mimeType: 'application/pdf', fileName: 'Consent form.pdf', owned: true });
    const [url, request] = fetchMock.mock.calls[0].arguments;
    assert.equal(new URL(url, 'https://clinic.test').searchParams.get('path'), 'signatures/Consent form.pdf');
    assert.equal(request.headers.Authorization, 'Bearer test-token');
    assert.equal(request.signal, controller.signal);
    assert.equal(fetchMock.mock.calls[1].arguments[0], 'blob:protected-pdf');
    assert.equal(createMock.mock.callCount(), 1);
    assert.equal(revokeMock.mock.callCount(), 0);
});

test('generated PDFs get an independent preview URL without revoking the originating form URL', async (t) => {
    const pdf = new Blob(['%PDF-1.7\n'], { type: 'application/pdf' });
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(pdf));
    const createMock = t.mock.method(URL, 'createObjectURL', () => 'blob:preview-copy');
    const revokeMock = t.mock.method(URL, 'revokeObjectURL', () => {});
    const file = await loadDocumentPreviewSource('blob:original-consent');
    assert.deepEqual(file, { url: 'blob:preview-copy', mimeType: 'application/pdf', fileName: 'document.pdf', owned: true });
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(fetchMock.mock.calls[0].arguments[0], 'blob:original-consent');
    assert.equal(createMock.mock.callCount(), 1);
    assert.equal(revokeMock.mock.callCount(), 0);
});

test('missing files and HTML responses never become PDF preview URLs', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch');
    const createMock = t.mock.method(URL, 'createObjectURL', () => 'blob:unexpected');
    for (const status of [401, 404, 503]) {
        fetchMock.mock.mockImplementation(async () => new Response('{}', { status, headers: { 'Content-Type': 'application/json' } }));
        await assert.rejects(loadDocumentPreviewSource('signatures/consent.pdf'), /Could not load/);
    }
    fetchMock.mock.mockImplementation(async () => new Response('<html>App fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
    await assert.rejects(loadDocumentPreviewSource('signatures/consent.pdf'), /not an image or supported document/);
    assert.equal(createMock.mock.callCount(), 0);
});

test('failed local reads release authenticated URLs but preserve caller-owned URLs', async (t) => {
    const pdf = new Blob(['%PDF-1.7\n'], { type: 'application/pdf' });
    const fetchMock = t.mock.method(globalThis, 'fetch', async url => url.startsWith('blob:') ? new Response('', { status: 404 }) : new Response(pdf));
    t.mock.method(URL, 'createObjectURL', () => 'blob:protected-pdf');
    const revokeMock = t.mock.method(URL, 'revokeObjectURL', () => {});
    await assert.rejects(loadDocumentPreviewSource('signatures/consent.pdf'), /could not be loaded/);
    assert.deepEqual(revokeMock.mock.calls.map(call => call.arguments[0]), ['blob:protected-pdf']);
    await assert.rejects(loadDocumentPreviewSource('blob:original-consent'), /could not be loaded/);
    assert.equal(revokeMock.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 3);
});

test('cancelling while a protected PDF is read releases its temporary URL', async (t) => {
    const controller = new AbortController();
    const pdf = new Blob(['%PDF-1.7\n'], { type: 'application/pdf' });
    t.mock.method(globalThis, 'fetch', async url => {
        if (url.startsWith('blob:')) controller.abort();
        return new Response(pdf);
    });
    t.mock.method(URL, 'createObjectURL', () => 'blob:protected-pdf');
    const revokeMock = t.mock.method(URL, 'revokeObjectURL', () => {});
    await assert.rejects(loadDocumentPreviewSource('signatures/consent.pdf', { signal: controller.signal }), { name: 'AbortError' });
    assert.deepEqual(revokeMock.mock.calls.map(call => call.arguments[0]), ['blob:protected-pdf']);
});

test('images remain supported and public PDFs preserve their browser URLs', async (t) => {
    const image = new Blob(['picture'], { type: 'image/png' });
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(image));
    t.mock.method(URL, 'createObjectURL', () => 'blob:preview-image');
    assert.equal((await loadDocumentPreviewSource('data:image/png;base64,cGljdHVyZQ==')).mimeType, 'image/png');
    const file = await loadDocumentPreviewSource('https://documents.test/consent.pdf');
    assert.deepEqual(file, { url: 'https://documents.test/consent.pdf', mimeType: 'application/pdf', fileName: 'consent.pdf', owned: false });
    assert.equal(fetchMock.mock.callCount(), 1);
});
