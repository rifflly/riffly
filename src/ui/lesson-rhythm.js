/**
 * A compact backing-rhythm player embedded inside a lesson step. Reuses the
 * BackingRhythm generator (and therefore the one timing engine, rule b) so a
 * lesson can play the exact strum/drum pattern it's teaching. Requires audio to
 * be unlocked first (rule c).
 */
import { el, clear } from './dom.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { BackingRhythm } from '../audio/backing.js';

/**
 * @param {string} patternId
 * @param {string} [chordId]
 * @param {number} [bpm]
 * @returns {{ node: HTMLElement, dispose: Function }}
 */
export function buildLessonRhythm(patternId, chordId, bpm) {
  const wrap = el('div', { class: 'lesson-rhythm' });
  let backing = null;
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

    backing = new BackingRhythm();
    backing.setPattern(patternId);
    if (chordId) backing.setChord(chordId);
    backing.setTempo(bpm || 75);

    const dot = el('span', { class: 'metro-mini-dot' });
    const btn = el('button', { class: 'btn btn-start btn-sm', type: 'button' });
    const setLabel = () => {
      btn.textContent = backing.running ? 'Stop' : `Start · ${backing.bpm} BPM`;
    };
    setLabel();

    btn.addEventListener('click', () => {
      if (backing.running) {
        backing.stop();
        dot.classList.remove('is-down');
      } else {
        backing.start((e) => {
          if (!e.isBeat) return;
          dot.classList.toggle('is-down', e.isDownbeat);
          dot.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], {
            duration: 150,
            easing: 'ease-out',
          });
        });
      }
      setLabel();
    });

    wrap.append(el('div', { class: 'lesson-metro-row' }, dot, btn));
  }

  build();

  return {
    node: wrap,
    dispose: () => {
      if (backing) backing.stop();
      if (offUnlock) offUnlock();
    },
  };
}
