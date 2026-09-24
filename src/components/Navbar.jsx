import React, { useRef, useState, useEffect } from 'react';
import SocialLinks from './SocialLinks.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSiteSettings } from '../context/SiteSettingsContext.jsx';
import { IconEdit, IconCheck, IconX } from './icons/AdminIcons.jsx';

// Small camera icon — used for the header logo's overlay upload button.
// Kept local since it's specific to the branding-edit overlay controls.
function IconCamera(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H7l1-2h4l1 2h2.5A1.5 1.5 0 0 1 17 7.5v8A1.5 1.5 0 0 1 15.5 17h-11A1.5 1.5 0 0 1 3 15.5v-8Z" />
      <circle cx="10" cy="11.2" r="3" />
    </svg>
  );
}

export default function Navbar({ isAdminAuthenticated = false }) {
  const { t } = useLanguage();
  const { siteName, logoUrl, updateSiteName, updateLogoFile } = useSiteSettings();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(siteName);
  const logoFileInputRef = useRef(null);

  useEffect(() => {
    if (!editingName) setNameDraft(siteName);
  }, [siteName, editingName]);

  const handleLogoFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    await updateLogoFile(file);
    e.target.value = '';
  };

  const saveNameEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) updateSiteName(trimmed);
    setEditingName(false);
  };

  const cancelNameEdit = () => {
    setNameDraft(siteName);
    setEditingName(false);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileOpen(false);
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const navItems = [
    { id: 'home', label: t('nav', 'home') },
    { id: 'live-results', label: t('nav', 'liveResults') },
    { id: 'schedules', label: t('nav', 'matches') },
    { id: 'algerian-matches', label: t('nav', 'algerianMatches') },
    { id: 'reels', label: t('nav', 'videos') },
    { id: 'news', label: t('nav', 'news') },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">
        <div className="vhub-logo">
          <div className="vhub-logo-mark-wrap">
            <img className="vhub-logo-mark rounded-full" src={logoUrl} alt={siteName} />
            {isAdminAuthenticated && (
              <>
                <button
                  type="button"
                  className="brand-edit-overlay-btn brand-edit-overlay-btn--logo"
                  onClick={() => logoFileInputRef.current && logoFileInputRef.current.click()}
                  aria-label={t('admin', 'brandingChangeLogo') || 'Change logo'}
                  title={t('admin', 'brandingChangeLogo') || 'Change logo'}
                >
                  <IconCamera />
                </button>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  style={{ display: 'none' }}
                />
              </>
            )}
          </div>

          {editingName ? (
            <div className="vhub-logo-text-edit">
              <input
                type="text"
                className="vhub-logo-text-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNameEdit();
                  if (e.key === 'Escape') cancelNameEdit();
                }}
              />
              <button type="button" className="brand-edit-overlay-btn brand-edit-overlay-btn--inline" onClick={saveNameEdit} aria-label={t('admin', 'confirmYes')}>
                <IconCheck />
              </button>
              <button type="button" className="brand-edit-overlay-btn brand-edit-overlay-btn--inline" onClick={cancelNameEdit} aria-label={t('admin', 'confirmCancel')}>
                <IconX />
              </button>
            </div>
          ) : (
            <div className="vhub-logo-title-row">
              <div className="vhub-logo-text">{siteName}</div>
              {isAdminAuthenticated && (
                <button
                  type="button"
                  className="brand-edit-overlay-btn brand-edit-overlay-btn--name"
                  onClick={() => setEditingName(true)}
                  aria-label={t('admin', 'brandingChangeSiteName') || 'Edit site name'}
                  title={t('admin', 'brandingChangeSiteName') || 'Edit site name'}
                >
                  <IconEdit />
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.id}>
              <button onClick={() => scrollToSection(item.id)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <SocialLinks variant="navbar" />
          <LanguageSwitcher variant="navbar" />
          <div className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-menu glass">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => scrollToSection(item.id)}>
              {item.label}
            </button>
          ))}
          <SocialLinks variant="mobile" className="mobile-menu-social" />
          <LanguageSwitcher variant="mobile" />
        </div>
      )}
    </nav>
  );
}
