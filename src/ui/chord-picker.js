/**
 * A modal that shows the chord library as a tappable grid and calls back with
 * the chosen chord id. Used by the song editor to insert chords (rule f — the
 * grid is the same data-driven chord library).
 */
import { el } from './dom.js';
import { CHORDS } from '../content.js';
import { chordDiagramSVG } from './chord-diagram.js';
import { openModal } from './modal.js';
import { getSetting } from '../storage/settings.js';

/** @param {(chordId:string)=>void} onPick */
export function openChordPicker(onPick) {
  const mirror = getSetting('leftHanded');
  let handle;

  const grid = el('div', { class: 'chord-grid chord-grid--pick' });
  for (const c of CHORDS) {
    grid.append(
      el(
        'button',
        {
          class: 'chord-cell',
          type: 'button',
          onclick: () => {
            onPick(c.id);
            handle.close();
          },
        },
        el('span', { class: 'chord-thumb', html: chordDiagramSVG(c, { mirror }) }),
        el('span', { class: 'chord-name' }, c.name)
      )
    );
  }

  const content = el('div', {}, el('h2', { class: 'chord-detail-name' }, 'Pick a chord'), grid);
  handle = openModal(content, { label: 'Pick a chord' });
  return handle;
}
