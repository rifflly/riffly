/**
 * Shared chords-above-lyrics renderer, used by the editor preview, the import
 * preview, and the Practice Studio (item 4).
 *
 * Lyrics render in a monospace row so a chord can sit at an exact character
 * column using `ch` units — position N means "above the Nth character".
 */
import { el } from './dom.js';

/**
 * @param {object} line - { lyrics, chords:[{chord, position}] }
 * @param {{ active?: boolean }} [opts]
 */
export function renderSongLine(line, { active = false } = {}) {
  const lyrics = line.lyrics || '';
  const wrap = el('div', { class: `song-line${active ? ' is-active' : ''}` });

  const chordRow = el('div', { class: 'song-chords' });
  for (const c of line.chords || []) {
    chordRow.append(el('span', { class: 'song-chord', style: `left:${c.position}ch` }, c.chord));
  }

  // Non-breaking space keeps empty lines from collapsing.
  const lyricRow = el('div', { class: 'song-lyrics' }, lyrics || ' ');
  wrap.append(chordRow, lyricRow);
  return wrap;
}

/** Render an entire song as stacked chord/lyric lines (a static preview). */
export function renderSongPreview(song) {
  const wrap = el('div', { class: 'song-preview' });
  for (const line of song.lines) wrap.append(renderSongLine(line));
  return wrap;
}
