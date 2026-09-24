import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import PlyrVideo from './PlyrVideo.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getPlyrI18n } from '../services/plyrI18n.js';
import { dataUrlToBlob, embedWithAutoplay, exitVideoFullscreen, getFullscreenElement, parseVideoSource, withFirstFrameHint } from '../services/videoSource.js';

// ============================================================
// VideoPlayer — the fixed reel/video player (no more black screen).
//
//  * Direct files  → a "pure static poster card" at rest (see the
//    "PURE STATIC POSTER CARD" architecture note just below), then a
//    real Plyr <video> only inside the popup modal once the visitor
//    taps.
//  * Legacy base64 → decoded into a Blob URL (huge data: URLs cannot be
//    played directly by most browsers).
//  * Platform links (YouTube, Vimeo, Facebook, Instagram, TikTok,
//    Dailymotion, Google Drive) → a sandboxed iframe, mounted only after
//    the visitor taps play (fast page load, no third-party tracking until
//    the visitor opts in). Unchanged by the rewrite below — an iframe was
//    never the source of the black-screen bug, only a real <video> was.
//  * Anything that fails to load → a clear message + "open link" button
//    instead of an empty black rectangle.
//
//  ============================================================
//  PURE STATIC POSTER CARD (current architecture — replaces every
//  previous card-side video/Plyr instance for good, the streaming-
//  platform-style architecture requested to close the black-screen bug
//  permanently rather than patch around it again):
//
//   1) PURE STATIC POSTER CARD — the small reel card in the grid never
//      creates, mounts, or arms a <video> element (Plyr or native) of
//      any kind. It renders exactly one thing on top of the card's
//      resting background: a plain `<img class="reel-video-poster">`
//      (the cover the admin uploaded) — see the JSX below. A browser
//      can only ever paint a normal, already-decoded image there, so a
//      black/blank card is now architecturally impossible: there is no
//      video decoder, no compositor layer, no Plyr instance, nothing
//      that could ever fail to paint. The big round "play" button the
//      visitor sees on top of that cover is rendered by the parent
//      (components/ReelsSection.jsx's `.reel-play-btn`) and by this
//      component's own `.reel-video-fs-wrap` tap target — either one
//      opens the very same modal below.
//
//   2) MODAL-ONLY VIDEO — a real <video> is created for a direct file
//      only once the visitor actually taps the card and the modal
//      opens: `openModalPlayer()` flushes a synchronous state update
//      (`flushSync`) that mounts `{modalOpen && createPortal(...)}`
//      below, and that JSX is the *only* place a `<PlyrVideo>` is
//      rendered for a direct file anywhere in this component. Doing it
//      inside `flushSync`, in the same tick as the visitor's tap, is
//      also what lets iOS Safari allow autoplay-with-sound instead of
//      opening on a silent, paused frame.
//
//   3) COMPLETE CLEANUP ON CLOSE — the modal's JSX is written as
//      `{modalOpen && createPortal(...)}`, so the instant
//      `closeModalPlayer()` (the × button, a tap outside the frame, or
//      Escape) flips `modalOpen` to `false`, React tears the *entire*
//      portal subtree out of `document.body` in that very commit.
//      `<PlyrVideo>`'s own cleanup effect (components/PlyrVideo.jsx)
//      runs synchronously as part of that unmount and destroys the Plyr
//      instance, pauses the video, strips its `src` and calls `load()`,
//      then empties its host `<div>` — so the `<video>` element itself
//      is completely removed from the DOM, not merely hidden or paused.
//      The screen falls straight back to the same, never-touched static
//      poster card described in (1) — instantly, with no flicker and no
//      leftover video/audio of any kind.
//
//   4) SCREEN-LOCK & GESTURE PROTECTION — unchanged from before: the
//      modal pins `<body>` with `position: fixed` while open (see the
//      scroll-lock effect below) and every reel/modal element keeps its
//      `overscroll-behavior: contain` / `touch-action: manipulation`
//      guards in index.css, so opening or closing a reel can never
//      trigger the mobile browser's pull-to-refresh or move the page
//      behind the modal.
//  ============================================================
//
//  * BUFFERING / LOADING STATE — a short, elegant spinner (`.reel-buffer-
//    spinner`) is layered over the modal's <video> (and over a platform
//    iframe while it loads) between `waiting`/`loadstart` and
//    `playing`/`canplay`, so a slow network shows a clear "still loading"
//    cue instead of a frozen frame or a flash of black — regardless of
//    the video's format or where it's hosted.
//
//  * PLYR PLAYER — the modal's <video> (components/PlyrVideo.jsx) runs on
//    Plyr (https://plyr.io) with the full control bar (play, seek bar,
//    time, mute/volume, speed, fullscreen). Plyr fullscreens its own
//    container (full-window CSS fallback on iPhone Safari); the close
//    (×) button + buffering spinner are portalled *into* that container
//    so they stay visible in fullscreen too. Leaving fullscreen only
//    shrinks the player back into the modal; closing the modal (×, tap
//    outside, Escape) is what returns to the static poster card — see
//    (3) above. Both are plain state changes — never a page reload.
// ============================================================

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

