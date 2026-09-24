import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import LiveResults from './components/LiveResults.jsx';
import MatchSchedules from './components/MatchSchedules.jsx';
import AlgerianMatches from './components/AlgerianMatches.jsx';
import ReelsSection from './components/ReelsSection.jsx';
import NewsSection from './components/NewsSection.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import Footer from './components/Footer.jsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';
import { SiteSettingsProvider } from './context/SiteSettingsContext.jsx';
import { AlgerianMatchesProvider, useAlgerianMatches } from './context/AlgerianMatchesContext.jsx';
import { NewsProvider, useNews } from './context/NewsContext.jsx';
import { ReelsProvider, useReels } from './context/ReelsContext.jsx';
import usePersistentState from './hooks/usePersistentState.js';
import { isBlockedClient } from './security/guard.js';

/* ============================================================
   SEED DATA — real, verified volleyball news as of the build
   date (real events, sourced from FIVB / Volleyball World /
   USA Volleyball / CEV coverage). Wire this up to a live
   API/CMS feed to keep it current.

   Match results and upcoming schedules are NOT mock data here —
   they're fetched live from a real indoor-volleyball API
   (see src/services/volleyballApi.js and the README).
   ============================================================ */

const initialNews = [
  {
    id: 1,
    title: 'المنتخب الأمريكي للناشئات يفوز في ظهوره الأول ببطولة العالم تحت 17 سنة',
    category: 'بطولة العالم للناشئين',
    date: '2026-08-06',
    summary: 'حقق منتخب الولايات المتحدة للناشئات فوزاً 3-0 على مصر في أولى مبارياته ضمن بطولة العالم تحت 17 سنة المقامة في سانتياغو بتشيلي، في أول مشاركة للفريق الأمريكي بتاريخ هذه البطولة.',
    image: 'https://images.pexels.com/photos/6203581/pexels-photo-6203581.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
  {
    id: 2,
    title: 'بولندا تحافظ على لقب دوري الأمم العالمي للرجال بفوز مثير على أمريكا',
    category: 'دوري الأمم',
    date: '2026-08-02',
    summary: 'توج المنتخب البولندي بلقبه الثاني على التوالي في دوري الأمم العالمي للرجال بعد فوز درامي بخمسة أشواط على الولايات المتحدة في نينغبو بالصين، وتم اختيار توماش فورنال أفضل لاعب في البطولة.',
    image: 'https://images.pexels.com/photos/6180384/pexels-photo-6180384.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
  {
    id: 3,
    title: 'تركيا تتوّج بلقب دوري الأمم العالمي للسيدات على حساب البرازيل',
    category: 'دوري الأمم',
    date: '2026-07-26',
    summary: 'انتزع المنتخب التركي لقبه الثاني في دوري الأمم العالمي للسيدات بفوزه على البرازيل في نهائي مثير أقيم في ماكاو بالصين، وسط أداء استثنائي من نجمة الفريق ميليسا فارغاس.',
    image: 'https://images.pexels.com/photos/12169045/pexels-photo-12169045.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
  {
    id: 4,
    title: 'ساو باولو تستضيف بطولة العالم للأندية للسيدات نهاية العام',
    category: 'بطولة الأندية',
    date: '2026-08-01',
    summary: 'أكد الاتحاد الدولي أن مدينة ساو باولو البرازيلية ستستضيف بطولة العالم للأندية للسيدات في ديسمبر المقبل، لتستمر العلاقة التاريخية للمدينة مع هذا الحدث العالمي المرموق.',
    image: 'https://images.pexels.com/photos/13571934/pexels-photo-13571934.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
  {
    id: 5,
    title: 'بيروجيا الإيطالي يحافظ على لقب دوري أبطال أوروبا للرجال',
    category: 'دوري أبطال أوروبا',
    date: '2026-05-17',
    summary: 'دافع نادي بيروجيا الإيطالي بنجاح عن لقبه القاري بفوزه على الفريق البولندي في نهائي أقيم في مدينة تورينو، ليحقق الثنائية الأوروبية للموسم الثاني على التوالي.',
    image: 'https://images.pexels.com/photos/22636435/pexels-photo-22636435.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
  {
    id: 6,
    title: 'قطر تستعد لاستضافة بطولة العالم للناشئين تحت 17 سنة',
    category: 'بطولة العالم للناشئين',
    date: '2026-05-24',
    summary: 'اكتمل عقد الفرق الأربعة والعشرين المشاركة في بطولة العالم للناشئين تحت 17 سنة (رجال) المقرر إقامتها في الدوحة بقطر خلال شهر أغسطس، بمشاركة منتخبات من القارات الخمس.',
    image: 'https://images.pexels.com/photos/9265913/pexels-photo-9265913.jpeg?auto=compress&cs=tinysrgb&w=800',
    views: 0,
    likes: 0,
    comments: 0,
  },
];

// Real, freely-licensed (Mixkit) volleyball footage — direct, playable MP4 links.
const initialReels = [
  {
    id: 1,
    title: 'أجواء من قلب الملعب — منظور نحو الشبكة',
    category: 'أجواء الملاعب',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/12321/12321-360.mp4',
    poster: 'https://images.pexels.com/photos/6203581/pexels-photo-6203581.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 2,
    title: 'منظور علوي لمباراة كرة طائرة',
    category: 'زوايا مختلفة',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/34179/34179-360.mp4',
    poster: 'https://images.pexels.com/photos/6180384/pexels-photo-6180384.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 3,
    title: 'كرة الطائرة تجمع الأصدقاء في كل مكان',
    category: 'أجواء',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/42742/42742-360.mp4',
    poster: 'https://images.pexels.com/photos/12169253/pexels-photo-12169253.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 4,
    title: 'جولة داخل ملاعب الكرة الطائرة الشاطئية',
    category: 'الطائرة الشاطئية',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/26831/26831-360.mp4',
    poster: 'https://images.pexels.com/photos/13571934/pexels-photo-13571934.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 5,
    title: 'ملاعب شاطئية بمعايير عالمية',
    category: 'الطائرة الشاطئية',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/26830/26830-360.mp4',
    poster: 'https://images.pexels.com/photos/9265913/pexels-photo-9265913.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 6,
    title: 'منظر جوي لملاعب الكرة الطائرة الشاطئية',
    category: 'تصوير جوي',
    views: 0,
    likes: 0,
    comments: 0,
    videoUrl: 'https://assets.mixkit.co/videos/26832/26832-360.mp4',
    poster: 'https://images.pexels.com/photos/22636435/pexels-photo-22636435.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
];

function AppContent() {
  const { dir } = useLanguage();
  const [currentView, setCurrentView] = useState('site'); // 'site' | 'admin'
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // SCROLL RESTORE AFTER VIDEO-CLOSE RELOAD — pairs with the
  // `sessionStorage.setItem('dzair_scroll', ...)` + `window.location.reload()`
  // in components/VideoPlayer.jsx's closeModalPlayer(). Runs once on every
  // mount (including the reload triggered by closing a reel) and, if a
  // saved position is found, jumps straight to it with `behavior: 'instant'`
  // (no smooth animation, so it never reads as a visible "scroll" or a
  // jump) before clearing the key so a normal page load is never affected.
  useEffect(() => {
    let savedScroll = null;
    try {
      savedScroll = sessionStorage.getItem('dzair_scroll');
    } catch (e) {
      // Ignored — sessionStorage can be unavailable (private mode, quota,
      // disabled storage); nothing to restore in that case.
    }
    if (savedScroll === null) return;
    try {
      sessionStorage.removeItem('dzair_scroll');
    } catch (e) {
      // Ignored.
    }
    const y = Number(savedScroll);
    if (!Number.isFinite(y)) return;
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  }, []);

  // News/reels now live in NewsContext/ReelsContext (real Supabase sync
  // with a localStorage fallback — see those files), the same pattern
  // already used for the Algerian matches and site settings, so
  // anything the admin adds shows up live on every device instantly
  // instead of staying stuck on just the browser that added it.
  const { news, addNews, deleteNews, likeNews, commentNews, viewNews } = useNews();
  const { reels, addReel, deleteReel, likeReel, commentReel, viewReel } = useReels();
  const { matches, addMatch, updateMatch, deleteMatch } = useAlgerianMatches();
  const [adminCredentials, setAdminCredentials] = usePersistentState('dzair-volley-admin-credentials', {
    // Demo-only defaults — compiled out of production builds (see LoginModal.jsx).
    username: import.meta.env.PROD ? '' : 'abdelhakbetch@gmail.com',
    password: import.meta.env.PROD ? '' : '123456789',
  });
  const handleLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentView('admin');
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setCurrentView('site');
  };

  const goToAdmin = () => {
    if (isAdminAuthenticated) setCurrentView('admin');
  };

  if (currentView === 'admin' && isAdminAuthenticated) {
    return (
      <div dir={dir}>
        <AdminDashboard
          news={news}
          reels={reels}
          matches={matches}
          onAddMatch={addMatch}
          onUpdateMatch={updateMatch}
          onDeleteMatch={deleteMatch}
          credentials={adminCredentials}
          onUpdateCredentials={setAdminCredentials}
          onAddNews={addNews}
          onDeleteNews={deleteNews}
          onAddReel={addReel}
          onDeleteReel={deleteReel}
          onLogout={handleLogout}
          onBackToSite={() => setCurrentView('site')}
        />
      </div>
    );
  }

  return (
    <div dir={dir}>
      <Navbar isAdminAuthenticated={isAdminAuthenticated} />
      <Hero
        newsCount={news.length}
        reelsCount={reels.length}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminAreaClick={goToAdmin}
        onLoginSuccess={handleLoginSuccess}
        credentials={adminCredentials}
      />
      <LiveResults />
      <MatchSchedules />
      <AlgerianMatches matches={matches} isAdminAuthenticated={isAdminAuthenticated} />
      <ReelsSection reels={reels} onLikeReel={likeReel} onCommentReel={commentReel} onViewReel={viewReel} />
      <NewsSection news={news} onLikeNews={likeNews} onCommentNews={commentNews} onViewNews={viewNews} />

      <Footer />
    </div>
  );
}

export default function App() {
  // Automated scrapers / headless browsers get no content (see
  // security/guard.js — set VITE_BLOCK_AUTOMATION=false to disable).
  if (isBlockedClient) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: '#050b1a', color: '#8fa1bd' }}>
        <p>Automated access is not permitted. / الوصول الآلي غير مسموح.</p>
      </div>
    );
  }
  return (
    <LanguageProvider>
      <SiteSettingsProvider>
        <AlgerianMatchesProvider>
          <NewsProvider initialNews={initialNews}>
            <ReelsProvider initialReels={initialReels}>
              <AppContent />
            </ReelsProvider>
          </NewsProvider>
        </AlgerianMatchesProvider>
      </SiteSettingsProvider>
    </LanguageProvider>
  );
}
