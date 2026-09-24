import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { translateAll } from '../services/translationService.js';

// Live-translates one or more pieces of *dynamic* content (a news title,
// summary, category, a reel caption, ...) into whatever language the
// visitor currently has selected — real API calls, cached, no fixed or
// placeholder text. The site's admin-entered content is authored in
// Arabic, so that's the assumed source language.
//
// Usage:
//   const [title, summary] = useLiveTranslate([item.title, item.summary]);
//
// While a translation is in flight, or if the visitor's language is
// Arabic (the source language) or the request fails, this returns the
// original text(s) unchanged — the UI never shows a blank/loading state
// for content, just the original until the translation lands.
export default function useLiveTranslate(texts) {
  const { lang } = useLanguage();
  const list = Array.isArray(texts) ? texts : [texts];
  const [translated, setTranslated] = useState(list);
  const requestId = useRef(0);

  // Stable dependency key so we only re-run when the actual text content
  // or target language changes, not on every render.
  const key = `${lang}::${list.join('\u241F')}`;

  useEffect(() => {
    if (lang === 'ar') {
      setTranslated(list);
      return undefined;
    }
    const myId = ++requestId.current;
    let cancelled = false;
    translateAll(list, lang, 'ar').then((result) => {
      if (cancelled || myId !== requestId.current) return;
      setTranslated(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang]);

  return translated;
}
