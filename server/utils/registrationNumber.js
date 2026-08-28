/**
 * Student registration numbers.
 *
 * Format: <SCHOOL-PREFIX>-<YEAR>-<4-DIGIT SEQUENCE>, e.g. GSK-2026-0042.
 * The prefix is derived from the school name so a printed transcript is
 * recognisable at a glance, and the whole string is safe to put in a URL
 * (uppercase letters, digits and dashes only) because /results looks a
 * student up by it directly.
 */

// Anything a school might type by hand: must start alphanumeric, 3-30 chars.
const REG_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

const DEFAULT_PREFIX = 'STU';
const SEQUENCE_WIDTH = 4;

/**
 * Normalise user-supplied input so lookups and uniqueness checks agree:
 * trim, uppercase, collapse whitespace/underscores/slashes into dashes.
 */
const normalizeRegistrationNumber = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s_/\\.]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

const isValidRegistrationNumber = (value) => REG_NUMBER_PATTERN.test(value || '');

/**
 * Build the school portion of the number: initials for a multi-word school
 * name ("Groupe Scolaire Kigali" -> GSK), otherwise the first 4 letters.
 */
const buildPrefix = (organization) => {
  const cleaned = String(organization || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  if (!cleaned) return DEFAULT_PREFIX;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const prefix = words.length >= 2
    ? words.slice(0, 4).map(w => w[0]).join('')
    : words[0].slice(0, 4);

  // Guard against a name that reduces to fewer than 2 usable characters.
  return prefix.length >= 2 ? prefix : DEFAULT_PREFIX;
};

/** The "<PREFIX>-<YEAR>-" stem that every number for one school-year shares. */
const buildBase = (organization, year) =>
  `${buildPrefix(organization)}-${year || new Date().getFullYear()}-`;

const formatRegistrationNumber = (base, sequence) =>
  `${base}${String(sequence).padStart(SEQUENCE_WIDTH, '0')}`;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matcher for every number already issued under one base.
 *
 * Deliberately [0-9] rather than \d: this pattern used to be built inside a
 * template literal, where a single-backslash \d silently collapses to a literal
 * "d", so the lookup matched nothing, every student was handed sequence 0001,
 * and each save then failed on the unique index.
 */
const sequenceMatcher = (base) => new RegExp('^' + escapeRegExp(base) + '[0-9]+$');

/**
 * The next free sequence number under a base.
 *
 * Sorting the zero-padded strings descending gives the highest sequence for
 * anything under 10,000 students in one school-year; past that the retry in
 * assignRegistrationNumber walks forward until it finds a free slot.
 */
const nextSequence = async (base) => {
  const User = require('../models/User');

  const last = await User.findOne({ registrationNumber: sequenceMatcher(base) })
    .sort({ registrationNumber: -1 })
    .select('registrationNumber')
    .lean();

  if (!last || !last.registrationNumber) return 1;

  const parsed = parseInt(last.registrationNumber.slice(base.length), 10);
  return (Number.isFinite(parsed) ? parsed : 0) + 1;
};

/**
 * Next free registration number for a school in a given year.
 * The unique index on User.registrationNumber is the real guarantee — callers
 * that save should go through assignRegistrationNumber, which retries.
 */
const generateRegistrationNumber = async (organization, year) => {
  const base = buildBase(organization, year);
  return formatRegistrationNumber(base, await nextSequence(base));
};

const isDuplicateRegistrationNumber = (error) =>
  error &&
  error.code === 11000 &&
  JSON.stringify(error.keyPattern || error.keyValue || {}).includes('registrationNumber');

/**
 * Set and persist a registration number on a student, stepping past any
 * sequence another request has already claimed.
 *
 * Uses a targeted updateOne rather than student.save(): callers commonly load
 * students with .select('-password'), and a full save would then fail the
 * schema's `password` required validator on a field it never fetched.
 */
const assignRegistrationNumber = async (student, organization, attempts = 10) => {
  const User = require('../models/User');

  const base = buildBase(organization || student.organization);
  // Read the sequence once, then walk forward. Re-deriving it on every retry
  // would produce the same colliding candidate each time and never converge.
  let sequence = await nextSequence(base);

  for (let attempt = 0; attempt < attempts; attempt++, sequence++) {
    const candidate = formatRegistrationNumber(base, sequence);
    try {
      await User.updateOne({ _id: student._id }, { $set: { registrationNumber: candidate } });
      student.registrationNumber = candidate;
      return candidate;
    } catch (error) {
      if (!isDuplicateRegistrationNumber(error)) throw error;
      if (attempt === attempts - 1) {
        throw new Error(
          `Could not find a free registration number after ${attempts} attempts (last tried ${candidate}).`
        );
      }
      // Someone else holds this one; the loop's sequence++ moves us past it.
    }
  }

  return null;
};

module.exports = {
  REG_NUMBER_PATTERN,
  SEQUENCE_WIDTH,
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
  buildPrefix,
  buildBase,
  formatRegistrationNumber,
  sequenceMatcher,
  nextSequence,
  generateRegistrationNumber,
  assignRegistrationNumber
};
