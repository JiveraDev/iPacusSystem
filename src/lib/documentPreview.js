import { fetchProtectedMediaObjectUrl } from './image.js';

const listeners = new Set();
let currentPreview = null;
let previewId = 0;

function notifyPreviewListeners() {
    listeners.forEach(listener => listener());
}

export function subscribeDocumentPreview(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getDocumentPreview() {
    return currentPreview;
}

export function requestDocumentPreview(source, { title = '' } = {}) {
    const path = typeof source === 'string' ? source.trim() : '';
    if (!path) return Promise.reject(new Error('The requested document is unavailable.'));
    if (currentPreview && !currentPreview.settled) currentPreview.resolve(false);
    return new Promise((resolve, reject) => {
        currentPreview = { id: ++previewId, source: path, title, resolve, reject, settled: false };
        notifyPreviewListeners();
    });
}

export function completeDocumentPreview(id, error) {
    if (!currentPreview || currentPreview.id !== id || currentPreview.settled) return;
    currentPreview.settled = true;
    if (error) currentPreview.reject(error);
    else currentPreview.resolve(true);
}

export function closeDocumentPreview(id) {
    if (!currentPreview || (id !== undefined && currentPreview.id !== id)) return;
    if (!currentPreview.settled) currentPreview.resolve(false);
    currentPreview = null;
    notifyPreviewListeners();
}

function documentFileName(source, mimeType) {
    let fileName = '';
    if (!/^(blob:|data:)/i.test(source)) {
        try {
            const url = new URL(source, 'https://preview.invalid');
            fileName = (url.searchParams.get('path') || decodeURIComponent(url.pathname)).replace(/\\/g, '/').split('/').pop() || '';
        } catch {
            fileName = '';
        }
    }
    if (!fileName) fileName = documentDownloadFileName({ mimeType }, mimeType === 'application/pdf' ? 'document' : 'document-image');
    return fileName.replace(/[<>:"/\\|?*]/g, '-');
}

export function documentDownloadFileName(file, preferredName = '') {
    const name = String(preferredName || file.fileName || 'document').replace(/[<>:"/\\|?*]/g, '-');
    const sourceExtension = file.fileName?.match(/\.(png|jpe?g|gif|webp|bmp)$/i)?.[1];
    const extension = file.mimeType === 'application/pdf'
        ? 'pdf'
        : ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' }[file.mimeType] || sourceExtension || 'png');
    return `${name.replace(/\.(pdf|png|jpe?g|gif|webp|bmp)$/i, '')}.${extension}`;
}

/** Load an authenticated file and keep its object URL alive for the preview's lifetime. */
export async function loadDocumentPreviewSource(source, { signal } = {}) {
    const originalSource = String(source || '').trim();
    let ownedObjectUrl = '';
    try {
        const resolvedSource = await fetchProtectedMediaObjectUrl(originalSource, { signal });
        if (!resolvedSource) throw new Error('The requested document is unavailable.');
        if (resolvedSource.startsWith('blob:') && resolvedSource !== originalSource) ownedObjectUrl = resolvedSource;

        // Read local blobs to retain their MIME type. A copied local preview remains
        // usable even if its originating form later releases the original URL.
        if (/^(blob:|data:)/i.test(resolvedSource)) {
            const response = await fetch(resolvedSource, { signal });
            if (!response.ok) throw new Error('The document could not be loaded.');
            const blob = await response.blob();
            const mimeType = blob.type.toLowerCase().split(';')[0].trim();
            if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) {
                throw new Error('This file is not a PDF or supported image.');
            }
            if (signal?.aborted) throw new DOMException('Document preview was cancelled.', 'AbortError');
            if (!ownedObjectUrl) ownedObjectUrl = URL.createObjectURL(blob);
            return { url: ownedObjectUrl, mimeType, fileName: documentFileName(originalSource, mimeType), owned: true };
        }

        // Public and external documents keep their original browser URL.
        // Protected runtime files always take the authenticated branch above.
        const mimeType = /\.(png|jpe?g|gif|webp|bmp)(?:[?#]|$)/i.test(resolvedSource) ? 'image/*' : 'application/pdf';
        return { url: resolvedSource, mimeType, fileName: documentFileName(originalSource, mimeType), owned: false };
    } catch (error) {
        if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
        throw error;
    }
}
