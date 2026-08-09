/**
 * Turn a Mongoose document (or subdocument) into a plain object before spreading it.
 *
 * Spreading a Mongoose document does NOT copy its schema fields. `{ ...subQuestion }` yields
 * `{ __parentArray, __index, $__parent, $__, _doc, $isNew }` — the real values live behind
 * getters on the prototype, so every field silently becomes undefined.
 *
 * This bit hard: the graders build `{ ...subQ, points: scaledPoints }` to mark a part against a
 * rescaled allocation. Under `.lean()` (how the tests and the submission path load questions) the
 * spread works and everything is fine; the regrade path loads real documents because it has to
 * call `result.save()`, so `requiresWrittenAnswer` and `writtenAnswerModelAnswer` came through as
 * undefined and the written half of a financial-spreadsheet question was never marked — the grid
 * quietly absorbed all the marks instead.
 */
function toPlainDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

/** Plain copy of `doc` with `overrides` applied — the safe form of `{ ...doc, ...overrides }`. */
function withOverrides(doc, overrides) {
  return { ...toPlainDoc(doc), ...overrides };
}

module.exports = { toPlainDoc, withOverrides };
