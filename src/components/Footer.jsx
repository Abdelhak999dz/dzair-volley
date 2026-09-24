import React from 'react';
import SocialLinks from './SocialLinks.jsx';
import VisitorCounter from './VisitorCounter.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// Site footer. The developer-branding block below uses the dedicated
// "footer" SocialLinks variant (developer contact links) — completely
// separate from the navbar/mobile variant, which must never be touched
// here.
export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="footer">
      <div className="container">
        {/* Live visitor counter (pulsing glow frame) + 5-star site rating
            widget — sits above the developer signature block below. */}
        <VisitorCounter />

        {/* Developer signature block: a glowing "Developed by V0RT3X" title
            sits above the compact horizontal glassmorphism pill; the pill
            itself holds the "تواصل مع المطوّر" contact label right next to
            the developer-only social links (kept fully separate from the
            navbar). The tagline copy is preserved as an accessible tooltip
            on the pill instead of stacked lines, to keep the footprint
            minimal. */}
        <div className="dev-signature-wrap">
          <p className="dev-signature-title">Developed by V0RT3X</p>
          <div className="dev-signature" title={t('footer', 'developerTagline')}>
            <div className="dev-signature-glow" aria-hidden="true" />
            <div className="dev-signature-pill">
              <span className="dev-signature-contact">{t('footer', 'developerContact')}</span>
              <SocialLinks variant="footer" className="dev-signature-social" />
            </div>
          </div>
        </div>

        <p className="footer-copyright">{t('footer', 'copyright')}</p>
      </div>
    </footer>
  );
}
