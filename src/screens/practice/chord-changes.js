/**
 * Chord-Change Trainer (Practice tab, Phase 2 item 1).
 *
 * Shows two chords side by side and flips the highlight on every bar line, so
 * the beginner practises switching cleanly in time. Everything rhythmic runs on
 * the ONE shared timing engine (rule b): a click sounds on every beat, and the
 * highlight flips on the downbeat via the engine's visual-event queue.
 *
 * Modes: steady tempo, or auto-advance (+4 BPM every 4 bars up to a ceiling).
 * A one-minute "change challenge" self-scores clean bars and stores a per-pair
 * best in IndexedDB. Any real session counts toward the practice streak.
 *
 * Exposes create() → { node, dispose } for the Practice hub.
 */
import { el, clear } from '../../ui/dom.js';
import { card } from '../../ui/screen.js';
import { CHORDS, getChord } from '../../content.js';
import { chordDiagramSVG } from '../../ui/chord-diagram.js';
import { ChordTrainer } from '../../audio/chord-trainer.js';
import { getSetting, setSetting } from '../../storage/settings.js';
import {
  getTrainerBest,
  recordTrainerScore,
  recordPracticeSession,
  getStreak,
} from '../../storage/stats.js';

const MIN_BPM = 40;
const MAX_BPM = 160;
const CHALLENGE_SECONDS = 60;
const BARS_PER_STEP = 4; // auto-advance cadence
const BPM_STEP = 4; // auto-advance increment

// Curriculum chord-change pairs the trainer suggests first.
const PRESET_PAIRS = [
  ['Em', 'Am'],
  ['Am', 'C'],
  ['Am', 'D'],
  ['G', 'C'],
  ['G', 'D'],
];

/** Order-independent key so Em↔Am and Am↔Em share one best score. */
function pairKey(a, b) {
  return [a, b].slice().sort().join('-');
}

