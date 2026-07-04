/**
 * Songs screen (Phase 2 item 3). A list of songs — starter songs plus the
 * user's own — with New and Import actions. Three in-screen views (list, editor,
 * import) swapped like the Learn screen. In item 4 the list gains the Practice
 * Studio player; for now tapping a song opens it in the editor.
 */
import { el, clear } from '../ui/dom.js';
import { allSongs, isStarter } from '../songs/song-library.js';
import { emptySong } from '../songs/song-model.js';
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
  const showEditor = (song) => {
    const { node } = renderEditor(song, { onBack: showList, onDone: showList });
    setView(node, null);
  };
  const showImport = () => {
    const { node } = renderImport({ onBack: showList, onDone: showList });
    setView(node, null);
  };

  function renderList() {
    const node = el('div', { class: 'song-list-view' });
    node.append(el('p', { class: 'screen-intro' }, 'Songs to practise. Tap one to open it.'));
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
          { class: 'song-card', type: 'button', onclick: () => showEditor(s) },
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
