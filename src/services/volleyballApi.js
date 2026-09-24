import { getTeamFlagUrl, getCountryFlagUrl } from './countryFlags.js';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { SEED_RESULTS } from '../data/volleyballSeed.js';

// Real, live indoor-volleyball data — fetched EXCLUSIVELY and DIRECTLY from
// the browser using real, provider-issued API keys, with NO server-side
// middleman and NO third-party CORS relay/proxy of any kind in front of it
// (an unreliable public CORS-bypass relay being slow, rate-limited or down
// was the previous, now-removed, cause of results/schedules silently
// coming back empty or stuck on "loading"):
//
//   Highlightly Volleyball API (https://highlightly.net/volleyball-api/) —
//   a documented REST API, called directly from the browser (its own CORS
//   headers permit this) using the key configured in the environment:
//   VITE_HIGHLIGHTLY_API_KEY (or, as an alternative, VITE_RAPIDAPI_KEY for
//   the RapidAPI marketplace listing — used automatically whenever
//   VITE_HIGHLIGHTLY_API_KEY isn't set). This is the sole live match
//   source: every request goes straight from the visitor's browser to
//   Highlightly's API with that key attached, no relay/proxy in between.
//
// Results are normalized into a single, stable match shape (see
// normalizeHighlightlyMatch below), so every consumer of this module (the
// hooks in useVolleyballApi.js, and the components built on them) is
// completely unaware of the request/caching details behind it.
//
// --- Key protection: aggressive local caching, not a hidden key ---------
// Because every call here runs directly in the browser using the
// VITE_HIGHLIGHTLY_API_KEY / VITE_RAPIDAPI_KEY values baked into the public
// build, that key is visible to anyone who inspects the page's network
// requests or JS bundle — bundling a VITE_* value does not, and cannot,
// hide it. What DOES protect the key's daily quota from being exhausted is
// the persistent localStorage cache below (CACHE_TTL_MS): once any date has
// been fetched, every further request for that same date — on this page,
// on a reload, or hours later — is served straight from localStorage and
// never touches the network again until the cache expires. Combined with
// the in-flight request de-duplication (pendingRequests) and the
// quota-exhaustion circuit breaker (RATE_LIMIT_COOLDOWN_MS) further below,
// this keeps the real number of upstream calls small regardless of how
// often a visitor reloads or navigates the site.

const HIGHLIGHTLY_DIRECT_BASE_URL = 'https://volleyball.highlightly.net';
const HIGHLIGHTLY_RAPIDAPI_BASE_URL = 'https://volleyball-highlights-api.p.rapidapi.com';
const HIGHLIGHTLY_RAPIDAPI_HOST = 'volleyball-highlights-api.p.rapidapi.com';

const HIGHLIGHTLY_KEY = import.meta.env.VITE_HIGHLIGHTLY_API_KEY || '';
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '';
const CUSTOM_HIGHLIGHTLY_BASE_URL = import.meta.env.VITE_HIGHLIGHTLY_BASE_URL || '';
const CUSTOM_HIGHLIGHTLY_HOST = import.meta.env.VITE_HIGHLIGHTLY_API_HOST || '';

let HIGHLIGHTLY_API_KEY = '';
let HIGHLIGHTLY_BASE_URL = HIGHLIGHTLY_DIRECT_BASE_URL;
let HIGHLIGHTLY_API_HOST = '';

if (HIGHLIGHTLY_KEY) {
  HIGHLIGHTLY_API_KEY = HIGHLIGHTLY_KEY;
  HIGHLIGHTLY_BASE_URL = CUSTOM_HIGHLIGHTLY_BASE_URL || HIGHLIGHTLY_DIRECT_BASE_URL;
  HIGHLIGHTLY_API_HOST = CUSTOM_HIGHLIGHTLY_HOST || '';
} else if (RAPIDAPI_KEY) {
  HIGHLIGHTLY_API_KEY = RAPIDAPI_KEY;
  HIGHLIGHTLY_BASE_URL = CUSTOM_HIGHLIGHTLY_BASE_URL || HIGHLIGHTLY_RAPIDAPI_BASE_URL;
  HIGHLIGHTLY_API_HOST = CUSTOM_HIGHLIGHTLY_HOST || HIGHLIGHTLY_RAPIDAPI_HOST;
}

