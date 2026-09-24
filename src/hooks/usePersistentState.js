import { useEffect, useState } from 'react';

// Keys that must never be written to localStorage when real Supabase Auth
// is in use (they would only ever hold demo credentials in plain text).
const SENSITIVE_KEYS = new Set(['dzair-volley-admin-credentials']);
const SUPABASE_AUTH_ACTIVE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

// Works exactly like useState, but reads its initial value from
// localStorage (if present) and writes back on every change — so
// admin-added news/reels/results survive a real page reload, not just
// live in memory for the current session.
export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch (e) {
      // Corrupt or inaccessible storage — fall back to the seed value.
    }
    return initialValue;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (SUPABASE_AUTH_ACTIVE && SENSITIVE_KEYS.has(key)) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage full or unavailable (private mode, etc.) — non-fatal;
      // the site keeps working from in-memory state for this session.
    }
  }, [key, value]);

  return [value, setValue];
}
