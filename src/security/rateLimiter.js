// ============================================================
// Client-side sliding-window rate limiter.
//
// This is a UX / abuse speed-bump for a single browser tab (spam-clicking
// like, flooding the comment box, hammering the rating stars). It is NOT
// a security boundary on its own — a determined script can bypass any
// client code — which is why every anonymous write path is ALSO
// rate-limited server-side in supabase/schema.sql (rate_limit_check()).
// ============================================================

const memory = new Map(); // key -> number[] (timestamps, ms)
const STORAGE_KEY = 'dzair-volley-rl';

function readStore() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStore(obj) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    // sessionStorage unavailable — in-memory limiting still applies.
  }
}

/**
 * Returns true when the action is allowed (and records it), false when
 * the caller has exceeded `max` actions inside the last `windowMs`.
 */
export function allowAction(key, max, windowMs) {
  const now = Date.now();
  const stored = readStore();
  const merged = (memory.get(key) || stored[key] || []).filter((ts) => now - ts < windowMs);
  if (merged.length >= max) {
    memory.set(key, merged);
    return false;
  }
  merged.push(now);
  memory.set(key, merged);
  stored[key] = merged;
  writeStore(stored);
  return true;
}

/** Milliseconds until the next action under `key` would be allowed. */
export function retryAfterMs(key, max, windowMs) {
  const now = Date.now();
  const list = (memory.get(key) || []).filter((ts) => now - ts < windowMs);
  if (list.length < max) return 0;
  return Math.max(0, windowMs - (now - list[0]));
}