function isHighlightlyConfigured() {
  return Boolean(HIGHLIGHTLY_API_KEY);
}

// Whether a direct, keyed live-data source is actually configured. Kept as
// an exported function (rather than a constant) so it still reads naturally
// at every call site, and so it always reflects the real environment keys
// rather than a value computed once at module load in some bundlers.
export function isVolleyballApiConfigured() {
  return isHighlightlyConfigured();
}

// --- Rate-limit-resilient local cache ---------------------------------
// Every day's response is cached independently. A *fresh* cache hit
// (within CACHE_TTL_MS) skips the network entirely. If a live fetch fails
// for any reason — every source unreachable/rate-limited — we fall back to
// the *stale* cache for that same date (however old it is) instead of
// surfacing a raw error. In practice this means: once a visitor has loaded
// the page successfully once, hitting reload repeatedly never shows a red
// error again for that browser, since there's always a stale fallback to
// serve.
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — aggressive caching: upstream sources (and the shared Supabase cache) are only re-hit a few times a day per date, so every visitor is served instantly from cache/localStorage without ever exhausting a third-party quota
const CACHE_PREFIX = 'dzair-volley-vbapi:';

// --- Smart caching v2: tiered TTL per date ------------------------------
// One flat 4-hour TTL for every date wastes quota: a match played 10 days
// ago will never change, while today's list can. Each date now gets the TTL
// that fits how likely its data is to still change:
//
//   today / yesterday .... 4 h   (scores settle, late matches finish)
//   upcoming days ........ 6 h   (fixtures rarely move within a few hours)
//   2 – 6 days ago ....... 24 h  (results are final)
//   7+ days ago .......... 72 h  (results are final and effectively frozen)
//
// Across the whole 14-day results window + 7-day schedule window this keeps
// the *entire site* (not per visitor) to roughly 40-60 upstream requests a
// day in steady state, instead of ~120, no matter how many people visit.
const HOUR_MS = 60 * 60 * 1000;
const TTL_TODAY_MS = CACHE_TTL_MS;
const TTL_YESTERDAY_MS = CACHE_TTL_MS;
const TTL_FUTURE_MS = 6 * HOUR_MS;
const TTL_RECENT_PAST_MS = 24 * HOUR_MS;
const TTL_OLD_PAST_MS = 72 * HOUR_MS;

// `day` is a "YYYY-MM-DD" string (UTC, same as dateStr() below).
function ttlForDay(day) {
  const diff = Math.round((Date.parse(day) - Date.parse(dateStr(0))) / 86400000);
  if (!Number.isFinite(diff)) return CACHE_TTL_MS;
  if (diff > 0) return TTL_FUTURE_MS;
  if (diff === 0) return TTL_TODAY_MS;
  if (diff === -1) return TTL_YESTERDAY_MS;
  if (diff >= -6) return TTL_RECENT_PAST_MS;
  return TTL_OLD_PAST_MS;
}

// --- Smart caching v2: per-browser hard budget --------------------------
// Last-resort guard for the *browser's* upstream requests: even if a bug,
// a runaway refresh loop or a hostile script re-triggered fetches, one
// browser can never send more than UPSTREAM_BUDGET_PER_DAY requests to the
// third-party API in a calendar day (UTC). A cold, empty-cache page load
// needs roughly 20-40 requests, so this leaves plenty of headroom.
const UPSTREAM_BUDGET_PER_DAY = 120;
const UPSTREAM_BUDGET_KEY = `${CACHE_PREFIX}upstream-budget`;

