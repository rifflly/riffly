/**
 * Song editor (Phase 2 item 3). Edit a song's details and lines, insert chords
 * from the chord library, watch a live chords-above-lyrics preview, and save to
 * IndexedDB. Opening a starter song edits a fresh copy (originals stay intact).
 */
import { el, clear } from '../../ui/dom.js';
import { card } from '../../ui/screen.js';
import { normalizeSong, emptyLine } from '../../songs/song-model.js';
import { saveSong, deleteSong } from '../../storage/songs.js';
import { getAudioMeta } from '../../storage/audio-store.js';
import { renderSongPreview } from '../../ui/song-view.js';
import { openChordPicker } from '../../ui/chord-picker.js';
import { buildTapAlong } from './tap-along.js';

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8'];

function clone(song) {
  return JSON.parse(JSON.stringify(song));
}

/**
 * @param {object} sourceSong
 * @param {{ onBack:Function, onDone:(song:object)=>void }} handlers
 */
export function renderEditor(sourceSong, { onBack, onDone }) {
  const isCopy = sourceSong.source === 'starter';
  const draft = clone(normalizeSong(sourceSong));
  if (isCopy) {
    draft.id = null;
    draft.source = 'user';
    draft.title = draft.title ? `${draft.title} (my version)` : '';
  }

  const root = el('div', { class: 'editor' });
  const preview = el('div', { class: 'song-preview-host' });

  // Tap-along timing tool — only when this (saved) song has an uploaded track.
  const tapAlong = draft.id && getAudioMeta(draft.id) ? buildTapAlong(draft) : null;

  function updatePreview() {
    clear(preview);
    preview.append(renderSongPreview(normalizeSong(draft)));
  }

  function textField(label, value, onInput, opts = {}) {
    const input = el('input', {
      class: 'text-input',
      type: opts.type || 'text',
      value: value == null ? '' : String(value),
      placeholder: opts.placeholder || '',
      ...(opts.min != null ? { min: String(opts.min) } : {}),
      ...(opts.max != null ? { max: String(opts.max) } : {}),
      'aria-label': label,
    });
    input.addEventListener('input', () => onInput(input.value));
    return el('label', { class: 'edit-field' }, el('span', { class: 'edit-label' }, label), input);
  }

  function metaCard() {
    const timeSel = el('select', { class: 'text-input', 'aria-label': 'Time signature' });
    for (const ts of TIME_SIGNATURES) {
      const opt = el('option', { value: ts }, ts);
      if (ts === draft.timeSignature) opt.selected = true;
      timeSel.append(opt);
    }
    timeSel.addEventListener('change', () => {
      draft.timeSignature = timeSel.value;
    });

    return card(
      el('h2', { class: 'card-title' }, 'Song details'),
      textField('Title', draft.title, (v) => {
        draft.title = v;
      }, { placeholder: 'My song' }),
      textField('Artist (optional)', draft.artist, (v) => {
        draft.artist = v;
      }),
      el(
        'div',
        { class: 'edit-row' },
        textField('Tempo (BPM)', draft.bpm, (v) => {
          draft.bpm = Number(v) || draft.bpm;
        }, { type: 'number', min: 40, max: 240 }),
        el('label', { class: 'edit-field' }, el('span', { class: 'edit-label' }, 'Time'), timeSel)
      ),
      textField('Key (optional)', draft.key, (v) => {
        draft.key = v;
      }, { placeholder: 'e.g. G' })
    );
  }

  function lineEditor(line, index) {
    const wrap = el('div', { class: 'edit-line' });

    // Lyrics
    const lyricInput = el('input', {
      class: 'text-input',
      type: 'text',
      value: line.lyrics,
      placeholder: 'Lyrics for this line (leave blank for a gap)',
      'aria-label': `Line ${index + 1} lyrics`,
    });
    lyricInput.addEventListener('input', () => {
      line.lyrics = lyricInput.value;
      updatePreview();
    });

    // Chord chips
    const chipRow = el('div', { class: 'chip-row' });
    function renderChips() {
      clear(chipRow);
      line.chords.forEach((c, ci) => {
        const posInput = el('input', {
          class: 'pos-input',
          type: 'number',
          min: '0',
          value: String(c.position),
          'aria-label': `${c.chord} position`,
        });
        posInput.addEventListener('input', () => {
          c.position = Math.max(0, Number(posInput.value) || 0);
          updatePreview();
        });
        chipRow.append(
          el(
            'span',
            { class: 'edit-chip' },
            el('span', { class: 'edit-chip-name' }, c.chord),
            el('span', { class: 'edit-chip-at' }, '@'),
            posInput,
            el(
              'button',
              {
                class: 'edit-chip-x',
                type: 'button',
                'aria-label': `Remove ${c.chord}`,
                onclick: () => {
                  line.chords.splice(ci, 1);
                  renderChips();
                  updatePreview();
                },
              },
              '✕'
            )
          )
        );
      });
      chipRow.append(
        el(
          'button',
          {
            class: 'add-chord-btn',
            type: 'button',
            onclick: () =>
              openChordPicker((chordId) => {
                line.chords.push({ chord: chordId, position: line.lyrics.length });
                renderChips();
                updatePreview();
              }),
          },
          '＋ Chord'
        )
      );
    }
    renderChips();

    // Line controls
    const controls = el(
      'div',
      { class: 'line-controls' },
      el('button', { class: 'line-ctrl', type: 'button', 'aria-label': 'Move line up', disabled: index === 0, onclick: () => moveLine(index, -1) }, '↑'),
      el('button', { class: 'line-ctrl', type: 'button', 'aria-label': 'Move line down', disabled: index === draft.lines.length - 1, onclick: () => moveLine(index, 1) }, '↓'),
      el('button', { class: 'line-ctrl line-ctrl--del', type: 'button', 'aria-label': 'Delete line', onclick: () => removeLine(index) }, '🗑')
    );

    wrap.append(
      el('div', { class: 'edit-line-head' }, el('span', { class: 'edit-line-num' }, `Line ${index + 1}`), controls),
      lyricInput,
      chipRow
    );
    return wrap;
  }

  function moveLine(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= draft.lines.length) return;
    const [item] = draft.lines.splice(index, 1);
    draft.lines.splice(to, 0, item);
    rebuild();
  }

  function removeLine(index) {
    draft.lines.splice(index, 1);
    if (!draft.lines.length) draft.lines.push(emptyLine());
    rebuild();
  }

  function linesCard() {
    const host = el('div', { class: 'edit-lines' });
    draft.lines.forEach((line, i) => host.append(lineEditor(line, i)));
    return card(
      el('h2', { class: 'card-title' }, 'Lines'),
      host,
      el(
        'button',
        {
          class: 'btn btn-secondary add-line-btn',
          type: 'button',
          onclick: () => {
            draft.lines.push(emptyLine());
            rebuild();
          },
        },
        '＋ Add line'
      )
    );
  }

  async function save() {
    if (!draft.title.trim()) draft.title = 'Untitled song';
    const saved = await saveSong(draft);
    onDone(saved);
  }

  function actions() {
    const row = el('div', { class: 'editor-actions' });
    row.append(el('button', { class: 'btn btn-start', type: 'button', onclick: save }, 'Save song'));
    if (draft.id) {
      row.append(
        el(
          'button',
          {
            class: 'btn btn-danger',
            type: 'button',
            onclick: async () => {
              await deleteSong(draft.id);
              onBack();
            },
          },
          'Delete'
        )
      );
    }
    return row;
  }

  function build() {
    clear(root);
    root.append(el('button', { class: 'back-btn', type: 'button', onclick: onBack }, '‹ Songs'));
    root.append(el('h2', { class: 'lesson-title' }, draft.id ? 'Edit song' : isCopy ? 'Edit a copy' : 'New song'));
    if (isCopy) {
      root.append(
        el('p', { class: 'row-desc editor-note' }, 'You’re editing a copy — the original starter song stays untouched.')
      );
    }
    root.append(metaCard());
    root.append(linesCard());
    if (tapAlong) {
      root.append(tapAlong.node);
      tapAlong.refresh();
    }
    root.append(card(el('h2', { class: 'card-title' }, 'Preview'), preview));
    root.append(actions());
    updatePreview();
  }

  function rebuild() {
    build();
  }

  build();
  return { node: root, dispose: () => { if (tapAlong) tapAlong.dispose(); } };
}
