const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  let path = String(profileImage).trim();
  
  // Strip '/public' or 'public' prefix if present
  const cleanPath = path.replace(/^\/?public\//, '/');
  
  // Ensure it starts with a single slash
  const finalPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
  
  // Request from current origin (Vite dev server)
  return finalPath;
};
