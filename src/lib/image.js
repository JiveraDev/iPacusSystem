import { API_BASE_URL, getApiUrl, getStoredAuthToken } from '../services/apiClient.js';

const RUNTIME_UPLOAD_DIRECTORIES = new Set([
  'grooming_photos',
  'boarding_documents',
  'concerns',
  'diagnosis',
  'inventory_items',
  'inventory_receipts',
  'invoices',
  'payment_qr',
  'payments',
  'pet_profile_images',
  'signatures',
  'uploads'
]);

function imageString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/** Recognize stored and legacy media paths without treating other sites as this API. */
export function runtimeImagePath(value, {
    apiBaseUrl = API_BASE_URL,
    origin = typeof window === 'undefined' ? '' : window.location?.origin || ''
} = {}) {
    const source = imageString(value).replace(/\\/g, '/');
    if (!source || /^(blob:|data:)/i.test(source)) return '';

    try {
        const url = new URL(source, origin || 'https://media.invalid');
        if (/^(https?:)?\/\//i.test(source)) {
            const trustedOrigins = new Set(origin ? [origin] : []);
            if (apiBaseUrl) trustedOrigins.add(new URL(apiBaseUrl, origin || 'https://media.invalid').origin);
            if (!trustedOrigins.has(url.origin)) return '';
        } else if (/^[a-z][a-z\d+.-]*:/i.test(source)) {
            return '';
        }

        let path = decodeURIComponent(url.pathname).replace(/\\/g, '/');
        // PHP accepts both /uploads/media/<path> and /uploads/media?path=<path>.
        // Older stored paths can include public/, set/, or php/index.php prefixes.
        const mediaRoute = path.match(/(?:^|\/)uploads\/media(?:\/(.*))?\/?$/i);
        if (mediaRoute) path = mediaRoute[1] || url.searchParams.get('path') || '';
        const segments = path.replace(/^\/+/, '').split('/');
        const directoryIndex = segments.findIndex(segment => RUNTIME_UPLOAD_DIRECTORIES.has(segment));
        if (directoryIndex < 0) return '';
        const mediaSegments = segments.slice(directoryIndex);
        if (mediaSegments.length < 2 || mediaSegments.some(segment => !segment || segment === '.' || segment === '..' || [...segment].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) return '';
        return mediaSegments.join('/');
    } catch {
        return '';
    }
}

export function resolveImageUrl(value) {
    const source = imageString(value);
    if (!source) return null;
    if (/^(blob:|data:)/i.test(source)) return source;

    const uploadPath = runtimeImagePath(source);
    if (uploadPath) return getApiUrl(`/uploads/media/${uploadPath.split('/').map(encodeURIComponent).join('/')}`, { apiPrefix: true });
    if (/^(https?:)?\/\//i.test(source)) return source;
    if (/^[a-z][a-z\d+.-]*:/i.test(source)) return null;

    const publicPath = source.replace(/\\/g, '/').replace(/^\/?public\//i, '/').replace(/\/{2,}/g, '/');
    return publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
}

export async function fetchProtectedMediaObjectUrl(value, { signal, allowedMimeTypes = ['image/', 'application/pdf'] } = {}) {
    const resolvedUrl = resolveImageUrl(value);
    const uploadPath = runtimeImagePath(value);
    if (!resolvedUrl || !uploadPath) return resolvedUrl;

    const token = getStoredAuthToken();
    const response = await fetch(getApiUrl(`/uploads/media?path=${encodeURIComponent(uploadPath)}`, { apiPrefix: true }), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal
    });
    if (!response.ok) throw new Error('Could not load protected file.');

    const blob = await response.blob();
    // A missing-file SPA fallback must not masquerade as a successful media load.
    const contentType = blob.type.toLowerCase().split(';')[0].trim();
    if (!allowedMimeTypes.some(type => type.endsWith('/') ? contentType.startsWith(type) : contentType === type)) {
        throw new Error('The media response is not an image or supported document.');
    }
    if (signal?.aborted) throw new DOMException('Image request was cancelled.', 'AbortError');
    return URL.createObjectURL(blob);
}

export function fetchProtectedImageObjectUrl(value, options = {}) {
    return fetchProtectedMediaObjectUrl(value, { ...options, allowedMimeTypes: ['image/'] });
}
