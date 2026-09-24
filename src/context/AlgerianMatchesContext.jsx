import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import usePersistentState from '../hooks/usePersistentState.js';

const AlgerianMatchesContext = createContext(null);

// Real Supabase table backing "البطولة الجزائرية" matches — admin-entered
// results/fixtures, including up to 5 real per-set scores per finished
// match (set1_home/set1_away ... set5_home/set5_away). See README.md for
// the exact `create table` + RLS policy SQL. When Supabase isn't
// configured, everything below transparently falls back to the same
// localStorage key this app already used, so the site keeps working out
// of the box either way.
const TABLE = 'algerian_matches';
const LOCAL_KEY = 'dzair-volley-algeria-matches';

// Real Supabase table backing the per-division crest/logo shown next to
// each "البطولة الجزائرية" section tab (القسم الوطني الأول أ رجال,
// كأس الجزائر أكابر, "الكل", ...). One row per division id (the
// special id 'all' covers the "الكل" tab). Admin-only writes (gated in
// the UI by isAdminAuthenticated and, server-side, by the same
// `auth.role() = 'authenticated'` RLS policy used for matches — see
// README.md). Falls back to localStorage when Supabase isn't
// configured, exactly like every other admin-managed feature here.
const DIVISION_CRESTS_TABLE = 'division_crests';
const LOCAL_CRESTS_KEY = 'dzair-volley-division-crests';
const CRESTS_STORAGE_BUCKET = 'site-assets';

