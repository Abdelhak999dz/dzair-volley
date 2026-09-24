import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ---------------------------------------------------------------------
// Security: Content-Security-Policy + response headers
// ---------------------------------------------------------------------
// The production build gets a CSP <meta> tag generated from your .env
// (so the Supabase / API hosts you actually use are the only origins the
// page may talk to). It is added at BUILD time only: the dev server needs
// inline scripts for hot-reload, which a strict CSP would block.
//
// Headers that a <meta> tag cannot express (frame-ancestors, HSTS, ...)
// ship in public/_headers (Netlify / Cloudflare Pages) and vercel.json;
// deploy/ has nginx + Apache equivalents. Keep the host lists below and
// those files in sync if you add a new external service.
const VIDEO_EMBED_HOSTS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://player.vimeo.com',
  'https://www.dailymotion.com',
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://www.instagram.com',
  'https://www.tiktok.com',
  'https://drive.google.com',
];

function hostOf(url) {
  try {
    return new URL(url).origin;
  } catch (e) {
    return '';
  }
}

function buildCsp(env) {
  const supabase = hostOf(env.VITE_SUPABASE_URL);
  const supabaseWs = supabase ? supabase.replace(/^https:/, 'wss:') : '';
  const customApi = hostOf(env.VITE_HIGHLIGHTLY_BASE_URL);
  const connect = [
    "'self'",
    supabase,
    supabaseWs,
    // Direct, keyed live-data source — no server-side proxy, no CORS relay
    // — MUST match public/_headers, vercel.json and
    // deploy/{nginx.conf,apache.htaccess}, or the browser blocks the
    // direct fetch() calls in volleyballApi.js on any host that serves
    // this build's own <meta> CSP tag (e.g. static/CDN hosting with no
    // custom response headers), producing exactly the "0 results / stuck
    // on loading" symptom even though the API layer itself is fine.
    'https://volleyball.highlightly.net',
    'https://volleyball-highlights-api.p.rapidapi.com',
    'https://api.mymemory.translated.net',
    customApi,
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${VIDEO_EMBED_HOSTS.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function securityMetaPlugin() {
  let env = {};
  return {
    name: 'dzair-volley-security-meta',
    apply: 'build',
    configResolved(config) {
      env = { ...process.env, ...(config.env || {}) };
    },
    transformIndexHtml(html) {
      const tag = `    <meta http-equiv="Content-Security-Policy" content="${buildCsp(env)}" />\n`;
      return html.replace('</head>', `${tag}  </head>`);
    },
  };
}

// Headers for `vite` (dev) and `vite preview`. No CSP header here — the
// build already embeds it, and dev needs inline scripts.
const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Robots-Tag': 'noai, noimageai',
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), securityMetaPlugin()],
  server: { headers: BASE_SECURITY_HEADERS },
  preview: { headers: BASE_SECURITY_HEADERS },
  // Never ship source maps: they hand a cloner the original source.
  build: { sourcemap: false },
});
