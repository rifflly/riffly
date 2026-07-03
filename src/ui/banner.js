/**
 * Reusable banner card (used for the audio-unlock prompt, iOS install hint,
 * and — in Phase 1 — the "New version ready" update notice).
 */
import { el } from './dom.js';

/**
 * @param {object} opts
 * @param {string} opts.message
 * @param {'sound'|'install'|'update'} [opts.tone]
 * @param {Node} [opts.leading] - optional leading icon/element
 * @param {{label:string, onClick:Function}} [opts.action] - primary action button
 * @param {Function} [opts.onDismiss] - if given, shows a dismiss (✕) button
 * @returns {HTMLElement}
 */
export function createBanner({ message, tone = 'sound', leading, action, onDismiss }) {
  const root = el('div', { class: `banner banner--${tone}`, role: 'status' });

  if (leading) root.append(el('span', { class: 'banner-lead' }, leading));
  root.append(el('p', { class: 'banner-text' }, message));

  if (action) {
    root.append(
      el(
        'button',
        { class: 'banner-action', type: 'button', onclick: action.onClick },
        action.label
      )
    );
  }

  if (onDismiss) {
    root.append(
      el(
        'button',
        {
          class: 'banner-dismiss',
          type: 'button',
          'aria-label': 'Dismiss',
          onclick: () => {
            root.remove();
            onDismiss();
          },
        },
        '✕'
      )
    );
  }

  return root;
}