// Close (×) glyph for the modal's close button — see `.reel-modal-close`
// in index.css.
function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Buffering/loading overlay — see the "BUFFERING / LOADING STATE" note
// above. Purely visual (`aria-hidden`) and `pointer-events: none` (see
// index.css) so it never blocks a tap on the video's own controls.
function BufferSpinner() {
  return (
    <div className="reel-buffer-spinner" aria-hidden="true">
      <span className="reel-buffer-spinner-ring" />
    </div>
  );
}

// See the "Black screen, audio only" fix history. Safe to call repeatedly —
// it only nudges the position when we're still sitting at the very start,
// and any seek error (some browsers refuse it before enough data is
// buffered) is silently ignored since the CSS-side GPU-layer fix still
// applies regardless.
function kickFirstFramePaint(video) {
  if (!video) return;
  try {
    if (video.currentTime === 0 && video.readyState >= 2) {
      video.currentTime = 0.001;
    }
  } catch (e) {
    // Ignored — see comment above.
  }
}

// Plyr control set for the modal — the only place a Plyr instance is ever
// created for a direct video file now (see the "PURE STATIC POSTER CARD" /
// "MODAL-ONLY VIDEO" notes above).
const MODAL_CONTROLS = ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'];

// Keeps the modal's frame sane for freak metadata (0 / absurdly wide clips).
function clampRatio(ratio) {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return 0;
  return Math.min(2.4, Math.max(0.4, ratio));
}

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    src, poster, title, onStart, onPlayingChange, onFailure, unavailableLabel, openLabel, playLabel, closeLabel,
    // Above-the-fold reels get `loading="eager"`/`fetchPriority="high"` on
    // their poster <img> instead of the lazy/low-priority defaults every
    // other card gets (the classic LCP-image fix). Purely a hint for that
    // one <img> — it has no other effect now that the card never builds a
    // video/Plyr instance of its own to "arm".
    priority = false,
  },
  ref
) {
  const { lang } = useLanguage();
  // Plyr's tooltips / aria-labels in the visitor's language.
  const plyrTexts = useMemo(() => getPlyrI18n(lang), [lang]);
  const source = useMemo(() => parseVideoSource(src), [src]);
  const [failed, setFailed] = useState(false);
  const [embedActive, setEmbedActive] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');
  // Custom modal player state. `modalVideoRef` is the modal's own <video>
  // element and `modalPlayerRef` its Plyr instance — the only <video>/Plyr
  // pair this component ever creates for a direct file (see the
  // "PURE STATIC POSTER CARD" / "MODAL-ONLY VIDEO" notes above).
  const modalVideoRef = useRef(null);
  const modalPlayerRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Synchronous mirror of `modalOpen`, so two triggers in the same tick (a
  // tap on the card and a tap on the explicit play button) can never open
  // two modals.
  const modalOpenRef = useRef(false);
  // The modal Plyr's `.plyr` container (null until Plyr is up). The close
  // button and the buffering spinner are portalled into it so they keep
  // showing when Plyr's fullscreen takes that container over the screen.
  const [modalPlyrEl, setModalPlyrEl] = useState(null);
  // Width / height of the clip, so the modal frame hugs it: a portrait reel
  // gets a tall narrow player instead of a wide black box. 0 = not known yet
  // (the stylesheet then assumes 16:9) — refined the moment the modal's own
  // <video> reports its real metadata.
  const [modalRatio, setModalRatio] = useState(0);
  // Buffering cue for the modal's own <video> — true between
  // `waiting`/`loadstart` and `playing`/`canplay`. See BufferSpinner and
  // the "BUFFERING / LOADING STATE" note above.
  const [modalBuffering, setModalBuffering] = useState(false);
  // Same idea for a platform-embed iframe (YouTube/Vimeo/...): true from
  // the moment the visitor taps the facade until the iframe's own `load`
  // event fires, so a slow embed shows a spinner instead of a flash of
  // plain black.
  const [embedLoading, setEmbedLoading] = useState(false);

  // Closes the custom modal player: leaves fullscreen if it is on, pauses and
  // rewinds the modal's own <video> (so playback and any audio definitely
  // stop before the modal disappears), then unmounts the modal itself —
  // see the "COMPLETE CLEANUP ON CLOSE" note at the top of this file for
  // why that unmount alone is enough to fully destroy the <video>/Plyr
  // instance and guarantee no audio or leftover DOM node can survive it.
  // Used by the modal's (×) button, a tap outside the video frame, the
  // Escape key, and a modal playback error — see below.
  const closeModalPlayer = () => {
    // If the visitor is currently in fullscreen (Plyr's fullscreen button),
    // leave it first — otherwise some browsers keep the fullscreen element
    // pinned even after its subtree is torn out of the DOM below, which is
    // what a stuck/blank fullscreen surface would look like. Plyr's own exit
    // handles both the real Fullscreen API and its full-window fallback;
    // exitVideoFullscreen() is the safety net for anything Plyr does not
    // own. Wrapped defensively; see exitVideoFullscreen()'s own try/catch.
    let leftFullscreen = false;
    try {
      const plyr = modalPlayerRef.current;
      if (plyr && plyr.fullscreen && plyr.fullscreen.active) {
        plyr.fullscreen.exit();
        leftFullscreen = true;
      }
    } catch (e) {
      // Ignored — the safety net below still runs.
    }
    if (!leftFullscreen && getFullscreenElement()) {
      exitVideoFullscreen(modalVideoRef.current);
    }
    const video = modalVideoRef.current;
    if (video) {
      try {
        video.pause();
      } catch (e) {
        // Ignored.
      }
      try {
        video.currentTime = 0;
      } catch (e) {
        // Ignored — some browsers refuse a seek before enough data is
        // buffered; the video is already paused/reset visually either way.
      }
    }
    // ------------------------------------------------------------
    // FULL RELOAD ON CLOSE — requested fix for a black-screen regression
    // still observed in practice. Earlier revisions of this component
    // tried to avoid a full reload (see the removed comment that used to
    // sit here) by relying purely on the portal unmount above to tear
    // down the <video>/Plyr instance. That unmount is still done first,
    // above, so playback and any decoder/compositor state are already
    // torn down before we get here — but a reload is still forced right
    // after it to flush the browser's graphics/compositor layer
    // completely and guarantee the black screen can never reappear.
    //
    // To make sure this reload never reproduces the old "page jumps to
    // the top" bug on mobile or desktop, the current scroll position is
    // saved to sessionStorage first and restored instantly (no smooth
    // animation) by the app's root component the moment the page comes
    // back up — see the restore effect in src/App.jsx.
    // ------------------------------------------------------------
    try {
      sessionStorage.setItem('dzair_scroll', String(window.scrollY || window.pageYOffset || 0));
    } catch (e) {
      // Ignored — sessionStorage can be unavailable (private mode, quota,
      // disabled storage); the reload below still happens, the page will
      // simply land at the top in that rare case.
    }
    modalOpenRef.current = false;
    setModalOpen(false);
    setModalBuffering(false);
    setModalRatio(0);
    if (onPlayingChange) onPlayingChange(false);
    window.location.reload();
  };

  // Opens the modal player. Runs *inside the visitor's tap* (see
  // `handleCardActivate`) — `flushSync` renders the modal and creates its
  // Plyr instance before this function returns, and <PlyrVideo> calls
  // play() as part of that, all still within the same user gesture. That
  // is what lets the video start immediately with sound on browsers that
  // only allow playback from a gesture (iOS Safari), instead of opening on
  // a paused poster. This is also the exact moment — and the *only*
  // moment — a real <video> is ever created for a direct file; see the
  // "MODAL-ONLY VIDEO" note at the top of this file.
  const openModalPlayer = () => {
    if (modalOpenRef.current) return;
    modalOpenRef.current = true;
    flushSync(() => {
      setModalRatio(0);
      setModalBuffering(true);
      setModalOpen(true);
    });
    if (onPlayingChange) onPlayingChange(true);
    if (onStart) onStart();
  };

  // Exposed to the parent (components/ReelsSection.jsx) instead of a raw
  // <video> node — the card no longer has one to hand back (see "PURE
  // STATIC POSTER CARD" above). `open()` is the single entry point the
  // parent's own play button / tap handler needs.
  useImperativeHandle(ref, () => ({
    open: openModalPlayer,
  }));

  // A tap anywhere on the static poster card opens the modal. This is the
  // only interactive behaviour the card itself owns; components/
  // ReelsSection.jsx's own `.reel-play-btn` calls the exact same
  // `open()` above through the imperative handle.
  const handleCardActivate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModalPlayer();
  };

  // Let the Escape key close the modal too, and lock page scroll behind
  // it while it's open (a full-viewport modal that still allows the page
  // underneath to scroll feels broken on touch devices).
  //
  // MOBILE SCROLL-LOCK — the actual fix for the reported "annoying jump"
  // when opening/closing a reel on a phone. `overflow: hidden` alone (the
  // previous approach) does not reliably stop the page from moving on
  // mobile Safari/Chrome: the address bar can still show/hide while it's
  // "hidden", and on iOS in particular the body can still rubber-band
  // under a finger even with overflow hidden. When that happens, the
  // instant the modal closes and `overflow` is restored, the browser
  // snaps back to whatever scroll position it was actually at — which is
  // rarely the exact position the visitor was reading before they tapped
  // play, and reads as a sudden, jarring jump.
  //
  // The reliable, cross-browser fix (the same technique used by every
  // major "body-scroll-lock" library) is to pin the body itself in place
  // with `position: fixed` at its *current* scroll offset while the modal
  // is open — which makes it physically impossible for any touch/scroll
  // gesture behind the modal to move the page — and then explicitly
  // restore the exact same scroll position with `window.scrollTo` the
  // instant the modal closes, before the browser gets a chance to pick
  // its own. No page navigation or reload is involved at any point.
  useEffect(() => {
    if (!modalOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // While the player is in fullscreen, Escape is the "leave fullscreen"
      // shortcut — do just that (Plyr's fallback mode has no browser
      // shortcut of its own, so it is done here) instead of also closing the
      // whole modal in the same keystroke, which would otherwise stop
      // playback the visitor only meant to shrink back down to the modal
      // view.
      const plyr = modalPlayerRef.current;
      const plyrFullscreen = !!(plyr && plyr.fullscreen && plyr.fullscreen.active);
      if (getFullscreenElement() || plyrFullscreen) {
        // Browsers normally leave native fullscreen on Escape by themselves;
        // Plyr's full-window fallback has no such shortcut. Asking Plyr to
        // exit is harmless when the browser is already doing it.
        if (plyrFullscreen) {
          try {
            const leaving = plyr.fullscreen.exit();
            if (leaving && typeof leaving.catch === 'function') leaving.catch(() => {});
          } catch (err) {
            // Ignored.
          }
        }
        return;
      }
      closeModalPlayer();
    };
    document.addEventListener('keydown', handleKeyDown);

    // However fullscreen was left — Plyr's button, Escape, the Android back
    // gesture, swiping down on iOS — the browser fires `fullscreenchange`.
    // Right after it, nudge the video so no browser is left showing a stale
    // or black frame until the next tap (see kickFirstFramePaint above). A
    // plain repaint: no layout change, no remount, no reload.
    const handleFullscreenChange = () => {
      window.requestAnimationFrame(() => kickFirstFramePaint(modalVideoRef.current));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      // Put the page back exactly where it was — instantly (no smooth
      // animation) and with no hash/navigation involved, so this can never
      // be mistaken for a reload or a jump to a different spot.
      //
      // `behavior: 'auto'` alone is NOT instant on this site: 'auto' means
      // "whatever the CSS says", and index.css sets `html { scroll-behavior:
      // smooth }` — so the page (already back at the top, now that the body
      // is no longer pinned) would visibly glide down to the old position,
      // which is exactly the kind of jump the scroll lock exists to prevent.
      // Forcing `scroll-behavior: auto` inline for this one call makes the
      // restore immediate; the inline value is removed straight afterwards.
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollY);
      root.style.scrollBehavior = previousBehavior;
    };
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the error state whenever the source changes.
  useEffect(() => {
    setFailed(false);
    setEmbedActive(false);
    setEmbedLoading(false);
    modalOpenRef.current = false;
    setModalOpen(false);
    setModalBuffering(false);
  }, [src]);

  // Legacy rows saved as base64 data: URLs → play through a Blob URL.
  useEffect(() => {
    if (source.kind !== 'data') {
      setBlobUrl('');
      return undefined;
    }
    const blob = dataUrlToBlob(source.src);
    if (!blob) {
      setFailed(true);
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source.kind, source.src]);

  // Let the parent hide its own play button when the media can't be played.
  const isUnplayable = failed || source.kind === 'invalid' || source.kind === 'none';
  useEffect(() => {
    if (isUnplayable && onFailure) onFailure();
  }, [isUnplayable]); // eslint-disable-line react-hooks/exhaustive-deps

  const openHref = source.kind === 'embed' || source.kind === 'file' ? source.src : '';

  if (failed || source.kind === 'invalid' || source.kind === 'none') {
    return (
      <div className="reel-video reel-video--fallback" role="alert">
        {poster && <img className="reel-fallback-poster" src={poster} alt="" loading="lazy" />}
        <div className="reel-fallback-box">
          <p>{unavailableLabel}</p>
          {openHref && (
            <a className="reel-fallback-link" href={openHref} target="_blank" rel="noopener noreferrer">
              {openLabel}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (source.kind === 'embed') {
    if (!embedActive) {
      return (
        <button
          type="button"
          className="reel-video reel-embed-facade"
          onClick={() => {
            setEmbedActive(true);
            setEmbedLoading(true);
            if (onStart) onStart();
            if (onPlayingChange) onPlayingChange(true);
          }}
          aria-label={playLabel}
          title={playLabel}
        >
          {poster && <img className="reel-fallback-poster" src={poster} alt="" loading="lazy" />}
          <span className="reel-facade-play"><PlayGlyph /></span>
        </button>
      );
    }
    return (
      <>
        <iframe
          className="reel-video reel-embed"
          src={embedWithAutoplay(source.embedUrl, source.provider)}
          title={title || 'video'}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
          onLoad={() => setEmbedLoading(false)}
        />
        {/* Loading cue for the embed — see the "BUFFERING / LOADING
            STATE" note above; fades away as soon as the iframe's own
            `load` event fires. */}
        {embedLoading && <BufferSpinner />}
      </>
    );
  }

  const playable = source.kind === 'data' ? blobUrl : withFirstFrameHint(source.src);
  if (!playable) return <div className="reel-video reel-video--loading" aria-busy="true" />;

  // Native media events of the modal's <video> — the only <video> this
  // component ever creates for a direct file (see the "MODAL-ONLY VIDEO"
  // note at the top of this file).
  const modalEvents = {
    loadstart: () => setModalBuffering(true),
    loadedmetadata: (e) => {
      const v = e.target;
      if (v && v.videoWidth && v.videoHeight) setModalRatio(clampRatio(v.videoWidth / v.videoHeight));
    },
    loadeddata: (e) => kickFirstFramePaint(e.target),
    canplay: (e) => {
      kickFirstFramePaint(e.target);
      setModalBuffering(false);
    },
    playing: () => setModalBuffering(false),
    waiting: () => setModalBuffering(true),
    stalled: () => setModalBuffering(true),
    error: () => {
      setFailed(true);
      closeModalPlayer();
    },
  };

  // Close (×) button + buffering spinner of the modal. Rendered *inside*
  // Plyr's container (portal) whenever Plyr is up, so they stay on screen in
  // fullscreen; rendered in place if Plyr could not start (the native
  // controls are then showing instead).
  const modalUi = (
    <>
      <div className="reel-modal-controls">
        <button
          type="button"
          className="reel-modal-close"
          onClick={closeModalPlayer}
          aria-label={closeLabel || 'Close'}
          title={closeLabel || 'Close'}
        >
          <CloseGlyph />
        </button>
      </div>
      {/* Buffering cue for the modal video itself — see BufferSpinner
          and the "BUFFERING / LOADING STATE" note above. */}
      {modalBuffering && <BufferSpinner />}
    </>
  );

  return (
    <>
    <div className="reel-video-fs-wrap" onClickCapture={handleCardActivate}>
      {/* PURE STATIC POSTER CARD — see the header comment at the top of
          this file. A plain <img>, nothing else: no <video>, no Plyr, no
          conditional rendering, no `key` that could ever force a remount.
          It is painted once, the instant this card mounts, and is never
          touched again for the entire lifetime of the card — including
          the exact moment the modal opens or closes — so there is no
          instant in which the card can show anything but this cover. Its
          stacking position is fixed purely in CSS (`.reel-video-poster`
          z-index in index.css), and it is `pointer-events: none` so it
          never intercepts the tap that opens the modal (handled by the
          wrapper's own `onClickCapture` above). */}
      {poster && (
        <img
          className="reel-video-poster"
          src={poster}
          alt=""
          aria-hidden="true"
          // The first, above-the-fold reels paint their cover eagerly and
          // at high priority (the classic LCP-image fix); every later
          // card keeps the browser's own lazy/auto scheduling — see the
          // `priority` prop note above. Neither attribute changes what
          // eventually shows, only how soon the browser is told to fetch
          // it.
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
        />
      )}
      {/* No poster on file: still a plain, static placeholder — never a
          <video> element. */}
      {!poster && <div className="reel-video reel-video--loading" aria-hidden="true" />}
    </div>
    {/* Custom cinematic modal player — mounted through a portal onto
        `document.body` so it always covers the entire viewport
        (`fixed inset-0`) no matter where this card sits in the page —
        including on top of the navbar and every other section. This is
        the only place a real <video>/Plyr instance is ever created for a
        direct file (see "MODAL-ONLY VIDEO" above) and, since it is
        rendered conditionally on `modalOpen`, the only place one is ever
        destroyed too (see "COMPLETE CLEANUP ON CLOSE" above). Clicking
        the (×) button or anywhere outside the video frame itself closes
        it via closeModalPlayer(), which explicitly pauses and rewinds
        this modal's own <video> first. */}
    {modalOpen && createPortal(
      <div
        className="reel-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title || playLabel}
        onClick={closeModalPlayer}
      >
        <div className="reel-modal-inner" onClick={(e) => e.stopPropagation()}>
          <PlyrVideo
            variant="modal"
            src={playable}
            poster={poster}
            controls={MODAL_CONTROLS}
            autoPlay
            loop
            preload="auto"
            i18n={plyrTexts}
            hostClassName="reel-plyr reel-plyr--modal"
            hostStyle={modalRatio ? { '--reel-ar': String(modalRatio) } : undefined}
            videoClassName="reel-modal-video"
            events={modalEvents}
            onVideoNode={(node) => {
              modalVideoRef.current = node;
            }}
            onPlayer={(plyr) => {
              modalPlayerRef.current = plyr;
              setModalPlyrEl((plyr && plyr.elements && plyr.elements.container) || null);
            }}
          />
          {modalPlyrEl ? createPortal(modalUi, modalPlyrEl) : modalUi}
        </div>
      </div>,
      document.body
    )}
    </>
  );
});

export default VideoPlayer;
