import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import usePersistentState from '../hooks/usePersistentState.js';

const SiteSettingsContext = createContext(null);

const DEFAULTS = {
  siteName: 'Dzair Volley',
  logoUrl: '/logo2.jpeg',
  heroBannerUrl: '',
};

// Singleton row id used in the `site_settings` table (one row for the
// whole site's branding config: site_name, logo_url, hero_banner_url).
const SETTINGS_ROW_ID = 1;
const STORAGE_BUCKET = 'site-assets';

// Converts a local File into a base64 data: URL — used as the local
// fallback (no Supabase configured) for logo/banner uploads, mirroring
// the same FileReader approach already used across the admin dashboard
// (news images, reel videos/posters, team crests).
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SiteSettingsProvider({ children }) {
  // Local/offline fallback store — used directly when Supabase isn't
  // configured, and also as the last-known-good cache either way so the
  // branding never flashes back to hardcoded defaults on reload.
  const [localSettings, setLocalSettings] = usePersistentState('dzair-volley-site-settings', DEFAULTS);
  const [remoteSettings, setRemoteSettings] = useState(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);

  // Initial fetch + realtime subscription so branding changes made by an
  // admin on one device reflect immediately on every other device/tab
  // viewing the public site.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function fetchSettings() {
      const { data, error } = await supabase
        .from('site_settings')
        .select('site_name, logo_url, hero_banner_url')
        .eq('id', SETTINGS_ROW_ID)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setRemoteSettings({
          siteName: data.site_name || DEFAULTS.siteName,
          logoUrl: data.logo_url || DEFAULTS.logoUrl,
          heroBannerUrl: data.hero_banner_url || '',
        });
      }
      setLoaded(true);
    }
    fetchSettings();

    const channel = supabase
      .channel('site_settings_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.${SETTINGS_ROW_ID}` },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setRemoteSettings({
            siteName: row.site_name || DEFAULTS.siteName,
            logoUrl: row.logo_url || DEFAULTS.logoUrl,
            heroBannerUrl: row.hero_banner_url || '',
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const settings = isSupabaseConfigured ? (remoteSettings || localSettings) : localSettings;

  // Keep the browser tab title in sync with the (possibly admin-edited)
  // site name.
  useEffect(() => {
    if (settings?.siteName) {
      document.title = settings.siteName;
    }
  }, [settings?.siteName]);

  // Persists a partial settings patch — writes to Supabase (so it syncs
  // everywhere in real time) when configured, and always mirrors into the
  // local cache too so the last-known value survives offline/reload.
  const persist = useCallback(
    async (patch) => {
      setLocalSettings((prev) => ({ ...prev, ...patch }));
      if (!isSupabaseConfigured) return;
      const row = {
        id: SETTINGS_ROW_ID,
        ...(patch.siteName !== undefined ? { site_name: patch.siteName } : {}),
        ...(patch.logoUrl !== undefined ? { logo_url: patch.logoUrl } : {}),
        ...(patch.heroBannerUrl !== undefined ? { hero_banner_url: patch.heroBannerUrl } : {}),
      };
      await supabase.from('site_settings').upsert(row, { onConflict: 'id' });
    },
    [setLocalSettings]
  );

  // Uploads an image (logo/banner) to Supabase Storage's public
  // `site-assets` bucket when configured, returning its public URL.
  // Falls back to a local base64 data: URL otherwise (same pattern as
  // every other image upload already in this app).
  const uploadImage = useCallback(async (file, prefix) => {
    if (!file) return '';
    if (!isSupabaseConfigured) {
      return readFileAsDataUrl(file);
    }
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      // Storage bucket may not exist yet / RLS not configured — fall back
      // to a local data URL rather than losing the admin's upload.
      return readFileAsDataUrl(file);
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || '';
  }, []);

  const updateSiteName = useCallback((name) => persist({ siteName: name }), [persist]);

  const updateLogoFile = useCallback(
    async (file) => {
      const url = await uploadImage(file, 'logo');
      if (url) await persist({ logoUrl: url });
      return url;
    },
    [uploadImage, persist]
  );

  const updateHeroBannerFile = useCallback(
    async (file) => {
      const url = await uploadImage(file, 'hero-banner');
      if (url) await persist({ heroBannerUrl: url });
      return url;
    },
    [uploadImage, persist]
  );

  const value = useMemo(
    () => ({
      siteName: settings.siteName || DEFAULTS.siteName,
      logoUrl: settings.logoUrl || DEFAULTS.logoUrl,
      heroBannerUrl: settings.heroBannerUrl || '',
      loaded,
      updateSiteName,
      updateLogoFile,
      updateHeroBannerFile,
    }),
    [settings, loaded, updateSiteName, updateLogoFile, updateHeroBannerFile]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    // Defensive fallback so any component rendered outside the provider
    // (shouldn't happen) still gets sane defaults instead of crashing.
    return { ...DEFAULTS, loaded: true, updateSiteName: () => {}, updateLogoFile: async () => '', updateHeroBannerFile: async () => '' };
  }
  return ctx;
}
