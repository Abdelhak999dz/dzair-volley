import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { IconEye, IconEyeOff } from './icons/AdminIcons.jsx';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

// Fallback used only if no persisted credentials exist yet (first run).
// SECURITY: these demo defaults are compiled OUT of production builds
// (import.meta.env.PROD is replaced at build time, so the literals never
// ship in the public JavaScript bundle). Real login is Supabase Auth.
const DEFAULT_ADMIN_USERNAME = import.meta.env.PROD ? '' : 'abdelhakbetch@gmail.com';
const DEFAULT_ADMIN_PASSWORD = import.meta.env.PROD ? '' : '123456789';

// The dedicated localStorage keys the admin settings panel writes to
// whenever credentials are updated. Reading these directly (rather than
// only relying on the `credentials` prop passed down from App state) keeps
// login correct even in edge cases where the in-memory prop hasn't
// re-rendered through to this modal yet — the storage write always
// happens synchronously when settings are saved, so it's the most
// reliable source of truth at the moment the form is submitted.
const LS_USERNAME_KEY = 'admin_username';
const LS_PASSWORD_KEY = 'admin_password';
// Set the instant credentials are ever saved (see AdminDashboard.jsx). Once
// this flag is present on a given browser/device, the hardcoded factory
// defaults are permanently rejected on that browser/device — even if the
// admin_username/admin_password keys were somehow cleared — so a stale
// default can never be used to log back in after a real change.
const LS_INITIALIZED_KEY = 'admin_credentials_initialized';

// --- Client-side brute-force throttling --------------------------------
// This is a UX-level speed bump (real protection against automated
// password guessing must also be enforced server-side, e.g. Supabase Auth
// rate limiting / RLS), but it meaningfully slows down anyone hammering
// the login form from this browser: after MAX_ATTEMPTS consecutive
// failures the form locks for an increasing cooldown, doubling on each
// further lockout up to a cap.
const LS_ATTEMPTS_KEY = 'admin_login_attempts';
const LS_LOCKOUT_UNTIL_KEY = 'admin_login_lockout_until';
const LS_LOCKOUT_STAGE_KEY = 'admin_login_lockout_stage';
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30 * 1000; // 30s
const MAX_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function readLockoutUntil() {
  try {
    const raw = window.localStorage.getItem(LS_LOCKOUT_UNTIL_KEY);
    const until = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(until) && until > Date.now() ? until : 0;
  } catch (e) {
    return 0;
  }
}

