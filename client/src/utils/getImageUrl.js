/**
 * Resolves a question image URL to an absolute URL.
 * - Cloudinary URLs (https://...) are returned as-is.
 * - Base64 data URIs (data:...) are returned as-is.
 * - Relative paths (/uploads/...) are prefixed with the server base URL.
 */
export function getImageUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  return base + url;
}
