/**
 * Practice Studio player (Phase 2 item 4) — the heart of the app.
 *
 * Plays a song along a scrolling sheet with three view modes (Play/Sing/Both),
 * a count-in bar, tempo override, and a backing selector (App Rhythm or Silent).
 *
 * SYNC RULE (rule b): the current-line + scroll position are derived from the
 * shared timing engine's audio clock (audioContext.currentTime), never from
 * wall-clock time — so pause/resume and tempo changes stay perfectly in sync.
 * We integrate beats from audio-time deltas each frame; the sound itself is
 * scheduled sample-accurately by the engine.
 */
import { el, clear } from '../../ui/dom.js';
import { getAudioContext } from '../../audio/audio-engine.js';
import { getTimingEngine } from '../../audio/timing.js';
import { playClick } from '../../audio/click.js';
import { BackingRhythm } from '../../audio/backing.js';
import { renderSongLine } from '../../ui/song-view.js';
import { beatsPerBar, lineBars } from '../../songs/song-model.js';
import { isStarter } from '../../songs/song-library.js';
import { markSongPractised } from '../../storage/stats.js';
import { getSetting, setSetting } from '../../storage/settings.js';

const VIEW_MODES = [
  { id: 'play', label: 'Play' },
  { id: 'sing', label: 'Sing' },
  { id: 'both', label: 'Both' },
];

/**
 * @param {object} song - a normalized song
 * @param {{ onBack:Function, onEdit:(song:object)=>void }} handlers
 * @returns {{ node: HTMLElement, dispose: Function }}
 */
