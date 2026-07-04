/**
 * Tuner screen (Phase 3 item 1). A friendly microphone tuner with a needle in
 * cents, auto string detection, an "In tune!" state, and a reference-tone
 * fallback so you can always tune by ear. Mic permission is asked for with a
 * plain-language pre-prompt; if it's denied we show exact re-enable steps.
 */
import { el, clear } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { isIosSafari } from '../install/platform.js';
import { unlockAudio } from '../audio/audio-engine.js';
import { TunerEngine, STRINGS, playReferenceTone } from '../audio/tuner-engine.js';

const IN_TUNE_CENTS = 5;
const IN_TUNE_HOLD_MS = 1000;
const LOST_MS = 2500;

export function render() {
  const root = el('div', { class: 'tuner' });
  const engine = new TunerEngine();

  // Active-display state (declared before the early return so it's initialized
  // by the time the mic-reading callbacks fire).
  let els = null;
  let inTuneSince = 0;
  let lastValidAt = 0;

  root._dispose = () => engine.stop();

  showIntro();
  return root;

  // ---- Views ------------------------------------------------------------

  function showIntro() {
    clear(root);
    root.append(
      card(
        el('h2', { class: 'card-title' }, 'Tuner'),
        el('p', { class: 'card-text' }, 'Riffly listens to your string and tells you if it’s in tune.'),
        el('p', { class: 'row-desc' }, 'Nothing is recorded and nothing is sent anywhere — it all stays on your device.'),
        el(
          'button',
          { class: 'btn btn-primary', type: 'button', onclick: startTuner },
          'Start tuning'
        )
      ),
      referenceCard()
    );
  }

  async function startTuner() {
    const ok = await engine.start(onReading, onError);
    if (ok) showActive();
  }

  function showActive() {
    clear(root);
    root.append(activeCard(), referenceCard());
  }

  function onError() {
    clear(root);
    const steps = isIosSafari()
      ? 'On iPhone: open Settings → Safari → Microphone and choose Allow (or tap “aA” in the address bar → Website Settings → Microphone). Then come back and try again.'
      : 'Tap the lock or camera icon in your browser’s address bar, allow the microphone, then try again.';
    root.append(
      card(
        el('h2', { class: 'card-title' }, 'Microphone blocked'),
        el('p', { class: 'card-text' }, 'Riffly needs the microphone to hear your guitar, and it looks like it’s turned off.'),
        el('p', { class: 'row-desc' }, steps),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: startTuner }, 'Try again')
      ),
      el(
        'p',
        { class: 'screen-intro' },
        'No microphone? No problem — use the reference tones below to tune by ear.'
      ),
      referenceCard()
    );
  }

  // ---- Active tuner display --------------------------------------------

  function activeCard() {
    const stringName = el('span', { class: 'tuner-string' }, '—');
    const target = el('span', { class: 'tuner-target' }, 'Play a string');
    const needle = el('div', { class: 'tuner-needle' });
    const gauge = el(
      'div',
      { class: 'tuner-gauge' },
      el('div', { class: 'tuner-gauge-zone' }),
      el('div', { class: 'tuner-gauge-center' }),
      needle
    );
    const hint = el('p', { class: 'tuner-hint' }, 'Listening…');
    const status = el('p', { class: 'tuner-status' }, '');
    const gaugeWrap = el('div', { class: 'tuner-display' }, stringName, target, gauge, hint, status);

    els = { stringName, target, needle, gauge, hint, status, gaugeWrap };
    inTuneSince = 0;
    lastValidAt = performance.now();

    return card(
      el('h2', { class: 'card-title' }, 'Tuner'),
      gaugeWrap,
      el(
        'button',
        {
          class: 'btn btn-start',
          type: 'button',
          onclick: () => {
            engine.stop();
            showIntro();
          },
        },
        'Stop'
      )
    );
  }

  function onReading(r) {
    if (!els) return;
    const now = performance.now();

    if (!r.ok) {
      els.gauge.classList.remove('is-in-tune');
      if (now - lastValidAt > LOST_MS) {
        els.hint.textContent = 'Can’t hear you clearly';
        els.status.textContent = 'Try somewhere quieter, and pluck one string firmly.';
      }
      inTuneSince = 0;
      return;
    }

    lastValidAt = now;
    els.status.textContent = '';
    els.stringName.textContent = r.string.label;
    els.target.textContent = `Target ${Math.round(r.string.freq)} Hz`;

    const cents = Math.max(-50, Math.min(50, r.cents));
    els.needle.style.left = `${((cents + 50) / 100) * 100}%`;

    const inTune = Math.abs(r.cents) <= IN_TUNE_CENTS;
    if (inTune) {
      if (!inTuneSince) inTuneSince = now;
    } else {
      inTuneSince = 0;
    }

    if (inTune && now - inTuneSince >= IN_TUNE_HOLD_MS) {
      els.gauge.classList.add('is-in-tune');
      els.hint.textContent = 'In tune! ✓';
    } else {
      els.gauge.classList.remove('is-in-tune');
      els.hint.textContent = r.cents < 0 ? 'A bit flat — tune up ↑' : inTune ? 'Almost…' : 'A bit sharp — tune down ↓';
    }
  }

  // ---- Reference tones --------------------------------------------------

  function referenceCard() {
    const row = el('div', { class: 'tone-row' });
    for (const s of STRINGS) {
      row.append(
        el(
          'button',
          {
            class: 'tone-btn',
            type: 'button',
            'aria-label': `Play ${s.label}`,
            onclick: async () => {
              await unlockAudio();
              playReferenceTone(s.freq);
            },
          },
          el('span', { class: 'tone-name' }, s.name),
          el('span', { class: 'tone-hz' }, `${Math.round(s.freq)}`)
        )
      );
    }
    return card(
      el('h2', { class: 'card-title' }, 'Reference tones'),
      el('p', { class: 'row-desc' }, 'Tap a string to hear its pitch and tune by ear.'),
      row
    );
  }
}
