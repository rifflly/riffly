/**
 * Tap-along timing tool (Phase 3 item 3).
 *
 * Shown in the editor when a song has an uploaded backing track. Play the track
 * and tap once at the start of each line; we store `timeSec` on each line. The
 * Practice Studio then scrolls from those exact times (falling back to computed
 * timing when they're absent). Includes re-record, ±0.25s nudge, and clear.
 */
import { el, clear } from '../../ui/dom.js';
import { card } from '../../ui/screen.js';
import { getAudioContext } from '../../audio/audio-engine.js';
import { AudioTrack } from '../../audio/audio-track.js';
import { getAudioData } from '../../storage/audio-store.js';

const NUDGE = 0.25;

function fmt(sec) {
  if (typeof sec !== 'number') return '—';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export function buildTapAlong(draft) {
  const track = new AudioTrack();
  let ready = false;
  let playing = false;
  let tapIndex = 0;
  let raf = null;

  const timeReadout = el('span', { class: 'tap-time' }, '0:00.0');
  const playBtn = el('button', { class: 'btn btn-start btn-sm', type: 'button' }, 'Play');
  const restartBtn = el('button', { class: 'btn studio-restart', type: 'button', 'aria-label': 'Restart' }, '⟲');
  const tapBtn = el('button', { class: 'btn tap-big', type: 'button' }, 'Tap at each line');
  const hint = el('p', { class: 'tap-hint' }, 'Press Play, then tap the moment each line begins.');
  const rows = el('div', { class: 'tap-rows' });

  function refreshTransport() {
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.classList.toggle('is-running', playing);
    tapBtn.disabled = !ready || !playing;
  }

  function startFrame() {
    stopFrame();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!playing) return;
      const pos = track.position();
      timeReadout.textContent = fmt(pos);
      if (!track.loop && track.duration && pos >= track.duration - 0.03) {
        playing = false;
        stopFrame();
        refreshTransport();
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

  async function playPause() {
    if (!ready) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* best effort */
      }
    }
    if (playing) {
      track.pause();
      playing = false;
      stopFrame();
    } else {
      track.play();
      playing = true;
      startFrame();
    }
    refreshTransport();
    renderRows();
  }

  function restart() {
    track.stop();
    track.seek(0);
    timeReadout.textContent = '0:00.0';
    if (playing) track.play();
    renderRows();
  }

  function tap() {
    if (!ready || !playing || tapIndex >= draft.lines.length) return;
    draft.lines[tapIndex].timeSec = Math.round(track.position() * 100) / 100;
    tapIndex += 1;
    if (tapIndex >= draft.lines.length) hint.textContent = 'All lines timed! They save when you press “Save song”.';
    renderRows();
    tapBtn.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 120, easing: 'ease-out' });
  }

  function nudge(i, delta) {
    if (typeof draft.lines[i].timeSec !== 'number') return;
    draft.lines[i].timeSec = Math.max(0, Math.round((draft.lines[i].timeSec + delta) * 100) / 100);
    renderRows();
  }

  function clearAll() {
    for (const line of draft.lines) delete line.timeSec;
    tapIndex = 0;
    hint.textContent = 'Cleared. Press Play, then tap each line.';
    renderRows();
  }

  function reRecord() {
    clearAll();
    restart();
    hint.textContent = 'Ready — press Play and tap from the top.';
  }

  function renderRows() {
    clear(rows);
    draft.lines.forEach((line, i) => {
      const isNext = playing && i === tapIndex;
      const label = line.lyrics ? line.lyrics : line.chords.length ? line.chords.map((c) => c.chord).join(' ') : '(blank line)';
      rows.append(
        el(
          'div',
          { class: `tap-row${isNext ? ' is-next' : ''}` },
          el('span', { class: 'tap-row-num' }, String(i + 1)),
          el('span', { class: 'tap-row-label' }, label),
          el('span', { class: 'tap-row-time' }, fmt(line.timeSec)),
          el(
            'span',
            { class: 'tap-row-nudge' },
            el('button', { class: 'line-ctrl', type: 'button', 'aria-label': `Line ${i + 1} earlier`, disabled: typeof line.timeSec !== 'number', onclick: () => nudge(i, -NUDGE) }, '−'),
            el('button', { class: 'line-ctrl', type: 'button', 'aria-label': `Line ${i + 1} later`, disabled: typeof line.timeSec !== 'number', onclick: () => nudge(i, NUDGE) }, '+')
          )
        )
      );
    });
  }

  playBtn.addEventListener('click', playPause);
  restartBtn.addEventListener('click', restart);
  tapBtn.addEventListener('click', tap);

  const node = card(
    el('h2', { class: 'card-title' }, 'Tap-along timing'),
    el('p', { class: 'row-desc' }, 'Match the scroll to your track: play it and tap the start of each line.'),
    el('div', { class: 'tap-transport' }, restartBtn, playBtn, timeReadout),
    tapBtn,
    hint,
    rows,
    el(
      'div',
      { class: 'tap-actions' },
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: reRecord }, 'Re-record'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: clearAll }, 'Clear all')
    )
  );

  // Decode the attached track.
  (async () => {
    const data = await getAudioData(draft.id);
    if (!data) {
      hint.textContent = 'Couldn’t find the backing track for this song.';
      return;
    }
    try {
      await track.decode(data);
      ready = true;
      refreshTransport();
    } catch {
      hint.textContent = 'Sorry — that audio couldn’t be read.';
    }
  })();

  renderRows();
  refreshTransport();

  return {
    node,
    refresh: renderRows,
    dispose: () => {
      stopFrame();
      track.stop();
    },
  };
}