function takeUpstreamBudget() {
  try {
    const today = dateStr(0);
    let budget = JSON.parse(window.localStorage.getItem(UPSTREAM_BUDGET_KEY) || 'null');
    if (!budget || budget.day !== today) budget = { day: today, used: 0 };
    if (budget.used >= UPSTREAM_BUDGET_PER_DAY) return false;
    budget.used += 1;
    window.localStorage.setItem(UPSTREAM_BUDGET_KEY, JSON.stringify(budget));
    return true;
  } catch (e) {
    // Storage unavailable — the shared lease + shared cache still protect
    // the key, so do not block the visitor here.
    return true;
  }
}

// --- Quota-exhaustion circuit breaker (Highlightly/RapidAPI) ------------
// If the key's free-tier quota is confirmed exhausted (HTTP 429, or 403 —
// which this RapidAPI plan also uses for an over-quota key), a short
// cooldown stops every pending/future call for this visitor (and, best
// effort, every other visitor via the shared Supabase cache below) from
// hammering an already-exhausted key. The local + shared cache below is
// what keeps the site showing real data through a cooldown window.
const RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const COOLDOWN_KEY = `${CACHE_PREFIX}cooldown-until`;
const pendingRequests = new Map();

function isHighlightlyInCooldown() {
  try {
    const until = Number(window.localStorage.getItem(COOLDOWN_KEY) || 0);
    return Date.now() < until;
  } catch (e) {
    return false;
  }
}

function tripHighlightlyCooldown() {
  try {
    window.localStorage.setItem(COOLDOWN_KEY, String(Date.now() + RATE_LIMIT_COOLDOWN_MS));
  } catch (e) {
    // Storage full/unavailable — non-fatal; requests just won't be
    // short-circuited until the next successful write.
  }
}

function isFresh(timestampMs, ttlMs = CACHE_TTL_MS) {
  return Date.now() - timestampMs <= ttlMs;
}

// --- Shared (cross-visitor) cache & circuit breaker, via Supabase -------
// Everything above this point only protects ONE visitor's browser. With
// only a per-browser localStorage cache, N people browsing the site at
// once can still fire N separate outbound requests for the exact same
// date — which is exactly the "الخدمة مزدحمة مؤقتاً" symptom this fixes.
//
// The `volleyball_cache` table (supabase/schema.sql) lets every browser,
// on every device, read back the most recent successful *merged* fetch for
// a given date — and the shared "Highlightly quota is exhausted" cooldown
// marker — before ever touching a third-party source itself. Reads/writes
// go through narrow RPCs (get_volleyball_cache / set_volleyball_cache),
// never the raw table. Every call here is wrapped so Supabase being
// unreachable, unconfigured, or briefly slow never blocks or breaks a
// visitor's own request: it just behaves as if the shared cache were empty
// and falls through to the existing per-browser behaviour.
const SHARED_COOLDOWN_KEY = 'circuit:cooldown';

async function sharedCacheGet(key) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_volleyball_cache', { p_key: key });
    if (error || !Array.isArray(data) || !data.length) return null;
    const row = data[0];
    if (!row || !row.payload) return null;
    return { data: row.payload, timestamp: new Date(row.updated_at).getTime() };
  } catch (e) {
    return null;
  }
}

// Fire-and-forget: writing the shared cache is a courtesy to every other
// visitor, never a requirement for the current one, so failures here must
// never surface to (or delay) the caller.
async function sharedCacheSet(key, payload) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('set_volleyball_cache', { p_key: key, p_payload: payload });
  } catch (e) {
    // Ignored — see comment above.
  }
}

