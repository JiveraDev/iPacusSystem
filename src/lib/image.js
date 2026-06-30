import { API_BASE_URL, getApiUrl, getStoredAuthToken } from '../services/apiClient';

const RUNTIME_UPLOAD_DIRECTORIES = new Set([
  'boarding_documents',
  'concerns',
  'diagnosis',
  'inventory_items',
  'inventory_receipts',
  'payment_qr',
  'payments',
  'pet_profile_images',
  'signatures',
  'uploads'
]);

function appendAccessToken(url) {
  const token = getStoredAuthToken();
  if (!token) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

function normalizePublicPath(value) {
  let path = String(value || '').trim().replace(/\\/g, '/');
  path = path.replace(/^\/?public\//i, '/');
  path = path.replace(/\/{2,}/g, '/');

  return path.startsWith('/') ? path : `/${path}`;
}

function runtimeUploadPath(cleanPath) {
  let uploadPath = cleanPath.replace(/^\/+/, '');

  if (uploadPath.startsWith('uploads/media/')) {
    uploadPath = uploadPath.slice('uploads/media/'.length);
  }

  const uploadDirectory = uploadPath.split('/')[0];

  return RUNTIME_UPLOAD_DIRECTORIES.has(uploadDirectory) ? uploadPath : '';
}

/**
 * Resolves an image path to a full URL, handling Vite's public folder and absolute URLs.
 * @param {string} profileImage - The path or URL to the image
 * @returns {string|null} The resolved image URL
 */
export const resolveImageUrl = (profileImage) => {
  if (!profileImage) return null;

  // 1. Blobs/Previews (already absolute or temporary)
  if (profileImage.startsWith('blob:') || profileImage.startsWith('data:')) {
    return profileImage;
  }

  // 2. Already absolute URLs
  if (profileImage.startsWith('http')) {
    return profileImage;
  }

  // 3. Vite Assets from 'public' folder
  // Contents of 'public/' are served at the root '/' by Vite.
  // If path is '/public/uploads/xxx.png', it's actually at '/uploads/xxx.png'
  const cleanPath = normalizePublicPath(profileImage);
  const uploadPath = runtimeUploadPath(cleanPath);

  if (API_BASE_URL && uploadPath) {
    return appendAccessToken(getApiUrl(`/uploads/media/${uploadPath}`));
  }

  // Request from current origin (Vite dev server)
  return cleanPath;
};
