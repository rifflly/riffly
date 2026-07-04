/**
 * Practice Studio player (Phase 2 item 4 + Phase 3 item 2).
 *
 * Plays a song along a scrolling sheet with three view modes (Play/Sing/Both),
 * a count-in bar, tempo override, and a backing selector:
 *   - App Rhythm / Silent → driven by the shared timing engine; the current line
 *     + scroll are integrated from audioContext.currentTime deltas (rule b), so
 *     pause/resume + tempo changes stay in sync.
 *   - My Audio → plays an uploaded backing track; here the current line + scroll
 *     derive from the TRACK playback position in seconds (Phase-3 sync rule),
 *     with an optional A/B loop on a waveform.
 */
import { el, clear } from '../../ui/dom.js';
import { getAudioContext } from '../../audio/audio-engine.js';
import { getTimingEngine } from '../../audio/timing.js';
import { playClick } from '../../audio/click.js';
import { BackingRhythm } from '../../audio/backing.js';
import { AudioTrack } from '../../audio/audio-track.js';
import { renderSongLine } from '../../ui/song-view.js';
import { createWaveform } from '../../ui/waveform.js';
import { beatsPerBar, lineBars, lineDurationSec } from '../../songs/song-model.js';
import { isStarter } from '../../songs/song-library.js';
import { markSongPractised } from '../../storage/stats.js';
import { getSetting, setSetting } from '../../storage/settings.js';
import { getAudioMeta, getAudioData, saveAudioFile, deleteAudio, formatBytes } from '../../storage/audio-store.js';

const VIEW_MODES = [
  { id: 'play', label: 'Play' },
  { id: 'sing', label: 'Sing' },
  { id: 'both', label: 'Both' },
];