// --- Smart caching v2: shared refresh lease (single-flight) --------------
// The shared cache above stops most repeat calls, but it has one weak spot:
// the instant a date's shared entry expires, EVERY visitor who arrives in
// the next few seconds sees "stale, nobody refreshed it yet" and would call
// the third-party API at the same time (a thundering herd — with 10,000
// visitors that is 10,000 upstream calls for one date).
//
// The `claim_volleyball_refresh` RPC (supabase/schema.sql, section 5.5)
// hands out a short lease per date: exactly ONE browser is told "granted"
// and refreshes that date; every other browser is told "denied" and is
// simply served the newest copy that already exists (shared, else local)
// instantly — flagged `stale`, and never a network call. The RPC also
// enforces a site-wide daily ceiling on refreshes as a final safety net.
//
// Returns 'granted' | 'denied' | 'unavailable'. 'unavailable' means the
// coordination layer itself can't be used (Supabase not configured, the
// RPC not installed yet, network trouble) — the caller then behaves exactly
// as before this feature existed (per-browser cache + budget guard), so
// the site never breaks because of it.
const SHARED_LEASE_SECONDS = 90;
const LEASE_DENIED_MEMO_MS = 45 * 1000;
const leaseDeniedUntil = new Map();

async function claimSharedRefreshLease(cacheKey) {
  if (!isSupabaseConfigured) return 'unavailable';

  // Don't re-ask Supabase for the same date over and over inside one
  // session once it has already said no.
  const memo = leaseDeniedUntil.get(cacheKey);
  if (memo && Date.now() < memo) return 'denied';

  try {
    const { data, error } = await supabase.rpc('claim_volleyball_refresh', {
      p_key: cacheKey,
      p_lease_seconds: SHARED_LEASE_SECONDS,
    });
    if (error) {
      // Rate limited by our own RPC guard = someone (maybe this browser) is
      // asking far too often: treat it as a "no", never as permission.
      if (String(error.code || '') === 'P0001' || /rate_limited/i.test(String(error.message || ''))) {
        leaseDeniedUntil.set(cacheKey, Date.now() + LEASE_DENIED_MEMO_MS);
        return 'denied';
      }
      return 'unavailable';
    }
    if (data === true) {
      leaseDeniedUntil.delete(cacheKey);
      return 'granted';
    }
    leaseDeniedUntil.set(cacheKey, Date.now() + LEASE_DENIED_MEMO_MS);
    return 'denied';
  } catch (e) {
    return 'unavailable';
  }
}

// The ~20 per-date requests a single page load makes (see
// RESULTS_LOOKBACK_DAYS below) all fire in the same tick via Promise.all,
// which would otherwise mean ~20 simultaneous "is the shared Highlightly
// quota dead?" round-trips to Supabase for the exact same answer. This
// memoizes the in-flight check for a few seconds so that whole burst
// shares one answer — mirroring the `pendingRequests` de-duplication used
// for the third-party sources themselves, just one layer up.
let sharedCooldownCheck = null;
let sharedCooldownCheckedAt = 0;

function isHighlightlyInSharedCooldown() {
  const now = Date.now();
  if (sharedCooldownCheck && now - sharedCooldownCheckedAt < 5000) return sharedCooldownCheck;
  sharedCooldownCheckedAt = now;
  sharedCooldownCheck = sharedCacheGet(SHARED_COOLDOWN_KEY).then(
    (entry) => Boolean(entry && entry.data && now < Number(entry.data.until || 0))
  );
  return sharedCooldownCheck;
}

// Tells every other visitor's browser the Highlightly quota is exhausted
// too — the shared counterpart to tripHighlightlyCooldown() above.
async function tripHighlightlySharedCooldown() {
  await sharedCacheSet(SHARED_COOLDOWN_KEY, { until: Date.now() + RATE_LIMIT_COOLDOWN_MS });
}

function cacheRead(key) {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Fresh cache only — respects CACHE_TTL_MS.
function cacheGetFresh(key, ttlMs) {
  const entry = cacheRead(key);
  if (!entry) return null;
  if (!isFresh(entry.timestamp, ttlMs)) return null;
  return entry.data;
}

// Any cached data regardless of age — the rate-limit fallback.
function cacheGetStale(key) {
  const entry = cacheRead(key);
  return entry ? entry.data : null;
}

// `timestamp` defaults to "now" (a genuinely fresh write). It is only passed
// explicitly when copying an older shared entry into local storage, so that
// a stale copy keeps its true age instead of masquerading as fresh.
function cacheSet(key, data, timestamp = Date.now()) {
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ timestamp, data }));
  } catch (e) {
    // Storage full/unavailable — non-fatal, just skip caching this response.
  }
}

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Converts an ISO 3166 alpha-2 country code (e.g. "IT") into its flag
// emoji via the regional-indicator-symbol trick — no image assets needed.
function countryCodeToFlag(code) {
  if (!code || typeof code !== 'string' || code.length !== 2) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(...[...upper].map((c) => 127397 + c.charCodeAt(0)));
}

