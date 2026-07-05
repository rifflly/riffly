/**
 * Songs screen (Phase 2 items 3–4). A list of songs — starter songs plus the
 * user's own — with New and Import actions. Four in-screen views swapped like
 * the Learn screen: list, studio (player), editor, import. Tapping a song opens
 * the Practice Studio; the studio's Edit button opens the editor.
 */
import { el, clear } from '../ui/dom.js';
import { allSongs, getSong, isStarter } from '../songs/song-library.js';
import { emptySong } from '../songs/song-model.js';
import { saveSong } from '../storage/songs.js';
import { saveAudioFile } from '../storage/audio-store.js';
import { SONG_CARD_GROUPS, getChord } from '../content.js';
import { chordDiagramSVG } from '../ui/chord-diagram.js';
import { openModal } from '../ui/modal.js';
import { getSetting } from '../storage/settings.js';
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
  const showStudio = (song, initialBacking) => {
    const { node, dispose } = renderStudio(song, { onBack: showList, onEdit: showEditor, initialBacking });
    setView(node, dispose);
  };
  const showEditor = (song) => {
    const { node, dispose } = renderEditor(song, { onBack: showList, onDone: showStudio });
    setView(node, dispose);
  };
  const showImport = () => {
    const { node } = renderImport({ onBack: showList, onDone: showStudio });
    setView(node, null);
  };

  // Direct audio add: pick a file → wrap it in a lightweight song → open the
  // studio already in My Audio mode, ready to play. The song is saved under
  // "Your songs" so it's reusable.
  async function handleAudioPick(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    inputEl.value = ''; // let the user re-pick the same file later
    if (!file) return;
    try {
      const saved = await saveSong({
        ...emptySong(),
        title: fileToTitle(file.name),
        lines: [{ lyrics: 'Play along with your music ✨', chords: [] }],
      });
      await saveAudioFile(saved.id, file);
      showStudio(saved, 'audio');
    } catch {
      alert('Sorry — that file couldn’t be added. Try an MP3, M4A or WAV.');
    }
  }

  function fileToTitle(name) {
    return String(name || 'My song').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'My song';
  }

  function renderList() {
    const node = el('div', { class: 'song-list-view' });
    node.append(el('p', { class: 'screen-intro' }, 'Pick a mission and play along. Tap a card to start.'));
    node.append(
      el(
        'div',
        { class: 'song-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => showEditor(emptySong()) }, '＋ New song'),
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: showImport }, 'Import')
      )
    );

    // One-tap: add your own music file and play along right away.
    const audioInput = el('input', { type: 'file', accept: 'audio/*', class: 'visually-hidden', 'aria-hidden': 'true' });
    audioInput.addEventListener('change', () => handleAudioPick(audioInput));
    node.append(
      el('button', { class: 'btn btn-primary song-add-music', type: 'button', onclick: () => audioInput.click() },
        '🎵  Add your music (MP3)'),
      audioInput
    );

    // "Practice with Your Song" — guides users to free external tools (no audio
    // processing in-app; opens a small how-to modal with safe outbound links).
    node.append(
      el(
        'button',
        { class: 'byo-card', type: 'button', onclick: openPracticeWithSong },
        el('span', { class: 'byo-emoji', 'aria-hidden': 'true' }, '🎤'),
        el(
          'span',
          { class: 'byo-text' },
          el('span', { class: 'byo-title' }, 'Remove vocals or instruments'),
          el('span', { class: 'byo-sub' }, 'Free tools to mute a part before you add your music.')
        ),
        el('span', { class: 'byo-arrow', 'aria-hidden': 'true' }, '›')
      )
    );

    // Curated, motivational library grouped by difficulty (data-driven, rule f).
    for (const group of SONG_CARD_GROUPS) {
      node.append(renderCardGroup(group));
    }

    // The player's own songs (created or imported) — keeps the studio/edit flow.
    const mine = allSongs().filter((s) => !isStarter(s.id));
    if (mine.length) {
      node.append(el('h2', { class: 'song-group-title' }, 'Your songs'));
      node.append(
        el('p', { class: 'song-group-sub' }, 'Songs you added yourself. Tap to open the studio.')
      );
      const list = el('div', { class: 'song-cards' });
      for (const s of mine) {
        list.append(
          el(
            'button',
            { class: 'song-card', type: 'button', onclick: () => showStudio(s) },
            el('span', { class: 'song-card-main' },
              el('span', { class: 'song-card-title' }, s.title || 'Untitled'),
              el('span', { class: 'song-card-meta' }, `${s.artist ? s.artist + ' · ' : ''}${s.bpm} BPM · ${s.timeSignature}`)
            ),
            el('span', { class: 'lesson-chevron' }, '›')
          )
        );
      }
      node.append(list);
    }

    return node;
  }

  function renderCardGroup(group) {
    const section = el('section', { class: 'song-group' });
    section.append(el('h2', { class: 'song-group-title' }, group.title));
    if (group.subtitle) section.append(el('p', { class: 'song-group-sub' }, group.subtitle));

    const grid = el('div', { class: 'song-lib-grid' });
    for (const card of group.songs) grid.append(songLibCard(card));
    section.append(grid);
    return section;
  }

  function songLibCard(card) {
    const chips = el(
      'div',
      { class: 'song-lib-chords' },
      ...(card.chords || []).map((c) => el('span', { class: 'chord-chip' }, c))
    );

    const onActivate = () => {
      const song = card.songId ? getSong(card.songId) : null;
      if (song) showStudio(song);
      else openMission(card);
    };

    return el(
      'button',
      { class: 'song-lib-card', type: 'button', onclick: onActivate },
      el(
        'div',
        { class: 'song-lib-head' },
        el('span', { class: 'song-lib-title' }, card.title),
        card.badge ? el('span', { class: 'song-badge' }, card.badge) : null
      ),
      card.mood ? el('div', { class: 'song-lib-mood' }, card.mood) : null,
      chips,
      card.skillFocus
        ? el('div', { class: 'song-lib-focus' },
            el('span', { class: 'song-lib-label' }, 'Focus'),
            el('span', {}, card.skillFocus))
        : null,
      card.mission ? el('p', { class: 'song-lib-mission' }, card.mission) : null,
      el('span', { class: 'song-lib-cta' }, card.cta || 'Play')
    );
  }

  function byoAction(href, title, desc) {
    return el(
      'a',
      { class: 'byo-action', href, target: '_blank', rel: 'noopener noreferrer' },
      el(
        'span',
        { class: 'byo-action-main' },
        el('span', { class: 'byo-action-title' }, title),
        el('span', { class: 'byo-action-desc' }, desc)
      ),
      el('span', { class: 'byo-action-go', 'aria-hidden': 'true' }, '↗')
    );
  }

  function openPracticeWithSong() {
    const content = el(
      'div',
      { class: 'byo-modal' },
      el('h2', { class: 'byo-modal-title' }, 'Practice with Your Song'),
      el('p', { class: 'byo-modal-body' }, 'Upload a song, mute the voice or instrument, and play along your way.'),
      el('p', { class: 'byo-modal-sub' }, 'Sing it, strum it, or take over the missing part.'),
      byoAction(
        'https://vocalremover.org',
        'Remove vocals and sing',
        'Strip out the singing so you can be the singer.'
      ),
      byoAction(
        'https://github.com/fabiogra/moseca',
        'Split stems and mute a part',
        'Separate vocals, drums and bass — mute the one you want to play.'
      ),
      el('p', { class: 'byo-disclaimer' }, 'These are free tools that open in a new tab. How clean the result sounds depends on the song and the tool.')
    );
    openModal(content, { label: 'Practice with Your Song' });
  }

  function openMission(card) {
    const mirror = getSetting('leftHanded');
    const diagrams = el('div', { class: 'mission-chords' });
    for (const name of card.chords || []) {
      const chord = getChord(name);
      if (!chord) continue;
      diagrams.append(
        el('div', { class: 'mission-chord' },
          el('span', { class: 'mission-chord-diagram', html: chordDiagramSVG(chord, { mirror }) }),
          el('span', { class: 'mission-chord-name' }, chord.name))
      );
    }

    const content = el('div', { class: 'mission' },
      el('div', { class: 'mission-badge-row' },
        card.badge ? el('span', { class: 'song-badge' }, card.badge) : null),
      el('h2', { class: 'mission-title' }, card.title),
      card.mood ? el('p', { class: 'mission-mood' }, card.mood) : null,
      diagrams,
      card.skillFocus
        ? el('p', { class: 'mission-focus' },
            el('strong', {}, 'Focus: '), card.skillFocus)
        : null,
      card.mission
        ? el('div', { class: 'mission-goal' },
            el('span', { class: 'mission-goal-label' }, 'Your mission'),
            el('p', {}, card.mission))
        : null,
      el('p', { class: 'mission-hint' }, 'Set these shapes up, then loop them with the metronome in Practice.')
    );
    openModal(content, { label: `${card.title} — mission` });
  }

  root._dispose = () => {
    if (disposeView) disposeView();
  };
  showList();
  return root;
}
