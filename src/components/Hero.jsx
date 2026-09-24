import React, { useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useLiveResults, useUpcomingMatches } from '../hooks/useVolleyballApi.js';
import LoginModal from './LoginModal.jsx';
import { useSiteSettings } from '../context/SiteSettingsContext.jsx';

// Real, freely-licensed (Mixkit) volleyball match footage — direct playable MP4s.
const HERO_VIDEO_SOURCES = [
  'https://assets.mixkit.co/videos/12321/12321-720.mp4',
  'https://assets.mixkit.co/videos/12321/12321-360.mp4',
];
const HERO_POSTER = 'https://images.pexels.com/photos/6203581/pexels-photo-6203581.jpeg?auto=compress&cs=tinysrgb&w=1600';

// Small camera icon — mirrors the one used for the header logo overlay.
function IconCamera(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H7l1-2h4l1 2h2.5A1.5 1.5 0 0 1 17 7.5v8A1.5 1.5 0 0 1 15.5 17h-11A1.5 1.5 0 0 1 3 15.5v-8Z" />
      <circle cx="10" cy="11.2" r="3" />
    </svg>
  );
}

function HeroLogo({ src, alt, onClick, label, isAdminAuthenticated, onCameraClick, cameraLabel }) {
  return (
    <div className="hero-logo-wrap">
      <button type="button" className="hero-logo-clickable" onClick={onClick} aria-label={label} title={label}>
        <span className="hero-logo-aura" />
        <span className="hero-logo-ring" />
        <img
          className="hero-logo-img rounded-full"
          src={src}
          alt={alt}
          width="150"
          height="150"
        />
      </button>
      {isAdminAuthenticated && (
        <button
          type="button"
          className="hero-banner-edit-btn"
          onClick={onCameraClick}
          aria-label={cameraLabel}
          title={cameraLabel}
        >
          <IconCamera />
        </button>
      )}
    </div>
  );
}

export default function Hero({ newsCount, reelsCount, isAdminAuthenticated, onAdminAreaClick, onLoginSuccess, credentials }) {
  const { t } = useLanguage();
  const { siteName, logoUrl, heroBannerUrl, updateHeroBannerFile } = useSiteSettings();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const heroBannerInputRef = useRef(null);

  const handleHeroBannerFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    await updateHeroBannerFile(file);
    e.target.value = '';
  };

  // Real data only — no fabricated placeholder numbers. If the live API
  // isn't configured (or is still loading/erroring), that stat box is
  // simply omitted rather than showing a fake or misleading figure.
  const liveResults = useLiveResults();
  const upcoming = useUpcomingMatches();
  const showResultsStat = liveResults.configured && !liveResults.loading && !liveResults.error;
  const showUpcomingStat = upcoming.configured && !upcoming.loading && !upcoming.error;

  const handleLogoClick = () => {
    if (isAdminAuthenticated) {
      onAdminAreaClick();
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    onLoginSuccess();
  };

  return (
    <section className="hero" id="home">
      <div className="hero-media">
        {/* Fallback layer: an animated SVG net-mesh pattern that sits behind
            the video. On mobile browsers that block/skip autoplay (e.g.
            Chrome/Safari in power-saver mode), this stays fully visible
            instead of the section ever showing a blank/black background. It
            is placed before the <video> in markup so the video (same
            stacking level) paints on top of it whenever it does render. */}
        <div className="hero-net-fallback" aria-hidden="true">
          <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="heroNetMeshPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M0 0 L16 16 M16 0 L0 16" stroke="var(--gold-bright, #d4af37)" strokeWidth="0.6" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="160" height="160" fill="url(#heroNetMeshPattern)" />
          </svg>
        </div>
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster={HERO_POSTER}
        >
          <source src={HERO_VIDEO_SOURCES[0]} type="video/mp4" />
          <source src={HERO_VIDEO_SOURCES[1]} type="video/mp4" />
        </video>
        <div className="hero-video-overlay" />
      </div>

      <div className="hero-content">
        <HeroLogo
          src={heroBannerUrl || logoUrl}
          alt={siteName}
          onClick={handleLogoClick}
          label={isAdminAuthenticated ? t('nav', 'adminDashboard') : t('nav', 'adminLogin')}
          isAdminAuthenticated={isAdminAuthenticated}
          onCameraClick={() => heroBannerInputRef.current && heroBannerInputRef.current.click()}
          cameraLabel={t('admin', 'brandingChangeBanner') || 'Change banner image'}
        />
        {isAdminAuthenticated && (
          <input
            ref={heroBannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleHeroBannerFileChange}
            style={{ display: 'none' }}
          />
        )}

        <p className="tagline">
          {t('hero', 'tagline')}
        </p>

        <div className="hero-stats">
          {showResultsStat && (
            <div className="hero-stat">
              <h3>{liveResults.matches.length}</h3>
              <span>{t('hero', 'statLiveResults')}</span>
            </div>
          )}
          {showUpcomingStat && (
            <div className="hero-stat">
              <h3>{upcoming.matches.length}</h3>
              <span>{t('hero', 'statUpcoming')}</span>
            </div>
          )}
          <div className="hero-stat">
            <h3>{newsCount}</h3>
            <span>{t('hero', 'statNews')}</span>
          </div>
          <div className="hero-stat">
            <h3>{reelsCount}</h3>
            <span>{t('hero', 'statVideos')}</span>
          </div>
        </div>
      </div>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          credentials={credentials}
        />
      )}
    </section>
  );
}
