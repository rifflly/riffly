/**
 * Chords screen — a friendly, tappable chord library (Phase 1).
 *
 * Content is data-driven from /data/chords.json (rule f). Diagrams mirror for
 * left-handed players when Left-handed mode is on (rule e).
 */
import chordData from '../../data/chords.json';
import { el } from '../ui/dom.js';
import { chordDiagramSVG } from '../ui/chord-diagram.js';
import { openModal } from '../ui/modal.js';
import { getSetting } from '../storage/settings.js';

export function render() {
  const mirror = getSetting('leftHanded');
  const root = el('div', { class: 'chords' });

  root.append(
    el(
      'p',
      { class: 'screen-intro' },
      mirror
        ? 'Tap any chord to see it up close. Diagrams are mirrored for left-handed playing.'
        : 'Tap any chord to see it up close.'
    )
  );

  const grid = el('div', { class: 'chord-grid' });
  for (const chord of chordData.chords) {
    grid.append(
      el(
        'button',
        { class: 'chord-cell', type: 'button', onclick: () => openChord(chord, mirror) },
        el('span', { class: 'chord-thumb', html: chordDiagramSVG(chord, { mirror }) }),
        el('span', { class: 'chord-name' }, chord.name)
      )
    );
  }
  root.append(grid);
  return root;
}

function openChord(chord, mirror) {
  const content = el(
    'div',
    { class: 'chord-detail' },
    el('h2', { class: 'chord-detail-name' }, chord.longName || chord.name),
    el('div', { class: 'chord-detail-diagram', html: chordDiagramSVG(chord, { mirror }) }),
    chord.tip ? el('p', { class: 'chord-tip' }, chord.tip) : null,
    mirror ? el('p', { class: 'row-desc' }, 'Shown mirrored for left-handed players.') : null
  );
  openModal(content, { label: `${chord.longName || chord.name} chord` });
}
