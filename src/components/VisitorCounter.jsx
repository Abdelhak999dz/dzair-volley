import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { allowAction } from '../security/rateLimiter.js';

// Real, persisted-in-Supabase site stats — a single row (id = 1) in the
// `site_stats` table holding the live visitor count and the aggregate
// site rating (rating_sum / rating_count), kept in sync across every
// device in real time. See README.md ("Real visitor counter & site
// rating: Supabase sync") for the exact `create table` / RPC / RLS SQL.
// Without Supabase configured, everything falls back to a real (not
// fabricated) per-browser count/rating stored in localStorage, starting
// from 0 either way — never a fake seeded number.
const TABLE = 'site_stats';
const ROW_ID = 1;
const LOCAL_VISITORS_KEY = 'dzair-volley-visitor-count';
const LOCAL_RATING_KEY = 'dzair-volley-site-rating-agg';
const USER_RATING_KEY = 'dzair-volley-user-rating';
const SESSION_COUNTED_KEY = 'dzair-volley-visit-counted';

function readLocalRating() {
  try {
    const stored = window.localStorage.getItem(LOCAL_RATING_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.sum === 'number' && typeof parsed.count === 'number') return parsed;
    }
  } catch (e) {
    // ignore corrupt/inaccessible storage
  }
  return { sum: 0, count: 0 };
}

