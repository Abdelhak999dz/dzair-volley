import React, { useState, useEffect } from 'react';
import {
  IconDashboard,
  IconNews,
  IconVideo,
  IconMatch,
  IconSettings,
  IconEye,
  IconEyeOff,
  IconHeart,
  IconLogout,
  IconArrowBack,
} from './icons/AdminIcons.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSiteSettings } from '../context/SiteSettingsContext.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import TeamCrest from './TeamCrest.jsx';
import { ALGERIAN_DIVISIONS } from '../data/algeriaData.js';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { compressImage, uploadMedia, validateMediaFile } from '../services/mediaStorage.js';
import { parseVideoSource } from '../services/videoSource.js';
import { stripUnsafeChars } from '../security/sanitize.js';

// Dedicated localStorage keys kept in sync with the credentials object so
// LoginModal.jsx can check them directly and dynamically at submit time,
// independent of whatever React prop state it currently has.
const LS_USERNAME_KEY = 'admin_username';
const LS_PASSWORD_KEY = 'admin_password';
// Mirrors LoginModal.jsx's LS_INITIALIZED_KEY — set the instant credentials
// are first synced/saved on this browser/device, permanently disabling the
// factory-default fallback on it from that point on.
const LS_INITIALIZED_KEY = 'admin_credentials_initialized';

const NEWS_CATEGORIES = ['دوري الأمم', 'التصفيات الأولمبية', 'بطولة العالم', 'البطولة الأفريقية', 'البطولة الآسيوية', 'البطولة الأوروبية', 'تحويلات'];
const REEL_CATEGORIES = ['أهداف مميزة', 'دفاع', 'احتفالات', 'تدريبات', 'أجواء'];

// Round/matchday quick-pick suggestions ("الجولة 1" .. "الجولة 18") for
// the match form's round field, matching a typical Algerian Volleyball
// Federation (FAVB) season calendar length. Offered via a <datalist> —
// the admin is always free to type any other round/group label instead
// (e.g. "الجولة 19", "نصف النهائي", "الدور التمهيدي").
const ROUND_SUGGESTIONS = Array.from({ length: 18 }, (_, i) => `الجولة ${i + 1}`);

