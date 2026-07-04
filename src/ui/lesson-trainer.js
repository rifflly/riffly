/**
 * A compact chord-change trainer embedded inside a lesson step. Reuses the
 * shared ChordTrainer (and therefore the one timing engine, rule b). Shows two
 * chord diagrams and flips the highlight on each bar line. Requires audio to be
 * unlocked first (rule c); shows an Enable button until then.
 */
import { el, clear } from './dom.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { ChordTrainer } from '../audio/chord-trainer.js';
import { getChord } from '../content.js';
import { chordDiagramSVG } from './chord-diagram.js';
import { getSetting } from '../storage/settings.js';

/**
 * @param {[string,string]} pair - two chord ids
 * @param {number} bpm
 * @returns {{ node: HTMLElement, dispose: Function }}
 */
export function buildLessonTrainer(pair, bpm) {
  const wrap = el('div', { class: 'lesson-trainer' });
  const mirror = getSetting('leftHanded');
  const [aId, bId] = pair;
  let trainer = null;
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

    trainer = new ChordTrainer();
    trainer.setTempo(bpm);
    let activeIndex = 0;

    const slotA = el('div', { class: 'trainer-slot' });
    const slotB = el('div', { class: 'trainer-slot' });
    const diagrams = el(
      'div',
      { class: 'trainer-diagrams' },
      slotA,
      el('div', { class: 'trainer-arrow', 'aria-hidden': 'true' }, '⇄'),
      slotB
    );

    function renderSlot(slot, id, active) {
      const chord = getChord(id);
      clear(slot);
      slot.classList.toggle('is-active', active);
      if (!chord) return;
      slot.append(
        el('div', { class: 'trainer-diagram', html: chordDiagramSVG(chord, { mirror }) }),
        el('div', { class: 'trainer-chord-name' }, chord.name)
      );
    }
    function renderSlots() {
      renderSlot(slotA, aId, activeIndex === 0);
      renderSlot(slotB, bId, activeIndex === 1);
    }
    renderSlots();

    const btn = el('button', { class: 'btn btn-start btn-sm', type: 'button' });
    const setLabel = () => {
      btn.textContent = trainer.running ? 'Stop' : `Start · ${bpm} BPM`;
    };
    setLabel();
    btn.addEventListener('click', () => {
      if (trainer.running) {
        trainer.stop();
        activeIndex = 0;
        renderSlots();
      } else {
        activeIndex = 0;
        renderSlots();
        trainer.start({
          onBar: (bar) => {
            activeIndex = bar % 2;
            renderSlots();
          },
        });
      }
      setLabel();
    });

    wrap.append(diagrams, el('div', { class: 'lesson-metro-row' }, btn));
  }

  build();

  return {
    node: wrap,
    dispose: () => {
      if (trainer) trainer.stop();
      if (offUnlock) offUnlock();
    },
  };
}
