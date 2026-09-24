import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { IconShare } from './icons/AdminIcons.jsx';

// Rendered via a portal directly into <body> — always a centered,
// full-viewport modal regardless of which card it was opened from.
export default function ShareModal({ title, url, onClose }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const shareUrl = url || window.location.href;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title || '');

  const links = [
    { key: 'whatsapp', label: t('engagement', 'shareWhatsapp'), href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`, className: 'share-option--whatsapp' },
    { key: 'facebook', label: t('engagement', 'shareFacebook'), href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, className: 'share-option--facebook' },
    { key: 'x', label: t('engagement', 'shareX'), href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, className: 'share-option--x' },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard API unavailable — silently ignore, the link is still
      // visible/selectable to the user via their browser if needed.
    }
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({ title, url: shareUrl }).catch(() => {});
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box share-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{t('engagement', 'shareTitle')}</h2>

        <div className="share-options-grid">
          {links.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`share-option ${link.className}`}
            >
              {link.label}
            </a>
          ))}
          <button className="share-option share-option--copy" onClick={handleCopyLink}>
            {copied ? t('engagement', 'shareLinkCopied') : t('engagement', 'shareCopyLink')}
          </button>
        </div>

        {typeof navigator !== 'undefined' && navigator.share && (
          <button className="btn-secondary share-native-btn" onClick={handleNativeShare}>
            <IconShare /> {t('engagement', 'shareNative')}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
