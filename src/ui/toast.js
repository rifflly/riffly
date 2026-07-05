/**
 * Tiny stacked toasts for lightweight celebrations (badge unlocks, "lesson
 * complete"). Pure UI, no deps. Auto-dismiss; multiple stack top-to-bottom.
 */
import { el } from './dom.js';

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = el('div', { class: 'toast-host', 'aria-live': 'polite' });
  document.body.append(host);
  return host;
}

export function showToast(text, { emoji = '', duration = 2800 } = {}) {
  const node = el(
    'div',
    { class: 'toast', role: 'status' },
    emoji ? el('span', { class: 'toast-emoji', 'aria-hidden': 'true' }, emoji) : null,
    el('span', {}, text)
  );
  ensureHost().append(node);
  requestAnimationFrame(() => node.classList.add('is-in'));
  setTimeout(() => {
    node.classList.remove('is-in');
    setTimeout(() => node.remove(), 300);
  }, duration);
}

/** Convenience: announce newly earned badges. */
export function celebrateBadges(badges) {
  for (const b of badges || []) showToast(`New badge: ${b.label}`, { emoji: b.emoji });
}
