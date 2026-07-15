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

/**
 * Returns a question's reference images as a plain array of raw URL/data-URI strings, newest
 * multi-image field first with a fallback to the legacy single-image fields so old questions
 * keep displaying correctly.
 */
export function getQuestionImages(question) {
  if (!question) return [];
  if (Array.isArray(question.imageUrls) && question.imageUrls.length) {
    return question.imageUrls.filter(Boolean);
  }
  const single = question.imageUrl || question.image;
  return single && typeof single === 'string' ? [single] : [];
}

/**
 * Seeds the { file, url }[] shape MultiImageUploader expects from a question that may only
 * have the legacy single-image fields.
 */
export function toImageEntries(question) {
  return getQuestionImages(question).map(url => ({ file: null, url }));
}
