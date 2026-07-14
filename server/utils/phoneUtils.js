// Rwanda-first phone normalization: accepts local formats (e.g. 0788123456,
// 788123456) and converts them to the +250 E.164-ish format required by the
// User model's validator. Numbers already prefixed with a country code are
// passed through unchanged (after stripping spaces/dashes/parens).

const RWANDA_LOCAL_MOBILE = /^0?7\d{8}$/; // 0788123456 or 788123456
const E164_LIKE = /^\+[\d\s\-\(\)]{10,}$/;

/**
 * Normalizes a phone number to the +250 format when it looks like a Rwandan
 * local number, otherwise returns the trimmed input unchanged.
 * Returns '' for empty/falsy input.
 * Throws an Error with a user-facing message if the number can't be normalized
 * into a valid format.
 */
function normalizePhone(phone) {
  if (!phone) return '';

  const trimmed = String(phone).trim();
  if (!trimmed) return '';

  const digitsOnly = trimmed.replace(/[\s\-\(\)]/g, '');

  if (RWANDA_LOCAL_MOBILE.test(digitsOnly)) {
    const nationalNumber = digitsOnly.replace(/^0/, '');
    return `+250${nationalNumber}`;
  }

  if (E164_LIKE.test(trimmed)) {
    return trimmed;
  }

  throw new Error('Please enter a valid phone number with country code (e.g., +250 788 123 456)');
}

module.exports = { normalizePhone };
