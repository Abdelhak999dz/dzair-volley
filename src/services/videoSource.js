// ============================================================
// Video source resolver — the fix for the "black screen" reels.
//
// A <video> element can only play a *direct media file*. Historically the
// admin dashboard stored uploaded videos as gigantic base64 `data:` URLs
// (which overflow database rows / realtime payloads and fail to decode on
// many browsers) and could not handle pasted YouTube / Facebook / Instagram
// links at all — both end up as an empty black rectangle.
//
// parseVideoSource() classifies whatever is stored in `reels.video_url`:
//   * { kind: 'file'  } direct .mp4/.webm/.ogg/.mov URL (Supabase Storage,
//                       any CDN, Dropbox share links converted to direct)
//   * { kind: 'embed' } a known video platform → safe, sandboxed iframe
//   * { kind: 'data'  } legacy base64 data: URL → decoded to a Blob URL
//   * { kind: 'invalid' | 'none' }
//
// Only the platforms listed below can ever become an iframe — an
// arbitrary URL is never embedded, so this can't be used to frame a
// hostile page.
// ============================================================

const YT_ID = /^[\w-]{11}$/;

function stripWww(hostname) {
  return hostname.replace(/^(www|m|web|mobile)\./i, '').toLowerCase();
}

function youTube(u, host) {
  let id = '';
  if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1] || '';
  }
  if (!YT_ID.test(id)) return null;
  return {
    provider: 'youtube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  };
}

function vimeo(u, host) {
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const m = u.pathname.match(/(?:\/video)?\/(\d{5,12})(?:\/([a-f0-9]{6,}))?/i);
  if (!m) return null;
  const hash = m[2] ? `?h=${m[2]}` : '';
  return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}${hash}` };
}

function dailymotion(u, host) {
  let id = '';
  if (host === 'dai.ly') id = u.pathname.split('/').filter(Boolean)[0] || '';
  else if (host === 'dailymotion.com') {
    const m = u.pathname.match(/\/(?:embed\/)?video\/([a-z0-9]+)/i);
    id = m ? m[1] : '';
  }
  if (!/^[a-z0-9]{5,}$/i.test(id)) return null;
  return { provider: 'dailymotion', embedUrl: `https://www.dailymotion.com/embed/video/${id}` };
}

function facebook(u, host) {
  const isFb = host === 'facebook.com' || host === 'fb.watch' || host === 'fb.com';
  if (!isFb) return null;
  // The official plugin accepts the original public video/reel URL.
  const href = encodeURIComponent(u.toString());
  return {
    provider: 'facebook',
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&t=0`,
  };
}

function instagram(u, host) {
  if (host !== 'instagram.com') return null;
  const m = u.pathname.match(/\/(reel|reels|p|tv)\/([\w-]+)/i);
  if (!m) return null;
  const type = m[1].toLowerCase() === 'reels' ? 'reel' : m[1].toLowerCase();
  return { provider: 'instagram', embedUrl: `https://www.instagram.com/${type}/${m[2]}/embed` };
}

function tiktok(u, host) {
  if (host !== 'tiktok.com') return null;
  const m = u.pathname.match(/\/video\/(\d{8,25})/);
  if (!m) return null;
  return { provider: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}` };
}

function googleDrive(u, host) {
  if (host !== 'drive.google.com') return null;
  const m = u.pathname.match(/\/file\/d\/([\w-]+)/) || null;
  const id = m ? m[1] : u.searchParams.get('id');
  if (!id || !/^[\w-]{10,}$/.test(id)) return null;
  return { provider: 'drive', embedUrl: `https://drive.google.com/file/d/${id}/preview` };
}

const EMBED_RESOLVERS = [youTube, vimeo, dailymotion, facebook, instagram, tiktok, googleDrive];

// Dropbox "share" links open an HTML page — rewrite to the raw file.
function dropboxDirect(u, host) {
  if (host !== 'dropbox.com') return null;
  const direct = new URL(u.toString());
  direct.hostname = 'dl.dropboxusercontent.com';
  direct.searchParams.delete('dl');
  direct.searchParams.set('raw', '1');
  return direct.toString();
}

const MIME_BY_EXT = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
};

export function guessMimeType(url) {
  try {
    const ext = new URL(url).pathname.split('.').pop().toLowerCase();
    return MIME_BY_EXT[ext] || '';
  } catch (e) {
    return '';
  }
}

// Decodes a legacy base64 data: URL into a Blob (played through an object
// URL, which every browser handles — huge data: URLs as <video src> do not).
export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(5, comma); // after "data:"
  const isBase64 = /;base64$/i.test(meta);
  const mime = meta.replace(/;base64$/i, '') || 'video/mp4';
  const payload = dataUrl.slice(comma + 1);
  try {
    if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mime });
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch (e) {
    return null;
  }
}