export function renderStudio(song, { onBack, onEdit }) {
  const songBeats = beatsPerBar(song);

  // Per-line beat layout (for the engine path), and seconds layout (for My Audio).
  const lineBeats = song.lines.map((line) => lineBars(song, line) * songBeats);
  const lineStart = [];
  let acc = 0;
  for (const b of lineBeats) {
    lineStart.push(acc);
    acc += b;
  }
  const totalBeats = acc || songBeats;

  const lineDurSec = song.lines.map((line) => lineDurationSec(song, line));
  const lineStartSec = [];
  let accSec = 0;
  for (const d of lineDurSec) {
    lineStartSec.push(accSec);
    accSec += d;
  }
  const totalSec = accSec || 1;
  const hasTimeSec = song.lines.some((l) => typeof l.timeSec === 'number');

  const firstChord = song.lines.flatMap((l) => l.chords).map((c) => c.chord).find(Boolean) || 'G';
  const primaryChord = (line) => (line && line.chords[0] ? line.chords[0].chord : null);

  // --- State -------------------------------------------------------------
  let viewMode = ['play', 'sing', 'both'].includes(getSetting('studioView')) ? getSetting('studioView') : 'both';
  let backingMode = ['app', 'silent', 'audio'].includes(getSetting('studioBacking')) ? getSetting('studioBacking') : 'app';
  let tempoPct = Math.min(100, Math.max(50, Number(getSetting('studioTempoPct')) || 100));

  let phase = 'idle'; // idle | countin | playing | paused | done
  let contentBeats = 0;
  let currentLineIndex = 0;
  let countInRemaining = 0;
  let suppressBeats = 0;
  let lastNow = 0;

  let engine = null;
  let backing = null;
  let removeClick = null;
  let raf = null;
  let lineEls = [];

  // My Audio state
  let audioMeta = getAudioMeta(song.id);
  let track = null;
  let audioReady = false;
  let audioDecoding = false;
  let waveform = null;
  let loopEnabled = false;
  if (backingMode === 'audio' && !audioMeta) backingMode = 'app'; // nothing to play yet

  const effBpm = () => Math.max(40, Math.round(song.bpm * (tempoPct / 100)));

  // ======================================================================
  // Engine path (App Rhythm / Silent)
  // ======================================================================
  function attachSound() {
    const ctx = getAudioContext();
    engine.setTempo(effBpm());
    if (backingMode === 'app') {
      backing = new BackingRhythm();
      backing.setPattern(song.timeSignature === '3/4' ? 'folk34' : 'downstrums');
      backing.setChord(primaryChord(song.lines[currentLineIndex]) || firstChord);
      backing.setStartBeat(phase === 'countin' ? suppressBeats : 0);
      backing.attach();
    } else {
      engine.setBeatsPerBar(songBeats);
      engine.setSubdivisionsPerBeat(1);
    }
    removeClick = engine.addScheduler((e) => {
      if (!e.isBeat) return;
      if (e.beat < suppressBeats) playClick(ctx, e.time, { accent: e.beatInBar === 0 });
      else if (backingMode === 'silent') playClick(ctx, e.time, { accent: e.beatInBar === 0 });
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

  function playEngine() {
    if (phase === 'playing' || phase === 'countin') return;
    if (phase === 'paused') return resumeEngine();
    phase = 'countin';
    contentBeats = 0;
    currentLineIndex = 0;
    countInRemaining = songBeats;
    suppressBeats = songBeats;
    lastNow = 0;
    engine = getTimingEngine();
    attachSound();
    engine.start();
    startEngineFrame();
    applyLineStates();
    showCountIn(true);
    setStatus('');
    refreshTransport();
  }

  function resumeEngine() {
    if (phase !== 'paused') return;
    phase = 'playing';
    suppressBeats = 0;
    countInRemaining = 0;
    lastNow = 0;
    engine = getTimingEngine();
    attachSound();
    engine.start();
    startEngineFrame();
    setStatus('');
    refreshTransport();
  }

  function pauseEngine() {
    if (phase !== 'playing' && phase !== 'countin') return;
    phase = 'paused';
    if (engine) engine.stop();
    detachSound();
    stopFrame();
    showCountIn(false);
    setStatus('Paused — press play to carry on.');
    refreshTransport();
  }

  function finishEngine() {
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

  function startEngineFrame() {
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
          finishEngine();
          return;
        }
        let idx = 0;
        while (idx < lineStart.length - 1 && contentBeats >= lineStart[idx] + lineBeats[idx]) idx += 1;
        setCurrentLine(idx);
        autoScroll();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  // ======================================================================
  // My Audio path
  // ======================================================================
  async function ensureTrack() {
    if (audioReady || !audioMeta || audioDecoding) return audioReady;
    audioDecoding = true;
    renderAudioPanel();
    try {
      const data = await getAudioData(song.id);
      if (!data) throw new Error('no data');
      track = new AudioTrack();
      await track.decode(data);
      track.onended = () => {
        if (phase === 'playing' && !track.loop) finishAudio();
      };
      audioReady = true;
    } catch {
      setStatus('Sorry — that audio couldn’t be read. Try another file.');
    }
    audioDecoding = false;
    renderAudioPanel();
    return audioReady;
  }

  function loopMarkers() {
    return waveform ? waveform.getLoop() : { a: 0, b: track ? track.duration : 0 };
  }

  async function playAudio() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* best effort */
      }
    }
    const ok = await ensureTrack();
    if (!ok) {
      setStatus('Add a backing track first.');
      return;
    }
    if (phase === 'paused') {
      phase = 'playing';
      track.play();
      startAudioFrame();
      setStatus('');
      refreshTransport();
      return;
    }
    const { a, b } = loopMarkers();
    track.setLoop(loopEnabled, a, b);
    track.seek(loopEnabled ? a : 0);
    phase = 'playing';
    track.play();
    startAudioFrame();
    applyLineStates();
    setStatus('');
    refreshTransport();
  }

  function pauseAudio() {
    if (phase !== 'playing') return;
    phase = 'paused';
    if (track) track.pause();
    stopFrame();
    setStatus('Paused — press play to carry on.');
    refreshTransport();
  }

  function finishAudio() {
    if (track) track.stop();
    stopFrame();
    phase = 'done';
    currentLineIndex = song.lines.length - 1;
    applyLineStates();
    if (waveform && track) waveform.setPlayhead(track.duration);
    setStatus(`You practised “${song.title}”! 🎉 Lovely work.`);
    refreshTransport();
    markSongPractised(song.id);
  }

  function startAudioFrame() {
    stopFrame();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (phase !== 'playing' || !track) return;
      const pos = track.position();
      if (waveform) waveform.setPlayhead(pos);
      if (!track.loop && pos >= track.duration - 0.03) {
        finishAudio();
        return;
      }
      setCurrentLine(lineFromTrackPos(pos));
      autoScroll();
    };
    raf = requestAnimationFrame(frame);
  }

  function lineFromTrackPos(pos) {
    if (hasTimeSec) {
      let idx = 0;
      for (let i = 0; i < song.lines.length; i++) {
        if (typeof song.lines[i].timeSec === 'number' && pos >= song.lines[i].timeSec) idx = i;
      }
      return idx;
    }
    const dur = track ? track.duration : 0;
    const songSec = dur ? (Math.min(pos, dur) / dur) * totalSec : 0;
    let idx = 0;
    while (idx < lineStartSec.length - 1 && songSec >= lineStartSec[idx] + lineDurSec[idx]) idx += 1;
    return idx;
  }

  // ======================================================================
  // Shared transport dispatch
  // ======================================================================
  function play() {
    if (backingMode === 'audio') playAudio();
    else playEngine();
  }
  function resume() {
    if (backingMode === 'audio') playAudio();
    else resumeEngine();
  }
  function pause() {
    if (backingMode === 'audio') pauseAudio();
    else pauseEngine();
  }
  function stopAll() {
    if (engine) engine.stop();
    detachSound();
    if (track) track.stop();
    stopFrame();
    phase = 'idle';
    contentBeats = 0;
    currentLineIndex = 0;
    if (waveform) waveform.setPlayhead(loopEnabled ? loopMarkers().a : 0);
    showCountIn(false);
    applyLineStates();
    refreshTransport();
  }
  function restart() {
    stopAll();
    play();
  }

  function setCurrentLine(idx) {
    if (idx === currentLineIndex) return;
    currentLineIndex = idx;
    applyLineStates();
    const chord = primaryChord(song.lines[idx]);
    if (chord && backing) backing.setChord(chord);
  }

  function stopFrame() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function autoScroll() {
    const active = lineEls[currentLineIndex];
    const main = document.getElementById('screen');
    if (!active || !main) return;
    const mainRect = main.getBoundingClientRect();
    const lineRect = active.getBoundingClientRect();
    const target = main.scrollTop + (lineRect.top - (mainRect.top + main.clientHeight * 0.33));
    main.scrollTop += (target - main.scrollTop) * 0.18;
  }

  // ======================================================================
  // Rendering
  // ======================================================================
  const linesHost = el('div', { class: 'studio-lines' });
  const countInEl = el('div', { class: 'studio-countin' });
  const statusEl = el('p', { class: 'studio-status' });
  const audioPanel = el('div', { class: 'audio-panel' });

  const fileInput = el('input', { type: 'file', accept: 'audio/*', class: 'visually-hidden', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    stopAll();
    setStatus('Saving your track…');
    audioMeta = await saveAudioFile(song.id, file);
    audioReady = false;
    track = null;
    if (waveform) {
      waveform.destroy();
      waveform = null;
    }
    setStatus('');
    await ensureTrack();
    renderAudioPanel();
  });

  function renderLineNode(line, mode) {
    const wrap = el('div', { class: `studio-line studio-line--${mode}` });
    if (mode === 'sing') {
      wrap.append(el('div', { class: 'sl-lyrics' }, line.lyrics || ' '));
    } else if (mode === 'play') {
      const row = el('div', { class: 'sl-chords-big' });
      if (line.chords.length) for (const c of line.chords) row.append(el('span', { class: 'sl-chord-big' }, c.chord));
      else row.append(el('span', { class: 'sl-chord-rest' }, line.lyrics ? '·' : ' '));
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
    countInEl.append(el('span', { class: 'countin-label' }, 'Get ready…'), el('span', { class: 'countin-num' }, String(n)));
  }
  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  // ---- My Audio panel ---------------------------------------------------
  function uploadButton(label) {
    return el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => fileInput.click() }, label);
  }

  function renderAudioPanel() {
    clear(audioPanel);
    if (backingMode !== 'audio') {
      audioPanel.style.display = 'none';
      return;
    }
    audioPanel.style.display = '';

    if (audioDecoding) {
      audioPanel.append(el('p', { class: 'row-desc' }, 'Loading your track…'));
      return;
    }
    if (!audioMeta) {
      audioPanel.append(
        el('p', { class: 'row-desc' }, 'Add a song file (MP3, M4A, WAV…) to play along with. It stays on your device.'),
        uploadButton('Add a backing track')
      );
      return;
    }
    if (!audioReady) {
      audioPanel.append(el('p', { class: 'row-desc' }, 'Preparing waveform…'));
      return;
    }

    if (!waveform) {
      waveform = createWaveform(track.buffer, {
        onLoopChange: ({ a, b }) => {
          if (loopEnabled) track.setLoop(true, a, b);
        },
      });
      waveform.setLoopActive(loopEnabled);
    }

    const loopToggle = el('input', {
      type: 'checkbox',
      class: 'switch-input',
      ...(loopEnabled ? { checked: true } : {}),
      onchange: (e) => {
        loopEnabled = e.target.checked;
        waveform.setLoopActive(loopEnabled);
        const { a, b } = loopMarkers();
        if (track) track.setLoop(loopEnabled, a, b);
        if (loopEnabled && phase === 'playing') track.seek(a);
      },
    });

    audioPanel.append(
      waveform.node,
      el(
        'label',
        { class: 'row row--toggle audio-loop-row' },
        el(
          'span',
          { class: 'row-text' },
          el('span', { class: 'row-label' }, 'Loop a section'),
          el('span', { class: 'row-desc' }, 'Drag the two handles, then turn this on.')
        ),
        el('span', { class: 'switch' }, loopToggle, el('span', { class: 'switch-track' }))
      ),
      el(
        'div',
        { class: 'audio-meta-row' },
        el('span', { class: 'row-desc' }, `${audioMeta.name} · ${formatBytes(audioMeta.size)}`),
        el(
          'span',
          { class: 'audio-meta-actions' },
          uploadButton('Replace'),
          el(
            'button',
            {
              class: 'btn btn-danger btn-sm',
              type: 'button',
              onclick: async () => {
                stopAll();
                await deleteAudio(song.id);
                audioMeta = null;
                audioReady = false;
                track = null;
                if (waveform) {
                  waveform.destroy();
                  waveform = null;
                }
                renderAudioPanel();
              },
            },
            'Remove'
          )
        )
      )
    );
    if (waveform) requestAnimationFrame(() => waveform.redraw());
  }

  // ---- Controls ---------------------------------------------------------
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
    for (const o of [{ id: 'app', label: 'App Rhythm' }, { id: 'silent', label: 'Silent' }, { id: 'audio', label: 'My Audio' }]) {
      backingSeg.append(
        el(
          'button',
          { class: `seg${o.id === backingMode ? ' is-active' : ''}`, type: 'button', onclick: () => setBackingMode(o.id) },
          o.label
        )
      );
    }
  }
  function setBackingMode(m) {
    if (m === backingMode) return;
    const wasAudio = backingMode === 'audio';
    backingMode = m;
    setSetting('studioBacking', m);
    renderBackingSeg();
    updateTempoForMode();
    if (m === 'audio' || wasAudio) {
      stopAll(); // engine <-> audio transports differ; start fresh
    } else if (phase === 'playing' || phase === 'countin') {
      detachSound();
      attachSound();
    }
    if (m === 'audio') {
      renderAudioPanel();
      ensureTrack();
    } else {
      audioPanel.style.display = 'none';
    }
  }

  const tempoLabel = el('span', { class: 'tempo-label' });
  const tempoSlider = el('input', {
    type: 'range',
    class: 'bpm-slider',
    min: '50',
    max: '100',
    step: '5',
    value: String(tempoPct),
    'aria-label': 'Practice tempo (percent of written speed)',
  });
  function updateTempoForMode() {
    const audio = backingMode === 'audio';
    tempoSlider.disabled = audio;
    if (audio) tempoLabel.textContent = 'Full speed · slow-down next update';
    else tempoLabel.textContent = `${effBpm()} BPM${tempoPct < 100 ? ` (${tempoPct}%)` : ''}`;
  }
  tempoSlider.addEventListener('input', () => {
    tempoPct = Number(tempoSlider.value);
    setSetting('studioTempoPct', tempoPct);
    updateTempoForMode();
    if (engine && (phase === 'playing' || phase === 'countin')) engine.setTempo(effBpm());
  });

  const playBtn = el('button', { class: 'btn studio-play', type: 'button' });
  const restartBtn = el('button', { class: 'btn studio-restart', type: 'button', 'aria-label': 'Restart', onclick: restart }, '⟲');
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
      el('button', { class: 'link-btn', type: 'button', onclick: () => { stopAll(); onEdit(song); } }, isStarter(song.id) ? 'Edit a copy' : 'Edit')
    ),
    el('h2', { class: 'studio-title' }, song.title),
    el('p', { class: 'studio-sub' }, `${song.artist ? song.artist + ' · ' : ''}${song.bpm} BPM · ${song.timeSignature}`),
    el(
      'div',
      { class: 'studio-controls' },
      el('div', { class: 'studio-control' }, el('span', { class: 'edit-label' }, 'View'), viewSeg),
      el('div', { class: 'studio-control' }, el('span', { class: 'edit-label' }, 'Backing'), backingSeg)
    ),
    audioPanel,
    fileInput,
    statusEl,
    el('div', { class: 'studio-stage' }, countInEl, linesHost),
    el('div', { class: 'studio-transport' }, restartBtn, playBtn, el('div', { class: 'studio-tempo' }, tempoSlider, tempoLabel))
  );

  renderViewSeg();
  renderBackingSeg();
  renderLines();
  updateTempoForMode();
  showCountIn(false);
  refreshTransport();
  renderAudioPanel();
  if (backingMode === 'audio') ensureTrack();

  return {
    node: root,
    dispose: () => {
      stopAll();
      if (waveform) waveform.destroy();
    },
  };
}
