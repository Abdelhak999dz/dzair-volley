import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { IconEdit, IconTrash, IconCheck, IconX } from './icons/AdminIcons.jsx';
import { stripUnsafeChars } from '../security/sanitize.js';

// Hard cap on a single comment (also enforced with maxLength on the inputs).
const MAX_COMMENT_LENGTH = 500;

// Strips control characters and neutralizes HTML-significant characters
// (defense-in-depth against markup/script injection in visitor-authored
// comments, on top of React's own text-node escaping) before a comment
// ever reaches state/rendering.
function sanitizeComment(value) {
  return stripUnsafeChars(value)
    .slice(0, MAX_COMMENT_LENGTH)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

function formatRelativeDate(iso, locale) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Rendered via a portal directly into <body>, so it's always a centered,
// full-viewport modal — completely unaffected by the card it was opened
// from (no clipping/overflow/transform side effects from ancestor cards).
export default function CommentBox({ comments, onSubmit, onEditComment, onDeleteComment, onClose }) {
  const { t, locale } = useLanguage();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  // Inline-edit state: which comment is being edited + its draft text.
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState('');

  // Delete confirmation is a lightweight inline state (not a nested portal
  // modal) so it updates instantaneously with the rest of the list.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = sanitizeComment(text);
    if (!clean) {
      setError(t('engagement', 'commentEmptyError'));
      return;
    }
    setError('');
    onSubmit(clean);
    setText('');
  };

  const startEdit = (comment) => {
    setPendingDeleteId(null);
    setEditingId(comment.id);
    setEditText(comment.text);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditError('');
  };

  const saveEdit = (commentId) => {
    const clean = sanitizeComment(editText);
    if (!clean) {
      setEditError(t('engagement', 'commentEmptyError'));
      return;
    }
    onEditComment(commentId, clean);
    setEditingId(null);
    setEditText('');
    setEditError('');
  };

  const askDelete = (commentId) => {
    cancelEdit();
    setPendingDeleteId(commentId);
  };

  const confirmDelete = (commentId) => {
    onDeleteComment(commentId);
    setPendingDeleteId(null);
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box comment-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{t('engagement', 'commentsTitle')} ({comments.length})</h2>

        <div className="comment-list">
          {comments.length === 0 && (
            <p className="comment-empty">{t('engagement', 'commentsEmpty')}</p>
          )}
          {comments.slice().reverse().map((c) => {
            const isEditing = editingId === c.id;
            const isPendingDelete = pendingDeleteId === c.id;
            return (
              <div className="comment-item" key={c.id}>
                {isEditing ? (
                  <div className="comment-edit-form">
                    <textarea
                      className="comment-input comment-edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      maxLength={MAX_COMMENT_LENGTH}
                      autoFocus
                    />
                    {editError && <p className="form-error">{editError}</p>}
                    <div className="comment-edit-actions">
                      <button type="button" className="comment-icon-btn confirm" onClick={() => saveEdit(c.id)} aria-label={t('engagement', 'commentSave')} title={t('engagement', 'commentSave')}>
                        <IconCheck />
                      </button>
                      <button type="button" className="comment-icon-btn" onClick={cancelEdit} aria-label={t('engagement', 'commentCancel')} title={t('engagement', 'commentCancel')}>
                        <IconX />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="comment-text">{c.text}</p>
                    <div className="comment-item-footer">
                      <span className="comment-date">
                        {formatRelativeDate(c.date, locale)}
                        {c.edited && <span className="comment-edited-tag"> · {t('engagement', 'commentEditedTag')}</span>}
                      </span>

                      {!isPendingDelete ? (
                        <div className="comment-item-actions">
                          <button type="button" className="comment-icon-btn" onClick={() => startEdit(c)} aria-label={t('engagement', 'commentEdit')} title={t('engagement', 'commentEdit')}>
                            <IconEdit />
                          </button>
                          <button type="button" className="comment-icon-btn danger" onClick={() => askDelete(c.id)} aria-label={t('engagement', 'commentDelete')} title={t('engagement', 'commentDelete')}>
                            <IconTrash />
                          </button>
                        </div>
                      ) : (
                        <div className="comment-delete-confirm">
                          <span>{t('engagement', 'commentDeleteConfirm')}</span>
                          <button type="button" className="comment-icon-btn danger" onClick={() => confirmDelete(c.id)}>
                            {t('engagement', 'commentDelete')}
                          </button>
                          <button type="button" className="comment-icon-btn" onClick={() => setPendingDeleteId(null)}>
                            {t('admin', 'confirmCancel')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            className="comment-input"
            placeholder={t('engagement', 'commentPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={MAX_COMMENT_LENGTH}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="comment-submit-btn">{t('engagement', 'commentSubmit')}</button>
        </form>
      </div>
    </div>,
    document.body
  );
}
