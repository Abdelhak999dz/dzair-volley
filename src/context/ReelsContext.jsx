import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import usePersistentState from '../hooks/usePersistentState.js';

const ReelsContext = createContext(null);

// Real Supabase table backing "الفيديوهات" (reels) — admin-published
// short videos. See README.md for the exact `create table` + RLS
// policy SQL. When Supabase isn't configured, everything below
// transparently falls back to the same localStorage key (and seed
// reels) this app already used, so the site keeps working out of the
// box either way.
const TABLE = 'reels';
const LOCAL_KEY = 'dzair-volley-reels';

function rowToReel(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || '',
    views: row.views || 0,
    likes: row.likes || 0,
    comments: row.comments || 0,
    videoUrl: row.video_url,
    poster: row.poster || '',
  };
}

function reelToRow(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category || null,
    views: r.views || 0,
    likes: r.likes || 0,
    comments: r.comments || 0,
    video_url: r.videoUrl,
    poster: r.poster || null,
  };
}

// Re-reads the whole table from Supabase. Used to roll the screen back to
// the real server state when a write (e.g. a delete) is rejected by RLS or
// fails on the network, so the admin never sees a change that didn't stick.
async function fetchAllReels() {
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false });
  return !error && data ? data.map(rowToReel) : null;
}

// `initialReels` is only ever used as the local/offline seed — once
// Supabase is configured, the public site reads exclusively from the
// `reels` table so every admin-published video shows up, live, on
// every device (mirrors AlgerianMatchesContext / SiteSettingsContext).
export function ReelsProvider({ children, initialReels = [] }) {
  const [localReels, setLocalReels] = usePersistentState(LOCAL_KEY, initialReels);
  const [remoteReels, setRemoteReels] = useState(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);

  // Initial fetch + realtime subscription so a video added (or a
  // like/comment/view counted) by the admin — or any visitor — on one
  // device reflects immediately on every other device/tab viewing the
  // public site.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function fetchReels() {
      const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false });
      if (cancelled) return;
      setRemoteReels(!error && data ? data.map(rowToReel) : []);
      setLoaded(true);
    }
    fetchReels();

    const channel = supabase
      .channel('reels_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
        const r = rowToReel(payload.new);
        setRemoteReels((prev) => {
          const list = prev || [];
          if (list.some((x) => x.id === r.id)) return list;
          return [r, ...list];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, (payload) => {
        const r = rowToReel(payload.new);
        setRemoteReels((prev) => (prev || []).map((x) => (x.id === r.id ? r : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE }, (payload) => {
        const deletedId = payload.old && payload.old.id;
        setRemoteReels((prev) => (prev || []).filter((x) => x.id !== deletedId));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const reels = isSupabaseConfigured ? (remoteReels || []) : localReels;

  // Adds a reel — writes it for real into Supabase (so it syncs to
  // every device instantly) when configured, applying the same change
  // optimistically first so the admin's own screen updates immediately.
  // Always mirrors into the local cache too as an offline fallback.
  const addReel = useCallback(
    async (item) => {
      const newItem = { ...item, id: Date.now(), views: 0, likes: 0, comments: 0 };
      setLocalReels((prev) => [newItem, ...prev]);
      if (!isSupabaseConfigured) return newItem;

      setRemoteReels((prev) => [newItem, ...(prev || [])]);
      const { error } = await supabase.from(TABLE).insert(reelToRow(newItem));
      if (error) {
        // Real insert failed (RLS / network) — drop the optimistic row
        // rather than showing data that was never actually saved.
        setRemoteReels((prev) => (prev || []).filter((x) => x.id !== newItem.id));
        // Tell the admin UI the row was NOT saved server-side, so it can
        // warn instead of pretending the publish worked for everyone.
        return { ...newItem, syncError: true };
      }
      return newItem;
    },
    [setLocalReels]
  );

  const deleteReel = useCallback(
    async (id) => {
      setLocalReels((prev) => prev.filter((r) => r.id !== id));
      if (!isSupabaseConfigured) return;
      setRemoteReels((prev) => (prev || []).filter((r) => r.id !== id));
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) {
        // Delete rejected (RLS / network) — restore the real server state.
        const fresh = await fetchAllReels();
        if (fresh) setRemoteReels(fresh);
        return { syncError: true };
      }
      return undefined;
    },
    [setLocalReels]
  );

  // Applies a numeric field delta (views +1, likes +1/-1, comments
  // +1/-1) both optimistically and for real in Supabase, and always
  // mirrors into the local cache too.
  const bumpField = useCallback(
    async (id, field, delta) => {
      setLocalReels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: Math.max(0, (r[field] || 0) + delta) } : r))
      );
      if (!isSupabaseConfigured) return;
      const current = (remoteReels || []).find((r) => r.id === id);
      if (!current) return;
      const nextValue = Math.max(0, (current[field] || 0) + delta);
      setRemoteReels((prev) => (prev || []).map((r) => (r.id === id ? { ...r, [field]: nextValue } : r)));
      // Hardened path: atomic, whitelisted, per-IP rate-limited server
      // function (see supabase/schema.sql → bump_counter). Anonymous
      // visitors have NO direct UPDATE permission on the table.
      const { data: serverValue, error: rpcError } = await supabase.rpc('bump_counter', {
        p_table: TABLE,
        p_id: id,
        p_field: field,
        p_delta: delta,
      });
      if (!rpcError && typeof serverValue === 'number') {
        setRemoteReels((prev) => (prev || []).map((r) => (r.id === id ? { ...r, [field]: serverValue } : r)));
        return;
      }
      // Fallback for projects that haven't run the new schema.sql yet: the
      // original direct update (only succeeds for the signed-in admin).
      await supabase.from(TABLE).update({ [field]: nextValue }).eq('id', id);
    },
    [setLocalReels, remoteReels]
  );

  const likeReel = useCallback((id, delta = 1) => bumpField(id, 'likes', delta), [bumpField]);
  const commentReel = useCallback((id, delta = 1) => bumpField(id, 'comments', delta), [bumpField]);
  const viewReel = useCallback((id) => bumpField(id, 'views', 1), [bumpField]);

  const value = useMemo(
    () => ({ reels, addReel, deleteReel, likeReel, commentReel, viewReel, loaded }),
    [reels, addReel, deleteReel, likeReel, commentReel, viewReel, loaded]
  );

  return <ReelsContext.Provider value={value}>{children}</ReelsContext.Provider>;
}

export function useReels() {
  const ctx = useContext(ReelsContext);
  if (!ctx) {
    // Defensive fallback so any component rendered outside the provider
    // (shouldn't happen) still gets a sane, non-crashing value.
    return {
      reels: [],
      addReel: async () => {},
      deleteReel: async () => {},
      likeReel: () => {},
      commentReel: () => {},
      viewReel: () => {},
      loaded: true,
    };
  }
  return ctx;
}
