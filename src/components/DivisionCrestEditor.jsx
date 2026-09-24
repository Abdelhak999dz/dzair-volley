import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

// Small camera icon — same mark used for the header logo / hero banner
// upload overlays (see Navbar.jsx / Hero.jsx), kept local here since
// each of those files already keeps its own copy for the same reason.
function IconCamera(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H7l1-2h4l1 2h2.5A1.5 1.5 0 0 1 17 7.5v8A1.5 1.5 0 0 1 15.5 17h-11A1.5 1.5 0 0 1 3 15.5v-8Z" />
      <circle cx="10" cy="11.2" r="3" />
    </svg>
  );
}

// Admin-only control shown next to each "البطولة الجزائرية" division
// tab (and the "الكل" tab). Lets a logged-in admin set/replace/remove
// that section's crest — either by picking an image file (uploaded for
// real to Supabase Storage, see AlgerianMatchesContext.jsx) or by
// pasting a direct image URL — so the change is a real, cloud-synced
// piece of content every visitor sees, not a local-only edit.
export default function DivisionCrestEditor({ hasCrest, onUploadFile, onSaveUrl, onRemove, label }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const wrapRef = useRef(null);

  // Close the popover on an outside click, same as any lightweight
  // dropdown elsewhere in the app.
  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setSaving(true);
    await onUploadFile(file);
    setSaving(false);
    setOpen(false);
  };

  const handleSaveUrl = async () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSaveUrl(trimmed);
    setSaving(false);
    setUrlDraft('');
    setOpen(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await onRemove();
    setSaving(false);
    setOpen(false);
  };

  return (
    <span className="division-crest-admin" ref={wrapRef}>
      <button
        type="button"
        className="division-crest-camera-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={t('algerianMatches', 'crestUpload')}
        title={t('algerianMatches', 'crestUpload')}
      >
        <IconCamera />
      </button>
      {open && (
        <span className="division-crest-popover" onMouseDown={(e) => e.stopPropagation()}>
          <span className="division-crest-popover-title">{label}</span>
          <button
            type="button"
            className="division-crest-popover-btn"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current && fileInputRef.current.click();
            }}
          >
            {t('algerianMatches', 'crestUploadFromDevice')}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <span className="division-crest-popover-or">{t('algerianMatches', 'crestOrUrl')}</span>
          <span className="division-crest-popover-url-row">
            <input
              type="text"
              className="division-crest-url-input"
              placeholder={t('algerianMatches', 'crestUrlPlaceholder')}
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveUrl();
              }}
            />
            <button type="button" className="division-crest-popover-btn division-crest-popover-btn--save" disabled={saving} onClick={handleSaveUrl}>
              {t('algerianMatches', 'crestUrlSave')}
            </button>
          </span>
          {hasCrest && (
            <button type="button" className="division-crest-popover-btn division-crest-popover-btn--remove" disabled={saving} onClick={handleRemove}>
              {t('algerianMatches', 'crestRemove')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
