/**
 * Song import (Phase 2 item 3). Paste a chord sheet in ChordPro ("[G]words") or
 * the two-line format (chords above lyrics), see a live preview, and save it.
 * Unknown chords are flagged in a friendly way — never fatal.
 */
import { el, clear } from '../../ui/dom.js';
import { card } from '../../ui/screen.js';
import { parseChordPro } from '../../songs/chordpro.js';
import { normalizeSong } from '../../songs/song-model.js';
import { getChord } from '../../content.js';
import { saveSong } from '../../storage/songs.js';
import { renderSongPreview } from '../../ui/song-view.js';

const EXAMPLE = `{title: You Are My Sunshine}
{tempo: 96}
[C]You are my [F]sunshine, my only [C]sunshine
You make me [G]happy when skies are [C]grey`;

export function renderImport({ onBack, onDone }) {
  const root = el('div', { class: 'importer' });

  const textarea = el('textarea', {
    class: 'import-textarea',
    rows: '8',
    placeholder: 'Paste a chord sheet here…\n\n[G]Happy birthday to [D]you',
    'aria-label': 'Chord sheet text',
  });

  const preview = el('div', { class: 'song-preview-host' });
  const warn = el('div', { class: 'import-warn' });
  const saveBtn = el('button', { class: 'btn btn-start', type: 'button', disabled: true }, 'Save song');

  let parsed = null;

  function update() {
    const text = textarea.value.trim();
    if (!text) {
      parsed = null;
      clear(preview);
      preview.append(el('p', { class: 'row-desc' }, 'Your song preview will appear here.'));
      clear(warn);
      saveBtn.disabled = true;
      return;
    }
    const result = parseChordPro(textarea.value);
    parsed = normalizeSong(result.song);
    clear(preview);
    preview.append(renderSongPreview(parsed));

    const unknown = result.chords.filter((c) => !getChord(c));
    clear(warn);
    if (unknown.length) {
      warn.append(
        el(
          'p',
          { class: 'import-warn-text' },
          `Heads up: ${unknown.join(', ')} ${unknown.length === 1 ? "isn't" : "aren't"} in the chord library yet, so ${unknown.length === 1 ? 'it' : 'they'} will show as names without a diagram. That's fine — you can still save.`
        )
      );
    }
    saveBtn.disabled = false;
  }

  textarea.addEventListener('input', update);

  saveBtn.addEventListener('click', async () => {
    if (!parsed) return;
    const song = { ...parsed, title: parsed.title || 'Imported song' };
    const saved = await saveSong(song);
    onDone(saved);
  });

  const exampleBtn = el(
    'button',
    {
      class: 'link-btn',
      type: 'button',
      onclick: () => {
        textarea.value = EXAMPLE;
        update();
      },
    },
    'Paste an example'
  );

  root.append(
    el('button', { class: 'back-btn', type: 'button', onclick: onBack }, '‹ Songs'),
    el('h2', { class: 'lesson-title' }, 'Import a song'),
    card(
      el('h2', { class: 'card-title' }, 'Paste your chord sheet'),
      el(
        'p',
        { class: 'row-desc' },
        'Works with ChordPro (chords in [brackets]) or chords typed on the line above the words.'
      ),
      textarea,
      exampleBtn
    ),
    card(el('h2', { class: 'card-title' }, 'Preview'), warn, preview),
    saveBtn
  );

  update();
  return { node: root };
}