export function create() {
  const trainer = new ChordTrainer();
  const mirror = getSetting('leftHanded');

  // Restore remembered pair (guard against content changes).
  let pair = getSetting('trainerPair');
  if (!Array.isArray(pair) || !getChord(pair[0]) || !getChord(pair[1])) pair = ['Em', 'Am'];
  let activeIndex = 0; // which of the two chords is highlighted right now
  let autoMode = !!getSetting('trainerAuto');
  let ceiling = getSetting('trainerCeiling');

  trainer.setTempo(getSetting('trainerBpm'));

  // Challenge state
  let challenge = null; // { count, endsAt, raf } while running
  let sessionStart = 0; // performance.now() when the trainer last started

  // --- Diagrams ----------------------------------------------------------
  const diagrams = el('div', { class: 'trainer-diagrams' });
  const slotA = el('div', { class: 'trainer-slot' });
  const slotB = el('div', { class: 'trainer-slot' });
  const arrow = el('div', { class: 'trainer-arrow', 'aria-hidden': 'true' }, '⇄');
  diagrams.append(slotA, arrow, slotB);

  function renderDiagram(slot, id, isActive) {
    const chord = getChord(id);
    clear(slot);
    slot.classList.toggle('is-active', isActive);
    slot.append(
      el('div', { class: 'trainer-diagram', html: chordDiagramSVG(chord, { mirror }) }),
      el('div', { class: 'trainer-chord-name' }, chord.name)
    );
  }
  function renderDiagrams() {
    renderDiagram(slotA, pair[0], activeIndex === 0);
    renderDiagram(slotB, pair[1], activeIndex === 1);
  }

  // --- Beat pulse dots ---------------------------------------------------
  const dots = el('div', { class: 'beat-dots' });
  for (let i = 0; i < 4; i++) dots.append(el('span', { class: 'beat-dot' }));
  function pulseBeat(e) {
    const list = dots.querySelectorAll('.beat-dot');
    list.forEach((d) => d.classList.remove('is-active', 'is-down'));
    const active = list[e.beatInBar];
    if (!active) return;
    active.classList.add('is-active');
    if (e.isDownbeat) active.classList.add('is-down');
    active.animate(
      [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' }
    );
  }
  function clearDots() {
    dots.querySelectorAll('.beat-dot').forEach((d) => d.classList.remove('is-active', 'is-down'));
  }

  // --- Pair pickers ------------------------------------------------------
  const presetRow = el('div', { class: 'trainer-presets' });
  function renderPresets() {
    clear(presetRow);
    for (const [a, b] of PRESET_PAIRS) {
      const isCurrent = pairKey(a, b) === pairKey(pair[0], pair[1]);
      presetRow.append(
        el(
          'button',
          {
            class: `chip${isCurrent ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => setPair([a, b]),
          },
          `${getChord(a).name} ⇄ ${getChord(b).name}`
        )
      );
    }
  }

  function chordSelect(index) {
    const sel = el('select', {
      class: 'trainer-select',
      'aria-label': index === 0 ? 'First chord' : 'Second chord',
    });
    for (const c of CHORDS) {
      const opt = el('option', { value: c.id }, c.name);
      if (c.id === pair[index]) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      const next = pair.slice();
      next[index] = sel.value;
      setPair(next);
    });
    return sel;
  }
  let selectRow = el('div', { class: 'trainer-selects' });
  function renderSelects() {
    clear(selectRow);
    selectRow.append(
      chordSelect(0),
      el('span', { class: 'trainer-selects-sep' }, '⇄'),
      chordSelect(1)
    );
  }

  function setPair(next) {
    pair = next;
    setSetting('trainerPair', pair);
    activeIndex = 0;
    renderDiagrams();
    renderPresets();
    renderSelects();
    refreshBest();
  }

  // --- Tempo -------------------------------------------------------------
  const bpmNum = el('span', { class: 'bpm-num' }, String(trainer.bpm));
  const slider = el('input', {
    type: 'range',
    class: 'bpm-slider',
    min: String(MIN_BPM),
    max: String(MAX_BPM),
    value: String(trainer.bpm),
    'aria-label': 'Tempo in beats per minute',
  });
  function setBpm(value, { fromSlider = false, persist = true } = {}) {
    const bpm = trainer.setTempo(Math.min(MAX_BPM, Math.max(MIN_BPM, value)));
    bpmNum.textContent = String(bpm);
    if (!fromSlider) slider.value = String(bpm);
    if (persist) setSetting('trainerBpm', bpm);
  }
  slider.addEventListener('input', () => setBpm(Number(slider.value), { fromSlider: true }));
  const minus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Slower', onclick: () => setBpm(trainer.bpm - 2) },
    '−'
  );
  const plus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Faster', onclick: () => setBpm(trainer.bpm + 2) },
    '+'
  );

  // --- Mode: steady / auto-advance --------------------------------------
  const ceilingLabel = el('span', { class: 'trainer-ceiling-val' }, `${ceiling} BPM`);
  const ceilingRow = el(
    'div',
    { class: 'trainer-ceiling' },
    el('span', { class: 'row-desc' }, 'Speed up to'),
    el(
      'button',
      { class: 'stepper stepper-sm', type: 'button', 'aria-label': 'Lower ceiling', onclick: () => setCeiling(ceiling - 4) },
      '−'
    ),
    ceilingLabel,
    el(
      'button',
      { class: 'stepper stepper-sm', type: 'button', 'aria-label': 'Raise ceiling', onclick: () => setCeiling(ceiling + 4) },
      '+'
    )
  );
  function setCeiling(v) {
    ceiling = Math.min(MAX_BPM, Math.max(MIN_BPM, v));
    ceilingLabel.textContent = `${ceiling} BPM`;
    setSetting('trainerCeiling', ceiling);
  }

  const modeSeg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Practice mode' });
  function renderMode() {
    clear(modeSeg);
    for (const [val, label] of [[false, 'Steady'], [true, 'Speed up']]) {
      modeSeg.append(
        el(
          'button',
          {
            class: `seg${autoMode === val ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => {
              autoMode = val;
              setSetting('trainerAuto', val);
              renderMode();
              ceilingRow.style.display = autoMode ? '' : 'none';
            },
          },
          label
        )
      );
    }
    ceilingRow.style.display = autoMode ? '' : 'none';
  }

  // --- Start / Stop ------------------------------------------------------
  const startBtn = el('button', { class: 'btn btn-start', type: 'button' });
  const status = el('p', { class: 'trainer-status' }, 'Pick two chords, then press Start.');
  function refreshStart() {
    startBtn.textContent = trainer.running ? 'Stop' : 'Start';
    startBtn.classList.toggle('is-running', trainer.running);
  }

  function onBar(bar) {
    activeIndex = bar % 2;
    renderDiagrams();
    if (autoMode && bar > 0 && bar % BARS_PER_STEP === 0 && trainer.bpm < ceiling) {
      setBpm(Math.min(ceiling, trainer.bpm + BPM_STEP), { persist: false });
    }
  }

  function startTrainer() {
    sessionStart = performance.now();
    activeIndex = 0;
    renderDiagrams();
    trainer.start({ onBeat: pulseBeat, onBar });
    refreshStart();
    status.textContent = autoMode
      ? 'Switch on every bar — the tempo will creep up. You’ve got this!'
      : 'Switch chords on every bar. Smooth and steady wins.';
  }

  function stopTrainer({ silent = false } = {}) {
    const ranMs = sessionStart ? performance.now() - sessionStart : 0;
    trainer.stop();
    clearDots();
    activeIndex = 0;
    renderDiagrams();
    refreshStart();
    // A real practice bout (≥15s) counts toward the daily streak.
    if (!silent && ranMs >= 15000) {
      recordPracticeSession().then(refreshStreak);
      status.textContent = 'Nice work — that counts toward your streak. 🎉';
    } else if (!silent) {
      status.textContent = 'Pick two chords, then press Start.';
    }
    sessionStart = 0;
  }

  startBtn.addEventListener('click', () => {
    if (challenge) return; // ignore while a challenge owns the transport
    if (trainer.running) stopTrainer();
    else startTrainer();
  });

  // --- One-minute change challenge --------------------------------------
  const bestLine = el('span', { class: 'trainer-best-val' });
  function refreshBest() {
    const best = getTrainerBest(pairKey(pair[0], pair[1]));
    bestLine.textContent = best ? `Best: ${best} clean changes` : 'No score yet — set one!';
  }

  const streakLine = el('span', { class: 'trainer-streak' });
  function refreshStreak() {
    const s = getStreak();
    streakLine.textContent = s > 0 ? `🔥 ${s}-day streak` : '';
  }

  const challengeCount = el('div', { class: 'challenge-count' }, '0');
  const challengeTimer = el('div', { class: 'challenge-timer' }, `${CHALLENGE_SECONDS}s`);
  const cleanBtn = el(
    'button',
    { class: 'btn challenge-tap', type: 'button' },
    'Clean change! 👏'
  );
  const challengeBtn = el('button', { class: 'btn btn-secondary challenge-start', type: 'button' });
  const challengePanel = el(
    'div',
    { class: 'challenge-panel' },
    el('div', { class: 'challenge-readout' }, challengeTimer, challengeCount),
    cleanBtn
  );
  challengePanel.style.display = 'none';

  function refreshChallengeBtn() {
    challengeBtn.textContent = challenge ? 'Stop challenge' : 'Start 1-minute challenge';
    challengeBtn.classList.toggle('is-running', !!challenge);
  }

  cleanBtn.addEventListener('click', () => {
    if (!challenge) return;
    challenge.count += 1;
    challengeCount.textContent = String(challenge.count);
    cleanBtn.animate(
      [{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
      { duration: 120, easing: 'ease-out' }
    );
  });

  function startChallenge() {
    // Challenge always runs at a steady tempo (no auto-advance).
    if (trainer.running) trainer.stop();
    challenge = { count: 0, endsAt: performance.now() + CHALLENGE_SECONDS * 1000, raf: null };
    challengeCount.textContent = '0';
    challengePanel.style.display = '';
    startBtn.disabled = true;
    refreshChallengeBtn();
    status.textContent = 'Go! Tap “Clean change!” each time you switch cleanly.';

    activeIndex = 0;
    renderDiagrams();
    trainer.start({ onBeat: pulseBeat, onBar });

    // Countdown is wall-clock (not musical), so rAF/perf.now is fine here.
    const tick = () => {
      if (!challenge) return;
      const remaining = Math.max(0, challenge.endsAt - performance.now());
      challengeTimer.textContent = `${Math.ceil(remaining / 1000)}s`;
      if (remaining <= 0) {
        finishChallenge();
        return;
      }
      challenge.raf = requestAnimationFrame(tick);
    };
    challenge.raf = requestAnimationFrame(tick);
  }

  function finishChallenge() {
    const count = challenge ? challenge.count : 0;
    if (challenge && challenge.raf) cancelAnimationFrame(challenge.raf);
    challenge = null;
    trainer.stop();
    clearDots();
    activeIndex = 0;
    renderDiagrams();
    challengePanel.style.display = 'none';
    startBtn.disabled = false;
    refreshChallengeBtn();
    challengeTimer.textContent = `${CHALLENGE_SECONDS}s`;

    const key = pairKey(pair[0], pair[1]);
    status.textContent = 'Scoring…';
    recordPracticeSession().then(refreshStreak);
    // recordTrainerScore stores only if it beats the saved best (Promise<boolean>).
    recordTrainerScore(key, count).then((isBest) => {
      status.textContent =
        count === 0
          ? 'No worries — every guitarist started at zero. Try again!'
          : isBest
            ? `New best — ${count} clean changes! 🏆`
            : `${count} clean changes. Your best is ${getTrainerBest(key)}. 💪`;
      refreshBest();
    });
  }

  challengeBtn.addEventListener('click', () => {
    if (challenge) finishChallenge();
    else startChallenge();
  });

  // --- Initial render ----------------------------------------------------
  renderDiagrams();
  renderPresets();
  renderSelects();
  renderMode();
  refreshStart();
  refreshBest();
  refreshStreak();
  refreshChallengeBtn();

  const node = el(
    'div',
    { class: 'trainer' },
    card(
      el('h2', { class: 'card-title' }, 'Chord Changes'),
      diagrams,
      dots,
      status,
      el('div', { class: 'trainer-presets-wrap' }, presetRow, selectRow),
      el(
        'div',
        { class: 'bpm-display bpm-display--sm' },
        el('div', { class: 'bpm-line' }, bpmNum, el('span', { class: 'bpm-unit' }, 'BPM'))
      ),
      el('div', { class: 'tempo-row' }, minus, slider, plus),
      el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Mode'), modeSeg),
      ceilingRow,
      startBtn
    ),
    card(
      el('h2', { class: 'card-title' }, 'One-minute challenge'),
      el(
        'p',
        { class: 'row-desc' },
        'Play the change for one minute and tap each time you switch cleanly.'
      ),
      el('div', { class: 'trainer-best' }, bestLine, streakLine),
      challengeBtn,
      challengePanel
    )
  );

  return {
    node,
    dispose: () => {
      if (challenge && challenge.raf) cancelAnimationFrame(challenge.raf);
      challenge = null;
      trainer.stop();
    },
  };
}