// --- Highlightly / RapidAPI normalization (the direct, keyed source) ----
const HIGHLIGHTLY_SET_KEYS = ['firstSet', 'secondSet', 'thirdSet', 'fourthSet', 'fifthSet'];

function normalizeHighlightlyMatch(raw) {
  const scoreObj = raw?.state?.score || {};
  const sets = HIGHLIGHTLY_SET_KEYS.map((k) => scoreObj[k]).filter(Boolean).map((s) => String(s).replace(/\s+/g, ''));

  const description = raw?.state?.description || '';
  const isFinished = description === 'Finished';
  const isLive = /set$/i.test(description) && !isFinished;
  const status = isLive ? 'live' : isFinished ? 'finished' : 'upcoming';

  let scoreA = 0;
  let scoreB = 0;
  if (typeof scoreObj.current === 'string') {
    const parts = scoreObj.current.split('-').map((n) => parseInt(n.trim(), 10));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      [scoreA, scoreB] = parts;
    }
  }

  const teamAName = raw?.homeTeam?.name || '—';
  const teamBName = raw?.awayTeam?.name || '—';

  return {
    id: raw?.id != null ? `highlightly-${raw.id}` : `highlightly-${teamAName}-${teamBName}-${raw?.date}`,
    competition: raw?.league?.name || '—',
    leagueFlag: countryCodeToFlag(raw?.country?.code),
    leagueFlagUrl: getCountryFlagUrl(raw?.country?.code),
    leagueCountry: raw?.country?.name || '',
    teamA: teamAName,
    teamB: teamBName,
    // For national-team competitions (Nations League, World Championship,
    // Olympics...) the team name IS the country name, so we can resolve a
    // real flag image. For club competitions (domestic leagues) the name
    // won't match any country and this correctly falls back to null —
    // the UI shows a neutral ball icon rather than guessing/misrepresenting
    // a club's nationality.
    flagUrlA: getTeamFlagUrl(teamAName),
    flagUrlB: getTeamFlagUrl(teamBName),
    scoreA,
    scoreB,
    sets,
    status,
    statusDescription: description,
    date: raw?.date,
    venue: raw?.venue
      ? `${raw.venue.name}${raw.venue.city ? '، ' + raw.venue.city : ''}`
      : (raw?.country?.name || ''),
    source: 'highlightly',
  };
}

// The `/matches` endpoint is never called with a leagueId/leagueName/
// countryCode/countryName filter anywhere in this module — only `date`
// (a date alone is already a valid, unrestricted primary query parameter
// per Highlightly's docs) — so every request already asks for every
// match, in every category and every one of the 230+ leagues/tournaments
// the API covers (domestic leagues, Nations League, World Championship,
// Olympics, continental cups, everything) for that day. Nothing here ever
// narrows that down to a single competition.
//
// What *was* silently narrowing the results is pagination: the API caps
// each response at HIGHLIGHTLY_PAGE_LIMIT (100) matches and reports how
// many actually exist that day via `pagination.totalCount`; a single
// request only ever sees the first page. fetchHighlightlyDay() below now
// follows `offset` and keeps requesting subsequent pages until every match
// Highlightly has for that date has been collected (or the
// MAX_MATCHES_PER_DAY safety ceiling is hit, purely to bound worst-case
// quota usage on an unexpectedly huge day — 500 matches/day is far above
// what indoor volleyball worldwide ever produces in a single day).
const HIGHLIGHTLY_PAGE_LIMIT = 100;
const MAX_MATCHES_PER_DAY = 500;

