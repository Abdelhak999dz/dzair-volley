import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// UI-chrome languages (nav, hero, section headers, ...) — these have a
// full hand-written entry in the `translations` table below. Any other
// language a visitor picks from the switcher still works for all of
// this (falls back to Arabic for the chrome, see `translate()` below)
// AND gets real, live-translated dynamic content (news/reels/etc, see
// hooks/useLiveTranslate.js) — that part is not limited to this list.
const CORE_UI_LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇩🇿', dir: 'rtl', locale: 'ar-DZ' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr', locale: 'en-GB' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr', locale: 'fr-FR' },
];

// Broad set of additional world languages selectable from the language
// switcher. Their site-chrome labels fall back to Arabic (see
// `translate()`), but every visitor-facing dynamic piece of content
// (news, articles, titles, reel captions, ...) is live-translated into
// these too via the real translation API in services/translationService.js
// — nothing here is fake/placeholder text, it's just the switcher's
// selectable language list. RTL languages get dir: 'rtl' automatically.
const RTL_CODES = new Set(['ar', 'he', 'fa', 'ur']);
const EXTRA_LANGUAGES_RAW = [
  ['es', 'Español', '🇪🇸', 'es-ES'],
  ['de', 'Deutsch', '🇩🇪', 'de-DE'],
  ['it', 'Italiano', '🇮🇹', 'it-IT'],
  ['pt', 'Português', '🇵🇹', 'pt-PT'],
  ['ru', 'Русский', '🇷🇺', 'ru-RU'],
  ['tr', 'Türkçe', '🇹🇷', 'tr-TR'],
  ['zh-CN', '中文', '🇨🇳', 'zh-CN'],
  ['ja', '日本語', '🇯🇵', 'ja-JP'],
  ['ko', '한국어', '🇰🇷', 'ko-KR'],
  ['hi', 'हिन्दी', '🇮🇳', 'hi-IN'],
  ['ur', 'اردو', '🇵🇰', 'ur-PK'],
  ['fa', 'فارسی', '🇮🇷', 'fa-IR'],
  ['he', 'עברית', '🇮🇱', 'he-IL'],
  ['nl', 'Nederlands', '🇳🇱', 'nl-NL'],
  ['sv', 'Svenska', '🇸🇪', 'sv-SE'],
  ['no', 'Norsk', '🇳🇴', 'nb-NO'],
  ['da', 'Dansk', '🇩🇰', 'da-DK'],
  ['fi', 'Suomi', '🇫🇮', 'fi-FI'],
  ['pl', 'Polski', '🇵🇱', 'pl-PL'],
  ['ro', 'Română', '🇷🇴', 'ro-RO'],
  ['el', 'Ελληνικά', '🇬🇷', 'el-GR'],
  ['cs', 'Čeština', '🇨🇿', 'cs-CZ'],
  ['uk', 'Українська', '🇺🇦', 'uk-UA'],
  ['id', 'Bahasa Indonesia', '🇮🇩', 'id-ID'],
  ['ms', 'Bahasa Melayu', '🇲🇾', 'ms-MY'],
  ['th', 'ไทย', '🇹🇭', 'th-TH'],
  ['vi', 'Tiếng Việt', '🇻🇳', 'vi-VN'],
  ['sw', 'Kiswahili', '🇰🇪', 'sw-KE'],
  ['am', 'አማርኛ', '🇪🇹', 'am-ET'],
  ['ha', 'Hausa', '🇳🇬', 'ha-NG'],
];
const EXTRA_LANGUAGES = EXTRA_LANGUAGES_RAW.map(([code, label, flag, locale]) => ({
  code,
  label,
  flag,
  locale,
  dir: RTL_CODES.has(code) ? 'rtl' : 'ltr',
}));

export const LANGUAGES = [...CORE_UI_LANGUAGES, ...EXTRA_LANGUAGES];

const STORAGE_KEY = 'dzair-volley-lang';

