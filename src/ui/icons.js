/**
 * Inline SVG icons (stroke = currentColor so they inherit text colour).
 * Kept simple and friendly to match the beginner-first design language.
 */
import { el } from './dom.js';

const PATHS = {
  // Open book — Learn
  learn:
    '<path d="M12 6.5C10.5 5.3 8.3 4.8 5.5 5v12c2.8-.2 5 .3 6.5 1.5 1.5-1.2 3.7-1.7 6.5-1.5V5c-2.8-.2-5 .3-6.5 1.5Z"/><path d="M12 6.5V18"/>',
  // Grid of dots — Chords (like a chord diagram)
  chords:
    '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16"/>',
  // Metronome triangle — Practice
  practice: '<path d="M9 3h6l4 18H5L9 3Z"/><path d="M12 3v10"/><circle cx="12" cy="15.5" r="1.3"/>',
  // Gear — Settings
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"/>',
  // Music note — Songs
  songs: '<path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  // Speech bubble — Ask (AI tutor)
  ask: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
  // Extras used elsewhere
  check: '<path d="M5 12.5 10 17.5 19 6.5"/>',
  share:
    '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {number} [size]
 */
export function icon(name, size = 24) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
    `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return el('span', { class: 'icon', html: svg });
}