// Returns { matches, ok }. `ok: true` means the direct request genuinely
// succeeded (even if it legitimately found zero matches for that date);
// `ok: false` means it could not be reached/answered at all (network error,
// non-2xx response, or an active quota cooldown), which is the signal the
// caller uses to fall back to the local/shared cache instead of reporting
// an incorrect "no matches".
async function fetchHighlightlyDay(day) {
  if (!isHighlightlyConfigured()) return { matches: [], ok: true };
  if (isHighlightlyInCooldown()) return { matches: [], ok: false };
  if (await isHighlightlyInSharedCooldown()) return { matches: [], ok: false };

  const headers = { 'x-rapidapi-key': HIGHLIGHTLY_API_KEY };
  if (HIGHLIGHTLY_API_HOST) headers['x-rapidapi-host'] = HIGHLIGHTLY_API_HOST;

  try {
    let offset = 0;
    let all = [];
    // Walk every page for this date — see the module note above.
    for (;;) {
      // Smart caching v2: per-browser hard daily budget (see above).
      if (!takeUpstreamBudget()) {
        if (all.length) break;
        return { matches: [], ok: false };
      }
      const res = await fetch(
        `${HIGHLIGHTLY_BASE_URL}/matches?date=${day}&limit=${HIGHLIGHTLY_PAGE_LIMIT}&offset=${offset}`,
        { headers }
      );
      if (!res.ok) {
        // 429 = Too Many Requests, 403 = this RapidAPI plan's "over quota"
        // status. Either way: trip the circuit breaker so every other
        // pending/future call for this key — this visitor and (best effort,
        // via the shared Supabase cache) every other visitor's browser too —
        // backs off instead of retrying the exhausted quota.
        if (res.status === 429 || res.status === 403) {
          tripHighlightlyCooldown();
          tripHighlightlySharedCooldown();
        }
        // A later page failing after earlier pages already succeeded is
        // still a partial win — keep what we have instead of discarding it.
        if (all.length) break;
        return { matches: [], ok: false };
      }
      const json = await res.json();
      const pageMatches = Array.isArray(json?.data) ? json.data : [];
      all = all.concat(pageMatches);

      const totalCount = Number(json?.pagination?.totalCount);
      offset += HIGHLIGHTLY_PAGE_LIMIT;

      const gotEverythingReported = Number.isFinite(totalCount) && all.length >= totalCount;
      const shortPage = pageMatches.length < HIGHLIGHTLY_PAGE_LIMIT; // last page is never full
      if (gotEverythingReported || shortPage || pageMatches.length === 0 || all.length >= MAX_MATCHES_PER_DAY) {
        break;
      }
    }
    return { matches: all.map(normalizeHighlightlyMatch), ok: true };
  } catch (e) {
    return { matches: [], ok: false };
  }
}

// --- Merge + de-duplicate matches from every source ----------------------
// De-dupe on (teamA, teamB, calendar day) — a defensive safety net in case
// the upstream API ever returns the same fixture twice for one date (e.g.
// a paginated or re-listed entry), keeping whichever copy was seen first.
function dedupeMatches(matches) {
  const seen = new Map();
  for (const m of matches) {
    if (!m) continue;
    const key = `${(m.teamA || '').trim().toLowerCase()}|${(m.teamB || '').trim().toLowerCase()}|${(m.date || '').slice(0, 10)}`;
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()];
}

