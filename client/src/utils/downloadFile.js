import api from '../services/api';

/**
 * Fetch an authenticated endpoint that streams a file and hand it to the
 * browser as a download. The api instance attaches the bearer token, so this
 * can't be a plain <a href> — the response has to come back through axios.
 *
 * @param {string} url       api path, e.g. '/admin/transcripts/export/pdf'
 * @param {Object} params    query params
 * @param {string} fallback  file name used when the server sends no filename
 * @returns {Promise<string>} the file name that was saved
 */
export default async function downloadFile(url, params = {}, fallback = 'download') {
  const res = await api.get(url, { params, responseType: 'blob' });

  // A streamed error still arrives as a blob, so unwrap it before saving a
  // "PDF" that is really a JSON error body.
  const type = res.data?.type || '';
  if (type.includes('application/json')) {
    const text = await res.data.text();
    let message = 'The export failed. Please try again.';
    try { message = JSON.parse(text).message || message; } catch { /* keep default */ }
    throw new Error(message);
  }

  // Prefer the server's own filename from Content-Disposition.
  const disposition = res.headers?.['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1]) : fallback;

  const href = window.URL.createObjectURL(new Blob([res.data], { type: type || undefined }));
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);

  return fileName;
}