function formatViews(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// --- Basic input hardening -------------------------------------------
// Strips control characters, neutralizes HTML-significant characters
// (defense-in-depth against script/markup injection in admin-authored
// news/match content, on top of React's own text-node escaping), and
// trims whitespace from free-text input before it ever reaches
// state/localStorage/rendering.
function sanitizeText(value) {
  return stripUnsafeChars(value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

// Only accepts http(s) URLs for anything that ends up in a src/href —
// rejects javascript:, data:, vbscript: and any other scheme that could
// be used to smuggle executable content into an <img>/<video> tag.
function isSafeHttpUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Turns the 5 real per-set inputs of the Algerian match form (setNHome /
// setNAway text fields) into a validated setScores array — [[h,a], ...],
// one pair per set actually played — plus the final match score ("3-1"),
// which is always DERIVED by counting how many of those entered sets
// each side actually won. The admin never types the final score by
// hand, so it can never drift from the real set-by-set data below it.
// Sets 1-3 are required (a match can't finish in fewer); sets 4 and 5
// are only used if filled in (a match finishing 3-0/3-1 has no 4th/5th
// set). Returns { error } when the input isn't a valid, complete set of
// scores yet.
function buildSetScoresFromForm(form) {
  const setScores = [];
  for (let i = 1; i <= 5; i += 1) {
    const homeRaw = form[`set${i}Home`];
    const awayRaw = form[`set${i}Away`];
    const homeFilled = homeRaw !== '' && homeRaw !== undefined && homeRaw !== null;
    const awayFilled = awayRaw !== '' && awayRaw !== undefined && awayRaw !== null;
    if (!homeFilled && !awayFilled) continue; // this set simply wasn't played
    if (!homeFilled || !awayFilled) return { error: 'incomplete' };
    const home = Number(homeRaw);
    const away = Number(awayRaw);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      return { error: 'invalid' };
    }
    if (home === away) return { error: 'tie' };
    setScores.push([home, away]);
  }
  if (setScores.length < 3) return { error: 'tooFew' };
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  setScores.forEach(([home, away]) => {
    if (home > away) homeSetsWon += 1;
    else awaySetsWon += 1;
  });
  return { setScores, score: `${homeSetsWon}-${awaySetsWon}` };
}

const EMPTY_MATCH_SETS = {
  set1Home: '', set1Away: '',
  set2Home: '', set2Away: '',
  set3Home: '', set3Away: '',
  set4Home: '', set4Away: '',
  set5Home: '', set5Away: '',
};

export default function AdminDashboard({
  news,
  reels,
  matches,
  onAddNews,
  onDeleteNews,
  onAddReel,
  onDeleteReel,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  credentials,
  onUpdateCredentials,
  onLogout,
  onBackToSite,
}) {
  const { t, locale, dir } = useLanguage();
  const { siteName, logoUrl } = useSiteSettings();

  // Settings is no longer a sidebar entry — it's reached via the compact
  // gear icon at the top-left of the admin panel (see admin-header below).
  // Kept in a separate constant so its label still resolves for the
  // panel header / activeSection lookup.
  const SIDEBAR_ITEMS = [
    { key: 'stats', label: t('admin', 'sidebarStats'), icon: IconDashboard },
    { key: 'addNews', label: t('admin', 'sidebarAddNews'), icon: IconNews },
    { key: 'addReel', label: t('admin', 'sidebarAddReel'), icon: IconVideo },
    { key: 'addMatch', label: t('admin', 'sidebarAddResult'), icon: IconMatch },
  ];
  const SETTINGS_ITEM = { key: 'settings', label: t('admin', 'sidebarSettings'), icon: IconSettings };
  const ALL_SECTIONS = [...SIDEBAR_ITEMS, SETTINGS_ITEM];

  const safeMatches = matches || [];

  const [activeTab, setActiveTab] = useState('stats');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Generic delete-confirmation state, shared by news/video/match deletion.
  // `pendingDelete` holds { type: 'news' | 'reel' | 'match', id }.
  const [pendingDelete, setPendingDelete] = useState(null);

  const [newsForm, setNewsForm] = useState({ title: '', category: NEWS_CATEGORIES[0], content: '', image: '' });
  const [newsErrors, setNewsErrors] = useState({});

  const [reelForm, setReelForm] = useState({ title: '', videoUrl: '', videoFileName: '', poster: '', posterFileName: '', category: REEL_CATEGORIES[0] });
  const [reelErrors, setReelErrors] = useState({});
  // Optional pasted video link (direct .mp4 URL, YouTube, Facebook, Instagram,
  // Vimeo, TikTok, Dailymotion, Google Drive ...) — an alternative to uploading.
  const [videoLinkInput, setVideoLinkInput] = useState('');

  // --- Supabase Storage uploads ----------------------------------------
  // When Supabase is configured, picked files are uploaded to the public
  // `site-assets` bucket and ONLY the small public URL is stored in the
  // database row. (Base64-in-the-database was what produced the black-screen
  // videos and broken/oversized images — see services/mediaStorage.js.)
  // `uploading` tracks which upload slot is currently in flight.
  const [uploading, setUploading] = useState({});
  const uploadErrorText = (err) => {
    if (err && err.code === 'type') return t('admin', 'errMediaType');
    if (err && err.code === 'size') return t('admin', 'errMediaSize');
    return t('admin', 'errMediaUpload');
  };
  const runUpload = (slot, file, { folder, kind, compress }, onDone, onError) => {
    setUploading((prev) => ({ ...prev, [slot]: true }));
    Promise.resolve()
      .then(async () => {
        validateMediaFile(file, kind);
        const prepared = compress ? await compressImage(file) : file;
        return uploadMedia(prepared, folder, kind);
      })
      .then(onDone)
      .catch((err) => onError(uploadErrorText(err)))
      .finally(() => setUploading((prev) => ({ ...prev, [slot]: false })));
  };

  // --- Real local file uploads (news image / video) --------------------
  // Both read the actual selected file via FileReader and convert it to a
  // Base64 data: URL, so the resulting string can be stored directly in
  // React state (and therefore in localStorage via usePersistentState),
  // survives reloads, and renders immediately in <img>/<video> without any
  // external hosting or network request.
  const handleNewsImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNewsErrors((prev) => ({ ...prev, image: t('admin', 'errValidImageUrl') }));
      return;
    }
    if (isSupabaseConfigured) {
      runUpload('newsImage', file, { folder: 'news', kind: 'image', compress: true },
        (url) => {
          setNewsForm((prev) => ({ ...prev, image: url }));
          setNewsErrors((prev) => ({ ...prev, image: undefined }));
        },
        (message) => setNewsErrors((prev) => ({ ...prev, image: message })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewsForm((prev) => ({ ...prev, image: reader.result }));
      setNewsErrors((prev) => ({ ...prev, image: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const handleReelVideoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setReelErrors((prev) => ({ ...prev, videoUrl: t('admin', 'errVideoUrlRequired') }));
      return;
    }
    if (isSupabaseConfigured) {
      runUpload('video', file, { folder: 'reels/videos', kind: 'video' },
        (url) => {
          setVideoLinkInput('');
          setReelForm((prev) => ({ ...prev, videoUrl: url, videoFileName: file.name }));
          setReelErrors((prev) => ({ ...prev, videoUrl: undefined }));
        },
        (message) => setReelErrors((prev) => ({ ...prev, videoUrl: message })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReelForm((prev) => ({ ...prev, videoUrl: reader.result, videoFileName: file.name }));
      setReelErrors((prev) => ({ ...prev, videoUrl: undefined }));
    };
    reader.readAsDataURL(file);
  };

  // Pasted video link — a direct file URL or a supported platform link. The
  // public player (components/VideoPlayer.jsx) turns platform links into a
  // proper embedded player, so these no longer show up as a black box.
  const handleVideoLinkChange = (e) => {
    const value = e.target.value;
    setVideoLinkInput(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsed = parseVideoSource(trimmed);
    if (isSafeHttpUrl(trimmed) && (parsed.kind === 'embed' || parsed.kind === 'file')) {
      setReelForm((prev) => ({ ...prev, videoUrl: trimmed, videoFileName: '' }));
      setReelErrors((prev) => ({ ...prev, videoUrl: undefined }));
    } else {
      setReelErrors((prev) => ({ ...prev, videoUrl: t('admin', 'errValidUrl') }));
    }
  };

  // Poster image now comes from the local gallery/file system too (same
  // Base64/FileReader approach as the news image and reel video above)
  // instead of a typed external URL, with an instant live preview.
  const handlePosterImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setReelErrors((prev) => ({ ...prev, poster: t('admin', 'errValidImageUrl') }));
      return;
    }
    if (isSupabaseConfigured) {
      runUpload('poster', file, { folder: 'reels/posters', kind: 'image', compress: true },
        (url) => {
          setReelForm((prev) => ({ ...prev, poster: url, posterFileName: file.name }));
          setReelErrors((prev) => ({ ...prev, poster: undefined }));
        },
        (message) => setReelErrors((prev) => ({ ...prev, poster: message })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReelForm((prev) => ({ ...prev, poster: reader.result, posterFileName: file.name }));
      setReelErrors((prev) => ({ ...prev, poster: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const EMPTY_MATCH_FORM = {
    matchType: 'result',
    divisionId: '',
    groupId: '',
    round: '',
    homeTeam: '',
    awayTeam: '',
    homeTeamLogo: '',
    awayTeamLogo: '',
    ...EMPTY_MATCH_SETS,
    // Match date is optional — left blank by default so the admin can
    // publish a whole round's fixtures (round 1 through 18+) without a
    // date, then come back and fill each one in later via "edit" below.
    date: '',
    time: '',
  };
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH_FORM);
  const [matchErrors, setMatchErrors] = useState({});
  // Non-null while editing an existing match (set by the "edit" button
  // in the matches table below) — the form then updates that match
  // in place via onUpdateMatch instead of publishing a new one.
  const [editingMatchId, setEditingMatchId] = useState(null);

  const startEditMatch = (m) => {
    setEditingMatchId(m.id);
    setMatchForm({
      matchType: m.score ? 'result' : 'upcoming',
      divisionId: m.divisionId || '',
      groupId: m.groupId || '',
      round: m.round || '',
      homeTeam: m.homeTeam || '',
      awayTeam: m.awayTeam || '',
      homeTeamLogo: m.homeTeamLogo || '',
      awayTeamLogo: m.awayTeamLogo || '',
      set1Home: m.setScores?.[0]?.[0] ?? '', set1Away: m.setScores?.[0]?.[1] ?? '',
      set2Home: m.setScores?.[1]?.[0] ?? '', set2Away: m.setScores?.[1]?.[1] ?? '',
      set3Home: m.setScores?.[2]?.[0] ?? '', set3Away: m.setScores?.[2]?.[1] ?? '',
      set4Home: m.setScores?.[3]?.[0] ?? '', set4Away: m.setScores?.[3]?.[1] ?? '',
      set5Home: m.setScores?.[4]?.[0] ?? '', set5Away: m.setScores?.[4]?.[1] ?? '',
      date: m.date || '',
      time: m.time || '',
    });
    setMatchErrors({});
  };

  const cancelEditMatch = () => {
    setEditingMatchId(null);
    setMatchForm(EMPTY_MATCH_FORM);
    setMatchErrors({});
  };

  // Team crest logo uploads (Team A / Team B) for the Algerian match
  // form — same FileReader/Base64 approach as the news image and reel
  // poster uploads above, so a real uploaded crest is stored directly
  // on the match and rendered by TeamCrest (see its logoUrl prop)
  // instead of the shared generic/default emblem.
  const handleHomeTeamLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMatchErrors((prev) => ({ ...prev, homeTeamLogo: t('admin', 'errValidImageUrl') }));
      return;
    }
    if (isSupabaseConfigured) {
      runUpload('homeLogo', file, { folder: 'team-crests', kind: 'image', compress: true },
        (url) => {
          setMatchForm((prev) => ({ ...prev, homeTeamLogo: url }));
          setMatchErrors((prev) => ({ ...prev, homeTeamLogo: undefined }));
        },
        (message) => setMatchErrors((prev) => ({ ...prev, homeTeamLogo: message })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMatchForm((prev) => ({ ...prev, homeTeamLogo: reader.result }));
      setMatchErrors((prev) => ({ ...prev, homeTeamLogo: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const handleAwayTeamLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMatchErrors((prev) => ({ ...prev, awayTeamLogo: t('admin', 'errValidImageUrl') }));
      return;
    }
    if (isSupabaseConfigured) {
      runUpload('awayLogo', file, { folder: 'team-crests', kind: 'image', compress: true },
        (url) => {
          setMatchForm((prev) => ({ ...prev, awayTeamLogo: url }));
          setMatchErrors((prev) => ({ ...prev, awayTeamLogo: undefined }));
        },
        (message) => setMatchErrors((prev) => ({ ...prev, awayTeamLogo: message })));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMatchForm((prev) => ({ ...prev, awayTeamLogo: reader.result }));
      setMatchErrors((prev) => ({ ...prev, awayTeamLogo: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const selectedDivision = ALGERIAN_DIVISIONS.find((d) => d.id === matchForm.divisionId);

  const [settingsForm, setSettingsForm] = useState({
    currentPassword: '',
    newUsername: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [settingsError, setSettingsError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, new: false, confirm: false });
  const togglePasswordVisibility = (field) =>
    setVisiblePasswords((prev) => ({ ...prev, [field]: !prev[field] }));

  // Keep the dedicated admin_username/admin_password localStorage keys in
  // sync with whatever credentials are currently active — this runs on
  // mount and whenever credentials change (including the very first
  // default-credentials render), so LoginModal always has an up-to-date
  // value to read even before any settings change is ever made.
  useEffect(() => {
    if (!credentials) return;
    // Real Supabase Auth in use → never mirror credentials into localStorage.
    if (isSupabaseConfigured) return;
    try {
      window.localStorage.setItem(LS_USERNAME_KEY, credentials.username || '');
      window.localStorage.setItem(LS_PASSWORD_KEY, credentials.password || '');
      window.localStorage.setItem(LS_INITIALIZED_KEY, '1');
    } catch (err) {
      // localStorage unavailable — nothing else to do here.
    }
  }, [credentials]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  };

  const totalViews = reels.reduce((sum, r) => sum + r.views, 0) + news.reduce((sum, n) => sum + (n.views || 0), 0);
  const totalLikes = reels.reduce((sum, r) => sum + r.likes, 0) + news.reduce((sum, n) => sum + (n.likes || 0), 0);

  const handleNewsSubmit = (e) => {
    e.preventDefault();
    if (uploading.newsImage) { showToast(t('admin', 'uploadInProgress')); return; }
    const title = sanitizeText(newsForm.title);
    const content = sanitizeText(newsForm.content);
    const errors = {};
    if (!title) errors.title = t('admin', 'errTitleRequired');
    if (!content) errors.content = t('admin', 'errContentRequired');
    setNewsErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // If the row could not be saved server-side (RLS / network) the context
    // reports `syncError` — warn the admin instead of silently keeping a
    // change that nobody else will ever see.
    Promise.resolve(onAddNews({ title, category: newsForm.category, summary: content, image: newsForm.image })).then((saved) => {
      if (saved && saved.syncError) showToast(t('admin', 'toastSyncFailed'));
    });
    setNewsForm({ title: '', category: NEWS_CATEGORIES[0], content: '', image: '' });
    showToast(t('admin', 'toastNewsPublished'));
  };

  const handleReelSubmit = (e) => {
    e.preventDefault();
    if (uploading.video || uploading.poster) { showToast(t('admin', 'uploadInProgress')); return; }
    const title = sanitizeText(reelForm.title);
    // videoUrl now comes exclusively from the local file picker (a
    // data: URL produced by FileReader in handleReelVideoChange), never
    // from typed text, so it is never run through the http(s)-only
    // isSafeHttpUrl check — it's real local binary data, not a
    // user-typed external link.
    const videoUrl = reelForm.videoUrl;
    // poster now comes exclusively from the local file picker (a data:
    // URL produced by FileReader in handlePosterImageChange), never from
    // typed text, so — like videoUrl above — it's real local binary data
    // and isn't run through the http(s)-only isSafeHttpUrl check.
    const poster = reelForm.poster;
    const errors = {};
    if (!title) errors.title = t('admin', 'errTitleRequired');
    if (!videoUrl) errors.videoUrl = t('admin', 'errVideoUrlRequired');
    setReelErrors(errors);
    if (Object.keys(errors).length > 0) return;

    Promise.resolve(onAddReel({ title, videoUrl, poster, category: reelForm.category })).then((saved) => {
      if (saved && saved.syncError) showToast(t('admin', 'toastSyncFailed'));
    });
    setVideoLinkInput('');
    setReelForm({ title: '', videoUrl: '', videoFileName: '', poster: '', posterFileName: '', category: REEL_CATEGORIES[0] });
    showToast(t('admin', 'toastVideoPublished'));
  };

  const SET_ERROR_KEYS = {
    incomplete: 'errSetsIncomplete',
    invalid: 'errSetsInvalid',
    tie: 'errSetsTie',
    tooFew: 'errSetsTooFew',
  };

  const handleMatchSubmit = (e) => {
    e.preventDefault();
    if (uploading.homeLogo || uploading.awayLogo) { showToast(t('admin', 'uploadInProgress')); return; }
    const errors = {};
    if (!matchForm.divisionId) errors.division = t('admin', 'errDivisionRequired');
    if (!matchForm.homeTeam || !matchForm.awayTeam) errors.teams = t('admin', 'errTeamsRequired');
    // Match date is intentionally NOT validated as required — see
    // EMPTY_MATCH_FORM above: the admin can publish an entire round of
    // fixtures with no date yet and fill each one in later.

    let setsResult = null;
    if (matchForm.matchType === 'result') {
      setsResult = buildSetScoresFromForm(matchForm);
      if (setsResult.error) errors.score = t('admin', SET_ERROR_KEYS[setsResult.error] || 'errScoreRequired');
    }
    setMatchErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const division = ALGERIAN_DIVISIONS.find((d) => d.id === matchForm.divisionId);
    const group = division ? division.groups.find((g) => g.id === matchForm.groupId) : undefined;
    const payload = {
      matchType: matchForm.matchType,
      divisionId: matchForm.divisionId,
      divisionLabel: division ? division.label : '',
      groupId: group ? group.id : '',
      groupLabel: group ? group.label : '',
      // Round/matchday — free text the admin picks or types (see
      // ROUND_SUGGESTIONS above), entirely optional.
      round: sanitizeText(matchForm.round || ''),
      homeTeam: matchForm.homeTeam,
      awayTeam: matchForm.awayTeam,
      homeTeamLogo: matchForm.homeTeamLogo,
      awayTeamLogo: matchForm.awayTeamLogo,
      // The final score is never hand-typed — it's derived from the real
      // per-set scores entered below, so it can never disagree with them.
      score: matchForm.matchType === 'result' ? setsResult.score : '',
      setScores: matchForm.matchType === 'result' ? setsResult.setScores : undefined,
      // Optional — may be left empty (see above) and filled in later.
      date: matchForm.date || '',
      time: matchForm.matchType === 'upcoming' ? matchForm.time : '',
    };

    if (editingMatchId) {
      Promise.resolve(onUpdateMatch(editingMatchId, payload)).then((r) => {
        if (r && r.syncError) showToast(t('admin', 'toastSyncFailed'));
      });
      showToast(t('admin', 'toastMatchUpdated') || t('admin', 'toastMatchPublished'));
    } else {
      Promise.resolve(onAddMatch(payload)).then((saved) => {
        if (saved && saved.syncError) showToast(t('admin', 'toastSyncFailed'));
      });
      showToast(t('admin', 'toastMatchPublished'));
    }
    setEditingMatchId(null);
    setMatchForm(EMPTY_MATCH_FORM);
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsError('');

    const { currentPassword, newUsername, newPassword, confirmNewPassword } = settingsForm;

    if (!currentPassword.trim()) {
      setSettingsError(t('admin', 'errFieldsRequired'));
      return;
    }
    if (newPassword || confirmNewPassword) {
      if (newPassword.length < 4) {
        setSettingsError(t('admin', 'errPasswordTooShort'));
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setSettingsError(t('admin', 'errPasswordsNoMatch'));
        return;
      }
    }
    if (!newUsername.trim() && !newPassword) {
      setSettingsError(t('admin', 'errFieldsRequired'));
      return;
    }

    // When Supabase is configured, admin password/username (email) changes
    // go through real Supabase Auth (supabase.auth.updateUser), syncing
    // across every device instead of only this browser's localStorage.
    if (isSupabaseConfigured) {
      // Validate the shape of the payload client-side before it's ever
      // sent — Supabase treats the username as an email, so reject
      // anything that plainly isn't one rather than letting a malformed
      // value round-trip to the server.
      const trimmedNewUsername = newUsername.trim();
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedNewUsername);
      if (trimmedNewUsername && !looksLikeEmail) {
        setSettingsError(t('admin', 'errFieldsRequired'));
        return;
      }
      try {
        const { data: userData, error: getUserError } = await supabase.auth.getUser();
        const currentEmail = userData?.user?.email;
        if (getUserError || !currentEmail) {
          setSettingsError(t('admin', 'errCurrentPasswordWrong'));
          return;
        }
        // Re-authenticate with the current password to confirm identity
        // before allowing any change — supabase.auth has no separate
        // "verify current password" call, so signing in again is the way.
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: currentPassword,
        });
        if (reauthError) {
          setSettingsError(t('admin', 'errCurrentPasswordWrong'));
          return;
        }
        const updates = {};
        if (trimmedNewUsername) updates.email = sanitizeText(trimmedNewUsername);
        if (newPassword) updates.password = newPassword;
        const { error: updateError } = await supabase.auth.updateUser(updates);
        if (updateError) {
          // Deliberately generic — never surface Supabase's raw
          // error/stack details in the UI.
          setSettingsError(t('admin', 'errFieldsRequired'));
          return;
        }
        setSettingsForm({ currentPassword: '', newUsername: '', newPassword: '', confirmNewPassword: '' });
        showToast(t('admin', 'toastSettingsSaved'));
      } catch (err) {
        // Network/unexpected failure — same generic message, no internals.
        setSettingsError(t('admin', 'errFieldsRequired'));
      }
      return;
    }

    // Resolve the ACTIVE credentials the exact same way LoginModal.jsx
    // does at submit time, so "current password" validation here can
    // never drift out of sync with what actually logs the admin in:
    //   1) the dedicated localStorage keys (admin_username/admin_password)
    //      — the single source of truth, written synchronously on every
    //      successful settings save (see the effect above and the write
    //      at the end of this function).
    //   2) the `credentials` prop (React state, also localStorage-backed
    //      via usePersistentState).
    //   3) the hardcoded factory defaults, used ONLY
    //      when nothing has ever been persisted yet (brand-new install,
    //      or a browser where localStorage was cleared/blocked) — this
    //      never applies once real credentials exist, so the old
    //      defaults are permanently rejected the moment they're changed.
    let storedUsername = null;
    let storedPassword = null;
    let initialized = false;
    try {
      storedUsername = window.localStorage.getItem(LS_USERNAME_KEY);
      storedPassword = window.localStorage.getItem(LS_PASSWORD_KEY);
      initialized = window.localStorage.getItem(LS_INITIALIZED_KEY) === '1';
    } catch (err) {
      // localStorage unavailable — fall through to the other sources.
    }
    // Same strict rule as LoginModal.jsx: once credentials have ever been
    // set on this browser/device, the factory defaults are permanently
    // rejected here too — they never silently become the "current
    // password" again just because a key happened to be empty.
    const credentialsEverSet = initialized || Boolean(credentials?.username);
    const activeUsername = storedUsername || credentials?.username || (credentialsEverSet ? '' : (import.meta.env.PROD ? '' : 'abdelhakbetch@gmail.com'));
    const activePassword = storedPassword || credentials?.password || (credentialsEverSet ? '' : (import.meta.env.PROD ? '' : '123456789'));
    const currentCredentials = { username: activeUsername, password: activePassword };

    // Current password must match the ACTIVE password exactly — no
    // fallback to the factory default once real credentials are set, so
    // an old/replaced password can never be used to authorize further
    // changes.
    const matchesActive = currentPassword === currentCredentials.password;
    if (!matchesActive) {
      setSettingsError(t('admin', 'errCurrentPasswordWrong'));
      return;
    }

    const updatedUsername = newUsername.trim() ? sanitizeText(newUsername.trim()) : currentCredentials.username;
    const updatedPassword = newPassword || currentCredentials.password;

    onUpdateCredentials({ username: updatedUsername, password: updatedPassword });

    // Write straight to localStorage too, synchronously, so LoginModal.jsx
    // can check against the reliably updated credentials immediately —
    // not just on whatever the next re-render happens to pass down.
    try {
      window.localStorage.setItem(LS_USERNAME_KEY, updatedUsername || '');
      window.localStorage.setItem(LS_PASSWORD_KEY, updatedPassword || '');
      window.localStorage.setItem(LS_INITIALIZED_KEY, '1');
    } catch (err) {
      // localStorage unavailable — the React state update above still applies.
    }

    setSettingsForm({ currentPassword: '', newUsername: '', newPassword: '', confirmNewPassword: '' });
    showToast(t('admin', 'toastSettingsSaved'));
  };

  // All destructive deletes (news, video, match) go through the same
  // confirmation modal before anything is actually removed.
  const requestDelete = (type, id) => setPendingDelete({ type, id });
  const cancelDelete = () => setPendingDelete(null);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    const reportFailure = (r) => { if (r && r.syncError) showToast(t('admin', 'toastSyncFailed')); };
    if (type === 'news') { Promise.resolve(onDeleteNews(id)).then(reportFailure); showToast(t('admin', 'toastNewsDeleted')); }
    else if (type === 'reel') { Promise.resolve(onDeleteReel(id)).then(reportFailure); showToast(t('admin', 'toastVideoDeleted')); }
    else if (type === 'match') { Promise.resolve(onDeleteMatch(id)).then(reportFailure); showToast(t('admin', 'toastMatchDeleted')); }
    setPendingDelete(null);
  };

  // Secure logout: proactively wipe any credential-shaped form state from
  // memory (rather than just relying on React to eventually GC it on
  // unmount), and — when Supabase Auth is configured — actually invalidate
  // the server-side session too, so a logged-out admin isn't left with a
  // still-valid Supabase session token sitting in storage.
  const handleSecureLogout = () => {
    setSettingsForm({ currentPassword: '', newUsername: '', newPassword: '', confirmNewPassword: '' });
    setVisiblePasswords({ current: false, new: false, confirm: false });
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {
        // Best-effort: even if the network sign-out call fails, still
        // proceed to tear down the local admin session below.
      });
    }
    onLogout();
  };

  const activeSection = ALL_SECTIONS.find((i) => i.key === activeTab);

  return (
    <div className="admin-layout" dir={dir}>
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="vhub-logo">
          <img className="vhub-logo-mark rounded-full" src={logoUrl} alt={siteName} />
          <div className="vhub-logo-text">
            {siteName}
            <small>{t('admin', 'tagline')}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`sidebar-btn ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
              >
                <span className="sidebar-btn-icon"><Icon /></span> {item.label}
              </button>
            );
          })}
        </nav>

        <button className="back-site-btn" style={{ marginBottom: 12 }} onClick={onBackToSite}>
          <IconArrowBack style={dir === 'ltr' ? { transform: 'scaleX(-1)' } : undefined} /> {t('admin', 'backToSite')}
        </button>
        <button className="sidebar-logout" onClick={handleSecureLogout}>
          <IconLogout /> {t('admin', 'logout')}
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <button
            type="button"
            className={`admin-gear-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            aria-label={t('admin', 'sidebarSettings')}
            title={t('admin', 'sidebarSettings')}
          >
            <IconSettings />
          </button>
          <div>
            <div className="mobile-toggle admin-mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <span></span><span></span><span></span>
            </div>
            <h1>{t('admin', 'dashboardTitle')}</h1>
            <p>{activeSection?.label} — Dzair Volley</p>
          </div>
        </div>

        {activeTab === 'stats' && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="icon"><IconNews /></span>
                <h3>{news.length}</h3>
                <span>{t('admin', 'statTotalNews')}</span>
              </div>
              <div className="stat-card">
                <span className="icon"><IconVideo /></span>
                <h3>{reels.length}</h3>
                <span>{t('admin', 'statTotalVideos')}</span>
              </div>
              <div className="stat-card">
                <span className="icon"><IconEye /></span>
                <h3>{formatViews(totalViews)}</h3>
                <span>{t('admin', 'statTotalViews')}</span>
              </div>
              <div className="stat-card">
                <span className="icon"><IconHeart /></span>
                <h3>{formatViews(totalLikes)}</h3>
                <span>{t('admin', 'statTotalLikes')}</span>
              </div>
            </div>
            <p className="stats-note">{t('admin', 'statsNote')}</p>

            <div className="admin-panel">
              <h2><IconNews /> {t('admin', 'latestNews')}</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('admin', 'colTitle')}</th>
                      <th>{t('admin', 'colCategory')}</th>
                      <th>{t('admin', 'colDate')}</th>
                      <th>{t('admin', 'colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {news.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td><span className="badge badge-emerald">{item.category}</span></td>
                        <td>{formatDate(item.date)}</td>
                        <td><button className="delete-btn" onClick={() => requestDelete('news', item.id)}>{t('admin', 'delete')}</button></td>
                      </tr>
                    ))}
                    {news.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--gray-text)' }}>{t('admin', 'noNewsYet')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-panel">
              <h2><IconVideo /> {t('admin', 'latestVideos')}</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('admin', 'colTitle')}</th>
                      <th>{t('admin', 'colCategory')}</th>
                      <th>{t('admin', 'colViews')}</th>
                      <th>{t('admin', 'colLikes')}</th>
                      <th>{t('admin', 'colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reels.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td><span className="badge badge-crimson">{item.category}</span></td>
                        <td>{formatViews(item.views)}</td>
                        <td>{formatViews(item.likes)}</td>
                        <td><button className="delete-btn" onClick={() => requestDelete('reel', item.id)}>{t('admin', 'delete')}</button></td>
                      </tr>
                    ))}
                    {reels.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--gray-text)' }}>{t('admin', 'noVideosYet')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'addNews' && (
          <div className="admin-panel">
            <h2><IconNews /> {t('admin', 'addNewsTitle')}</h2>
            <form onSubmit={handleNewsSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('admin', 'newsTitleLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('admin', 'newsTitlePlaceholder')}
                    value={newsForm.title}
                    onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  />
                  {newsErrors.title && <p className="form-error">{newsErrors.title}</p>}
                </div>
                <div className="form-group">
                  <label>{t('admin', 'categoryLabel')}</label>
                  <select
                    value={newsForm.category}
                    onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                  >
                    {NEWS_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('admin', 'newsContentLabel')}</label>
                <textarea
                  placeholder={t('admin', 'newsContentPlaceholder')}
                  value={newsForm.content}
                  onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                />
                {newsErrors.content && <p className="form-error">{newsErrors.content}</p>}
              </div>
              <div className="form-group">
                <label>{t('admin', 'newsImageLabel')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNewsImageChange}
                />
                {uploading.newsImage && <p className="upload-status">{t('admin', 'uploading')}</p>}
                {newsErrors.image && <p className="form-error">{newsErrors.image}</p>}
                {newsForm.image && (
                  <div className="upload-preview">
                    <img src={newsForm.image} alt={t('admin', 'newsImageLabel')} className="upload-preview-thumb" />
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setNewsForm({ ...newsForm, image: '' })}
                    >
                      {t('admin', 'delete')}
                    </button>
                  </div>
                )}
              </div>
              <button type="submit" className="btn-submit">{t('admin', 'publishNews')}</button>
            </form>
          </div>
        )}

        {activeTab === 'addReel' && (
          <div className="admin-panel">
            <h2><IconVideo /> {t('admin', 'addVideoTitle')}</h2>
            <form onSubmit={handleReelSubmit}>
              <div className="form-group">
                <label>{t('admin', 'videoTitleLabel')}</label>
                <input
                  type="text"
                  placeholder={t('admin', 'videoTitlePlaceholder')}
                  value={reelForm.title}
                  onChange={(e) => setReelForm({ ...reelForm, title: e.target.value })}
                />
                {reelErrors.title && <p className="form-error">{reelErrors.title}</p>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('admin', 'videoUrlLabel')}</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleReelVideoChange}
                  />
                  {uploading.video && <p className="upload-status">{t('admin', 'uploading')}</p>}
                  <input
                    type="url"
                    className="video-link-input"
                    inputMode="url"
                    dir="ltr"
                    maxLength={2000}
                    placeholder={t('admin', 'videoLinkPlaceholder')}
                    value={videoLinkInput}
                    onChange={handleVideoLinkChange}
                    autoComplete="off"
                  />
                  <p className="form-hint">{t('admin', 'videoLinkHint')}</p>
                  {reelErrors.videoUrl && <p className="form-error">{reelErrors.videoUrl}</p>}
                  {reelForm.videoUrl && (
                    <div className="upload-preview">
                      {parseVideoSource(reelForm.videoUrl).kind === 'embed' ? (
                        <span className="upload-preview-filename">🔗 {parseVideoSource(reelForm.videoUrl).provider}</span>
                      ) : (
                        <video
                          src={reelForm.videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="upload-preview-video"
                        />
                      )}
                      {reelForm.videoFileName && <span className="upload-preview-filename">{reelForm.videoFileName}</span>}
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => setReelForm({ ...reelForm, videoUrl: '', videoFileName: '' })}
                      >
                        {t('admin', 'delete')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('admin', 'categoryLabel')}</label>
                  <select
                    value={reelForm.category}
                    onChange={(e) => setReelForm({ ...reelForm, category: e.target.value })}
                  >
                    {REEL_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('admin', 'posterLabel')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePosterImageChange}
                />
                {uploading.poster && <p className="upload-status">{t('admin', 'uploading')}</p>}
                {reelErrors.poster && <p className="form-error">{reelErrors.poster}</p>}
                {reelForm.poster && (
                  <div className="upload-preview">
                    <img
                      src={reelForm.poster}
                      alt={t('admin', 'posterLabel')}
                      className="upload-preview-thumb"
                    />
                    {reelForm.posterFileName && <span className="upload-preview-filename">{reelForm.posterFileName}</span>}
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setReelForm({ ...reelForm, poster: '', posterFileName: '' })}
                    >
                      {t('admin', 'delete')}
                    </button>
                  </div>
                )}
              </div>
              <button type="submit" className="btn-submit">{t('admin', 'publishVideo')}</button>
            </form>
          </div>
        )}

        {activeTab === 'addMatch' && (
          <>
            <div className="admin-panel">
              <h2><IconMatch /> {editingMatchId ? (t('admin', 'editMatchTitle') || t('admin', 'addMatchTitle')) : t('admin', 'addMatchTitle')}</h2>
              <form onSubmit={handleMatchSubmit}>
                <div className="form-group">
                  <label>{t('admin', 'matchTypeLabel')}</label>
                  <div className="match-type-toggle">
                    <button
                      type="button"
                      className={`match-type-btn ${matchForm.matchType === 'result' ? 'active' : ''}`}
                      onClick={() => setMatchForm({ ...matchForm, matchType: 'result' })}
                    >
                      {t('admin', 'matchTypeResult')}
                    </button>
                    <button
                      type="button"
                      className={`match-type-btn ${matchForm.matchType === 'upcoming' ? 'active' : ''}`}
                      onClick={() => setMatchForm({ ...matchForm, matchType: 'upcoming' })}
                    >
                      {t('admin', 'matchTypeUpcoming')}
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('admin', 'matchDivisionLabel')}</label>
                    <select
                      value={matchForm.divisionId}
                      onChange={(e) => setMatchForm({ ...matchForm, divisionId: e.target.value, groupId: '' })}
                    >
                      <option value="">—</option>
                      {ALGERIAN_DIVISIONS.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                    {matchErrors.division && <p className="form-error">{matchErrors.division}</p>}
                  </div>
                  <div className="form-group">
                    <label>{t('admin', 'matchGroupLabel')}</label>
                    <select
                      value={matchForm.groupId}
                      onChange={(e) => setMatchForm({ ...matchForm, groupId: e.target.value })}
                      disabled={!selectedDivision || selectedDivision.groups.length === 0}
                    >
                      <option value="">—</option>
                      {selectedDivision && selectedDivision.groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    {/* Round/matchday — free text with quick-pick
                        suggestions (الجولة 1..18, matching a typical FAVB
                        season calendar). The admin has total freedom to
                        pick one of these or type anything else (e.g. a
                        later round number, "نصف النهائي", ...). */}
                    <label>{t('admin', 'matchRoundLabel') || 'الجولة / المجموعة (اختياري)'}</label>
                    <input
                      type="text"
                      list="round-suggestions"
                      value={matchForm.round}
                      onChange={(e) => setMatchForm({ ...matchForm, round: e.target.value })}
                      placeholder={t('admin', 'matchRoundPlaceholder') || 'مثال: الجولة 1'}
                    />
                    <datalist id="round-suggestions">
                      {ROUND_SUGGESTIONS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('admin', 'matchHomeTeamLabel')}</label>
                    <input
                      type="text"
                      value={matchForm.homeTeam}
                      onChange={(e) => setMatchForm({ ...matchForm, homeTeam: e.target.value })}
                      placeholder={t('admin', 'matchHomeTeamLabel')}
                    />
                    <label style={{ marginTop: 10, display: 'block' }}>{t('admin', 'matchHomeTeamLogoLabel') || 'Team A crest (optional)'}</label>
                    <input type="file" accept="image/*" onChange={handleHomeTeamLogoChange} />
                    {uploading.homeLogo && <p className="upload-status">{t('admin', 'uploading')}</p>}
                    {matchErrors.homeTeamLogo && <p className="form-error">{matchErrors.homeTeamLogo}</p>}
                    {matchForm.homeTeam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        <TeamCrest name={matchForm.homeTeam} logoUrl={matchForm.homeTeamLogo} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>{matchForm.homeTeam}</span>
                        {matchForm.homeTeamLogo && (
                          <button type="button" className="delete-btn" onClick={() => setMatchForm({ ...matchForm, homeTeamLogo: '' })}>
                            {t('admin', 'delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>{t('admin', 'matchAwayTeamLabel')}</label>
                    <input
                      type="text"
                      value={matchForm.awayTeam}
                      onChange={(e) => setMatchForm({ ...matchForm, awayTeam: e.target.value })}
                      placeholder={t('admin', 'matchAwayTeamLabel')}
                    />
                    <label style={{ marginTop: 10, display: 'block' }}>{t('admin', 'matchAwayTeamLogoLabel') || 'Team B crest (optional)'}</label>
                    <input type="file" accept="image/*" onChange={handleAwayTeamLogoChange} />
                    {uploading.awayLogo && <p className="upload-status">{t('admin', 'uploading')}</p>}
                    {matchErrors.awayTeamLogo && <p className="form-error">{matchErrors.awayTeamLogo}</p>}
                    {matchForm.awayTeam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        <TeamCrest name={matchForm.awayTeam} logoUrl={matchForm.awayTeamLogo} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>{matchForm.awayTeam}</span>
                        {matchForm.awayTeamLogo && (
                          <button type="button" className="delete-btn" onClick={() => setMatchForm({ ...matchForm, awayTeamLogo: '' })}>
                            {t('admin', 'delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {matchErrors.teams && <p className="form-error">{matchErrors.teams}</p>}

                {matchForm.matchType === 'result' && (
                  <div className="form-group">
                    <label>{t('admin', 'matchSetsLabel')}</label>
                    <div className="match-sets-grid">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div className="match-set-row" key={n}>
                          <span className="match-set-label">
                            {t('admin', 'matchSetName')} {n}
                            {n > 3 && <em className="match-set-optional">({t('admin', 'matchSetOptional')})</em>}
                          </span>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="25"
                            value={matchForm[`set${n}Home`]}
                            onChange={(e) => setMatchForm({ ...matchForm, [`set${n}Home`]: e.target.value })}
                          />
                          <span className="match-set-dash">–</span>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="20"
                            value={matchForm[`set${n}Away`]}
                            onChange={(e) => setMatchForm({ ...matchForm, [`set${n}Away`]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    {matchErrors.score && <p className="form-error">{matchErrors.score}</p>}
                  </div>
                )}

                <div className="form-row">
                  {matchForm.matchType === 'upcoming' && (
                    <div className="form-group">
                      <label>{t('admin', 'matchTimeLabel')}</label>
                      <input
                        type="time"
                        value={matchForm.time}
                        onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>
                      {t('admin', 'matchDateLabel')}
                      {' '}
                      <em style={{ fontWeight: 400, fontSize: '0.78em', color: 'var(--gray-text)' }}>
                        ({t('admin', 'matchDateOptionalNote') || 'اختياري — يمكن تركه فارغاً وتعديله لاحقاً'})
                      </em>
                    </label>
                    <input
                      type="date"
                      value={matchForm.date}
                      onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-submit">
                    {editingMatchId ? (t('admin', 'saveChanges') || t('admin', 'publishMatch')) : t('admin', 'publishMatch')}
                  </button>
                  {editingMatchId && (
                    <button type="button" className="delete-btn" onClick={cancelEditMatch}>
                      {t('admin', 'cancel') || '—'}
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="admin-panel">
              <h2><IconMatch /> {t('admin', 'latestMatches')}</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('admin', 'colDivision')}</th>
                      <th>{t('admin', 'colRound') || 'الجولة'}</th>
                      <th>{t('admin', 'colTeams')}</th>
                      <th>{t('admin', 'colScore')}</th>
                      <th>{t('admin', 'colDate')}</th>
                      <th>{t('admin', 'colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeMatches.map((m) => (
                      <tr key={m.id}>
                        <td>{m.divisionLabel || '—'}{m.groupLabel ? ` — ${m.groupLabel}` : ''}</td>
                        <td>{m.round || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <TeamCrest name={m.homeTeam} size={28} logoUrl={m.homeTeamLogo} />
                            <span>{m.homeTeam}</span>
                            <span style={{ color: 'var(--gray-text)' }}>vs</span>
                            <TeamCrest name={m.awayTeam} size={28} logoUrl={m.awayTeamLogo} />
                            <span>{m.awayTeam}</span>
                          </div>
                        </td>
                        <td>
                          {m.score ? (
                            <div>
                              <div>{m.score}</div>
                              {Array.isArray(m.setScores) && m.setScores.length > 0 && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-text)' }}>
                                  {m.setScores.map(([h, a]) => `${h}-${a}`).join(' · ')}
                                </div>
                              )}
                            </div>
                          ) : (m.time ? `${t('admin', 'matchTypeUpcoming')} · ${m.time}` : '—')}
                        </td>
                        <td>{formatDate(m.date)}</td>
                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="delete-btn"
                            style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
                            onClick={() => startEditMatch(m)}
                          >
                            {t('admin', 'edit') || 'تعديل'}
                          </button>
                          <button className="delete-btn" onClick={() => requestDelete('match', m.id)}>{t('admin', 'delete')}</button>
                        </td>
                      </tr>
                    ))}
                    {safeMatches.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--gray-text)' }}>{t('admin', 'noMatchesYet')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div className="admin-panel">
            <h2><IconSettings /> {t('admin', 'settingsTitle')}</h2>
            <p className="settings-panel-sub">{t('admin', 'settingsSubtitle')}</p>
            {credentials?.username && (
              <p className="settings-current-username">
                {t('admin', 'currentUsernameNote')}: <strong style={{ color: 'var(--white)' }}>{credentials.username}</strong>
              </p>
            )}
            <form onSubmit={handleSettingsSubmit}>
              <div className="form-group">
                <label>{t('admin', 'currentPasswordLabel')}</label>
                <div className="password-input-wrap">
                  <input
                    type={visiblePasswords.current ? 'text' : 'password'}
                    autoComplete="off"
                    value={settingsForm.currentPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => togglePasswordVisibility('current')}
                    aria-label={visiblePasswords.current ? t('login', 'hidePassword') : t('login', 'showPassword')}
                    title={visiblePasswords.current ? t('login', 'hidePassword') : t('login', 'showPassword')}
                    tabIndex={-1}
                  >
                    {visiblePasswords.current ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('admin', 'newUsernameLabel')}</label>
                  <input
                    type="text"
                    inputMode="email"
                    placeholder={t('admin', 'newUsernameLabel')}
                    autoComplete="off"
                    value={settingsForm.newUsername}
                    onChange={(e) => setSettingsForm({ ...settingsForm, newUsername: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin', 'newPasswordLabel')}</label>
                  <div className="password-input-wrap">
                    <input
                      type={visiblePasswords.new ? 'text' : 'password'}
                      autoComplete="off"
                      value={settingsForm.newPassword}
                      onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => togglePasswordVisibility('new')}
                      aria-label={visiblePasswords.new ? t('login', 'hidePassword') : t('login', 'showPassword')}
                      title={visiblePasswords.new ? t('login', 'hidePassword') : t('login', 'showPassword')}
                      tabIndex={-1}
                    >
                      {visiblePasswords.new ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>{t('admin', 'confirmNewPasswordLabel')}</label>
                <div className="password-input-wrap">
                  <input
                    type={visiblePasswords.confirm ? 'text' : 'password'}
                    autoComplete="off"
                    value={settingsForm.confirmNewPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, confirmNewPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => togglePasswordVisibility('confirm')}
                    aria-label={visiblePasswords.confirm ? t('login', 'hidePassword') : t('login', 'showPassword')}
                    title={visiblePasswords.confirm ? t('login', 'hidePassword') : t('login', 'showPassword')}
                    tabIndex={-1}
                  >
                    {visiblePasswords.confirm ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              {settingsError && <p className="form-error">{settingsError}</p>}
              <button type="submit" className="btn-submit">{t('admin', 'saveSettings')}</button>
            </form>
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      {pendingDelete && (
        <ConfirmModal
          message={t('admin', 'confirmDeleteMessage')}
          confirmLabel={t('admin', 'confirmYes')}
          cancelLabel={t('admin', 'confirmCancel')}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}
