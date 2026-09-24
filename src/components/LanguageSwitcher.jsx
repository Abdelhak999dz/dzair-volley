import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function LanguageSwitcher({ variant = 'navbar' }) {
  const { lang, setLang, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div className={`lang-switcher lang-switcher-${variant}`} ref={wrapRef}>
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <span className={`lang-caret ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <ul className="lang-dropdown glass" role="listbox">
          {languages.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className={`lang-option ${l.code === lang ? 'active' : ''}`}
                onClick={() => handleSelect(l.code)}
                role="option"
                aria-selected={l.code === lang}
              >
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
