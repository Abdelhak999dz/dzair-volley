import React, { useLayoutEffect, useRef } from 'react';
import Plyr from 'plyr';
// Plyr's stylesheet and its SVG icon sprite both ship inside the npm package
// (`plyr` in package.json) and are bundled by Vite — nothing is ever loaded
// from cdn.plyr.io, which the site's Content-Security-Policy would block
// (`connect-src` is limited to 'self' + the API hosts).
import 'plyr/dist/plyr.css';
import plyrSprite from 'plyr/dist/plyr.svg?raw';

// ============================================================
// PlyrVideo — one professional Plyr player for a direct video file.
//
// WHY THE <video> IS CREATED IMPERATIVELY
//   Plyr re-parents the <video> it is given: it wraps it in its own
//   `<div class="plyr">` (video wrapper, poster layer, controls …). If React
//   owned that <video>, React's own bookkeeping would still point at the
//   *old* parent, and the next re-render / unmount would try to remove a node
//   from a parent it no longer lives in → "NotFoundError: Failed to execute
//   'removeChild'" — the classic Plyr-in-React crash. So React only renders
//   one empty host <div>; the <video> and the whole Plyr tree live inside it
//   and are created / destroyed together, by this component, in the layout
//   effect below. React never sees them.
//
// WHAT THE PARENT GETS
//   * `onVideoNode(video | null)`  the raw <video> element — VideoPlayer
//     forwards it as its `ref`, exactly as before Plyr existed.
//   * `onPlayer(plyr | null)`      the Plyr instance (fullscreen state, the
//     `.plyr` container that overlays are portalled into).
//   * `events`                     native media-event handlers (play, pause,
//     error, waiting, …) attached straight to the <video>. They are removed
//     *before* teardown, so the `error` event a destroyed player fires while
//     it cancels its network requests can never reach the parent.
//
// POSTER (cover image)
//   The cover is handed to Plyr as `data-poster` (+ the native `poster`
//   attribute). Plyr paints it in its own layer, so it looks the same on every
//   browser and stays put until playback really starts. For the modal player
//   the poster additionally stays on screen until the *first video frame has
//   been presented* (`reel-plyr-awaiting-frame`, see index.css) — otherwise
//   the poster would vanish the instant play() is called and the visitor would
//   see a black rectangle while the first frames are still buffering.
//
// LAZY ARMING (`armed` prop — v2)
//   Building a real <video> + Plyr instance for every reel card the moment it
//   mounts means a page with a dozen reels starts a dozen media elements and
//   Plyr instances at once — real work on the main thread and the network,
//   for cards nobody has scrolled to yet. `armed` gates that: while it is
//   false the component renders only its empty host <div> and does nothing
//   else (the reel's own always-present `.reel-video-poster` <img>, painted
//   by the parent independently of this component, is all the visitor sees —
//   see VideoPlayer.jsx's "PERMANENT POSTER LAYER"). The moment the parent
//   flips `armed` to true (VideoPlayer.jsx arms a card once it is within
//   ~800px of the viewport, via IntersectionObserver) this same effect runs
//   for the first time and builds the player exactly as before. Once armed,
//   a card is never disarmed again for the rest of its life — this is a
//   one-time, one-directional gate on *initial construction* only, layered
//   on top of the existing "STABLE CARD, NEVER REBUILT" guarantee, not a
//   replacement for it.
// ============================================================

const SPRITE_ID = 'sprite-plyr';
// Plyr only needs this to be a same-origin URL: with the sprite injected
// inline (below) it references icons as `#plyr-play`, `#plyr-pause`, …
// and never fetches the URL.
const SAME_ORIGIN_ICON_URL = '/plyr.svg';

// Puts Plyr's SVG icon sprite into the page once. Using the id Plyr itself
// uses (`sprite-plyr`) also makes Plyr skip its own network load of the sprite.
function ensurePlyrSprite() {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById(SPRITE_ID)) return;
  const holder = document.createElement('div');
  holder.id = SPRITE_ID;
  holder.hidden = true;
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = plyrSprite;
  document.body.insertBefore(holder, document.body.firstChild);
}

