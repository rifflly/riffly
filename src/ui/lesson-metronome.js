/**
 * A compact metronome control embedded inside a lesson step. Reuses the shared
 * Metronome (and therefore the one shared timing engine, rule b). Requires audio
 * to be unlocked first (rule c); shows an Enable button until then.
 */
import { el, clear } from './dom.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { Metronome } from '../audio/metronome.js';

/**
 * @param {number} bpm
 * @returns {{ node: HTMLElement, dispose: Function }}
 */
export function buildLessonMetronome(bpm) {
  const wrap = el('div', { class: 'lesson-metro' });
  let metro = null;
  let offUnlock = null;

  function build() {
    clear(wrap);
    if (!isAudioUnlocked()) {
      wrap.append(
        el(
          'button',
          { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => unlockAudio() },
          'Enable sound'
        )
      );
      offUnlock = onAudioUnlock(() => {
        offUnlock = null;
        build();
      });
      return;
    }

    metro = new Metronome();
    metro.setTempo(bpm);
    metro.setBeatsPerBar(4);

    const dot = el('span', { class: 'metro-mini-dot' });
    const btn = el('button', { class: 'btn btn-start btn-sm', type: 'button' });
    const setLabel = () => {
      btn.textContent = metro.running ? 'Stop beat' : `Start beat · ${bpm} BPM`;
    };
    setLabel();

    btn.addEventListener('click', () => {
      metro.toggle((e) => {
        dot.classList.toggle('is-down', e.isDownbeat);
        dot.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], {
          duration: 150,
          easing: 'ease-out',
        });
      });
      setLabel();
      if (!metro.running) dot.classList.remove('is-down');
    });

    wrap.append(el('div', { class: 'lesson-metro-row' }, dot, btn));
  }

  build();

  return {
    node: wrap,
    dispose: () => {
      if (metro) metro.stop();
      if (offUnlock) offUnlock();
    },
  };
}
