import { useEffect, useState } from 'react';
import { fetchLiveAndRecentResults, fetchUpcomingMatches } from '../services/volleyballApi.js';

// Smart caching v2 — automatic background refresh. A tab that stays open for
// hours would otherwise keep showing whatever it loaded first. Every
// AUTO_REFRESH_CHECK_MS (only while the tab is visible) the hook simply asks
// the service again; the service answers straight from the local/shared
// cache unless that date's TTL (4-72 h, see volleyballApi.js) has actually
// expired — so this timer costs a localStorage read, not an API call, and at
// most one visitor site-wide is ever allowed to refresh from the API.
const AUTO_REFRESH_CHECK_MS = 15 * 60 * 1000;

// Shared shape: { matches, loading, error, rateLimited, stale, configured, refetch }
function useVolleyballFetch(fetchFn) {
  const [state, setState] = useState({
    matches: [], loading: true, error: null, rateLimited: false, stale: false, configured: true, demo: false,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null, rateLimited: false }));

    fetchFn()
      .then((result) => {
        if (cancelled) return;
        setState({
          matches: result.matches || [],
          loading: false,
          error: result.error || null,
          rateLimited: Boolean(result.rateLimited),
          stale: Boolean(result.stale),
          configured: result.configured,
          demo: Boolean(result.demo),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ matches: [], loading: false, error: err.message, rateLimited: false, stale: false, configured: true, demo: false });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchFn()
        .then((result) => {
          // Never replace good data on screen with a failure/empty error state.
          if (cancelled || !result || result.error || result.rateLimited) return;
          setState((prev) => ({
            ...prev,
            matches: result.matches || [],
            stale: Boolean(result.stale),
            configured: result.configured,
            demo: Boolean(result.demo),
          }));
        })
        .catch(() => {});
    }, AUTO_REFRESH_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => setReloadToken((t) => t + 1);

  return { ...state, refetch };
}

export function useLiveResults() {
  return useVolleyballFetch(fetchLiveAndRecentResults);
}

export function useUpcomingMatches() {
  return useVolleyballFetch(fetchUpcomingMatches);
}