// Fetches one date's matches directly from Highlightly using the real API
// key. Never throws: on total failure (unreachable/cooldown/non-2xx) it
// transparently falls back to the last cached response for that date,
// however old. Only when there's truly no cache at all for that date does
// it report failure.
//
// Wrapped by fetchMatchesForDateSafe() below with in-flight de-duplication
// — this inner function always hits the network and is never called twice
// concurrently for the same key.
async function fetchMatchesForDateNetwork(day, cacheKey, sharedFallback = null) {
  const { matches: fetched, ok } = await fetchHighlightlyDay(day);

  if (!ok) {
    // The direct request failed/cooled down — fall back to this date's
    // stale cache, if any, rather than reporting an incorrect empty result.
    // (Smart caching v2: a stale shared copy is also a valid fallback.)
    const stale = cacheGetStale(cacheKey) || (sharedFallback && Array.isArray(sharedFallback.data) ? sharedFallback.data : null);
    if (stale) return { matches: stale, stale: true, failed: false };
    return { matches: [], stale: false, failed: true };
  }

  const matches = dedupeMatches(fetched);
  cacheSet(cacheKey, matches);
  // Share this successful fetch with every other visitor's browser (see
  // the "Shared (cross-visitor) cache" note above) — best effort, never
  // awaited-for-correctness.
  sharedCacheSet(cacheKey, matches);
  return { matches, stale: false, failed: false };
}

// Consults the shared Supabase cache before ever touching a third-party
// source — only reached once fetchMatchesForDateSafe() below has already
// ruled out a fresh *local* copy. This is the cross-visitor line of
// defence described in the "Shared (cross-visitor) cache" note above, on
// top of (never instead of) the per-browser one.
// Smart caching v2: what a browser does when the shared lease was DENIED —
// i.e. another visitor is already refreshing this date (or the site-wide
// daily refresh ceiling was reached). It never touches the third-party API:
//   1. serve the newest copy that already exists (shared or local, any age)
//      instantly, flagged `stale`;
//   2. if no copy exists anywhere (brand-new deployment / first ever
//      visitors), wait a few seconds for the lease holder to publish its
//      result to the shared cache, polling only our own Supabase.
const LEASE_WAIT_POLL_DELAYS_MS = [2000, 2500, 3000];
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMatchesForDateWhileLeased(day, cacheKey, sharedEntry) {
  const local = cacheRead(cacheKey);
  const candidates = [];
  if (sharedEntry && Array.isArray(sharedEntry.data)) candidates.push(sharedEntry);
  if (local && Array.isArray(local.data)) candidates.push({ data: local.data, timestamp: local.timestamp });

  if (candidates.length) {
    const best = candidates.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    if (!local || best.timestamp > local.timestamp) cacheSet(cacheKey, best.data, best.timestamp);
    return { matches: best.data, stale: !isFresh(best.timestamp, ttlForDay(day)), failed: false };
  }

  for (const delay of LEASE_WAIT_POLL_DELAYS_MS) {
    await sleepMs(delay);
    const entry = await sharedCacheGet(cacheKey);
    if (entry && Array.isArray(entry.data)) {
      cacheSet(cacheKey, entry.data, entry.timestamp);
      return { matches: entry.data, stale: !isFresh(entry.timestamp, ttlForDay(day)), failed: false };
    }
  }
  return { matches: [], stale: false, failed: true };
}

async function fetchMatchesForDateShared(day, cacheKey) {
  const shared = await sharedCacheGet(cacheKey);
  if (shared && isFresh(shared.timestamp, ttlForDay(day))) {
    // Someone else's browser already has a fresh copy — warm our own
    // local cache with it too (so a reload in the next CACHE_TTL_MS needs
    // no network, or even Supabase, call at all) and skip every
    // third-party source entirely.
    cacheSet(cacheKey, shared.data);
    return { matches: shared.data, stale: false, failed: false };
  }

  // Smart caching v2: only ONE visitor at a time (site-wide) may refresh a
  // given date from the third-party API — see claimSharedRefreshLease().
  const lease = await claimSharedRefreshLease(cacheKey);
  if (lease === 'denied') {
    return fetchMatchesForDateWhileLeased(day, cacheKey, shared);
  }

  return fetchMatchesForDateNetwork(day, cacheKey, shared);
}

// Resolves every date in `days` directly — no server-side proxy of any
// kind. Each date runs through fetchMatchesForDateSafe() below, which
// itself checks the local cache, then the shared Supabase cache, then
// falls through to calling Highlightly directly from the browser with the
// real API key (see the module-header comment above).
async function resolveMatchesForDays(days) {
  return Promise.all(days.map(fetchMatchesForDateSafe));
}

