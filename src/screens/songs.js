/**
 * Songs screen (Phase 2 items 3–4). A list of songs — starter songs plus the
 * user's own — with New and Import actions. Four in-screen views swapped like
 * the Learn screen: list, studio (player), editor, import. Tapping a song opens
 * the Practice Studio; the studio's Edit button opens the editor.
 */
import { el, clear } from '../ui/dom.js';
import { allSongs, isStarter } from '../songs/song-library.js';
import { emptySong } from '../songs/song-model.js';
import { renderStudio } from './songs/studio.js';
import { renderEditor } from './songs/editor.js';
import { renderImport } from './songs/import.js';

export function render() {
  const root = el('div', { class: 'songs' });
  let disposeView = null;

  function setView(node, dispose) {
    if (disposeView) disposeView();
    disposeView = dispose || null;
    clear(root);
    root.append(node);
    const main = document.getElementById('screen');
    if (main) main.scrollTop = 0;
  }

  const showList = () => setView(renderList(), null);
  const showStudio = (song) => {
    const { node, dispose } = renderStudio(song, { onBack: showList, onEdit: showEditor });
    setView(node, dispose);
  };
  const showEditor = (song) => {
    const { node } = renderEditor(song, { onBack: showList, onDone: showStudio });
    setView(node, null);
  };
  const showImport = () => {
    const { node } = renderImport({ onBack: showList, onDone: showStudio });
    setView(node, null);
  };

  function renderList() {
    const node = el('div', { class: 'song-list-view' });
    node.append(el('p', { class: 'screen-intro' }, 'Songs to play along with. Tap one to open the studio.'));
    node.append(
      el(
        'div',
        { class: 'song-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => showEditor(emptySong()) }, '＋ New song'),
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: showImport }, 'Import')
      )
    );

    const list = el('div', { class: 'song-cards' });
    for (const s of allSongs()) {
      list.append(
        el(
          'button',
          { class: 'song-card', type: 'button', onclick: () => showStudio(s) },
          el('span', { class: 'song-card-main' },
            el('span', { class: 'song-card-title' }, s.title || 'Untitled'),
            el('span', { class: 'song-card-meta' }, `${s.artist ? s.artist + ' · ' : ''}${s.bpm} BPM · ${s.timeSignature}`)
          ),
          isStarter(s.id) ? el('span', { class: 'song-badge' }, 'Starter') : el('span', { class: 'lesson-chevron' }, '›')
        )
      );
    }
    node.append(list);
    return node;
  }

  root._dispose = () => {
    if (disposeView) disposeView();
  };
  showList();
  return root;
}