// The cover is painted by Plyr as a CSS `background-image: url('…')`, so keep
// quotes, parentheses, backslashes and whitespace out of the URL. Anything
// else — https URLs, site-relative paths, base64 data: / blob: URLs — is
// left exactly as it was.
function safeCoverUrl(poster) {
  const value = String(poster || '').trim();
  if (!value) return '';
  return value.replace(/["'\\()\s]/g, (c) => encodeURIComponent(c));
}

// Native media events forwarded to `events.<name>` (see the header comment).
const NATIVE_EVENTS = [
  'loadstart',
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'playing',
  'play',
  'pause',
  'waiting',
  'stalled',
  'error',
  'ended',
];

export default function PlyrVideo({
  src,
  poster,
  variant = 'card', // 'card' (cover + big play button) | 'modal' (full controls)
  controls,
  autoPlay = false,
  loop = false,
  preload = 'metadata',
  hostClassName = '',
  hostStyle,
  videoClassName = '',
  i18n,
  events,
  onVideoNode,
  onPlayer,
  // Lazy construction gate — see the "LAZY ARMING" note above. Defaults to
  // true so every other caller (and the modal, which is only ever rendered
  // once already open) behaves exactly as before; only VideoPlayer.jsx's
  // card instance passes this in as a real gate.
  armed = true,
}) {
  const hostRef = useRef(null);
  // Latest callbacks, read at call time, so the effect below only has to
  // re-run when the *media* changes — never because a parent re-rendered.
  const eventsRef = useRef(events);
  const onVideoNodeRef = useRef(onVideoNode);
  const onPlayerRef = useRef(onPlayer);
  const i18nRef = useRef(i18n);
  eventsRef.current = events;
  onVideoNodeRef.current = onVideoNode;
  onPlayerRef.current = onPlayer;
  i18nRef.current = i18n;

  const controlsKey = Array.isArray(controls) ? controls.join(',') : '';

  useLayoutEffect(() => {
    const host = hostRef.current;
    // Not armed yet: stay an empty host div (see the "LAZY ARMING" note
    // above) — nothing to build or tear down.
    if (!host || !src || !armed) return undefined;

    ensurePlyrSprite();

    // ---- the <video> (Plyr's input) ---------------------------------
    const cover = safeCoverUrl(poster);
    const video = document.createElement('video');
    if (videoClassName) video.className = videoClassName;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    video.playsInline = true;
    video.setAttribute('controlslist', 'nodownload noplaybackrate');
    video.preload = preload;
    video.loop = !!loop;
    // Native controls stay on until Plyr takes over: if Plyr can't start in
    // some ancient browser, the visitor still gets a working native player.
    video.controls = true;
    if (cover) {
      video.setAttribute('data-poster', cover);
      video.poster = cover;
    }
    video.src = src;
    host.appendChild(video);

    // ---- native media events → parent -------------------------------
    const listeners = NATIVE_EVENTS.map((type) => {
      const fn = (e) => {
        const handlers = eventsRef.current;
        if (handlers && typeof handlers[type] === 'function') handlers[type](e);
      };
      video.addEventListener(type, fn);
      return [type, fn];
    });

    // ---- Plyr ---------------------------------------------------------
    const isModal = variant === 'modal';
    let player = null;
    try {
      const options = {
        controls: controls && controls.length ? controls : ['play-large'],
        settings: ['speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        // Icons: the sprite is already inline (see ensurePlyrSprite).
        iconUrl: SAME_ORIGIN_ICON_URL,
        loadSprite: false,
        // Plyr swaps in a tiny "blank" clip when it is destroyed, to cancel
        // pending downloads. Its default lives on cdn.plyr.io; an empty
        // source cancels the request just as well without any third party.
        blankVideo: '',
        autoplay: false,
        clickToPlay: true,
        hideControls: isModal,
        resetOnEnd: false,
        invertTime: false,
        seekTime: 10,
        volume: 1,
        muted: false,
        loop: { active: !!loop },
        // Never persist volume / mute / speed between visitors' videos: a
        // remembered "muted" would look like a silent-video bug.
        storage: { enabled: false },
        keyboard: { focused: isModal, global: false },
        tooltips: { controls: false, seek: true },
        // Fullscreen on the player container. `fallback: true` gives iPhone
        // Safari (which has no element-fullscreen API) a full-window mode
        // instead of a dead button.
        fullscreen: { enabled: true, fallback: true, iosNative: false },
      };
      // Only pass `i18n` when there is something to merge: an explicit
      // `undefined` would overwrite Plyr's built-in English strings.
      if (i18nRef.current) options.i18n = i18nRef.current;
      player = new Plyr(video, options);
    } catch (err) {
      player = null; // native controls remain — see above.
    }

    const container = player && player.elements ? player.elements.container : null;
    if (player && typeof player.on === 'function') {
      ['enterfullscreen', 'exitfullscreen'].forEach((type) => {
        player.on(type, (e) => {
          const handlers = eventsRef.current;
          if (handlers && typeof handlers[type] === 'function') handlers[type](e);
        });
      });
    }

    // ---- keep the poster until the first frame is really on screen ----
    let firstFrameShown = !isModal; // only the modal needs the guard
    let frameTimer = 0;
    const setAwaitingFrame = (on) => {
      if (container && container.classList) container.classList.toggle('reel-plyr-awaiting-frame', on);
    };
    const onPlayingNow = () => {
      if (firstFrameShown) return;
      firstFrameShown = true;
      const done = () => {
        window.clearTimeout(frameTimer);
        setAwaitingFrame(false);
      };
      // Safety net: never keep the poster up for good.
      frameTimer = window.setTimeout(done, 1500);
      if (typeof video.requestVideoFrameCallback === 'function') {
        try {
          video.requestVideoFrameCallback(done);
          return;
        } catch (err) {
          // fall through to the rAF path
        }
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(done));
    };
    if (isModal) {
      // Hold the cover from the very start — not only once play() is called —
      // so it is also what the visitor sees if the browser refuses to
      // autoplay (Plyr then shows it with its big play button).
      setAwaitingFrame(true);
      video.addEventListener('playing', onPlayingNow);
    }

    if (onVideoNodeRef.current) onVideoNodeRef.current(video);
    if (onPlayerRef.current) onPlayerRef.current(player);

    // ---- autoplay (the modal) -----------------------------------------
    // Called synchronously while the visitor's tap is still being handled
    // (VideoPlayer mounts the modal with flushSync from the click), which is
    // what lets iOS Safari start a video that has sound. If a browser still
    // refuses, Plyr simply shows the poster + its big play button.
    if (autoPlay) {
      try {
        const started = player ? player.play() : video.play();
        if (started && typeof started.catch === 'function') started.catch(() => {});
      } catch (err) {
        // ignored — see above
      }
    }

    return () => {
      // 1) Nothing the teardown does may reach the parent.
      listeners.forEach(([type, fn]) => video.removeEventListener(type, fn));
      video.removeEventListener('playing', onPlayingNow);
      window.clearTimeout(frameTimer);
      if (onPlayerRef.current) onPlayerRef.current(null);
      if (onVideoNodeRef.current) onVideoNodeRef.current(null);
      // 2) Silence the media right away (audio must never outlive the UI).
      try {
        video.pause();
      } catch (err) {
        // ignored
      }
      // 3) Let Plyr unwind its wrapper and hand the original <video> back.
      try {
        if (player) player.destroy();
      } catch (err) {
        // ignored — the host is emptied below either way.
      }
      // 4) Release the decoder / network connection and empty the host, so
      //    React's own (empty) host node is all that is ever left behind.
      try {
        video.removeAttribute('src');
        video.load();
      } catch (err) {
        // ignored
      }
      host.textContent = '';
    };
    // Re-created only when the media itself changes, or the first time
    // `armed` flips from false to true (see the "LAZY ARMING" note above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, poster, variant, controlsKey, loop, preload, videoClassName, armed]);

  return <div ref={hostRef} className={hostClassName} style={hostStyle} dir="ltr" />;
}
