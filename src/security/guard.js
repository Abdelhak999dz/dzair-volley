// ============================================================
// Runtime guard — imported first by main.jsx so it runs before React
// renders anything. Every layer here is a deterrent that raises the cost
// of abuse; none of them can replace the server-side controls (RLS, RPC
// rate limits, security headers, CDN/WAF rules) documented in REPORT.md.
// ============================================================

// ---- 1. Anti-framing / clickjacking ---------------------------------
// Hosts that can send `X-Frame-Options` / `frame-ancestors` already block
// framing (see public/_headers, vercel.json). This is the fallback for
// hosts that cannot set headers: if the page is loaded inside someone
// else's <iframe> (a classic "clone by framing" trick), hide the content
// and try to break out. NOTE: Chrome blocks a cross-origin frame from
// navigating the parent window without a user gesture, so the reliable
// part here is the hiding; real protection is the header (frame-ancestors).
(function frameBust() {
  try {
    if (window.top !== window.self) {
      try {
        window.top.location.href = window.self.location.href;
      } catch (e) {
        // Cross-origin top window: navigating it may be blocked — hide instead.
      }
      document.documentElement.style.display = 'none';
    }
  } catch (e) {
    document.documentElement.style.display = 'none';
  }
})();

// ---- 2. Optional domain lock (anti-clone) ---------------------------
// Set VITE_ALLOWED_HOSTS="dzairvolley.com,*.dzairvolley.com" to make the
// build refuse to run on any other domain. localhost / LAN preview hosts
// are always allowed so development keeps working. Left empty = no lock
// (so a fresh deploy on an unknown domain never bricks itself).
const ALLOWED_HOSTS = String(import.meta.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function hostAllowed(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
  return ALLOWED_HOSTS.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".example.com"
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pattern;
  });
}

export const isUnauthorizedHost = ALLOWED_HOSTS.length > 0 && !hostAllowed(window.location.hostname);

if (isUnauthorizedHost) {
  const official = ALLOWED_HOSTS.find((h) => !h.startsWith('*.'));
  document.documentElement.innerHTML =
    '<body style="margin:0;background:#050b1a;color:#f4f8fc;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:1.4rem;margin-bottom:12px">Unauthorized copy detected</h1>' +
    '<p style="color:#8fa1bd">هذه نسخة غير مصرّح بها من الموقع.</p></div></body>';
  if (official) {
    window.setTimeout(() => window.location.replace(`https://${official}`), 1500);
  }
}

// ---- 3. Automation / headless-browser detection ----------------------
// Flags the default fingerprints of Selenium / Puppeteer / Playwright /
// PhantomJS and headless Chrome. Real visitors (including Googlebot and
// social-preview crawlers) never trip these. A scraper using a
// "stealth" plugin can hide them, so this only stops the low-effort
// scrapers — which is most of them.
// Set VITE_BLOCK_AUTOMATION=false to disable (e.g. for your own
// Playwright / Lighthouse runs against the production build).
function detectAutomation() {
  try {
    const ua = navigator.userAgent || '';
    if (navigator.webdriver === true) return true;
    if (/HeadlessChrome|PhantomJS|SlimerJS|Puppeteer|Playwright|Selenium|CasperJS/i.test(ua)) return true;
    if (window.callPhantom || window._phantom || window.__nightmare || window.domAutomation || window.domAutomationController) return true;
    const docKeys = Object.keys(document);
    if (docKeys.some((k) => /^\$?cdc_|__webdriver|__selenium|__driver_/i.test(k))) return true;
  } catch (e) {
    // Detection must never break the page.
  }
  return false;
}

export const isAutomatedClient = detectAutomation();
export const isBlockedClient = isAutomatedClient && String(import.meta.env.VITE_BLOCK_AUTOMATION) !== 'false';

// ---- 4. Media deterrents --------------------------------------------
// No right-click "Save image/video as…" and no drag-to-desktop on media
// elements only (text selection and normal context menus keep working).
// Casual copying only — anyone can still open DevTools.
if (!isUnauthorizedHost) {
  document.addEventListener(
    'contextmenu',
    (event) => {
      const target = event.target;
      if (target && target.closest && target.closest('video, img')) event.preventDefault();
    },
    { capture: true }
  );
  document.addEventListener(
    'dragstart',
    (event) => {
      const target = event.target;
      if (target && target.tagName === 'IMG') event.preventDefault();
    },
    { capture: true }
  );
}

// ---- 5. Legacy credential cleanup -----------------------------------
// Older builds stored the local demo admin credentials in localStorage in
// plain text. When real Supabase Auth is configured they are never used,
// so wipe them from this browser.
try {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    ['admin_username', 'admin_password', 'admin_credentials_initialized', 'dzair-volley-admin-credentials'].forEach((k) =>
      window.localStorage.removeItem(k)
    );
  }
} catch (e) {
  // localStorage unavailable — nothing to clean.
}