export default function LoginModal({ onClose, onLoginSuccess, credentials }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(() => readLockoutUntil());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  // Guards against double-submits (double-click, Enter held, slow network)
  // firing multiple concurrent `signInWithPassword` calls, which is what
  // was actually tripping the Supabase rate limit rather than genuine
  // repeated attempts.
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (!lockoutUntil) {
      setRemainingSeconds(0);
      return undefined;
    }
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(0);
        setRemainingSeconds(0);
      } else {
        setRemainingSeconds(remaining);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  // Records a failed attempt and, once MAX_ATTEMPTS is reached, starts (or
  // extends) a lockout window with exponential backoff. Fails open if
  // localStorage isn't available (private mode, etc.) — no throttling in
  // that case, but the real credential check still applies.
  const registerFailedAttempt = () => {
    try {
      const attempts = (parseInt(window.localStorage.getItem(LS_ATTEMPTS_KEY), 10) || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const stage = (parseInt(window.localStorage.getItem(LS_LOCKOUT_STAGE_KEY), 10) || 0) + 1;
        const lockoutMs = Math.min(BASE_LOCKOUT_MS * Math.pow(2, stage - 1), MAX_LOCKOUT_MS);
        const until = Date.now() + lockoutMs;
        window.localStorage.setItem(LS_LOCKOUT_STAGE_KEY, String(stage));
        window.localStorage.setItem(LS_LOCKOUT_UNTIL_KEY, String(until));
        window.localStorage.setItem(LS_ATTEMPTS_KEY, '0');
        setLockoutUntil(until);
      } else {
        window.localStorage.setItem(LS_ATTEMPTS_KEY, String(attempts));
      }
    } catch (e) {
      // localStorage unavailable — no client-side throttling this session.
    }
  };

  const clearAttemptState = () => {
    try {
      window.localStorage.removeItem(LS_ATTEMPTS_KEY);
      window.localStorage.removeItem(LS_LOCKOUT_UNTIL_KEY);
      window.localStorage.removeItem(LS_LOCKOUT_STAGE_KEY);
    } catch (e) {
      // localStorage unavailable — nothing to clear.
    }
    setLockoutUntil(0);
  };

  const isLockedOut = lockoutUntil > Date.now();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    // A submission already in flight — ignore double-clicks/double-Enter
    // instead of firing a second concurrent Supabase auth request.
    if (isSubmitting) {
      return;
    }

    // Re-check at submit time (not just via the disabled button) so a
    // form submitted programmatically/via Enter can't bypass the lockout.
    if (readLockoutUntil()) {
      setLockoutUntil(readLockoutUntil());
      return;
    }

    // Strictly trim both fields before any comparison or network call, so
    // accidental leading/trailing whitespace (common on mobile keyboards)
    // never causes a false-negative login.
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setLoginError(t('login', 'errorRequired'));
      return;
    }

    // When Supabase is configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    // set — see src/supabaseClient.js), authenticate the admin against real
    // Supabase Auth so credentials/password changes sync across every
    // device. The username field is treated as the account's email.
    if (isSupabaseConfigured) {
      setIsSubmitting(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedUsername,
          password: trimmedPassword,
        });
        if (error) {
          registerFailedAttempt();
          setLoginError(t('login', 'errorInvalid'));
          return;
        }
        // Server-side authorization: a valid Supabase account is NOT enough.
        // Only users listed in public.admin_users (see supabase/schema.sql)
        // may enter the dashboard — otherwise anyone able to create an
        // account on the project could see the admin UI. If is_admin() does
        // not exist yet (schema.sql not applied) we don't lock the owner out.
        const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
        if (adminCheckError) {
          console.warn('Dzair Volley: is_admin() is not available — run supabase/schema.sql', adminCheckError.message);
        } else if (isAdmin !== true) {
          await supabase.auth.signOut().catch(() => {});
          registerFailedAttempt();
          setLoginError(t('login', 'errorInvalid'));
          return;
        }
        clearAttemptState();
        setUsername('');
        setPassword('');
        onLoginSuccess();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Resolve the current valid credentials dynamically, at submit time:
    // 1) localStorage (source of truth, written the instant settings are
    //    saved in the admin dashboard — see AdminDashboard.jsx)
    // 2) the `credentials` prop (React state, also localStorage-backed)
    // 3) the hardcoded defaults, only if nothing has ever been persisted.
    let storedUsername = null;
    let storedPassword = null;
    let initialized = false;
    try {
      storedUsername = window.localStorage.getItem(LS_USERNAME_KEY);
      storedPassword = window.localStorage.getItem(LS_PASSWORD_KEY);
      initialized = window.localStorage.getItem(LS_INITIALIZED_KEY) === '1';
    } catch (err) {
      // localStorage unavailable (privacy mode, etc.) — fall through.
    }

    // IMPORTANT: the hardcoded defaults are ONLY a fallback for the very
    // first run, before any credentials have ever been persisted on this
    // browser/device. Once real credentials have been saved here — flagged
    // by LS_INITIALIZED_KEY, independent of whether the individual
    // username/password keys are still populated — the factory defaults
    // are permanently rejected on this browser/device: there is NO
    // hardcoded recovery bypass, so a device that hasn't received the
    // latest saved credentials never silently falls back to the factory
    // default once it knows credentials were ever changed on it.
    const credentialsEverSet = initialized || Boolean(credentials?.username);
    const validUsername = storedUsername || credentials?.username || (credentialsEverSet ? '' : DEFAULT_ADMIN_USERNAME);
    const validPassword = storedPassword || credentials?.password || (credentialsEverSet ? '' : DEFAULT_ADMIN_PASSWORD);

    const matchesResolved = trimmedUsername === validUsername && trimmedPassword === validPassword;

    if (matchesResolved) {
      clearAttemptState();
      setUsername('');
      setPassword('');
      onLoginSuccess();
    } else {
      registerFailedAttempt();
      setLoginError(t('login', 'errorInvalid'));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{t('login', 'title')}</h2>
        <p className="modal-sub">{t('login', 'subtitle')}</p>

        <form onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label>{t('login', 'username')}</label>
            <input
              type="text"
              inputMode="email"
              placeholder={t('login', 'username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              maxLength={254}
              disabled={isLockedOut || isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>{t('login', 'password')}</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                maxLength={200}
                disabled={isLockedOut || isSubmitting}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t('login', 'hidePassword') : t('login', 'showPassword')}
                title={showPassword ? t('login', 'hidePassword') : t('login', 'showPassword')}
                tabIndex={-1}
                disabled={isLockedOut || isSubmitting}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          {isLockedOut ? (
            <p className="form-error">
              {t('login', 'errorTooManyAttempts')} {remainingSeconds}{t('login', 'secondsShort')}
            </p>
          ) : (
            loginError && <p className="form-error">{loginError}</p>
          )}
          <button type="submit" className="btn-submit" disabled={isLockedOut || isSubmitting}>
            {isSubmitting ? t('login', 'submitting') || '…' : t('login', 'submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
