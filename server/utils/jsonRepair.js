/**
 * Tolerant JSON recovery for LLM output.
 *
 * Even in JSON mode the models occasionally emit *almost* valid JSON - a stray quote in front
 * of an object in an array, one extra closing brace, a trailing comma, or an answer cut off
 * mid-way when the token budget runs out. Groq validates the output server-side and, when it
 * does not parse, rejects the whole call with a 400 `json_validate_failed` and hands the broken
 * text back in `failed_generation`. Throwing that away means losing a complete 50-question exam
 * over two misplaced characters, so we try to repair it here before giving up.
 *
 * Everything is done with a string-aware scanner rather than regexes: values in this codebase
 * legitimately contain stringified JSON (e.g. `"spreadsheetModelAnswer": "{\"tables\":[]}"`),
 * and a naive regex pass mangles those.
 */

/**
 * Strip markdown fences / leading prose and keep only the outermost JSON value.
 * @param {string} text
 * @returns {string}
 */
const stripToJsonValue = (text) => {
  let s = String(text || '').trim();

  // ```json ... ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start > 0) s = s.slice(start);

  const lastEnd = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastEnd !== -1 && lastEnd < s.length - 1) s = s.slice(0, lastEnd + 1);

  return s.trim();
};

/**
 * Single-pass structural repair.
 *
 * Fixes, without ever touching the inside of a string literal:
 *  - a stray `"` where an object/array is about to start (`,"{"label":...` -> `,{"label":...`)
 *  - closing brackets that do not match what is actually open (the extra `}` after a question
 *    object, which is what took the pasted-exam parser down)
 *  - trailing commas before `}` / `]`
 *  - unterminated strings and unclosed objects/arrays left behind by a truncated response
 *
 * @param {string} text
 * @returns {string} repaired JSON text (not guaranteed to parse - callers must try/catch)
 */
const repairJsonText = (text) => {
  const s = stripToJsonValue(text);

  let out = '';
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      // A quote immediately followed by `{` or `[` and then a *bare* quote is the stray-quote
      // glitch: `,"{"label":"c)"` . A genuine string holding stringified JSON always escapes its
      // inner quote (`"{\"tables\"...`), so the backslash check keeps those intact.
      const next = s[i + 1];
      const after = s[i + 2];
      const prev = out.replace(/\s+$/, '').slice(-1);
      const atValueStart = prev === ',' || prev === '[' || prev === ':' || prev === '';
      if (atValueStart && (next === '{' || next === '[') && after !== '\\') {
        continue; // drop the stray quote
      }
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      out += ch;
      continue;
    }

    if (ch === '}' || ch === ']') {
      const want = ch === '}' ? '{' : '[';
      if (stack[stack.length - 1] === want) {
        out = out.replace(/,\s*$/, ''); // trailing comma before the closer
        stack.pop();
        out += ch;
      }
      // Anything else is a closer with nothing (or the wrong thing) open - the extra `}` case.
      // Dropping it is always safer than emitting it, since emitting guarantees a parse failure.
      continue;
    }

    out += ch;
  }

  // Tail repair for truncated output.
  if (inString) out += '"';
  out = out.replace(/,\s*$/, '');
  while (stack.length > 0) {
    const open = stack.pop();
    out = out.replace(/,\s*$/, '');
    out += open === '{' ? '}' : ']';
  }

  return out;
};

/**
 * Drop whatever sits after the last complete element at the given depth, so a response that was
 * cut off in the middle of a key/value pair can still yield every element that came before it.
 * @param {string} text
 * @returns {string|null}
 */
const truncateToLastCompleteElement = (text) => {
  const s = stripToJsonValue(text);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastSafe = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') { depth--; if (depth >= 1) lastSafe = i; continue; }
  }

  return lastSafe > 0 ? s.slice(0, lastSafe + 1) : null;
};

/**
 * Parse LLM JSON output, repairing it if needed.
 * @param {string} text - raw model output (may be fenced, malformed or truncated)
 * @returns {{ value: any, repaired: boolean }|null} null when nothing usable could be recovered
 */
const parseJsonLoose = (text) => {
  if (!text || typeof text !== 'string') return null;

  try {
    return { value: JSON.parse(text), repaired: false };
  } catch {
    // fall through to the repair strategies
  }

  const strategies = [
    () => stripToJsonValue(text),
    () => repairJsonText(text),
    () => {
      const trimmed = truncateToLastCompleteElement(text);
      return trimmed ? repairJsonText(trimmed) : null;
    }
  ];

  for (const strategy of strategies) {
    let candidate;
    try {
      candidate = strategy();
    } catch {
      continue;
    }
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object') return { value, repaired: true };
    } catch {
      // try the next strategy
    }
  }

  return null;
};

/**
 * Convenience wrapper: the recovered object, or null.
 * @param {string} text
 * @returns {any|null}
 */
const repairJson = (text) => {
  const result = parseJsonLoose(text);
  return result ? result.value : null;
};

/**
 * Pull the model's rejected output out of a Groq 400 `json_validate_failed` error.
 *
 * The groq-sdk APIError carries the parsed body on `.error`, but generateContent (and other
 * wrappers) re-throw plain Errors whose message is `Groq API error: 400 {json body}` - so fall
 * back to digging the body out of the message text.
 *
 * @param {Error} error
 * @returns {string|null} the raw `failed_generation`, or null if this is not that kind of error
 */
const extractFailedGeneration = (error) => {
  if (!error) return null;

  const body = error.error || error.response?.data;
  const direct = body?.error?.failed_generation ?? body?.failed_generation;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const message = typeof error.message === 'string' ? error.message : '';
  if (!message.includes('failed_generation')) return null;

  const start = message.indexOf('{');
  if (start === -1) return null;
  try {
    const parsed = JSON.parse(message.slice(start));
    const fromMessage = parsed?.error?.failed_generation ?? parsed?.failed_generation;
    if (typeof fromMessage === 'string' && fromMessage.trim()) return fromMessage;
  } catch {
    // message was not a clean `<status> <json body>` - nothing recoverable
  }

  return null;
};

/**
 * True when the error is Groq rejecting the model's own output as invalid JSON.
 * @param {Error} error
 * @returns {boolean}
 */
const isJsonValidationError = (error) => {
  if (!error) return false;
  // `error.code` covers the normalized error generateContent re-throws once its retries are
  // spent; the nested forms cover the raw groq-sdk APIError.
  const code = error.code || error.error?.error?.code || error.error?.code;
  if (code === 'json_validate_failed') return true;
  const message = typeof error.message === 'string' ? error.message : '';
  return message.includes('json_validate_failed') ||
    message.includes('Failed to generate JSON') ||
    message.includes('Failed to validate JSON');
};

module.exports = {
  parseJsonLoose,
  repairJson,
  repairJsonText,
  stripToJsonValue,
  extractFailedGeneration,
  isJsonValidationError
};