export function renderStudio(song, { onBack, onEdit }) {
  const songBeats = beatsPerBar(song);

  // Per-line beat layout (content-relative, excludes the count-in bar).
  const lineBeats = song.lines.map((line) => lineBars(song, line) * songBeats);
  const lineStart = [];
  let acc = 0;
  for (const b of lineBeats) {
    lineStart.push(acc);
    acc += b;
  }
  const totalBeats = acc || songBeats;

  const firstChord =
    song.lines.flatMap((l) => l.chords).map((c) => c.chord).find(Boolean) || 'G';
  const primaryChord = (line) => (line && line.chords[0] ? line.chords[0].chord : null);

  // --- State -------------------------------------------------------------
  let viewMode = ['play', 'sing', 'both'].includes(getSetting('studioView'))
    ? getSetting('studioView')
    : 'both';
  let backingMode = getSetting('studioBacking') === 'silent' ? 'silent' : 'app';
  let tempoPct = Math.min(100, Math.max(50, Number(getSetting('studioTempoPct')) || 100));

  let phase = 'idle'; // idle | countin | playing | paused | done
  let contentBeats = 0;
  let currentLineIndex = 0;
  let countInRemaining = 0;
  let suppressBeats = 0; // engine beats treated as count-in this run
  let lastNow = 0;

  let engine = null;
  let backing = null;
  let removeClick = null;
  let raf = null;
  let lineEls = [];

  const effBpm = () => Math.max(40, Math.round(song.bpm * (tempoPct / 100)));

  // --- Sound wiring ------------------------------------------------------
  function attachSound() {
    const ctx = getAudioContext();
    engine.setTempo(effBpm());
    if (backingMode === 'app') {
      backing = new BackingRhythm();
      backing.setPattern(song.timeSignature === '3/4' ? 'folk34' : 'downstrums');
      backing.setChord(primaryChord(song.lines[currentLineIndex]) || firstChord);
      backing.setStartBeat(phase === 'countin' ? suppressBeats : 0);
      backing.attach(); // sets engine beats/subdivisions from the pattern
    } else {
      engine.setBeatsPerBar(songBeats);
      engine.setSubdivisionsPerBeat(1);
    }
    removeClick = engine.addScheduler((e) => {
      if (!e.isBeat) return;
      if (e.beat < suppressBeats) {
        playClick(ctx, e.time, { accent: e.beatInBar === 0 }); // count-in ticks
      } else if (backingMode === 'silent') {
        playClick(ctx, e.time, { accent: e.beatInBar === 0 });
      }
    });
  }

  function detachSound() {
    if (removeClick) {
      removeClick();
      removeClick = null;
    }
    if (backing) {
      backing.detach();
      backing = null;
    }
  }

  // --- Transport ---------------------------------------------------------
  function play() {
    if (phase === 'playing' || phase === 'countin') return;
    if (phase === 'paused') return resume();
    phase = 'countin';
    contentBeats = 0;
    currentLineIndex = 0;
    countInRemaining = songBeats;
    suppressBeats = songBeats;
    lastNow = 0;
    engine = getTimingEngine();
    attachSound();
    engine.start();
    startFrame();
    applyLineStates();
    showCountIn(true);
    setStatus('');
    refreshTransport();
  }

  function resume() {
    if (phase !== 'paused') return;
    phase = 'playing';
    suppressBeats = 0; // no second count-in on resume
    countInRemaining = 0;
    lastNow = 0;
    engine = getTimingEngine();
    attachSound();
    engine.start();
    startFrame();
    setStatus('');
    refreshTransport();
  }

  function pause() {
    if (phase !== 'playing' && phase !== 'countin') return;
    phase = 'paused';
    if (engine) engine.stop();
    detachSound();
    stopFrame();
    showCountIn(false);
    setStatus('Paused — press play to carry on.');
    refreshTransport();
  }

  function stopAll() {
    if (engine) engine.stop();
    detachSound();
    stopFrame();
    phase = 'idle';
    contentBeats = 0;
    currentLineIndex = 0;
    showCountIn(false);
    applyLineStates();
    refreshTransport();
  }

  function restart() {
    stopAll();
    play();
  }

  function finish() {
    if (engine) engine.stop();
    detachSound();
    stopFrame();
    phase = 'done';
    currentLineIndex = song.lines.length - 1;
    contentBeats = totalBeats;
    applyLineStates();
    showCountIn(false);
    setStatus(`You practised “${song.title}”! 🎉 Lovely work.`);
    refreshTransport();
    markSongPractised(song.id);
  }

  // --- Frame loop (audio-clock driven) -----------------------------------
  function startFrame() {
    stopFrame();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = getAudioContext().currentTime;
      if (phase !== 'countin' && phase !== 'playing') return;
      if (lastNow === 0) {
        lastNow = now;
        return;
      }
      let dtBeats = (now - lastNow) * (effBpm() / 60);
      lastNow = now;

      if (phase === 'countin') {
        const used = Math.min(countInRemaining, dtBeats);
        countInRemaining -= used;
        dtBeats -= used;
        updateCountIn();
        if (countInRemaining <= 0.0001) {
          phase = 'playing';
          showCountIn(false);
          refreshTransport();
        }
      }
      if (phase === 'playing') {
        contentBeats += dtBeats;
        if (contentBeats >= totalBeats) {
          finish();
          return;
        }
        updateCurrentLine();
        autoScroll();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  function stopFrame() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function updateCurrentLine() {
    let idx = 0;
    while (idx < lineStart.length - 1 && contentBeats >= lineStart[idx] + lineBeats[idx]) idx += 1;
    if (idx === currentLineIndex) return;
    currentLineIndex = idx;
    applyLineStates();
    const chord = primaryChord(song.lines[idx]);
    if (chord && backing) backing.setChord(chord);
  }

  function autoScroll() {
    const active = lineEls[currentLineIndex];
    const main = document.getElementById('screen');
    if (!active || !main) return;
    const mainRect = main.getBoundingClientRect();
    const lineRect = active.getBoundingClientRect();
    const target = main.scrollTop + (lineRect.top - (mainRect.top + main.clientHeight * 0.33));
    main.scrollTop += (target - main.scrollTop) * 0.18; // smooth follow
  }

  // --- Rendering ---------------------------------------------------------
  const linesHost = el('div', { class: 'studio-lines' });
  const countInEl = el('div', { class: 'studio-countin' });
  const statusEl = el('p', { class: 'studio-status' });

  function renderLineNode(line, mode) {
    const wrap = el('div', { class: `studio-line studio-line--${mode}` });
    if (mode === 'sing') {
      wrap.append(el('div', { class: 'sl-lyrics' }, line.lyrics || ' '));
    } else if (mode === 'play') {
      const row = el('div', { class: 'sl-chords-big' });
      if (line.chords.length) {
        for (const c of line.chords) row.append(el('span', { class: 'sl-chord-big' }, c.chord));
      } else {
        row.append(el('span', { class: 'sl-chord-rest' }, line.lyrics ? '·' : ' '));
      }
      wrap.append(row);
      if (line.tab) wrap.append(el('pre', { class: 'sl-tab' }, line.tab));
      if (line.lyrics) wrap.append(el('div', { class: 'sl-lyrics-small' }, line.lyrics));
    } else {
      wrap.append(renderSongLine(line));
    }
    return wrap;
  }

  function renderLines() {
    clear(linesHost);
    lineEls = song.lines.map((line) => {
      const node = renderLineNode(line, viewMode);
      linesHost.append(node);
      return node;
    });
    applyLineStates();
  }

  function applyLineStates() {
    const activeShown = phase !== 'idle';
    lineEls.forEach((n, i) => {
      n.classList.toggle('is-active', activeShown && i === currentLineIndex);
      n.classList.toggle('is-past', activeShown && i < currentLineIndex);
      n.classList.toggle('is-future', activeShown && i > currentLineIndex);
    });
  }

  function showCountIn(on) {
    countInEl.style.display = on ? '' : 'none';
    if (on) updateCountIn();
  }
  function updateCountIn() {
    const n = Math.max(1, Math.ceil(countInRemaining));
    clear(countInEl);
    countInEl.append(
      el('span', { class: 'countin-label' }, 'Get ready…'),
      el('span', { class: 'countin-num' }, String(n))
    );
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  // --- Controls ----------------------------------------------------------
  const viewSeg = el('div', { class: 'segmented studio-seg', role: 'group', 'aria-label': 'View mode' });
  function renderViewSeg() {
    clear(viewSeg);
    for (const v of VIEW_MODES) {
      viewSeg.append(
        el(
          'button',
          {
            class: `seg${v.id === viewMode ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => {
              viewMode = v.id;
              setSetting('studioView', v.id);
              renderViewSeg();
              renderLines();
            },
          },
          v.label
        )
      );
    }
  }

  const backingSeg = el('div', { class: 'segmented studio-seg', role: 'group', 'aria-label': 'Backing' });
  function renderBackingSeg() {
    clear(backingSeg);
    const opts = [
      { id: 'app', label: 'App Rhythm', disabled: false },
      { id: 'silent', label: 'Silent', disabled: false },
      { id: 'audio', label: 'My Audio', disabled: true },
    ];
    for (const o of opts) {
      backingSeg.append(
        el(
          'button',
          {
            class: `seg${o.id === backingMode ? ' is-active' : ''}${o.disabled ? ' is-disabled' : ''}`,
            type: 'button',
            disabled: o.disabled,
            title: o.disabled ? 'Coming in the next update' : null,
            onclick: o.disabled ? null : () => setBackingMode(o.id),
          },
          o.label,
          o.disabled ? el('span', { class: 'seg-note' }, 'next update') : null
        )
      );
    }
  }
  function setBackingMode(m) {
    if (m === backingMode) return;
    backingMode = m;
    setSetting('studioBacking', m);
    renderBackingSeg();
    if (phase === 'playing' || phase === 'countin') {
      detachSound();
      attachSound(); // swap sound live on the still-running engine
    }
  }

  // Tempo control
  const tempoLabel = el('span', { class: 'tempo-label' });
  function updateTempoLabel() {
    tempoLabel.textContent = `${effBpm()} BPM${tempoPct < 100 ? ` (${tempoPct}%)` : ''}`;
  }
  const tempoSlider = el('input', {
    type: 'range',
    class: 'bpm-slider',
    min: '50',
    max: '100',
    step: '5',
    value: String(tempoPct),
    'aria-label': 'Practice tempo (percent of written speed)',
  });
  tempoSlider.addEventListener('input', () => {
    tempoPct = Number(tempoSlider.value);
    setSetting('studioTempoPct', tempoPct);
    updateTempoLabel();
    if (engine && (phase === 'playing' || phase === 'countin')) engine.setTempo(effBpm());
  });

  const playBtn = el('button', { class: 'btn studio-play', type: 'button' });
  const restartBtn = el(
    'button',
    { class: 'btn studio-restart', type: 'button', 'aria-label': 'Restart', onclick: restart },
    '⟲'
  );
  function refreshTransport() {
    const isRunning = phase === 'playing' || phase === 'countin';
    playBtn.textContent = isRunning ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'done' ? 'Play again' : 'Play';
    playBtn.classList.toggle('is-running', isRunning);
  }
  playBtn.addEventListener('click', () => {
    if (phase === 'playing' || phase === 'countin') pause();
    else if (phase === 'paused') resume();
    else play();
  });

  // --- Assemble ----------------------------------------------------------
  const root = el('div', { class: 'studio' });

  root.append(
    el(
      'div',
      { class: 'studio-head' },
      el('button', { class: 'back-btn', type: 'button', onclick: () => { stopAll(); onBack(); } }, '‹ Songs'),
      el(
        'button',
        { class: 'link-btn', type: 'button', onclick: () => { stopAll(); onEdit(song); } },
        isStarter(song.id) ? 'Edit a copy' : 'Edit'
      )
    ),
    el('h2', { class: 'studio-title' }, song.title),
    el('p', { class: 'studio-sub' }, `${song.artist ? song.artist + ' · ' : ''}${song.bpm} BPM · ${song.timeSignature}`),
    el('div', { class: 'studio-controls' },
      el('div', { class: 'studio-control' }, el('span', { class: 'edit-label' }, 'View'), viewSeg),
      el('div', { class: 'studio-control' }, el('span', { class: 'edit-label' }, 'Backing'), backingSeg)
    ),
    statusEl,
    el('div', { class: 'studio-stage' }, countInEl, linesHost),
    el(
      'div',
      { class: 'studio-transport' },
      restartBtn,
      playBtn,
      el('div', { class: 'studio-tempo' }, tempoSlider, tempoLabel)
    )
  );

  renderViewSeg();
  renderBackingSeg();
  renderLines();
  updateTempoLabel();
  showCountIn(false);
  refreshTransport();

  return { node: root, dispose: stopAll };
}
