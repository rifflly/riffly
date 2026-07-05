/**
 * Chords screen — a friendly, tappable chord library (Phase 1).
 *
 * Content is data-driven from /data/chords.json (rule f). Diagrams mirror for
 * left-handed players when Left-handed mode is on (rule e).
 */
import { CHORDS, CHORD_BASICS } from '../content.js';
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

  root.append(
    el(
      'button',
      { class: 'chord-basics-card', type: 'button', onclick: openBasics },
      el('span', { class: 'chord-basics-emoji', 'aria-hidden': 'true' }, '🎸'),
      el(
        'span',
        { class: 'chord-basics-text' },
        el('span', { class: 'chord-basics-title' }, 'New to chords? Start here'),
        el('span', { class: 'chord-basics-sub' }, 'A quick, friendly guide to what chords are and why they matter.')
      ),
      el('span', { class: 'chord-basics-arrow', 'aria-hidden': 'true' }, '›')
    )
  );

  const grid = el('div', { class: 'chord-grid' });
  for (const chord of CHORDS) {
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

function openBasics() {
  const content = el('div', { class: 'chord-basics' });
  content.append(el('h2', { class: 'chord-basics-modal-title' }, CHORD_BASICS.title || 'Chord basics'));
  if (CHORD_BASICS.intro) {
    content.append(el('p', { class: 'chord-basics-intro' }, CHORD_BASICS.intro));
  }
  for (const section of CHORD_BASICS.sections || []) {
    content.append(
      el(
        'section',
        { class: 'chord-basics-section' },
        el(
          'h3',
          { class: 'chord-basics-heading' },
          section.emoji ? el('span', { class: 'chord-basics-icon', 'aria-hidden': 'true' }, section.emoji) : null,
          el('span', {}, section.heading)
        ),
        el('p', { class: 'chord-basics-body' }, section.body)
      )
    );
  }
  openModal(content, { label: CHORD_BASICS.title || 'Chord basics' });
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
