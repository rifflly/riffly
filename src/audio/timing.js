/**
 * The ONE shared timing engine instance (architecture rule b).
 *
 * Every rhythmic feature — metronome now, chord-change trainer and practice
 * studio later — must use this single engine, bound to the single shared
 * AudioContext. Created lazily so the AudioContext isn't built before the user
 * unlocks audio.
 */
import { getAudioContext } from './audio-engine.js';
import { TimingEngine } from './timing-engine.js';

let engine = null;

export function getTimingEngine() {
  if (!engine) engine = new TimingEngine(getAudioContext());
  return engine;
}
