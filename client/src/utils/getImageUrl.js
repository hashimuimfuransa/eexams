import api from '../services/api';

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

/**
 * Uploads any File-based image entries to Cloudinary, passes already-hosted URLs through
 * unchanged, and drops entries that fail to upload or are still a local data: URI. Shared by
 * every "save/publish a question" handler so image handling doesn't get re-implemented per
 * call site.
 */
export async function uploadImageEntries(entries) {
  const results = await Promise.all((entries || []).map(async (img) => {
    if (img?.file instanceof File) {
      const formData = new FormData();
      formData.append('image', img.file);
      try {
        const uploadRes = await api.post('/admin/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        });
        return uploadRes.data.url;
      } catch (uploadError) {
        console.error('Failed to upload image:', uploadError);
        return null;
      }
    }
    return img?.url && !img.url.startsWith('data:') ? img.url : null;
  }));
  return results.filter(Boolean);
}

/**
 * Resolves a question's own images plus (recursively) each sub-question's images into hosted
 * imageUrl/imageUrls, uploading any pending File objects along the way. Used by every publish/
 * save-draft/save-question-edit handler so sub-question images get uploaded the same way the
 * top-level question's images do, instead of being silently left as unhosted base64 data URIs.
 */
export async function resolveQuestionImages(q) {
  const entries = (q.images && q.images.length) ? q.images : toImageEntries(q);
  const finalImageUrls = await uploadImageEntries(entries);

  const subQuestions = Array.isArray(q.subQuestions) && q.subQuestions.length
    ? await Promise.all(q.subQuestions.map(resolveQuestionImages))
    : q.subQuestions;

  return {
    ...q,
    image: undefined,
    images: undefined,
    imageUrl: finalImageUrls[0] || '',
    imageUrls: finalImageUrls,
    subQuestions,
  };
}