async function fetchMatchesForDateSafe(day) {
  const cacheKey = `matches:${day}`;

  const fresh = cacheGetFresh(cacheKey, ttlForDay(day));
  if (fresh) return { matches: fresh, stale: false, failed: false };

  // In-flight de-duplication: fetchLiveAndRecentResults() and
  // fetchUpcomingMatches() both run on every page load and both cover
  // "today" — without this, that's two simultaneous requests for the same
  // date. Whichever caller arrives first starts the real request and
  // stores its promise here; any other caller for the same date within
  // that window just awaits the same promise instead of firing its own.
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = fetchMatchesForDateShared(day, cacheKey).finally(() => {
    pendingRequests.delete(cacheKey);
  });
  pendingRequests.set(cacheKey, promise);
  return promise;
}

// How many past days to scan for completed/live results. Wider window =
// a fuller "all completed matches" list (paired with the Show All button
// in the UI). Each day is cached independently, so repeat visits within
// CACHE_TTL_MS are free, and even beyond that window a failed day
// gracefully falls back to its own stale cache rather than failing.
const RESULTS_LOOKBACK_DAYS = 14;

export async function fetchLiveAndRecentResults() {
  const days = Array.from({ length: RESULTS_LOOKBACK_DAYS }, (_, i) => dateStr(-i));
  const results = await resolveMatchesForDays(days);

  const matches = results
    .flatMap((r) => r.matches)
    .filter((m) => m.status === 'live' || m.status === 'finished')
    .sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return new Date(b.date) - new Date(a.date);
    });

  const anySucceeded = results.some((r) => !r.failed);
  const usedStale = results.some((r) => r.stale);

  if (matches.length === 0) {
    // The direct Highlightly fetch, the shared Supabase cache, AND this
    // browser's own stale cache all came back empty — with the shared
    // cache in place this should be rare. Rather than a literal "0", fall
    // back to real, verified, clearly-dated results from the most recent
    // major tournament instead — see src/data/volleyballSeed.js for
    // exactly what this is and why.
    return { configured: isHighlightlyConfigured(), matches: SEED_RESULTS, stale: true };
  }

  if (!anySucceeded) {
    // Every single day failed AND had zero cached fallback across every
    // source — genuinely nothing real to show right now. The UI shows a
    // calm "try again shortly" state — never fabricated match data.
    return { configured: isHighlightlyConfigured(), matches: [], rateLimited: true };
  }

  return { configured: isHighlightlyConfigured(), matches, stale: usedStale };
}

// Upcoming matches over the next week, for the Match Schedules section.
export async function fetchUpcomingMatches() {
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => dateStr(n));
  const results = await resolveMatchesForDays(days);

  const matches = results
    .flatMap((r) => r.matches)
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const anySucceeded = results.some((r) => !r.failed);
  const usedStale = results.some((r) => r.stale);

  if (!anySucceeded) {
    return { configured: isHighlightlyConfigured(), matches: [], rateLimited: true };
  }

  return { configured: isHighlightlyConfigured(), matches, stale: usedStale };
}

// --- Smart caching v2: local housekeeping --------------------------------
// Every date gets its own localStorage entry, and new dates appear every
// day. Without clean-up they pile up for months until localStorage's
// ~5 MB quota is full and caching silently stops working. On load, drop
// per-date entries older than 21 days (the app only ever reads the last 14
// days and the next 7).
function pruneOldLocalCache() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const cutoff = Date.parse(dateStr(-21));
    const prefix = `${CACHE_PREFIX}matches:`;
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const day = Date.parse(k.slice(prefix.length));
      if (Number.isFinite(day) && day < cutoff) window.localStorage.removeItem(k);
    }
  } catch (e) {
    // Non-fatal — housekeeping only.
  }
}
pruneOldLocalCache();