// Core site UI strings — nav, hero, section headers, footer, login modal,
// and the admin sidebar. Dynamic content (real news/results/reels seed
// data) intentionally stays in Arabic, since that is real sourced content
// rather than interface chrome.
const translations = {
  // Shared, cross-section UI strings — used by every "show more / show
  // less" toggle (Live Results, Match Schedules, Algerian Matches,
  // Videos/Reels, News) so all five sections stay perfectly unified.
  common: {
    showAll: { ar: 'عرض الكل', en: 'Show All', fr: 'Tout afficher' },
    showLess: { ar: 'عرض أقل', en: 'Show Less', fr: 'Afficher moins' },
  },
  nav: {
    home: { ar: 'الرئيسية', en: 'Home', fr: 'Accueil' },
    news: { ar: 'الأخبار', en: 'News', fr: 'Actualités' },
    videos: { ar: 'الفيديوهات', en: 'Videos', fr: 'Vidéos' },
    liveResults: { ar: 'النتائج المباشرة', en: 'Live Results', fr: 'Résultats en direct' },
    matches: { ar: 'المباريات', en: 'Matches', fr: 'Matchs' },
    algerianMatches: { ar: 'البطولة الجزائرية', en: 'Algerian Championship', fr: 'Championnat algérien' },
    adminLogin: { ar: 'دخول الإدارة', en: 'Admin Login', fr: 'Connexion Admin' },
    adminDashboard: { ar: 'لوحة التحكم', en: 'Dashboard', fr: 'Tableau de bord' },
  },
  hero: {
    tagline: {
      ar: 'منصتك الأولى لمتابعة كرة الطائرة العالمية — نتائج مباشرة، مواعيد رسمية، أخبار حصرية وأفضل اللحظات من دوري الأمم، الألعاب الأولمبية، وبطولات العالم والقارات',
      en: 'Your #1 platform for global volleyball — live results, official schedules, exclusive news, and the best moments from the Nations League, the Olympics, and world & continental championships',
      fr: "Votre plateforme n°1 pour le volley-ball mondial — résultats en direct, calendriers officiels, actualités exclusives et les meilleurs moments de la Ligue des Nations, des Jeux Olympiques et des championnats mondiaux et continentaux",
    },
    btnLive: { ar: 'النتائج المباشرة', en: 'Live Results', fr: 'Résultats en direct' },
    btnSchedule: { ar: 'المباريات', en: 'Matches', fr: 'Matchs' },
    statTeams: { ar: 'منتخب عالمي', en: 'National Teams', fr: 'Équipes nationales' },
    statNews: { ar: 'خبر', en: 'Global News', fr: 'Actualités' },
    statVideos: { ar: 'فيديو', en: 'Exclusive Videos', fr: 'Vidéos exclusives' },
    statFounded: { ar: 'تأسيس FIVB', en: 'FIVB Founded', fr: 'Fondation FIVB' },
    statLiveResults: { ar: 'نتيجة حقيقية اليوم', en: 'Real Results Today', fr: "Résultats réels aujourd'hui" },
    statUpcoming: { ar: 'مباراة قادمة', en: 'Upcoming Matches', fr: 'Matchs à venir' },
  },
  liveResults: {
    title: { ar: 'النتائج المباشرة', en: 'Live Results', fr: 'Résultats en direct' },
    subtitle: {
      ar: 'تابع نتائج مباريات الكرة الطائرة الدولية والقارية والدوريات المحترفة أولاً بأول بنتائج الأشواط كاملة',
      en: 'Follow international, continental, and professional league volleyball results first, with full set-by-set scores',
      fr: 'Suivez en premier les résultats du volley-ball international, continental et des ligues professionnelles, avec le score complet de chaque set',
    },
    tabInternational: { ar: '🌍 دولية', en: '🌍 International', fr: '🌍 International' },
    tabContinental: { ar: '🏆 قارية', en: '🏆 Continental', fr: '🏆 Continental' },
    tabLeagues: { ar: '🎽 دوريات', en: '🎽 Leagues', fr: '🎽 Ligues' },
    tabAll: { ar: 'الكل', en: 'All', fr: 'Tout' },
    liveNow: { ar: 'مباشر الآن', en: 'Live now', fr: 'En direct' },
    finished: { ar: 'انتهت المباراة', en: 'Match finished', fr: 'Match terminé' },
    finalScoreLabel: { ar: 'النتيجة النهائية للأشواط', en: 'Final set score', fr: 'Score final des sets' },
    setPrefix: { ar: 'ش', en: 'S', fr: 'S' },
    noResults: { ar: 'لا توجد نتائج متاحة حالياً في هذا القسم', en: 'No results available in this section yet', fr: "Aucun résultat disponible dans cette section" },
    notConfiguredTitle: { ar: 'لم يتم إعداد مصدر البيانات المباشر بعد', en: 'Live data source not configured yet', fr: "La source de données en direct n'est pas encore configurée" },
    notConfiguredBody: {
      ar: 'هذا القسم يعرض نتائج حقيقية فقط — بدون بيانات وهمية. لتفعيله، أضف مفتاح API مجاني في ملف .env (راجع ملف README لخطوات الإعداد الكاملة).',
      en: 'This section shows only real results — no mock data. To enable it, add a free API key to your .env file (see README.md for full setup steps).',
      fr: 'Cette section affiche uniquement des résultats réels — aucune donnée fictive. Pour l’activer, ajoutez une clé API gratuite dans votre fichier .env (voir README.md).',
    },
    errorTitle: { ar: 'تعذر تحميل النتائج حالياً', en: 'Could not load results right now', fr: "Impossible de charger les résultats pour le moment" },
    retry: { ar: 'إعادة المحاولة', en: 'Retry', fr: 'Réessayer' },
    loading: { ar: 'جارٍ تحميل النتائج المباشرة…', en: 'Loading live results…', fr: 'Chargement des résultats en direct…' },
    rateLimitedTitle: { ar: 'الخدمة مزدحمة مؤقتاً', en: 'Service temporarily busy', fr: 'Service temporairement occupé' },
    rateLimitedBody: {
      ar: 'وصلنا للحد الأقصى المسموح به من طلبات مصدر البيانات المباشر مؤقتاً. لم نعرض أي نتائج وهمية — فقط انتظر بضع دقائق ثم أعد المحاولة.',
      en: "We've temporarily hit the live data source's request limit. No placeholder results are shown — just wait a few minutes and try again.",
      fr: "Nous avons temporairement atteint la limite de requêtes de la source de données en direct. Aucun résultat fictif n'est affiché — réessayez dans quelques minutes.",
    },
    staleNotice: { ar: 'بيانات محفوظة مؤقتاً — قد لا تكون الأحدث', en: 'Showing cached data — may not be the latest', fr: 'Données mises en cache — peut ne pas être la plus récente' },
  },
  schedules: {
    title: { ar: 'المباريات القادمة', en: 'Upcoming Matches', fr: 'Matchs à venir' },
    subtitle: {
      ar: 'جدول المباريات الدولية والقارية الرسمية القادمة مع عد تنازلي مباشر لكل موعد',
      en: 'The official upcoming international and continental fixtures, with a live countdown to each match',
      fr: 'Le calendrier officiel des prochains matchs internationaux et continentaux, avec un compte à rebours en direct',
    },
    days: { ar: 'يوم', en: 'Days', fr: 'Jours' },
    hours: { ar: 'ساعة', en: 'Hours', fr: 'Heures' },
    minutes: { ar: 'دقيقة', en: 'Min', fr: 'Min' },
    seconds: { ar: 'ثانية', en: 'Sec', fr: 'Sec' },
    live: { ar: 'جارية', en: 'Live', fr: 'En cours' },
    noSchedules: { ar: 'لا توجد مواعيد قادمة حالياً', en: 'No upcoming matches yet', fr: 'Aucun match à venir pour le moment' },
    notConfiguredTitle: { ar: 'لم يتم إعداد مصدر البيانات المباشر بعد', en: 'Live data source not configured yet', fr: "La source de données en direct n'est pas encore configurée" },
    notConfiguredBody: {
      ar: 'هذا القسم يعرض مباريات حقيقية قادمة فقط — بدون بيانات وهمية. لتفعيله، أضف مفتاح API مجاني في ملف .env (راجع ملف README لخطوات الإعداد الكاملة).',
      en: 'This section shows only real upcoming matches — no mock data. To enable it, add a free API key to your .env file (see README.md for full setup steps).',
      fr: "Cette section affiche uniquement de vrais matchs à venir — aucune donnée fictive. Pour l'activer, ajoutez une clé API gratuite dans votre fichier .env (voir README.md).",
    },
    errorTitle: { ar: 'تعذر تحميل المواعيد حالياً', en: 'Could not load the schedule right now', fr: "Impossible de charger le calendrier pour le moment" },
    retry: { ar: 'إعادة المحاولة', en: 'Retry', fr: 'Réessayer' },
    loading: { ar: 'جارٍ تحميل المواعيد القادمة…', en: 'Loading upcoming matches…', fr: 'Chargement des matchs à venir…' },
    rateLimitedTitle: { ar: 'الخدمة مزدحمة مؤقتاً', en: 'Service temporarily busy', fr: 'Service temporairement occupé' },
    rateLimitedBody: {
      ar: 'وصلنا للحد الأقصى المسموح به من طلبات مصدر البيانات المباشر مؤقتاً. لم نعرض أي مواعيد وهمية — فقط انتظر بضع دقائق ثم أعد المحاولة.',
      en: "We've temporarily hit the live data source's request limit. No placeholder schedule is shown — just wait a few minutes and try again.",
      fr: "Nous avons temporairement atteint la limite de requêtes de la source de données en direct. Aucun calendrier fictif n'est affiché — réessayez dans quelques minutes.",
    },
    staleNotice: { ar: 'بيانات محفوظة مؤقتاً — قد لا تكون الأحدث', en: 'Showing cached data — may not be the latest', fr: 'Données mises en cache — peut ne pas être la plus récente' },
  },
  reels: {
    title: { ar: 'الفيديوهات', en: 'Videos', fr: 'Vidéos' },
    subtitle: {
      ar: 'مقاطع فيديو حقيقية وقابلة للتشغيل من عالم الكرة الطائرة — اضغط على أي مقطع لتشغيله',
      en: 'Real, playable video clips from the world of volleyball — tap any clip to play it',
      fr: 'Des vidéos réelles et lisibles issues du monde du volley-ball — appuyez sur un clip pour le lancer',
    },
    share: { ar: 'مشاركة', en: 'Share', fr: 'Partager' },
    shareCopied: { ar: 'تم نسخ رابط المشاركة: ', en: 'Share link copied: ', fr: 'Lien de partage copié : ' },
    play: { ar: 'تشغيل', en: 'Play', fr: 'Lecture' },
    comment: { ar: 'تعليق', en: 'Comment', fr: 'Commentaire' },
    unavailable: { ar: 'تعذّر تشغيل هذا الفيديو في متصفحك', en: "This video can't be played in your browser", fr: "Cette vidéo ne peut pas être lue dans votre navigateur" },
    openVideo: { ar: 'فتح الفيديو في نافذة جديدة', en: 'Open video in a new tab', fr: 'Ouvrir la vidéo dans un nouvel onglet' },
    close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer' },
  },
  news: {
    title: { ar: 'الأخبار', en: 'News', fr: 'Actualités' },
    subtitle: {
      ar: 'كل ما يخص المنتخبات العالمية والبطولات الكبرى أولاً بأول',
      en: 'Everything about national teams and major championships, first',
      fr: "Tout sur les équipes nationales et les grands championnats, en premier",
    },
    readMore: { ar: 'اقرأ المزيد ←', en: 'Read more →', fr: 'Lire plus →' },
    noNews: { ar: 'لا توجد أخبار متاحة حالياً', en: 'No news available yet', fr: "Aucune actualité disponible" },
    like: { ar: 'إعجاب', en: 'Like', fr: "J'aime" },
    comment: { ar: 'تعليق', en: 'Comment', fr: 'Commentaire' },
    share: { ar: 'مشاركة', en: 'Share', fr: 'Partager' },
    shareCopied: { ar: 'تم نسخ رابط المشاركة: ', en: 'Share link copied: ', fr: 'Lien de partage copié : ' },
  },
  engagement: {
    commentsTitle: { ar: 'التعليقات', en: 'Comments', fr: 'Commentaires' },
    commentPlaceholder: { ar: 'اكتب تعليقك هنا…', en: 'Write your comment…', fr: 'Écrivez votre commentaire…' },
    commentSubmit: { ar: 'نشر', en: 'Post', fr: 'Publier' },
    commentsEmpty: { ar: 'لا توجد تعليقات بعد — كن أول من يعلّق', en: 'No comments yet — be the first to comment', fr: 'Aucun commentaire — soyez le premier à commenter' },
    commentEmptyError: { ar: 'اكتب شيئاً قبل النشر', en: 'Write something before posting', fr: "Écrivez quelque chose avant de publier" },
    commentEdit: { ar: 'تعديل', en: 'Edit', fr: 'Modifier' },
    commentDelete: { ar: 'حذف', en: 'Delete', fr: 'Supprimer' },
    commentSave: { ar: 'حفظ', en: 'Save', fr: 'Enregistrer' },
    commentCancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler' },
    commentEditedTag: { ar: 'معدّل', en: 'edited', fr: 'modifié' },
    commentDeleteConfirm: { ar: 'حذف هذا التعليق؟', en: 'Delete this comment?', fr: 'Supprimer ce commentaire ?' },
    shareTitle: { ar: 'مشاركة', en: 'Share', fr: 'Partager' },
    shareWhatsapp: { ar: 'واتساب', en: 'WhatsApp', fr: 'WhatsApp' },
    shareFacebook: { ar: 'فيسبوك', en: 'Facebook', fr: 'Facebook' },
    shareX: { ar: 'X (تويتر)', en: 'X (Twitter)', fr: 'X (Twitter)' },
    shareCopyLink: { ar: 'نسخ الرابط', en: 'Copy link', fr: 'Copier le lien' },
    shareLinkCopied: { ar: 'تم نسخ الرابط!', en: 'Link copied!', fr: 'Lien copié !' },
    shareNative: { ar: 'مشاركة عبر التطبيقات', en: 'Share via apps', fr: 'Partager via des applis' },
    close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer' },
  },
  social: {
    email: { ar: 'البريد الإلكتروني', en: 'Email', fr: 'E-mail' },
    facebook: { ar: 'فيسبوك', en: 'Facebook', fr: 'Facebook' },
    instagram: { ar: 'إنستغرام', en: 'Instagram', fr: 'Instagram' },
    tiktok: { ar: 'تيك توك', en: 'TikTok', fr: 'TikTok' },
    youtube: { ar: 'يوتيوب', en: 'YouTube', fr: 'YouTube' },
    x: { ar: 'إكس (تويتر)', en: 'X (Twitter)', fr: 'X (Twitter)' },
    telegram: { ar: 'تيليجرام', en: 'Telegram', fr: 'Telegram' },
  },
  algerianMatches: {
    title: { ar: 'البطولة الجزائرية', en: 'Algerian Championship', fr: 'Championnat algérien' },
    subtitle: {
      ar: 'آخر نتائج المباريات ومواعيد اللقاءات القادمة عبر الولايات الجزائرية',
      en: 'Latest match results and upcoming fixtures across Algerian wilayas',
      fr: 'Derniers résultats et prochains matchs à travers les wilayas algériennes',
    },
    resultsTitle: { ar: 'نتائج المباريات', en: 'Match Results', fr: 'Résultats des matchs' },
    fixturesTitle: { ar: 'المباريات القادمة', en: 'Upcoming Fixtures', fr: 'Matchs à venir' },
    noResults: { ar: 'لا توجد نتائج بعد', en: 'No results yet', fr: 'Aucun résultat pour le moment' },
    noFixtures: { ar: 'لا توجد مباريات قادمة بعد', en: 'No upcoming fixtures yet', fr: 'Aucun match à venir pour le moment' },
    vsLabel: { ar: 'ضد', en: 'vs', fr: 'vs' },
    finalScore: { ar: 'النتيجة النهائية', en: 'Final Score', fr: 'Score final' },
    upcoming: { ar: 'قادمة', en: 'Upcoming', fr: 'À venir' },
    standingsTitle: { ar: 'جدول الترتيب', en: 'Standings', fr: 'Classement' },
    standingsHint: {
      ar: 'اختر قسماً (ومجموعة إن وُجدت) من الأعلى لعرض جدول ترتيبه',
      en: 'Pick a division (and group, if any) above to see its table',
      fr: 'Choisissez une division (et un groupe le cas échéant) ci-dessus pour voir son classement',
    },
    standingsEmpty: { ar: 'لا توجد نتائج كافية لبناء جدول الترتيب بعد', en: 'Not enough results yet to build a table', fr: 'Pas assez de résultats pour établir un classement' },
    colRank: { ar: 'الترتيب', en: 'Rank', fr: 'Rang' },
    colTeam: { ar: 'الفريق / النادي', en: 'Club', fr: 'Club' },
    colPlayed: { ar: 'لعب', en: 'P', fr: 'J' },
    colWins: { ar: 'فوز', en: 'W', fr: 'G' },
    colLosses: { ar: 'خسارة', en: 'L', fr: 'P' },
    colSets: { ar: 'الأشواط', en: 'Sets', fr: 'Sets' },
    colSetRatio: { ar: 'معامل الأشواط', en: 'Set Ratio', fr: 'Ratio sets' },
    colPointRatio: { ar: 'معامل النقاط', en: 'Point Ratio', fr: 'Ratio points' },
    colPoints: { ar: 'النقاط', en: 'Pts', fr: 'Pts' },
    colSetsFor: { ar: 'الأشواط له', en: 'Sets For', fr: 'Sets P.' },
    colSetsAgainst: { ar: 'الأشواط عليه', en: 'Sets Against', fr: 'Sets C.' },
    colSetCoeff: { ar: 'معامل الأشواط', en: 'Set Coeff.', fr: 'Coeff. sets' },
    colPointsFor: { ar: 'النقاط له', en: 'Points For', fr: 'Pts P.' },
    colPointsAgainst: { ar: 'النقاط عليه', en: 'Points Against', fr: 'Pts C.' },
    colPointCoeff: { ar: 'معامل النقاط', en: 'Point Coeff.', fr: 'Coeff. pts' },
    setLabel1: { ar: 'الشوط الأول', en: 'Set 1', fr: '1er set' },
    setLabel2: { ar: 'الشوط الثاني', en: 'Set 2', fr: '2e set' },
    setLabel3: { ar: 'الشوط الثالث', en: 'Set 3', fr: '3e set' },
    setLabel4: { ar: 'الشوط الرابع', en: 'Set 4', fr: '4e set' },
    setLabel5: { ar: 'الشوط الخامس', en: 'Set 5', fr: '5e set' },
    crestUpload: { ar: 'إضافة/تغيير شعار القسم', en: 'Add/change section crest', fr: 'Ajouter/changer le blason de la section' },
    crestUploadFromDevice: { ar: 'رفع من المعرض', en: 'Upload from device', fr: "Téléverser depuis l'appareil" },
    crestOrUrl: { ar: 'أو عبر رابط صورة', en: 'or via image URL', fr: "ou via une URL d'image" },
    crestUrlPlaceholder: { ar: 'الصق رابط الصورة هنا', en: 'Paste image URL here', fr: "Collez l'URL de l'image ici" },
    crestUrlSave: { ar: 'حفظ', en: 'Save', fr: 'Enregistrer' },
    crestRemove: { ar: 'إزالة الشعار', en: 'Remove crest', fr: 'Retirer le blason' },
  },
  footer: {
    fivb: { ar: 'FIVB', en: 'FIVB', fr: 'FIVB' },
    olympics: { ar: 'الألعاب الأولمبية', en: 'Olympic Games', fr: 'Jeux Olympiques' },
    worldChamp: { ar: 'بطولة العالم', en: 'World Championship', fr: 'Championnat du monde' },
    nationsLeague: { ar: 'دوري الأمم', en: 'Nations League', fr: 'Ligue des Nations' },
    developerContact: { ar: 'تواصل مع المطوّر', en: 'Developer Contact', fr: 'Contact développeur' },
    developedBy: {
      ar: 'تصميم و تطوير V0RT3X',
      en: 'Designed & Developed by V0RT3X',
      fr: 'Conçu et développé par V0RT3X',
    },
    developerTagline: {
      ar: 'هندسة برمجية متكاملة — واجهات، أداء، وتجربة استخدام من طراز رفيع',
      en: 'Full-stack engineering — sleek interfaces, performance, elite UX',
      fr: 'Ingénierie full-stack — interfaces élégantes, performance, UX de haut niveau',
    },
    copyright: {
      ar: '© 2026 Dzair Volley — جميع الحقوق محفوظة لدى V0RT3X',
      en: '© 2026 Dzair Volley — All rights reserved to V0RT3X',
      fr: '© 2026 Dzair Volley — Tous droits réservés à V0RT3X',
    },
    visitorsLive: { ar: 'زوار الموقع الآن', en: 'Live Site Visitors', fr: 'Visiteurs en ligne' },
    rateUs: { ar: 'قيّم الموقع', en: 'Rate this site', fr: 'Notez ce site' },
    rateThanks: { ar: 'شكراً على تقييمك!', en: 'Thanks for rating!', fr: 'Merci pour votre note !' },
  },
  login: {
    title: { ar: 'الدخول للوحة التحكم', en: 'Dashboard Login', fr: 'Connexion au tableau de bord' },
    subtitle: { ar: 'أدخل بيانات الدخول للوصول إلى لوحة التحكم', en: 'Enter your credentials to access the dashboard', fr: "Entrez vos identifiants pour accéder au tableau de bord" },
    username: { ar: 'البريد الإلكتروني', en: 'Email Address', fr: "Adresse e-mail" },
    password: { ar: 'كلمة المرور', en: 'Password', fr: 'Mot de passe' },
    submit: { ar: 'دخول', en: 'Log in', fr: 'Connexion' },
    errorRequired: { ar: 'يرجى إدخال البريد الإلكتروني وكلمة المرور', en: 'Please enter your email address and password', fr: 'Veuillez saisir votre adresse e-mail et mot de passe' },
    errorInvalid: { ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', en: 'Incorrect email address or password', fr: 'Adresse e-mail ou mot de passe incorrect' },
    errorTooManyAttempts: { ar: 'محاولات كثيرة جداً. حاول مجدداً بعد', en: 'Too many attempts. Try again in', fr: 'Trop de tentatives. Réessayez dans' },
    secondsShort: { ar: 'ث', en: 's', fr: 's' },
    showPassword: { ar: 'إظهار كلمة المرور', en: 'Show password', fr: 'Afficher le mot de passe' },
    hidePassword: { ar: 'إخفاء كلمة المرور', en: 'Hide password', fr: 'Masquer le mot de passe' },
  },
  admin: {
    tagline: { ar: 'ADMIN PANEL', en: 'ADMIN PANEL', fr: 'ADMIN PANEL' },
    dashboardTitle: { ar: 'لوحة التحكم', en: 'Dashboard', fr: 'Tableau de bord' },
    welcome: { ar: 'مرحباً بك في لوحة تحكم Dzair Volley', en: 'Welcome to the Dzair Volley dashboard', fr: 'Bienvenue sur le tableau de bord Dzair Volley' },
    backToSite: { ar: 'العودة للموقع', en: 'Back to site', fr: 'Retour au site' },
    logout: { ar: 'تسجيل الخروج', en: 'Log out', fr: 'Déconnexion' },
    sidebarStats: { ar: 'إحصائيات', en: 'Statistics', fr: 'Statistiques' },
    sidebarAddNews: { ar: 'إضافة خبر', en: 'Add News', fr: 'Ajouter une actualité' },
    sidebarAddReel: { ar: 'إضافة فيديو', en: 'Add Video', fr: 'Ajouter une vidéo' },
    sidebarAddResult: { ar: 'إضافة نتيجة مباراة', en: 'Add Match Result', fr: 'Ajouter un résultat' },
    sidebarSettings: { ar: 'إعدادات الحساب', en: 'Account Settings', fr: 'Paramètres du compte' },
    statTotalNews: { ar: 'إجمالي الأخبار', en: 'Total News', fr: 'Total actualités' },
    statTotalVideos: { ar: 'إجمالي الفيديوهات', en: 'Total Videos', fr: 'Total vidéos' },
    statTotalViews: { ar: 'إجمالي المشاهدات', en: 'Total Views', fr: 'Total des vues' },
    statTotalLikes: { ar: 'إجمالي الإعجابات', en: 'Total Likes', fr: "Total des mentions J'aime" },
    statsNote: {
      ar: 'هذه الأرقام محسوبة مباشرة من تفاعل الزوار الحقيقيين المخزّن في هذا المتصفح — تبدأ من صفر وتزيد تلقائياً مع كل إعجاب ومشاهدة جديدة.',
      en: 'These numbers are computed live from real visitor interactions stored in this browser — they start at zero and grow automatically with every new like and view.',
      fr: 'Ces chiffres sont calculés en direct à partir des interactions réelles des visiteurs stockées dans ce navigateur — ils partent de zéro et augmentent automatiquement.',
    },
    latestNews: { ar: 'آخر الأخبار المنشورة', en: 'Latest Published News', fr: 'Dernières actualités publiées' },
    latestVideos: { ar: 'آخر الفيديوهات المنشورة', en: 'Latest Published Videos', fr: 'Dernières vidéos publiées' },
    colTitle: { ar: 'العنوان', en: 'Title', fr: 'Titre' },
    colCategory: { ar: 'التصنيف', en: 'Category', fr: 'Catégorie' },
    colDate: { ar: 'التاريخ', en: 'Date', fr: 'Date' },
    colAction: { ar: 'إجراء', en: 'Action', fr: 'Action' },
    colViews: { ar: 'المشاهدات', en: 'Views', fr: 'Vues' },
    colLikes: { ar: 'الإعجابات', en: 'Likes', fr: "J'aime" },
    delete: { ar: 'حذف', en: 'Delete', fr: 'Supprimer' },
    noNewsYet: { ar: 'لا توجد أخبار', en: 'No news yet', fr: 'Aucune actualité' },
    noVideosYet: { ar: 'لا توجد فيديوهات', en: 'No videos yet', fr: 'Aucune vidéo' },
    addNewsTitle: { ar: 'إضافة خبر جديد', en: 'Add New Article', fr: 'Ajouter une actualité' },
    newsTitleLabel: { ar: 'عنوان الخبر', en: 'Article title', fr: "Titre de l'actualité" },
    newsTitlePlaceholder: { ar: 'اكتب عنوان الخبر هنا...', en: 'Write the article title here...', fr: "Écrivez le titre de l'actualité ici..." },
    categoryLabel: { ar: 'التصنيف', en: 'Category', fr: 'Catégorie' },
    newsContentLabel: { ar: 'محتوى الخبر', en: 'Article content', fr: "Contenu de l'actualité" },
    newsContentPlaceholder: { ar: 'اكتب تفاصيل الخبر هنا...', en: 'Write the article details here...', fr: "Écrivez les détails de l'actualité ici..." },
    publishNews: { ar: 'نشر الخبر', en: 'Publish Article', fr: "Publier l'actualité" },
    newsImageLabel: { ar: 'صورة الخبر', en: 'Article image', fr: "Image de l'actualité" },
    addVideoTitle: { ar: 'إضافة فيديو جديد', en: 'Add New Video', fr: 'Ajouter une nouvelle vidéo' },
    videoTitleLabel: { ar: 'عنوان الفيديو', en: 'Video title', fr: 'Titre de la vidéo' },
    videoTitlePlaceholder: { ar: 'اكتب عنوان الفيديو هنا...', en: 'Write the video title here...', fr: 'Écrivez le titre de la vidéo ici...' },
    videoUrlLabel: { ar: 'ملف الفيديو', en: 'Video file', fr: "Fichier vidéo" },
    posterLabel: { ar: 'صورة الغلاف (اختياري)', en: 'Cover image (optional)', fr: 'Image de couverture (optionnel)' },
    publishVideo: { ar: 'نشر الفيديو', en: 'Publish Video', fr: 'Publier la vidéo' },
    errTitleRequired: { ar: 'العنوان مطلوب', en: 'Title is required', fr: 'Le titre est requis' },
    errContentRequired: { ar: 'المحتوى مطلوب', en: 'Content is required', fr: 'Le contenu est requis' },
    errVideoUrlRequired: { ar: 'يجب اختيار ملف فيديو', en: 'A video file is required', fr: 'Un fichier vidéo est requis' },
    // --- media uploads (Supabase Storage) & video links ---
    uploading: { ar: 'جارٍ الرفع… يرجى الانتظار', en: 'Uploading… please wait', fr: 'Téléversement… veuillez patienter' },
    uploadInProgress: { ar: 'انتظر انتهاء رفع الملف أولاً', en: 'Wait for the file upload to finish first', fr: "Attendez la fin du téléversement" },
    errMediaType: { ar: 'صيغة الملف غير مدعومة (الصور: JPG/PNG/WEBP/GIF — الفيديو: MP4/WEBM/MOV)', en: 'Unsupported file type (images: JPG/PNG/WEBP/GIF — video: MP4/WEBM/MOV)', fr: 'Type de fichier non pris en charge (images : JPG/PNG/WEBP/GIF — vidéo : MP4/WEBM/MOV)' },
    errMediaSize: { ar: 'حجم الملف كبير جداً (الحد الأقصى: 10 ميغابايت للصور و50 ميغابايت للفيديو)', en: 'File too large (max 10 MB for images, 50 MB for video)', fr: 'Fichier trop volumineux (max 10 Mo pour les images, 50 Mo pour la vidéo)' },
    errMediaUpload: { ar: 'فشل رفع الملف إلى التخزين. تأكد من تشغيل ملف supabase/schema.sql وتسجيل الدخول كأدمن', en: 'Upload to storage failed. Make sure supabase/schema.sql was run and you are signed in as admin', fr: "Échec du téléversement. Vérifiez que supabase/schema.sql a été exécuté et que vous êtes connecté en admin" },
    videoLinkPlaceholder: { ar: 'أو الصق رابط فيديو (mp4 / YouTube / Facebook / Instagram / Vimeo / TikTok / Google Drive)', en: 'Or paste a video link (mp4 / YouTube / Facebook / Instagram / Vimeo / TikTok / Google Drive)', fr: 'Ou collez un lien vidéo (mp4 / YouTube / Facebook / Instagram / Vimeo / TikTok / Google Drive)' },
    videoLinkHint: { ar: 'الروابط المباشرة (.mp4) تُشغَّل داخل الموقع، وروابط المنصات تظهر بمشغّل مضمَّن.', en: 'Direct (.mp4) links play natively; platform links appear in an embedded player.', fr: 'Les liens directs (.mp4) sont lus nativement ; les liens de plateformes s’affichent dans un lecteur intégré.' },
    toastSyncFailed: { ar: 'تعذّر الحفظ على الخادم — لن يراه الزوار. تأكد من تسجيل الدخول كأدمن وتشغيل schema.sql', en: 'Could not save to the server — visitors will not see it. Check you are signed in as admin and schema.sql was run', fr: "Impossible d'enregistrer sur le serveur — les visiteurs ne le verront pas. Vérifiez votre connexion admin et schema.sql" },
    errValidUrl: { ar: 'الرجاء إدخال رابط https:// أو http:// صالح', en: 'Please enter a valid http:// or https:// URL', fr: 'Veuillez saisir une URL http:// ou https:// valide' },
    errValidImageUrl: { ar: 'الرجاء إدخال رابط صورة https:// أو http:// صالح', en: 'Please enter a valid http:// or https:// image URL', fr: "Veuillez saisir une URL d'image http:// ou https:// valide" },
    toastNewsPublished: { ar: 'تم نشر الخبر بنجاح', en: 'Article published successfully', fr: 'Actualité publiée avec succès' },
    toastVideoPublished: { ar: 'تم نشر الفيديو بنجاح', en: 'Video published successfully', fr: 'Vidéo publiée avec succès' },
    toastNewsDeleted: { ar: 'تم حذف الخبر', en: 'Article deleted', fr: 'Actualité supprimée' },
    toastVideoDeleted: { ar: 'تم حذف الفيديو', en: 'Video deleted', fr: 'Vidéo supprimée' },
    confirmDeleteMessage: {
      ar: 'هل أنت تأكد من إيقاف/حذف هذا العنصر؟',
      en: 'Are you sure you want to stop/delete this item?',
      fr: 'Voulez-vous vraiment arrêter/supprimer cet élément ?',
    },
    confirmYes: { ar: 'نعم، احذف', en: 'Yes, delete', fr: 'Oui, supprimer' },
    confirmCancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler' },
    brandingChangeLogo: { ar: 'تغيير الشعار', en: 'Change logo', fr: 'Changer le logo' },
    brandingChangeSiteName: { ar: 'تعديل اسم الموقع', en: 'Edit site name', fr: 'Modifier le nom du site' },
    brandingChangeBanner: { ar: 'تغيير صورة الغلاف', en: 'Change banner image', fr: "Changer l'image de couverture" },
    addMatchTitle: { ar: 'إضافة نتيجة مباراة جزائرية', en: 'Add Algerian Match Result', fr: 'Ajouter un résultat de match algérien' },
    matchDivisionLabel: { ar: 'القسم / البطولة', en: 'Division / Competition', fr: 'Division / Compétition' },
    matchGroupLabel: { ar: 'المجموعة', en: 'Group', fr: 'Groupe' },
    matchRoundLabel: { ar: 'الجولة / المجموعة (اختياري)', en: 'Round / Matchday (optional)', fr: 'Journée / Round (facultatif)' },
    matchRoundPlaceholder: { ar: 'مثال: الجولة 1', en: 'e.g. Round 1', fr: 'ex : Journée 1' },
    editMatchTitle: { ar: 'تعديل مباراة جزائرية', en: 'Edit Algerian Match', fr: 'Modifier un match algérien' },
    saveChanges: { ar: 'حفظ التعديلات', en: 'Save Changes', fr: 'Enregistrer les modifications' },
    cancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler' },
    edit: { ar: 'تعديل', en: 'Edit', fr: 'Modifier' },
    errDivisionRequired: { ar: 'يرجى اختيار القسم', en: 'Please select a division', fr: 'Veuillez sélectionner une division' },
    colDivision: { ar: 'القسم / المجموعة', en: 'Division / Group', fr: 'Division / Groupe' },
    colRound: { ar: 'الجولة', en: 'Round', fr: 'Journée' },
    matchHomeTeamLabel: { ar: 'الفريق المستضيف', en: 'Home Team', fr: 'Équipe à domicile' },
    matchHomeTeamLogoLabel: { ar: 'شعار الفريق المستضيف (اختياري)', en: 'Home team crest (optional)', fr: 'Blason équipe à domicile (facultatif)' },
    matchAwayTeamLabel: { ar: 'الفريق الضيف', en: 'Away Team', fr: 'Équipe visiteuse' },
    matchAwayTeamLogoLabel: { ar: 'شعار الفريق الضيف (اختياري)', en: 'Away team crest (optional)', fr: 'Blason équipe visiteuse (facultatif)' },
    matchScoreLabel: { ar: 'النتيجة (مثال: 3-1)', en: 'Score (e.g. 3-1)', fr: 'Score (ex : 3-1)' },
    matchSetsLabel: { ar: 'نتائج الأشواط', en: 'Set Scores', fr: 'Scores des sets' },
    matchSetName: { ar: 'الشوط', en: 'Set', fr: 'Set' },
    matchSetOptional: { ar: 'إن وجد', en: 'if played', fr: 'si joué' },
    matchComputedScoreLabel: { ar: 'النتيجة النهائية (محسوبة تلقائياً)', en: 'Final score (auto-computed)', fr: 'Score final (calculé automatiquement)' },
    errSetsIncomplete: {
      ar: 'يرجى إدخال نتيجة كلا الفريقين في هذا الشوط',
      en: "Please enter both teams' score for this set",
      fr: 'Veuillez saisir le score des deux équipes pour ce set',
    },
    errSetsTie: { ar: 'لا يمكن أن ينتهي الشوط بالتعادل', en: 'A set cannot end in a tie', fr: 'Un set ne peut pas se terminer à égalité' },
    errSetsTooFew: { ar: 'يجب إدخال نتيجة 3 أشواط على الأقل', en: 'At least 3 sets are required', fr: 'Au moins 3 sets sont requis' },
    errSetsInvalid: { ar: 'يرجى إدخال أرقام صحيحة لنتيجة الشوط', en: 'Please enter valid set scores', fr: 'Veuillez saisir des scores de set valides' },
    matchDateLabel: { ar: 'تاريخ المباراة', en: 'Match date', fr: 'Date du match' },
    matchDateOptionalNote: {
      ar: 'اختياري — يمكن تركه فارغاً وتعديله لاحقاً',
      en: 'Optional — can be left blank and set later',
      fr: 'Facultatif — peut être laissé vide et renseigné plus tard',
    },
    matchTimeLabel: { ar: 'موعد المباراة', en: 'Match time', fr: 'Heure du match' },
    matchTypeLabel: { ar: 'نوع الإدخال', en: 'Entry type', fr: "Type d'entrée" },
    matchTypeResult: { ar: 'نتيجة مباراة منتهية', en: 'Completed result', fr: 'Résultat terminé' },
    matchTypeUpcoming: { ar: 'موعد مباراة قادمة', en: 'Upcoming fixture', fr: 'Match à venir' },
    publishMatch: { ar: 'حفظ نتيجة المباراة', en: 'Save Match Result', fr: 'Enregistrer le résultat' },
    latestMatches: { ar: 'مباريات الكرة الطائرة الجزائرية', en: 'Algerian Volleyball Matches', fr: 'Matchs de volley-ball algériens' },
    colTeams: { ar: 'الفريقان', en: 'Teams', fr: 'Équipes' },
    colScore: { ar: 'النتيجة', en: 'Score', fr: 'Score' },
    noMatchesYet: { ar: 'لا توجد مباريات مسجلة بعد', en: 'No matches recorded yet', fr: 'Aucun match enregistré pour le moment' },
    errTeamsRequired: { ar: 'يرجى إدخال اسم الفريقين', en: 'Please enter both team names', fr: 'Veuillez saisir le nom des deux équipes' },
    errScoreRequired: { ar: 'يرجى إدخال نتيجة المباراة', en: 'Please enter the match score', fr: 'Veuillez saisir le score du match' },
    toastMatchPublished: { ar: 'تم حفظ نتيجة المباراة', en: 'Match result saved', fr: 'Résultat du match enregistré' },
    toastMatchDeleted: { ar: 'تم حذف المباراة', en: 'Match deleted', fr: 'Match supprimé' },
    toastMatchUpdated: { ar: 'تم تحديث المباراة', en: 'Match updated', fr: 'Match mis à jour' },
    settingsTitle: { ar: 'إعدادات الحساب', en: 'Account Settings', fr: 'Paramètres du compte' },
    settingsSubtitle: {
      ar: 'قم بتحديث اسم المستخدم وكلمة المرور الخاصة بلوحة التحكم.',
      en: 'Update the admin dashboard username and password.',
      fr: "Mettez à jour le nom d'utilisateur et le mot de passe du tableau de bord.",
    },
    currentPasswordLabel: { ar: 'كلمة المرور الحالية', en: 'Current Password', fr: 'Mot de passe actuel' },
    newUsernameLabel: { ar: 'البريد الإلكتروني الجديد', en: 'New Email Address', fr: "Nouvelle adresse e-mail" },
    newPasswordLabel: { ar: 'كلمة المرور الجديدة', en: 'New Password', fr: 'Nouveau mot de passe' },
    confirmNewPasswordLabel: { ar: 'تأكيد كلمة المرور الجديدة', en: 'Confirm New Password', fr: 'Confirmer le nouveau mot de passe' },
    saveSettings: { ar: 'حفظ التغييرات', en: 'Save Changes', fr: 'Enregistrer les modifications' },
    errCurrentPasswordWrong: { ar: 'كلمة المرور الحالية غير صحيحة', en: 'Current password is incorrect', fr: 'Le mot de passe actuel est incorrect' },
    errPasswordsNoMatch: { ar: 'كلمتا المرور الجديدتان غير متطابقتين', en: 'New passwords do not match', fr: 'Les nouveaux mots de passe ne correspondent pas' },
    errFieldsRequired: { ar: 'يرجى تعبئة جميع الحقول المطلوبة', en: 'Please fill in all required fields', fr: 'Veuillez remplir tous les champs requis' },
    errPasswordTooShort: { ar: 'يجب أن تتكون كلمة المرور من 4 أحرف على الأقل', en: 'Password must be at least 4 characters', fr: 'Le mot de passe doit contenir au moins 4 caractères' },
    toastSettingsSaved: { ar: 'تم تحديث بيانات الدخول بنجاح', en: 'Login credentials updated successfully', fr: 'Identifiants mis à jour avec succès' },
    currentUsernameNote: { ar: 'البريد الإلكتروني الحالي', en: 'Current email address', fr: "Adresse e-mail actuelle" },
  },
};

function translate(section, key, lang) {
  const entry = translations[section] && translations[section][key];
  if (!entry) return '';
  return entry[lang] || entry.ar || '';
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'ar';
    return window.localStorage.getItem(STORAGE_KEY) || 'ar';
  });

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('dir', current.dir);
    document.documentElement.setAttribute('lang', current.code);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // localStorage may be unavailable (private mode, etc.) — non-fatal.
    }
  }, [lang, current.dir, current.code]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      dir: current.dir,
      locale: current.locale,
      // Language switcher is restricted to the 3 core UI languages only
      // (Arabic / English / Français). The full LANGUAGES list (core +
      // EXTRA_LANGUAGES) is intentionally kept above and still exported
      // for any other part of the app (e.g. live-translation services)
      // that may still want the broader set — only the switcher's
      // visible options are limited here.
      languages: CORE_UI_LANGUAGES,
      t: (section, key) => translate(section, key, lang),
    }),
    [lang, current.dir, current.locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
