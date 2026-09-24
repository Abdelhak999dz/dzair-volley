import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import usePersistentState from '../hooks/usePersistentState.js';

const NewsContext = createContext(null);

// Real Supabase table backing "الأخبار" — admin-published news articles.
// See README.md for the exact `create table` + RLS policy SQL. When
// Supabase isn't configured, everything below transparently falls back
// to the same localStorage key (and seed articles) this app already
// used, so the site keeps working out of the box either way.
const TABLE = 'news';
const LOCAL_KEY = 'dzair-volley-news';

function rowToNews(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || '',
    date: row.date,
    summary: row.summary || '',
    image: row.image || '',
    views: row.views || 0,
    likes: row.likes || 0,
    comments: row.comments || 0,
  };
}

function newsToRow(n) {
  return {
    id: n.id,
    title: n.title,
    category: n.category || null,
    date: n.date,
    summary: n.summary || null,
    image: n.image || null,
    views: n.views || 0,
    likes: n.likes || 0,
    comments: n.comments || 0,
  };
}

// Re-reads the whole table from Supabase. Used to roll the screen back to
// the real server state when a write (e.g. a delete) is rejected by RLS or
// fails on the network, so the admin never sees a change that didn't stick.
async function fetchAllNews() {
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false });
  return !error && data ? data.map(rowToNews) : null;
}

// `initialNews` is only ever used as the local/offline seed — once
// Supabase is configured, the public site reads exclusively from the
// `news` table so every admin-published article shows up, live, on
// every device (mirrors AlgerianMatchesContext / SiteSettingsContext).
export function NewsProvider({ children, initialNews = [] }) {
  const [localNews, setLocalNews] = usePersistentState(LOCAL_KEY, initialNews);
  const [remoteNews, setRemoteNews] = useState(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);

  // Initial fetch + realtime subscription so a news article added (or a
  // like/comment/view counted) by the admin — or any visitor — on one
  // device reflects immediately on every other device/tab viewing the
  // public site.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function fetchNews() {
      const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false });
      if (cancelled) return;
      setRemoteNews(!error && data ? data.map(rowToNews) : []);
      setLoaded(true);
    }
    fetchNews();

    const channel = supabase
      .channel('news_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
        const n = rowToNews(payload.new);
        setRemoteNews((prev) => {
          const list = prev || [];
          if (list.some((x) => x.id === n.id)) return list;
          return [n, ...list];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, (payload) => {
        const n = rowToNews(payload.new);
        setRemoteNews((prev) => (prev || []).map((x) => (x.id === n.id ? n : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE }, (payload) => {
        const deletedId = payload.old && payload.old.id;
        setRemoteNews((prev) => (prev || []).filter((x) => x.id !== deletedId));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const news = isSupabaseConfigured ? (remoteNews || []) : localNews;

  // Adds a news article — writes it for real into Supabase (so it syncs
  // to every device instantly) when configured, applying the same
  // change optimistically first so the admin's own screen updates
  // immediately. Always mirrors into the local cache too as an offline
  // fallback.
  const addNews = useCallback(
    async (item) => {
      const newItem = {
        ...item,
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        views: 0,
        likes: 0,
        comments: 0,
      };
      setLocalNews((prev) => [newItem, ...prev]);
      if (!isSupabaseConfigured) return newItem;

      setRemoteNews((prev) => [newItem, ...(prev || [])]);
      const { error } = await supabase.from(TABLE).insert(newsToRow(newItem));
      if (error) {
        // Real insert failed (RLS / network) — drop the optimistic row
        // rather than showing data that was never actually saved.
        setRemoteNews((prev) => (prev || []).filter((x) => x.id !== newItem.id));
        // Tell the admin UI the row was NOT saved server-side, so it can
        // warn instead of pretending the publish worked for everyone.
        return { ...newItem, syncError: true };
      }
      return newItem;
    },
    [setLocalNews]
  );

  const deleteNews = useCallback(
    async (id) => {
      setLocalNews((prev) => prev.filter((n) => n.id !== id));
      if (!isSupabaseConfigured) return;
      setRemoteNews((prev) => (prev || []).filter((n) => n.id !== id));
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) {
        // Delete rejected (RLS / network) — restore the real server state.
        const fresh = await fetchAllNews();
        if (fresh) setRemoteNews(fresh);
        return { syncError: true };
      }
      return undefined;
    },
    [setLocalNews]
  );

  // Applies a numeric field delta (views +1, likes +1/-1, comments
  // +1/-1) both optimistically and for real in Supabase, and always
  // mirrors into the local cache too.
  const bumpField = useCallback(
    async (id, field, delta) => {
      setLocalNews((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: Math.max(0, (n[field] || 0) + delta) } : n))
      );
      if (!isSupabaseConfigured) return;
      const current = (remoteNews || []).find((n) => n.id === id);
      if (!current) return;
      const nextValue = Math.max(0, (current[field] || 0) + delta);
      setRemoteNews((prev) => (prev || []).map((n) => (n.id === id ? { ...n, [field]: nextValue } : n)));
      // Hardened path: an atomic, whitelisted, per-IP rate-limited server
      // function (see supabase/schema.sql → bump_counter). Anonymous
      // visitors have NO direct UPDATE permission on the table, so a like
      // can never be abused to rewrite a title, image or video URL.
      const { data: serverValue, error: rpcError } = await supabase.rpc('bump_counter', {
        p_table: TABLE,
        p_id: id,
        p_field: field,
        p_delta: delta,
      });
      if (!rpcError && typeof serverValue === 'number') {
        setRemoteNews((prev) => (prev || []).map((n) => (n.id === id ? { ...n, [field]: serverValue } : n)));
        return;
      }
      // Fallback for projects that haven't run the new schema.sql yet: the
      // original direct update (only succeeds for the signed-in admin).
      await supabase.from(TABLE).update({ [field]: nextValue }).eq('id', id);
    },
    [setLocalNews, remoteNews]
  );

  const likeNews = useCallback((id, delta = 1) => bumpField(id, 'likes', delta), [bumpField]);
  const commentNews = useCallback((id, delta = 1) => bumpField(id, 'comments', delta), [bumpField]);
  const viewNews = useCallback((id) => bumpField(id, 'views', 1), [bumpField]);

  const value = useMemo(
    () => ({ news, addNews, deleteNews, likeNews, commentNews, viewNews, loaded }),
    [news, addNews, deleteNews, likeNews, commentNews, viewNews, loaded]
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews() {
  const ctx = useContext(NewsContext);
  if (!ctx) {
    // Defensive fallback so any component rendered outside the provider
    // (shouldn't happen) still gets a sane, non-crashing value.
    return {
      news: [],
      addNews: async () => {},
      deleteNews: async () => {},
      likeNews: () => {},
      commentNews: () => {},
      viewNews: () => {},
      loaded: true,
    };
  }
  return ctx;
}