export function parseVideoSource(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { kind: 'none', src: '' };

  if (/^data:video\//i.test(value)) return { kind: 'data', src: value };
  if (/^blob:/i.test(value)) return { kind: 'file', src: value };

  let u;
  try {
    // Allow site-relative paths (e.g. "/videos/intro.mp4").
    u = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
  } catch (e) {
    return { kind: 'invalid', src: '' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'invalid', src: '' };

  // Mixed content: an http:// media URL is blocked outright on an https page.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && u.protocol === 'http:') {
    u.protocol = 'https:';
  }

  const host = stripWww(u.hostname);

  for (const resolve of EMBED_RESOLVERS) {
    const hit = resolve(u, host);
    if (hit) return { kind: 'embed', src: u.toString(), ...hit };
  }

  const dropbox = dropboxDirect(u, host);
  const finalUrl = dropbox || u.toString();

  return { kind: 'file', src: finalUrl, mime: guessMimeType(finalUrl) };
}

// iOS Safari paints no first frame for `preload="metadata"` unless the URL
// carries a media fragment — "#t=0.001" makes it render a real thumbnail
// instead of a black box. Skipped for blob:/data: and URLs that already
// carry a fragment.
export function withFirstFrameHint(src) {
  if (!src || /^(blob:|data:)/i.test(src) || src.includes('#')) return src;
  return `${src}#t=0.001`;
}

export function embedWithAutoplay(embedUrl, provider) {
  try {
    const u = new URL(embedUrl);
    if (provider === 'youtube') u.searchParams.set('autoplay', '1');
    else if (provider === 'vimeo') u.searchParams.set('autoplay', '1');
    else if (provider === 'dailymotion') u.searchParams.set('autoplay', '1');
    else if (provider === 'facebook') u.searchParams.set('autoplay', 'true');
    return u.toString();
  } catch (e) {
    return embedUrl;
  }
}

// ============================================================
// Cinematic "fullscreen on play" — the definitive fix for the reels
// "black screen, audio only" symptom, on top of the GPU-layer/repaint
// fixes already in place. Rather than fighting a browser that refuses to
// paint a decoded frame inside a small, CSS-transformed card, the video
// is handed straight to the browser's own native fullscreen video
// surface the instant playback starts — the same pattern TikTok/
// Instagram Reels use. The native fullscreen renderer always paints
// correctly because it bypasses the card's compositing context
// entirely, so the black-frame bug simply cannot occur there.
//
// Tries the standard Fullscreen API first, then the vendor-prefixed
// variants, then iOS Safari's video-only native fullscreen player
// (`webkitEnterFullscreen`, which only exists on <video> elements and
// is the *only* way to get real fullscreen video on iOS Safari). Must
// be called synchronously from within a user-gesture handler (a click,
// or the resulting `play` event fired in the same tick) — browsers
// silently refuse it otherwise, which is why the call is wrapped in
// try/catch: if it's refused for any reason, playback simply continues
// normally in the card instead of breaking.
// ============================================================
export function requestVideoFullscreen(el) {
  if (!el) return;
  // Prefer fullscreening the reel's own wrapping container (see
  // VideoPlayer.jsx's `.reel-video-fs-wrap`) instead of the bare <video>
  // whenever it's available. A lone <video> element cannot show any
  // sibling/overlay content (like the custom × close button) once native
  // fullscreen takes over — only the fullscreen element itself and its
  // descendants stay visible — so fullscreening the wrapper is what lets
  // the close button keep showing on top of the video. Falls straight
  // back to the original behaviour (fullscreening `el` itself, or iOS
  // Safari's video-only `webkitEnterFullscreen`) wherever the wrapper
  // isn't present or the browser doesn't support container fullscreen.
  const container = (el.closest && el.closest('.reel-video-fs-wrap')) || el;
  try {
    if (container.requestFullscreen) {
      const result = container.requestFullscreen();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } else if (el.webkitEnterFullscreen) {
      el.webkitEnterFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
  } catch (e) {
    // Ignored — see comment above; playback still proceeds normally.
  }
}

// ============================================================
// Close (×) button support — the counterpart to requestVideoFullscreen()
// above. Cleanly ends playback and native fullscreen together so the
// reel card falls back to a stable, silent "poster" state instead of a
// stuck black screen or audio still running in the background.
//
// Cross-browser fullscreen exit: tries the standard API, then every
// vendor-prefixed variant, then — for iOS Safari's video-only native
// fullscreen player, which the standard `document.exitFullscreen` does
// not affect — the video element's own `webkitExitFullscreen`. Every
// step is wrapped so a browser refusing one method never stops the
// rest (pause/reset still happen even if the fullscreen exit is
// rejected for any reason).
// ============================================================
export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export function exitVideoFullscreen(video) {
  try {
    if (getFullscreenElement()) {
      if (document.exitFullscreen) {
        const result = document.exitFullscreen();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  } catch (e) {
    // Ignored — closing must never throw even if the browser refuses.
  }
  try {
    if (video && video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
      video.webkitExitFullscreen();
    }
  } catch (e) {
    // Ignored — see comment above.
  }
}
