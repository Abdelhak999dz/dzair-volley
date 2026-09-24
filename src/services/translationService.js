// Real, live machine translation for dynamic site content (news, reels,
// any admin-entered text) — NOT the static UI-chrome strings, which stay
// in LanguageContext.jsx's `translations` table. This is what powers
// "any news, article, title, or content on the site is automatically
// translated into whatever language a visitor picks" — every call here
// hits a real translation API; nothing here is a fixed/fake string.
//
// Provider: MyMemory Translation API (https://mymemory.translated.net) —
// free, keyless, CORS-enabled, good enough quality/rate-limits for a
// public sports site. If a request fails (network hiccup, rate limit,
// unsupported language pair) we fail soft and return the original text,
// so the site never shows an error or empty string in place of content.
//
// Every (sourceText, targetLang) pair is translated at most once per
// browser: results are cached in memory for the session and mirrored to
// localStorage so a repeat visit doesn't re-translate the same news
// titles/summaries again.

const CACHE_KEY = 'dzair-volley-translation-cache-v1';
const MAX_CACHE_ENTRIES = 2000;
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

let memoryCache = null;

function loadCache() {
  if (memoryCache) return memoryCache;
  memoryCache = new Map();
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => memoryCache.set(k, v));
    }
  } catch (e) {
    // Corrupt/unavailable localStorage — start with an empty cache.
  }
  return memoryCache;
}

function persistCache() {
  try {
    if (typeof window === 'undefined' || !memoryCache) return;
    // Keep the persisted cache bounded — drop the oldest entries once it
    // grows past MAX_CACHE_ENTRIES rather than growing localStorage forever.
    if (memoryCache.size > MAX_CACHE_ENTRIES) {
      const entries = Array.from(memoryCache.entries()).slice(-MAX_CACHE_ENTRIES);
      memoryCache = new Map(entries);
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memoryCache)));
  } catch (e) {
    // Non-fatal — translation still works without a persisted cache.
  }
}

function cacheKey(text, sourceLang, targetLang) {
  return `${sourceLang}|${targetLang}|${text}`;
}

// In-flight request de-duplication: if several components ask to
// translate the exact same text to the same language in the same tick
// (e.g. a news card's title appearing in a list and a "read more" view),
// they share one network request instead of firing one each.
const inFlight = new Map();

/**
 * Translate `text` from `sourceLang` to `targetLang` (ISO 639-1 codes,
 * e.g. 'ar', 'en', 'fr', 'es', 'de', 'zh-CN', ...). Returns the original
 * text unchanged when the two languages match, the text is empty, or the
 * translation request fails for any reason.
 */
export async function translateText(text, targetLang, sourceLang = 'ar') {
  const trimmed = (text || '').toString();
  if (!trimmed.trim()) return trimmed;
  if (!targetLang || targetLang === sourceLang) return trimmed;

  const cache = loadCache();
  const key = cacheKey(trimmed, sourceLang, targetLang);
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const request = (async () => {
    try {
      // MyMemory caps a single request around ~500 bytes of source text;
      // real news titles/summaries comfortably fit. Longer admin-entered
      // text is translated as-is and simply falls back to the original
      // string if the API rejects it as too long.
      const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(trimmed)}&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(targetLang)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Translation request failed (${res.status})`);
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      const looksValid = typeof translated === 'string' && translated.trim() && !/^AWFUL|INVALID/i.test(translated);
      const result = looksValid ? translated : trimmed;
      cache.set(key, result);
      persistCache();
      return result;
    } catch (e) {
      return trimmed;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

/**
 * Translate several strings for the same target language in one pass —
 * used for a news card's title + summary + category together so a
 * component only needs one loading state instead of three.
 */
export async function translateAll(texts, targetLang, sourceLang = 'ar') {
  return Promise.all(texts.map((t) => translateText(t, targetLang, sourceLang)));
}
