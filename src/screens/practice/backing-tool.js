/**
 * Backing-rhythm tool (Practice tab, Phase 2 item 2).
 *
 * A friendly front-end over the BackingRhythm controller: pick a pattern, pick a
 * chord to strum, set the tempo, and play along. All sound runs on the shared
 * timing engine (rule b) via the controller. Exposes create() → { node, dispose }
 * for the Practice hub.
 */
import { el, clear } from '../../ui/dom.js';
import { card } from '../../ui/screen.js';
import { CHORDS, getChord } from '../../content.js';
import { BackingRhythm, PATTERNS, getPattern } from '../../audio/backing.js';
import { getSetting, setSetting } from '../../storage/settings.js';

const MIN_BPM = 50;
const MAX_BPM = 180;

export function create() {
  const backing = new BackingRhythm();

  let pattern = getPattern(getSetting('backingPattern'));
  let chordId = getChord(getSetting('backingChord')) ? getSetting('backingChord') : 'G';
  backing.setPattern(pattern.id);
  backing.setChord(chordId);
  backing.setTempo(getSetting('backingBpm'));

  // --- Pattern picker ----------------------------------------------------
  const patternList = el('div', { class: 'pattern-list' });
  function renderPatterns() {
    clear(patternList);
    for (const p of PATTERNS) {
      patternList.append(
        el(
          'button',
          {
            class: `pattern-btn${p.id === pattern.id ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => selectPattern(p.id),
          },
          el('span', { class: 'pattern-name' }, p.name),
          el('span', { class: 'pattern-sig' }, p.signature)
        )
      );
    }
  }

  // --- Chord picker ------------------------------------------------------
  const chordField = el('div', { class: 'field' });
  const chordSelect = el('select', { class: 'trainer-select', 'aria-label': 'Chord to strum' });
  for (const c of CHORDS) {
    const opt = el('option', { value: c.id }, c.name);
    if (c.id === chordId) opt.selected = true;
    chordSelect.append(opt);
  }
  chordSelect.addEventListener('change', () => {
    chordId = chordSelect.value;
    backing.setChord(chordId);
    setSetting('backingChord', chordId);
  });
  const chordHint = el('span', { class: 'row-desc' });
  function renderChordField() {
    clear(chordField);
    if (pattern.usesChord) {
      chordField.append(el('span', { class: 'field-label' }, 'Chord'), chordSelect);
      chordField.style.opacity = '1';
    } else {
      chordField.append(
        el('span', { class: 'field-label' }, 'Chord'),
        el('span', { class: 'row-desc' }, 'Drum groove — no chord needed')
      );
      chordField.style.opacity = '0.7';
    }
  }

  function selectPattern(id) {
    pattern = getPattern(id);
    backing.setPattern(id);
    setSetting('backingPattern', id);
    renderPatterns();
    renderChordField();
    renderDots();
  }

  // --- Beat dots ---------------------------------------------------------
  const dots = el('div', { class: 'beat-dots' });
  function renderDots() {
    clear(dots);
    for (let i = 0; i < pattern.beats; i++) dots.append(el('span', { class: 'beat-dot' }));
  }
  function onStep(e) {
    if (!e.isBeat) return;
    const list = dots.querySelectorAll('.beat-dot');
    list.forEach((d) => d.classList.remove('is-active', 'is-down'));
    const active = list[e.beatInBar];
    if (!active) return;
    active.classList.add('is-active');
    if (e.isDownbeat) active.classList.add('is-down');
    active.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], {
      duration: 150,
      easing: 'ease-out',
    });
  }
  function clearDots() {
    dots.querySelectorAll('.beat-dot').forEach((d) => d.classList.remove('is-active', 'is-down'));
  }

  // --- Tempo -------------------------------------------------------------
  const bpmNum = el('span', { class: 'bpm-num' }, String(backing.bpm));
  const slider = el('input', {
    type: 'range',
    class: 'bpm-slider',
    min: String(MIN_BPM),
    max: String(MAX_BPM),
    value: String(backing.bpm),
    'aria-label': 'Tempo in beats per minute',
  });
  function setBpm(value, { fromSlider = false } = {}) {
    const bpm = backing.setTempo(Math.min(MAX_BPM, Math.max(MIN_BPM, value)));
    bpmNum.textContent = String(bpm);
    if (!fromSlider) slider.value = String(bpm);
    setSetting('backingBpm', bpm);
  }
  slider.addEventListener('input', () => setBpm(Number(slider.value), { fromSlider: true }));
  const minus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Slower', onclick: () => setBpm(backing.bpm - 2) },
    '−'
  );
  const plus = el(
    'button',
    { class: 'stepper', type: 'button', 'aria-label': 'Faster', onclick: () => setBpm(backing.bpm + 2) },
    '+'
  );

  // --- Start / Stop ------------------------------------------------------
  const startBtn = el('button', { class: 'btn btn-start', type: 'button' });
  function refreshStart() {
    startBtn.textContent = backing.running ? 'Stop' : 'Play';
    startBtn.classList.toggle('is-running', backing.running);
  }
  startBtn.addEventListener('click', () => {
    if (backing.running) {
      backing.stop();
      clearDots();
    } else {
      backing.start(onStep);
    }
    refreshStart();
  });

  renderPatterns();
  renderChordField();
  renderDots();
  refreshStart();

  const node = card(
    el('h2', { class: 'card-title' }, 'Backing Rhythm'),
    el('p', { class: 'row-desc' }, 'Pick a groove to strum or play along with.'),
    patternList,
    chordField,
    dots,
    el(
      'div',
      { class: 'bpm-display bpm-display--sm' },
      el('div', { class: 'bpm-line' }, bpmNum, el('span', { class: 'bpm-unit' }, 'BPM'))
    ),
    el('div', { class: 'tempo-row' }, minus, slider, plus),
    startBtn
  );

  return { node, dispose: () => backing.stop() };
}
