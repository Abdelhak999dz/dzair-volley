// ============================================================
// Input sanitization helpers (defense-in-depth).
//
// React already escapes every text node, and the site never uses
// dangerouslySetInnerHTML, so stored text can't execute as markup. These
// helpers add a second layer: they normalise anything a person (or a
// script hitting the forms) can type before it reaches state, the
// database or a src/href attribute.
// ============================================================

// C0/C1 control characters (except \t \n \r), DEL, and the Unicode
// bidi *override/embedding* controls (U+202A–U+202E) that are used to
// visually spoof text (e.g. reversing a filename or a link label).
// The harmless LRM/RLM marks (U+200E/U+200F) that Arabic text can
// legitimately contain are left untouched.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

// Zero-width characters used to smuggle invisible payloads / evade filters.
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

export function stripUnsafeChars(value) {
  return String(value ?? '').replace(UNSAFE_CHARS, '').replace(ZERO_WIDTH, '');
}

// Plain-text sanitizer: strips unsafe characters, neutralises HTML
// metacharacters, collapses runaway whitespace, trims and (optionally)
// hard-limits the length.
export function sanitizeText(value, maxLength = 0) {
  let out = stripUnsafeChars(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (maxLength > 0 && out.length > maxLength) out = out.slice(0, maxLength).trim();
  return out;
}

// Only http(s) URLs may ever reach an <img src>, <video src>, <iframe src>
// or <a href>. Rejects javascript:, data:, vbscript:, file:, blob: ...
export function isSafeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Returns the normalised URL string when safe, otherwise ''.
export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    // Never keep credentials embedded in a URL (user:pass@host).
    url.username = '';
    url.password = '';
    return url.toString();
  } catch (e) {
    return '';
  }
}

// Escapes a URL for use inside a CSS url("...") custom-property value.
export function cssUrl(value) {
  const safe = String(value ?? '').replace(/["\\\n\r)(]/g, (c) => encodeURIComponent(c));
  return `url("${safe}")`;
}
