import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

// Real contact + social links for Dzair Volley.
export const SOCIAL_LINKS = [
  {
    key: 'email',
    labelKey: 'email',
    href: 'mailto:dzair.volley@gmail.com',
    external: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M3 6.5 12 13l9-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'facebook',
    labelKey: 'facebook',
    href: 'https://www.facebook.com/share/18tmuracQL/',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 8.5h2.5V5.2c-.43-.06-1.9-.2-3.6-.2-3.57 0-6 2.24-6 6.35v3.15H4v3.7h3.4V21h3.75v-6.8h3.3l.5-3.7h-3.8v-2.75c0-1.07.29-1.75 1.85-1.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'instagram',
    labelKey: 'instagram',
    href: 'https://www.instagram.com/dzairvolley/',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'tiktok',
    labelKey: 'tiktok',
    href: 'https://www.tiktok.com/@dzar.volley?lang=fr&is_from_webapp=1&sender_device=mobile&sender_web_id=7671302877847356944',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 3.5c.5 2.2 2.1 3.7 4.5 3.9v2.9c-1.6.05-3.05-.45-4.5-1.4v6.4a5.6 5.6 0 1 1-5.6-5.6c.35 0 .68.03 1 .09v2.95a2.65 2.65 0 1 0 1.9 2.55V3.5H15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'youtube',
    labelKey: 'youtube',
    href: 'https://youtube.com/@dzairvolley?feature=shared',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 8.3s-.2-1.5-.83-2.16c-.8-.85-1.68-.85-2.1-.9C15.05 5 12 5 12 5h-.01s-3.04 0-6.06.24c-.42.05-1.3.05-2.1.9C3.2 6.8 3 8.3 3 8.3S2.8 10 2.8 11.75v1.5C2.8 15 3 16.7 3 16.7s.2 1.5.83 2.16c.8.85 1.85.82 2.32.92C7.8 19.95 12 20 12 20s3.05 0 6.07-.25c.42-.05 1.3-.05 2.1-.9.63-.65.83-2.15.83-2.15s.2-1.7.2-3.45v-1.5C21.2 10 21 8.3 21 8.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M10 9.6 14.5 12 10 14.4V9.6Z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'x',
    labelKey: 'x',
    href: 'https://x.com/DzairVolley',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4l7.2 8.6L4.4 20H6.6l6-6.6L17.3 20H20l-7.5-9L19.6 4h-2.2l-5.6 6.15L7 4H4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor"/>
      </svg>
    ),
  },
];

// Developer/footer-only social links — deliberately separate from
// SOCIAL_LINKS (navbar/mobile) above, which must stay untouched.
export const FOOTER_SOCIAL_LINKS = [
  {
    key: 'facebook',
    labelKey: 'facebook',
    href: 'https://www.facebook.com/profile.php?id=61579639955517',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 8.5h2.5V5.2c-.43-.06-1.9-.2-3.6-.2-3.57 0-6 2.24-6 6.35v3.15H4v3.7h3.4V21h3.75v-6.8h3.3l.5-3.7h-3.8v-2.75c0-1.07.29-1.75 1.85-1.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'instagram',
    labelKey: 'instagram',
    href: 'https://www.instagram.com/destruction_lover?igsi=MXY0aW5vZ2JwcDNhbQ==',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'tiktok',
    labelKey: 'tiktok',
    href: 'https://www.tiktok.com/@destruction_lover?_r=1&_t=ZS-99DxUfHNont',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 3.5c.5 2.2 2.1 3.7 4.5 3.9v2.9c-1.6.05-3.05-.45-4.5-1.4v6.4a5.6 5.6 0 1 1-5.6-5.6c.35 0 .68.03 1 .09v2.95a2.65 2.65 0 1 0 1.9 2.55V3.5H15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'telegram',
    labelKey: 'telegram',
    href: 'https://t.me/Destruction_lover',
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 4.5 3 11.2c-.6.23-.6 1.09.02 1.3l4.3 1.43 1.63 5.1c.2.63 1 .8 1.44.3l2.4-2.7 4.46 3.3c.55.4 1.33.1 1.46-.57l2.9-13.9c.14-.7-.56-1.26-1.21-.96Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M8.3 13.9l9.9-7.7-8.1 8.9" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function SocialLinks({ variant = 'navbar', className = '' }) {
  const { t } = useLanguage();
  // Footer uses the developer's own contact links; navbar/mobile keep the
  // original Dzair Volley social links untouched.
  const items = variant === 'footer' ? FOOTER_SOCIAL_LINKS : SOCIAL_LINKS;
  return (
    <div className={`social-links social-links-${variant} ${className}`}>
      {items.map((item) => {
        const label = t('social', item.labelKey);
        return (
          <a
            key={item.key}
            href={item.href}
            className={`social-icon-btn social-${item.key}`}
            aria-label={label}
            title={label}
            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {item.icon}
          </a>
        );
      })}
    </div>
  );
}
