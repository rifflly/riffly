/**
 * Shared building blocks for screens, so they share a consistent, friendly look.
 */
import { el } from './dom.js';

/** A screen section card. */
export function card(...children) {
  return el('section', { class: 'card' }, ...children);
}

/** A large friendly hero for placeholder screens. */
export function placeholder({ emoji, title, lines = [] }) {
  return el(
    'div',
    { class: 'placeholder' },
    el('div', { class: 'placeholder-emoji', 'aria-hidden': 'true' }, emoji),
    el('h2', { class: 'placeholder-title' }, title),
    ...lines.map((line) => el('p', { class: 'placeholder-text' }, line))
  );
}
