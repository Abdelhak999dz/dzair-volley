import React from 'react';
import { createPortal } from 'react-dom';

// Small, generic confirmation dialog — rendered via a portal so it always
// sits centered over the whole viewport, matching the existing
// comment/share modal treatment. Used by the admin dashboard before any
// destructive delete action.
export default function ConfirmModal({ message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 380, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel}>✕</button>
        <p style={{ fontSize: '1.02rem', fontWeight: 700, margin: '10px 0 26px', lineHeight: 1.7 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="delete-btn"
            style={{ padding: '10px 26px', fontSize: '0.9rem' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '10px 26px', fontSize: '0.9rem' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