function readUserRating() {
  try {
    return Number(window.localStorage.getItem(USER_RATING_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

function StarIcon({ filled, glowing }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), filter 0.25s ease',
        filter: glowing
          ? 'drop-shadow(0 0 8px rgba(255,201,60,0.85)) drop-shadow(0 0 16px rgba(255,201,60,0.5))'
          : filled
          ? 'drop-shadow(0 0 4px rgba(255,201,60,0.4))'
          : 'none',
      }}
    >
      <path
        d="M12 2.5l2.95 6.28 6.8.72-5.02 4.72 1.4 6.78L12 17.9l-6.13 3.1 1.4-6.78-5.02-4.72 6.8-.72L12 2.5z"
        fill={filled ? 'url(#dv-star-grad)' : 'rgba(255,255,255,0.08)'}
        stroke={filled ? '#ffc93c' : 'var(--border-color)'}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="dv-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="55%" stopColor="#ffc93c" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Real live-visitor counter + a real 5-star site rating widget. Both
// start at 0 and only ever move in response to an actual visit or an
// actual submitted rating — never a simulated/randomized number.
export default function VisitorCounter() {
  const { t } = useLanguage();
  const [visitors, setVisitors] = useState(0);
  const [isBumping, setIsBumping] = useState(false);
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(readUserRating);
  const [hoverStar, setHoverStar] = useState(0);
  const [justRated, setJustRated] = useState(false);
  const prevVisitorsRef = useRef(0);
  // Last known-good raw rating totals (not just the derived average),
  // kept in sync with every server response/realtime update so a new
  // rating click can compute its optimistic UI update — and, if the
  // write fails, its rollback — from real numbers instead of guessing
  // from the already-rounded displayed average.
  const ratingSumRef = useRef(0);
  const ratingCountRef = useRef(0);

  const wasCountedThisSession = () => {
    try {
      return window.sessionStorage.getItem(SESSION_COUNTED_KEY) === '1';
    } catch (e) {
      return false;
    }
  };
  const markCountedThisSession = () => {
    try {
      window.sessionStorage.setItem(SESSION_COUNTED_KEY, '1');
    } catch (e) {
      // non-fatal
    }
  };

  // Local (no-Supabase-configured) fallback: a real per-browser count and
  // rating persisted in localStorage, starting from 0 — counted once per
  // browser session so reloading the page never double-counts a visit.
  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      const storedVisitors = Number(window.localStorage.getItem(LOCAL_VISITORS_KEY)) || 0;
      const alreadyCounted = wasCountedThisSession();
      const next = alreadyCounted ? storedVisitors : storedVisitors + 1;
      if (!alreadyCounted) {
        window.localStorage.setItem(LOCAL_VISITORS_KEY, String(next));
        markCountedThisSession();
      }
      setVisitors(next);
      const agg = readLocalRating();
      setRatingCount(agg.count);
      setRatingAverage(agg.count ? agg.sum / agg.count : 0);
    } catch (e) {
      // non-fatal — counter simply stays at 0 for this session
    }
  }, []);

  // Real Supabase-backed count + rating, synced live across every
  // visitor/device via a realtime subscription on `site_stats`.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function bootstrap() {
      // Increment the shared visitor count once per browser session
      // (fire-and-await, but this doesn't need to block the rating
      // aggregate fetch below — both simply run in this one async
      // function in sequence, always exactly once, so there's no
      // duplicate/second fetch racing against a fresh rating click).
      let visitorsFromIncrement = null;
      if (!wasCountedThisSession()) {
        const { data, error } = await supabase.rpc('increment_visitor_count');
        if (!cancelled && !error && typeof data === 'number') {
          visitorsFromIncrement = data;
        }
        markCountedThisSession();
      }

      const { data: row, error } = await supabase
        .from(TABLE)
        .select('visitors, rating_sum, rating_count')
        .eq('id', ROW_ID)
        .maybeSingle();
      if (cancelled) return;
      if (!error && row) {
        const finalVisitors = visitorsFromIncrement !== null ? visitorsFromIncrement : (row.visitors || 0);
        prevVisitorsRef.current = finalVisitors;
        setVisitors(finalVisitors);
        ratingSumRef.current = row.rating_sum || 0;
        ratingCountRef.current = row.rating_count || 0;
        setRatingCount(row.rating_count || 0);
        setRatingAverage(row.rating_count ? row.rating_sum / row.rating_count : 0);
      } else if (error) {
        // Table/RPC missing or RLS not configured yet — surface it in
        // the console rather than silently leaving the widget at 0
        // forever with no clue why.
        console.error('Dzair Volley: could not load site_stats', error);
      }
    }
    bootstrap();

    const channel = supabase
      .channel('site_stats_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, (payload) => {
        const row = payload.new;
        if (!row) return;
        if (typeof row.visitors === 'number' && row.visitors !== prevVisitorsRef.current) {
          prevVisitorsRef.current = row.visitors;
          setVisitors(row.visitors);
          setIsBumping(true);
          setTimeout(() => setIsBumping(false), 420);
        }
        ratingSumRef.current = row.rating_sum || 0;
        ratingCountRef.current = row.rating_count || 0;
        setRatingCount(row.rating_count || 0);
        setRatingAverage(row.rating_count ? row.rating_sum / row.rating_count : 0);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRate = async (value) => {
    // Client-side speed bump against star-mashing / scripted rating spam
    // (the server enforces its own per-IP limit in submit_site_rating).
    if (!allowAction('site-rating', 5, 60000)) return;
    const previous = userRating;
    setUserRating(value);
    try {
      window.localStorage.setItem(USER_RATING_KEY, String(value));
    } catch (e) {
      // non-fatal
    }
    setJustRated(true);
    setTimeout(() => setJustRated(false), 2200);

    if (!isSupabaseConfigured) {
      try {
        const agg = readLocalRating();
        const nextSum = agg.sum - previous + value;
        const nextCount = previous > 0 ? agg.count : agg.count + 1;
        window.localStorage.setItem(LOCAL_RATING_KEY, JSON.stringify({ sum: nextSum, count: nextCount }));
        setRatingAverage(nextCount ? nextSum / nextCount : 0);
        setRatingCount(nextCount);
      } catch (e) {
        // non-fatal
      }
      return;
    }

    // Optimistic update — computed from the real last-known totals, using
    // the exact same rule the server-side RPC applies — so the star/count
    // move the instant the visitor clicks instead of waiting on the round
    // trip. This is what actually fixes "5 stars but the count stays at
    // 0": the previous version only updated the UI after `await`ing the
    // RPC, so any RPC failure (missing table/function, RLS, network) left
    // the widget looking permanently stuck with no feedback at all.
    const rollbackSum = ratingSumRef.current;
    const rollbackCount = ratingCountRef.current;
    const optimisticSum = rollbackSum - previous + value;
    const optimisticCount = previous > 0 ? rollbackCount : rollbackCount + 1;
    ratingSumRef.current = optimisticSum;
    ratingCountRef.current = optimisticCount;
    setRatingCount(optimisticCount);
    setRatingAverage(optimisticCount ? optimisticSum / optimisticCount : 0);

    const { data, error } = await supabase.rpc('submit_site_rating', { p_new: value, p_previous: previous });
    if (!error && Array.isArray(data) && data[0]) {
      // Reconcile with the server's authoritative numbers (in case of
      // concurrent raters), replacing the optimistic estimate.
      const row = data[0];
      ratingSumRef.current = row.rating_sum || 0;
      ratingCountRef.current = row.rating_count || 0;
      setRatingCount(row.rating_count || 0);
      setRatingAverage(row.rating_count ? row.rating_sum / row.rating_count : 0);
    } else if (error) {
      // The write genuinely failed server-side — never leave a fake
      // number on screen: roll the widget (and the user's own star
      // selection) back to the real last-known state.
      console.error('Dzair Volley: submit_site_rating failed', error);
      ratingSumRef.current = rollbackSum;
      ratingCountRef.current = rollbackCount;
      setRatingCount(rollbackCount);
      setRatingAverage(rollbackCount ? rollbackSum / rollbackCount : 0);
      setUserRating(previous);
      try {
        window.localStorage.setItem(USER_RATING_KEY, String(previous));
      } catch (e) {
        // non-fatal
      }
    }
  };

  const displayValue = hoverStar || userRating;

  return (
    <div className="visitor-rating-wrap">
      {/* Live visitor counter — glowing pulsing-frame badge */}
      <div className="visitor-counter-frame" role="status" aria-live="polite">
        <span className="visitor-counter-dot" aria-hidden="true" />
        <span className="visitor-counter-label">{t('footer', 'visitorsLive')}</span>
        <span className={`visitor-counter-value ${isBumping ? 'is-bumping' : ''}`}>
          {visitors.toLocaleString()}
        </span>
      </div>

      {/* 5-star rating widget */}
      <div className="site-rating-widget">
        <span className="site-rating-label">{t('footer', 'rateUs')}</span>
        <div
          className="site-rating-stars"
          onMouseLeave={() => setHoverStar(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="site-rating-star-btn"
              onMouseEnter={() => setHoverStar(n)}
              onFocus={() => setHoverStar(n)}
              onClick={() => handleRate(n)}
              aria-label={`${n} / 5`}
            >
              <StarIcon filled={n <= displayValue} glowing={n <= hoverStar} />
            </button>
          ))}
        </div>
        <span className="site-rating-average">
          {ratingAverage.toFixed(1)} ★ · {ratingCount.toLocaleString()}
        </span>
        {justRated && <span className="site-rating-thanks">{t('footer', 'rateThanks')}</span>}
      </div>
    </div>
  );
}
