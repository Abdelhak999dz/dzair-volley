import React, { useRef, useState } from 'react';
import useRevealObserver from '../hooks/useRevealObserver.js';
import usePersistentState from '../hooks/usePersistentState.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import useLiveTranslate from '../hooks/useLiveTranslate.js';
import { IconEye, IconHeart, IconHeartFilled, IconComment, IconShare } from './icons/AdminIcons.jsx';
import CommentBox from './CommentBox.jsx';
import ShareModal from './ShareModal.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import { parseVideoSource, requestVideoFullscreen } from '../services/videoSource.js';
import { allowAction } from '../security/rateLimiter.js';

const INITIAL_VISIBLE = 3;

function formatViews(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const ReelCard = React.memo(function ReelCard({
  reel, index, isLiked, comments, isCommentBoxOpen, isShareOpen,
  onLike, onToggleComments, onSubmitComment, onEditComment, onDeleteComment, onToggleShare, onFirstView, shareLabel, commentLabel, unavailableLabel, openLabel, playLabel, closeLabel,
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // A play can be reported twice in the same tick (play button + the
  // <video> onPlay event) — count the view only once per card.
  const viewSentRef = useRef(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const fireFirstView = () => {
    if (viewSentRef.current) return;
    viewSentRef.current = true;
    onFirstView(reel.id);
  };
  // Live-translates this reel's caption/title into the visitor's chosen
  // language — see hooks/useLiveTranslate.js.
  const [translatedTitle] = useLiveTranslate([reel.title]);
  // The big centre play button is only meaningful for direct video files
  // (platform embeds show their own tap-to-play facade).
  const sourceKind = parseVideoSource(reel.videoUrl).kind;
  const isDirectFile = (sourceKind === 'file' || sourceKind === 'data') && !playbackFailed;

  // Opens the cinematic modal player. The card itself is a pure static
  // poster (no <video>/Plyr element of any kind — see the "PURE STATIC
  // POSTER CARD" note in components/VideoPlayer.jsx), so there is nothing
  // to play/pause in place here any more: `videoRef.current` is the
  // imperative handle VideoPlayer exposes (`{ open() }`), and `open()`
  // mounts the modal's own real <video> for the first time, right inside
  // this click handler, for the browser's autoplay user-gesture
  // requirement. `isPlaying` itself is driven by VideoPlayer's own
  // `onPlayingChange` callback below (fired the instant the modal opens or
  // closes), and the first-view ping is fired by VideoPlayer's `onStart`
  // callback, so neither needs to be duplicated here.
  const togglePlay = () => {
    const player = videoRef.current;
    if (player && typeof player.open === 'function') player.open();
  };

  return (
    <div className={`reel-card reveal ${isPlaying ? 'is-playing' : ''}`} style={{ transitionDelay: `${index * 0.06}s` }}>
      {/* Robust player: the card itself is a pure static poster image (no
          <video>/Plyr element ever exists here — see the "PURE STATIC
          POSTER CARD" note in components/VideoPlayer.jsx); direct files
          play in a popup modal built only once the visitor taps, platform
          links (YouTube/Facebook/Instagram/...) use a sandboxed iframe, and
          failures show a message instead of a black box. */}
      <VideoPlayer
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.poster}
        title={translatedTitle}
        onStart={fireFirstView}
        onPlayingChange={setIsPlaying}
        onFailure={() => setPlaybackFailed(true)}
        unavailableLabel={unavailableLabel}
        openLabel={openLabel}
        playLabel={playLabel}
        closeLabel={closeLabel}
        // The first cards are the ones visible without scrolling — see the
        // poster-priority note in VideoPlayer.jsx.
        priority={index < INITIAL_VISIBLE}
      />

      <div className="reel-overlay" onClick={(e) => e.target === e.currentTarget && togglePlay()}>
        <span className="reel-views"><IconEye /> {formatViews(reel.views)}</span>
        {!isPlaying && isDirectFile && (
          <button
            type="button"
            className="reel-play-btn"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={playLabel}
            title={playLabel}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" /></svg>
          </button>
        )}
        <div className="reel-info">
          <h4>{translatedTitle}</h4>
          <div className="engagement-bar">
            <button
              className={`engagement-btn engagement-btn--like ${isLiked ? 'is-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onLike(reel.id); }}
            >
              {isLiked ? <IconHeartFilled /> : <IconHeart />} {formatViews(reel.likes)}
            </button>
            <button
              className={`engagement-btn engagement-btn--comment ${isCommentBoxOpen ? 'is-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleComments(reel.id); }}
              title={commentLabel}
            >
              <IconComment /> {formatViews(comments.length)}
            </button>
            <button
              className="engagement-btn engagement-btn--share"
              onClick={(e) => { e.stopPropagation(); onToggleShare(reel.id); }}
            >
              <IconShare /> {shareLabel}
            </button>
          </div>

          {isCommentBoxOpen && (
            <CommentBox
              comments={comments}
              onSubmit={(text) => onSubmitComment(reel.id, text)}
              onEditComment={(commentId, newText) => onEditComment(reel.id, commentId, newText)}
              onDeleteComment={(commentId) => onDeleteComment(reel.id, commentId)}
              onClose={() => onToggleComments(reel.id)}
            />
          )}
        </div>
      </div>

      {isShareOpen && (
        <ShareModal title={translatedTitle} onClose={() => onToggleShare(reel.id)} />
      )}
    </div>
  );
});

export default function ReelsSection({ reels, onLikeReel, onCommentReel, onViewReel }) {
  const { t } = useLanguage();
  const [likedIds, setLikedIds] = usePersistentState('dzair-volley-liked-reels', []);
  const [viewedIds, setViewedIds] = usePersistentState('dzair-volley-viewed-reels', []);
  const [commentsByReel, setCommentsByReel] = usePersistentState('dzair-volley-reel-comments', {});
  const [openCommentsFor, setOpenCommentsFor] = useState(null);
  const [openShareFor, setOpenShareFor] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const visibleReels = showAll ? reels : reels.slice(0, INITIAL_VISIBLE);
  const gridRef = useRevealObserver([visibleReels.length]);

  // Fully toggleable like — clicking again removes it (mirrors the
  // delta-based counters in App.jsx).
  const handleLike = (id) => {
    if (!allowAction(`like:reel:${id}`, 6, 60000)) return;
    const alreadyLiked = likedIds.includes(id);
    setLikedIds((prev) => (alreadyLiked ? prev.filter((x) => x !== id) : [...prev, id]));
    onLikeReel(id, alreadyLiked ? -1 : 1);
  };

  const handleToggleComments = (id) => {
    setOpenCommentsFor((prev) => (prev === id ? null : id));
  };

  const handleSubmitComment = (id, text) => {
    if (!allowAction('comment', 6, 60000)) return;
    setCommentsByReel((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { id: Date.now(), text, date: new Date().toISOString() }],
    }));
    onCommentReel(id);
  };

  const handleEditComment = (id, commentId, newText) => {
    setCommentsByReel((prev) => ({
      ...prev,
      [id]: (prev[id] || []).map((c) => (c.id === commentId ? { ...c, text: newText, edited: true } : c)),
    }));
  };

  const handleDeleteComment = (id, commentId) => {
    setCommentsByReel((prev) => ({
      ...prev,
      [id]: (prev[id] || []).filter((c) => c.id !== commentId),
    }));
    onCommentReel(id, -1);
  };

  const handleToggleShare = (id) => {
    setOpenShareFor((prev) => (prev === id ? null : id));
  };

  const handleFirstView = (id) => {
    if (viewedIds.includes(id)) return;
    setViewedIds((prev) => [...prev, id]);
    onViewReel(id);
  };

  return (
    <section className="reels-section" id="reels">
      <div className="container">
        <h2 className="section-title">{t('reels', 'title')}</h2>

        <div className="reels-grid" ref={gridRef}>
          {visibleReels.map((reel, index) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              index={index}
              isLiked={likedIds.includes(reel.id)}
              comments={commentsByReel[reel.id] || []}
              isCommentBoxOpen={openCommentsFor === reel.id}
              isShareOpen={openShareFor === reel.id}
              onLike={handleLike}
              onToggleComments={handleToggleComments}
              onSubmitComment={handleSubmitComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onToggleShare={handleToggleShare}
              onFirstView={handleFirstView}
              shareLabel={t('reels', 'share')}
              commentLabel={t('reels', 'comment')}
              unavailableLabel={t('reels', 'unavailable')}
              openLabel={t('reels', 'openVideo')}
              playLabel={t('reels', 'play')}
              closeLabel={t('reels', 'close')}
            />
          ))}
        </div>

        {reels.length > INITIAL_VISIBLE && (
          <div className="show-all-wrap">
            <button
              className="show-all-btn"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
            >
              {showAll ? t('common', 'showLess') : t('common', 'showAll')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
