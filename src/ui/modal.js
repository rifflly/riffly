/**
 * Lightweight modal overlay. Closes on the ✕ button, backdrop click, or Escape.
 */
import { el } from './dom.js';

/**
 * @param {Node} content
 * @param {{ onClose?: Function, label?: string }} [opts]
 */
export function openModal(content, { onClose, label } = {}) {
  const panel = el('div', { class: 'modal-panel', role: 'document' });
  const closeBtn = el(
    'button',
    { class: 'modal-close', type: 'button', 'aria-label': 'Close' },
    '✕'
  );
  panel.append(closeBtn, content);

  const overlay = el(
    'div',
    { class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || 'Details' },
    panel
  );

  function dismiss() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  }
  function onKey(e) {
    if (e.key === 'Escape') dismiss();
  }

  closeBtn.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKey);

  document.body.append(overlay);
  closeBtn.focus();
  return { close: dismiss };
}