// Converts a local File into a base64 data: URL — the same local
// fallback approach already used for logo/banner uploads
// (SiteSettingsContext.jsx) and every other image upload in this app.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Uploads a division crest image to Supabase Storage's public
// `site-assets` bucket (reusing the same bucket as site branding
// assets) and returns its public URL, so the crest is real and visible
// to every visitor on every device — never just a local file. Falls
// back to a base64 data: URL if Supabase isn't configured or the
// upload fails (missing bucket/RLS), so the admin's upload is never
// silently lost.
async function uploadDivisionCrestFile(file, divisionId) {
  if (!file) return '';
  if (!isSupabaseConfigured) return readFileAsDataUrl(file);
  const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
  const path = `division-crests/${divisionId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(CRESTS_STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) {
    return readFileAsDataUrl(file);
  }
  const { data } = supabase.storage.from(CRESTS_STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

// Converts one Supabase row (snake_case, set1_home..set5_away columns)
// into the camelCase match object every component in this app already
// consumes (AlgerianMatches.jsx, AlgerianStandings.jsx / algerianStandings.js).
function rowToMatch(row) {
  const setScores = [];
  for (let i = 1; i <= 5; i += 1) {
    const h = row[`set${i}_home`];
    const a = row[`set${i}_away`];
    if (h !== null && h !== undefined && a !== null && a !== undefined) {
      setScores.push([Number(h), Number(a)]);
    }
  }
  return {
    id: row.id,
    matchType: row.match_type || 'result',
    divisionId: row.division_id || '',
    divisionLabel: row.division_label || '',
    groupId: row.group_id || '',
    groupLabel: row.group_label || '',
    // Round/matchday label (e.g. "الجولة 1" .. "الجولة 18" or higher) —
    // free text set by the admin, per the Algerian Volleyball
    // Federation's fixture calendar. Optional; a match can be added
    // with no round set.
    round: row.round_label || '',
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeTeamLogo: row.home_team_logo || '',
    awayTeamLogo: row.away_team_logo || '',
    score: row.score || '',
    setScores: setScores.length > 0 ? setScores : undefined,
    date: row.match_date,
    time: row.match_time || '',
  };
}

// Converts one camelCase match object (as built by AdminDashboard.jsx's
// match form) into a Supabase row ready for insert().
function matchToRow(m) {
  const row = {
    id: m.id,
    match_type: m.matchType,
    division_id: m.divisionId || null,
    division_label: m.divisionLabel || null,
    group_id: m.groupId || null,
    group_label: m.groupLabel || null,
    // Round/matchday label — optional free text (see rowToMatch above).
    round_label: m.round || null,
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    home_team_logo: m.homeTeamLogo || null,
    away_team_logo: m.awayTeamLogo || null,
    score: m.score || null,
    // Match date is now optional — the admin can publish a whole round
    // of fixtures before real dates are set, then fill each one in
    // later (see updateMatch below). An empty/undefined date is stored
    // as null rather than an empty string.
    match_date: m.date || null,
    match_time: m.time || null,
  };
  for (let i = 1; i <= 5; i += 1) {
    const pair = Array.isArray(m.setScores) ? m.setScores[i - 1] : undefined;
    row[`set${i}_home`] = pair ? pair[0] : null;
    row[`set${i}_away`] = pair ? pair[1] : null;
  }
  return row;
}

// Re-reads every match from Supabase — used to roll the screen back to the
// real server state when a write is rejected (RLS / network).
async function fetchAllMatches() {
  const { data, error } = await supabase.from(TABLE).select('*').order('match_date', { ascending: false });
  return !error && data ? data.map(rowToMatch) : null;
}

export function AlgerianMatchesProvider({ children }) {
  // Local/offline store — the single source of truth when Supabase isn't
  // configured, and also a last-known-good cache either way so results
  // never disappear on reload while the network round-trip is pending.
  const [localMatches, setLocalMatches] = usePersistentState(LOCAL_KEY, []);
  const [remoteMatches, setRemoteMatches] = useState(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);

  // Division crests — a map of divisionId -> crest image URL (the
  // special id 'all' is the "الكل" tab). Same local/remote + realtime
  // pattern as matches above, so a crest an admin sets on one device
  // shows up live, for every visitor, on every device.
  const [localCrests, setLocalCrests] = usePersistentState(LOCAL_CRESTS_KEY, {});
  const [remoteCrests, setRemoteCrests] = useState(null);

  // Initial fetch + realtime subscription so a result/set score entered
  // by the admin on one device reflects immediately — in the standings
  // table, the results list and the live match cards — on every other
  // device/tab viewing the public site.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function fetchMatches() {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('match_date', { ascending: false });
      if (cancelled) return;
      setRemoteMatches(!error && data ? data.map(rowToMatch) : []);
      setLoaded(true);
    }
    fetchMatches();

    const channel = supabase
      .channel('algerian_matches_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
        const m = rowToMatch(payload.new);
        setRemoteMatches((prev) => {
          const list = prev || [];
          if (list.some((x) => x.id === m.id)) return list;
          return [m, ...list];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, (payload) => {
        const m = rowToMatch(payload.new);
        setRemoteMatches((prev) => (prev || []).map((x) => (x.id === m.id ? m : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE }, (payload) => {
        const deletedId = payload.old && payload.old.id;
        setRemoteMatches((prev) => (prev || []).filter((x) => x.id !== deletedId));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Initial fetch + realtime subscription for division crests, kept as
  // its own independent effect (separate table/channel) so it neither
  // depends on nor interferes with the matches fetch/`loaded` state
  // above.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function fetchCrests() {
      const { data, error } = await supabase.from(DIVISION_CRESTS_TABLE).select('division_id, crest_url');
      if (cancelled) return;
      if (!error && data) {
        const map = {};
        data.forEach((row) => {
          if (row.division_id) map[row.division_id] = row.crest_url || '';
        });
        setRemoteCrests(map);
      } else {
        setRemoteCrests({});
      }
    }
    fetchCrests();

    const crestsChannel = supabase
      .channel('division_crests_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: DIVISION_CRESTS_TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old && payload.old.division_id;
          setRemoteCrests((prev) => {
            const next = { ...(prev || {}) };
            delete next[deletedId];
            return next;
          });
          return;
        }
        const row = payload.new;
        if (!row || !row.division_id) return;
        setRemoteCrests((prev) => ({ ...(prev || {}), [row.division_id]: row.crest_url || '' }));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(crestsChannel);
    };
  }, []);

  const matches = isSupabaseConfigured ? (remoteMatches || []) : localMatches;
  const divisionCrests = isSupabaseConfigured ? (remoteCrests || {}) : localCrests;

  // Adds a match — writes it for real into Supabase (so it syncs to
  // every device instantly) when configured, applying the same change
  // optimistically first so the admin's own screen updates immediately.
  // Always mirrors into the local cache too as an offline fallback.
  const addMatch = useCallback(
    async (item) => {
      const newMatch = { ...item, id: Date.now() };
      setLocalMatches((prev) => [newMatch, ...prev]);
      if (!isSupabaseConfigured) return newMatch;

      setRemoteMatches((prev) => [newMatch, ...(prev || [])]);
      const { error } = await supabase.from(TABLE).insert(matchToRow(newMatch));
      if (error) {
        // Real insert failed (RLS / network) — drop the optimistic row
        // rather than showing data that was never actually saved.
        setRemoteMatches((prev) => (prev || []).filter((x) => x.id !== newMatch.id));
        // Tell the admin UI the match was NOT saved server-side.
        return { ...newMatch, syncError: true };
      }
      return newMatch;
    },
    [setLocalMatches]
  );

  const deleteMatch = useCallback(
    async (id) => {
      setLocalMatches((prev) => prev.filter((m) => m.id !== id));
      if (!isSupabaseConfigured) return;
      setRemoteMatches((prev) => (prev || []).filter((m) => m.id !== id));
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) {
        // Delete rejected (RLS / network) — restore the real server state.
        const fresh = await fetchAllMatches();
        if (fresh) setRemoteMatches(fresh);
        return { syncError: true };
      }
      return undefined;
    },
    [setLocalMatches]
  );

  // Updates an existing match in place (e.g. the admin filling in or
  // changing a fixture's real date/time once it's known, or fixing any
  // other field of a round added earlier). Applies the change
  // optimistically to both the local cache and the live view first, then
  // writes it for real into Supabase — the existing realtime UPDATE
  // subscription above (see the effect near the top of this file) is
  // what then reflects the change instantly for every other visitor.
  const updateMatch = useCallback(
    async (id, updates) => {
      setLocalMatches((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      if (!isSupabaseConfigured) return;

      setRemoteMatches((prev) => (prev || []).map((m) => (m.id === id ? { ...m, ...updates } : m)));
      const current = (remoteMatches || []).find((m) => m.id === id);
      const merged = { ...(current || {}), ...updates, id };
      const row = matchToRow(merged);
      delete row.id;
      const { error } = await supabase.from(TABLE).update(row).eq('id', id);
      if (error && current) {
        // Real update failed (RLS / network) — roll back to the last
        // known-good value rather than showing an unsaved change.
        setRemoteMatches((prev) => (prev || []).map((m) => (m.id === id ? current : m)));
        return { syncError: true };
      }
      return undefined;
    },
    [setLocalMatches, remoteMatches]
  );

  // Sets (or replaces) a division's crest — either from an uploaded
  // file (real upload to Supabase Storage, so it's a real image every
  // visitor can load, not just this browser's local cache) or a direct
  // image URL. Writes for real into Supabase (upsert, so it works
  // whether or not the division already had a crest) when configured,
  // applying the change optimistically first, and always mirrors into
  // the local cache too as an offline fallback.
  const updateDivisionCrest = useCallback(
    async (divisionId, source = {}) => {
      let crestUrl = (source.url || '').trim();
      if (!crestUrl && source.file) {
        crestUrl = await uploadDivisionCrestFile(source.file, divisionId);
      }
      if (!crestUrl) return '';

      setLocalCrests((prev) => ({ ...prev, [divisionId]: crestUrl }));
      if (!isSupabaseConfigured) return crestUrl;

      setRemoteCrests((prev) => ({ ...(prev || {}), [divisionId]: crestUrl }));
      const { error } = await supabase.from(DIVISION_CRESTS_TABLE).upsert(
        { division_id: divisionId, crest_url: crestUrl, updated_at: new Date().toISOString() },
        { onConflict: 'division_id' }
      );
      if (error) {
        // Real write failed (RLS / network) — drop the optimistic value
        // rather than showing a crest that was never actually saved.
        setRemoteCrests((prev) => {
          const next = { ...(prev || {}) };
          delete next[divisionId];
          return next;
        });
      }
      return crestUrl;
    },
    [setLocalCrests]
  );

  const removeDivisionCrest = useCallback(
    async (divisionId) => {
      setLocalCrests((prev) => {
        const next = { ...prev };
        delete next[divisionId];
        return next;
      });
      if (!isSupabaseConfigured) return;
      setRemoteCrests((prev) => {
        const next = { ...(prev || {}) };
        delete next[divisionId];
        return next;
      });
      await supabase.from(DIVISION_CRESTS_TABLE).delete().eq('division_id', divisionId);
    },
    [setLocalCrests]
  );

  const value = useMemo(
    () => ({ matches, addMatch, updateMatch, deleteMatch, loaded, divisionCrests, updateDivisionCrest, removeDivisionCrest }),
    [matches, addMatch, updateMatch, deleteMatch, loaded, divisionCrests, updateDivisionCrest, removeDivisionCrest]
  );

  return <AlgerianMatchesContext.Provider value={value}>{children}</AlgerianMatchesContext.Provider>;
}

export function useAlgerianMatches() {
  const ctx = useContext(AlgerianMatchesContext);
  if (!ctx) {
    // Defensive fallback so any component rendered outside the provider
    // (shouldn't happen) still gets a sane, non-crashing value.
    return {
      matches: [],
      addMatch: async () => {},
      updateMatch: async () => {},
      deleteMatch: async () => {},
      loaded: true,
      divisionCrests: {},
      updateDivisionCrest: async () => '',
      removeDivisionCrest: async () => {},
    };
  }
  return ctx;
}
