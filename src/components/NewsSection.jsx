import React, { useState } from 'react';
import useRevealObserver from '../hooks/useRevealObserver.js';
import usePersistentState from '../hooks/usePersistentState.js';
import useLiveTranslate from '../hooks/useLiveTranslate.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { IconEye, IconHeart, IconHeartFilled, IconComment, IconShare } from './icons/AdminIcons.jsx';
import CommentBox from './CommentBox.jsx';
import ShareModal from './ShareModal.jsx';
import { cssUrl } from '../security/sanitize.js';
import { allowAction } from '../security/rateLimiter.js';

const INITIAL_VISIBLE = 4;

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Live-translates one news card's title/summary/category into the
// visitor's chosen language (real API call, cached — see
// useLiveTranslate.js / services/translationService.js). Kept as its
// own tiny component so each card only re-translates when its own text
// changes, not the whole list.
function TranslatedNewsText({ title, summary, category, children }) {
  const [tTitle, tSummary, tCategory] = useLiveTranslate([title, summary || '', category || '']);
  return children(tTitle, tSummary, tCategory);
}

export default function NewsSection({ news, onLikeNews, onCommentNews, onViewNews }) {
  const { t, locale } = useLanguage();
  const gridRef = useRevealObserver([news.length]);
  const [likedIds, setLikedIds] = usePersistentState('dzair-volley-liked-news', []);
  const [viewedIds, setViewedIds] = usePersistentState('dzair-volley-viewed-news', []);
  const [commentsByNews, setCommentsByNews] = usePersistentState('dzair-volley-news-comments', {});
  const [openCommentsFor, setOpenCommentsFor] = useState(null);
  const [openShareFor, setOpenShareFor] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Fully toggleable like — clicking again on an already-liked post removes
  // the like (mirrors the delta-based counters in App.jsx).
  const handleLike = (id) => {
    if (!allowAction(`like:news:${id}`, 6, 60000)) return;
    const alreadyLiked = likedIds.includes(id);
    setLikedIds((prev) => (alreadyLiked ? prev.filter((x) => x !== id) : [...prev, id]));
    onLikeNews(id, alreadyLiked ? -1 : 1);
  };

  const handleToggleComments = (id) => {
    setOpenCommentsFor((prev) => (prev === id ? null : id));
  };

  const handleSubmitComment = (id, text) => {
    if (!allowAction('comment', 6, 60000)) return;
    setCommentsByNews((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { id: Date.now(), text, date: new Date().toISOString() }],
    }));
    onCommentNews(id);
  };

  const handleEditComment = (id, commentId, newText) => {
    setCommentsByNews((prev) => ({
      ...prev,
      [id]: (prev[id] || []).map((c) => (c.id === commentId ? { ...c, text: newText, edited: true } : c)),
    }));
  };

  const handleDeleteComment = (id, commentId) => {
    setCommentsByNews((prev) => ({
      ...prev,
      [id]: (prev[id] || []).filter((c) => c.id !== commentId),
    }));
    onCommentNews(id, -1);
  };

  const handleToggleShare = (id) => {
    setOpenShareFor((prev) => (prev === id ? null : id));
  };

  const handleFirstView = (id) => {
    if (viewedIds.includes(id)) return;
    setViewedIds((prev) => [...prev, id]);
    onViewNews(id);
  };

  return (
    <section className="news-section" id="news">
      <div className="container">
        <h2 className="section-title">{t('news', 'title')}</h2>

        <div className="news-grid" ref={gridRef}>
          {(showAll ? news : news.slice(0, INITIAL_VISIBLE)).map((item, index) => {
            const isLiked = likedIds.includes(item.id);
            const comments = commentsByNews[item.id] || [];
            const isCommentBoxOpen = openCommentsFor === item.id;
            const isShareOpen = openShareFor === item.id;
            return (
              <div className="news-card reveal" key={item.id} style={{ transitionDelay: `${index * 0.08}s` }}>
                <TranslatedNewsText title={item.title} summary={item.summary} category={item.category}>
                  {(tTitle, tSummary, tCategory) => (
                    <>
                      {/* Cover image: shown COMPLETE (object-fit: contain) on top of a
                          blurred copy of itself that fills any leftover space, so no
                          image is ever cropped or stretched at any screen size — see
                          the "NEWS COVER IMAGES" block at the end of index.css. */}
                      <div
                        className={`news-image ${item.image ? 'has-cover' : ''}`}
                        style={item.image ? { '--news-cover': cssUrl(item.image) } : undefined}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={tTitle}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            draggable="false"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="news-image-scrim" />
                        <span className="badge badge-emerald">{tCategory}</span>
                        <span className="news-date">{formatDate(item.date)}</span>
                      </div>
                      <div className="news-body">
                        <h3>{tTitle}</h3>
                        <p>{tSummary}</p>
                        <div className="news-views"><IconEye /> {formatCount(item.views || 0)}</div>
                        <a
                          className="news-read-more"
                          href="#news"
                          onClick={() => handleFirstView(item.id)}
                        >
                          {t('news', 'readMore')}
                        </a>

                        <div className="news-actions">
                          <div className="engagement-bar">
                            <button
                              className={`engagement-btn engagement-btn--like ${isLiked ? 'is-active' : ''}`}
                              onClick={() => handleLike(item.id)}
                            >
                              {isLiked ? <IconHeartFilled /> : <IconHeart />} {formatCount(item.likes || 0)}
                            </button>
                            <button
                              className={`engagement-btn engagement-btn--comment ${isCommentBoxOpen ? 'is-active' : ''}`}
                              onClick={() => handleToggleComments(item.id)}
                              title={t('news', 'comment')}
                            >
                              <IconComment /> {formatCount(comments.length)}
                            </button>
                            <button
                              className="engagement-btn engagement-btn--share"
                              onClick={() => handleToggleShare(item.id)}
                            >
                              <IconShare /> {t('news', 'share')}
                            </button>
                          </div>

                          {isCommentBoxOpen && (
                            <CommentBox
                              comments={comments}
                              onSubmit={(text) => handleSubmitComment(item.id, text)}
                              onEditComment={(commentId, newText) => handleEditComment(item.id, commentId, newText)}
                              onDeleteComment={(commentId) => handleDeleteComment(item.id, commentId)}
                              onClose={() => handleToggleComments(item.id)}
                            />
                          )}
                        </div>
                      </div>

                      {isShareOpen && (
                        <ShareModal title={tTitle} onClose={() => handleToggleShare(item.id)} />
                      )}
                    </>
                  )}
                </TranslatedNewsText>
              </div>
            );
          })}

          {news.length === 0 && (
            <p style={{ color: 'var(--gray-text)' }}>{t('news', 'noNews')}</p>
          )}
        </div>

        {news.length > INITIAL_VISIBLE && (
          <div className="show-all-wrap">
            <button className="show-all-btn" onClick={() => setShowAll((s) => !s)}>
              {showAll ? t('common', 'showLess') : t('common', 'showAll')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
