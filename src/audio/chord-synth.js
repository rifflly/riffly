/**
 * Karplus-Strong chord strum synth.
 *
 * A plucked-string tone is made by exciting a short delay line with noise and
 * feeding it back through a one-pole lowpass (the "string" losing energy). We
 * render each string's pluck to an AudioBuffer once and cache it, then a strum
 * plays the chord's strings in sequence with a small time offset — low→high for
 * a down strum, high→low for an up strum, exactly like a real strumming hand.
 *
 * Everything is stamped at a precise audioContext time supplied by the shared
 * timing engine (rule b) — this module never schedules time itself.
 */
import { getChord } from '../content.js';

// Open-string pitches in standard tuning, in data-string order (low E → high E).
const OPEN_STRING_HZ = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const KS_DURATION = 1.6; // seconds of tail rendered per pluck
const DECAY = 0.996; // per-sample energy loss — higher = longer sustain

const bufferCache = new Map(); // rounded-freq → AudioBuffer

/** Frequencies of the strings that actually sound in this chord (skips muted). */
function stringFreqs(chord) {
  const out = [];
  chord.frets.forEach((fret, i) => {
    if (fret < 0) return; // muted string — not struck
    out.push(OPEN_STRING_HZ[i] * Math.pow(2, fret / 12));
  });
  return out;
}

/** Render (or fetch from cache) a Karplus-Strong pluck at `freq`. */
function ksBuffer(ctx, freq) {
  const key = Math.round(freq * 10);
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const sr = ctx.sampleRate;
  const N = Math.max(2, Math.round(sr / freq)); // delay-line length sets the pitch
  const len = Math.floor(sr * KS_DURATION);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);

  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1; // noise excitation

  let idx = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % N];
    out[i] = cur;
    line[idx] = 0.5 * (cur + next) * DECAY; // lowpass average + gentle decay
    idx = (idx + 1) % N;
  }

  bufferCache.set(key, buf);
  return buf;
}

/**
 * Strum a chord at a precise audio time.
 * @param {AudioContext} ctx
 * @param {number} time - audioContext time of the strum
 * @param {object|string} chordOrId - chord object or its id
 * @param {{direction?: 'down'|'up', gain?: number, destination?: AudioNode}} [opts]
 */
export function strumChord(ctx, time, chordOrId, { direction = 'down', gain = 0.22, destination } = {}) {
  const chord = typeof chordOrId === 'string' ? getChord(chordOrId) : chordOrId;
  if (!chord) return;
  const dest = destination || ctx.destination;

  let freqs = stringFreqs(chord);
  if (direction === 'up') freqs = freqs.slice().reverse();
  const spread = direction === 'up' ? 0.018 : 0.014; // seconds between adjacent strings
  const level = direction === 'up' ? gain * 0.8 : gain; // up-strokes a touch softer

  freqs.forEach((freq, k) => {
    const t = time + k * spread;
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(ctx, freq);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004); // soften the attack click
    src.connect(g).connect(dest);
    src.start(t);
    src.stop(t + KS_DURATION);
  });
}
