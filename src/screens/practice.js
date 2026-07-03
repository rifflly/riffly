/**
 * Practice screen — Metronome (Phase 1).
 *
 * The first feature that makes sound. It is driven entirely by the shared
 * timing engine (rule b) via the Metronome controller. Audio must be unlocked
 * first (rule c); until then we show a friendly "Enable sound" prompt.
 */
import { el, clear } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { Metronome } from '../audio/metronome.js';
import { getSetting, setSetting } from '../storage/settings.js';

const MIN_BPM = 40;
const MAX_BPM = 208;

function tempoTerm(bpm) {
  if (bpm < 60) return 'Nice and slow';
  if (bpm < 76) return 'Slow';
  if (bpm < 100) return 'Relaxed';
  if (bpm < 120) return 'Medium';
  if (bpm < 144) return 'Brisk';
  if (bpm < 176) return 'Fast';
  return 'Very fast';
}

export function render() {
  const root = el('div', { class: 'practice' });
  mount(root);
  return root;
}

function mount(root) {
  clear(root);
  if (!isAudioUnlocked()) {
    mountEnablePrompt(root);
  } else {
    mountMetronome(root);
  }
}

function mountEnablePrompt(root) {
  const btn = el(
    'button',
    { class: 'btn btn-primary', type: 'button', onclick: () => unlockAudio() },
    'Enable sound'
  );
  root.append(
    card(
      el('h2', { class: 'card-title' }, 'Metronome'),
      el(
        'div',
        { class: 'enable-block' },
        el('p', { class: 'card-text' }, 'Turn on sound to use the metronome.'),
        el('p', { class: 'row-desc' }, 'You only need to do this once each visit.'),
        btn
      )
    )
  );
  // Rebuild into the full metronome as soon as audio unlocks.
  const off = onAudioUnlock(() => {
    off();
    mount(root);
  });
  root._dispose = off;
}

function mountMetronome(root) {
  const metro = new Metronome();
  metro.setTempo(getSetting('metronomeBpm'));
  metro.setBeatsPerBar(getSetting('metronomeBeats'));

  // --- Beat dots ---------------------------------------------------------
  const dots = el('div', { class: 'beat-dots' });
  function renderDots() {
    clear(dots);
    for (let i = 0; i < metro.beatsPerBar; i++) {
      dots.append(el('span', { class: 'beat-dot' }));
    }
  }
  function clearActiveDots() {
    dots.querySelectorAll('.beat-dot').forEach((d) => d.classList.remove('is-active', 'is-down'));
  }
  renderDots();

  // --- BPM display -------------------------------------------------------
  const bpmNum = el('span', { class: 'bpm-num' }, String(metro.bpm));
  const bpmTerm = el('span', { class: 'bpm-term' }, tempoTerm(metro.bpm));
  const slider = el('input', {
    type: 'range',
    class: 'bpm-slider',
    min: String(MIN_BPM),
    max: String(MAX_BPM),
    value: String(metro.bpm),
    'aria-label': 'Tempo in beats per minute',
  });

  function setBpm(value, { fromSlider = false } = {}) {
    const bpm = metro.setTempo(value);
    bpmNum.textContent = String(bpm);
    bpmTerm.textContent = tempoTerm(bpm);
    if (!fromSlider) slider.value = String(bpm);
    setSetting('metronomeBpm', bpm);
  }
  slider.addEventListener('input', () => setBpm(Number(slider.value), { fromSlider: true }));

  const minus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Slower', onclick: () => setBpm(metro.bpm - 1) },
    '−'
  );
  const plus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Faster', onclick: () => setBpm(metro.bpm + 1) },
    '+'
  );

  // --- Time signature (beats per bar) ------------------------------------
  const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Beats per bar' });
  function renderSeg() {
    clear(seg);
    for (const n of [2, 3, 4]) {
      seg.append(
        el(
          'button',
          {
            class: `seg${n === metro.beatsPerBar ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => {
              metro.setBeatsPerBar(n);
              setSetting('metronomeBeats', n);
              renderSeg();
              renderDots();
            },
          },
          String(n)
        )
      );
    }
  }
  renderSeg();

  // --- Tap tempo ---------------------------------------------------------
  let taps = [];
  const tapBtn = el(
    'button',
    {
      class: 'btn btn-tap',
      type: 'button',
      onclick: () => {
        const now = performance.now();
        if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
        taps.push(now);
        if (taps.length > 4) taps = taps.slice(-4);
        if (taps.length >= 2) {
          let sum = 0;
          for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
          setBpm(Math.round(60000 / (sum / (taps.length - 1))));
        }
      },
    },
    'Tap tempo'
  );

  // --- Start / Stop ------------------------------------------------------
  const startBtn = el('button', { class: 'btn btn-start', type: 'button' });
  function refreshStart() {
    startBtn.textContent = metro.running ? 'Stop' : 'Start';
    startBtn.classList.toggle('is-running', metro.running);
  }
  refreshStart();

  function onBeat(event) {
    const list = dots.querySelectorAll('.beat-dot');
    list.forEach((d) => d.classList.remove('is-active', 'is-down'));
    const active = list[event.beatInBar];
    if (!active) return;
    active.classList.add('is-active');
    if (event.isDownbeat) active.classList.add('is-down');
    active.animate(
      [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' }
    );
  }

  startBtn.addEventListener('click', () => {
    const running = metro.toggle(onBeat);
    refreshStart();
    if (!running) clearActiveDots();
  });

  // Clean up when leaving the screen so the metronome doesn't keep ticking.
  root._dispose = () => metro.stop();

  root.append(
    card(
      el('h2', { class: 'card-title' }, 'Metronome'),
      dots,
      el(
        'div',
        { class: 'bpm-display' },
        el('div', { class: 'bpm-line' }, bpmNum, el('span', { class: 'bpm-unit' }, 'BPM')),
        bpmTerm
      ),
      el('div', { class: 'tempo-row' }, minus, slider, plus),
      el(
        'div',
        { class: 'field' },
        el('span', { class: 'field-label' }, 'Beats per bar'),
        seg
      ),
      el('div', { class: 'action-row' }, tapBtn, startBtn)
    )
  );
}
