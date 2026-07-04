/**
 * Microphone tuner engine (Phase 3 item 1).
 *
 * Listens to the guitar through the mic and reports the nearest string + how
 * many cents sharp/flat you are. Uses pitchy's McLeod pitch detector on an
 * AnalyserNode fed from the shared AudioContext (rule c — one context). The mic
 * source is NOT connected to the destination, so there's no feedback howl.
 *
 * Readings are filtered (clarity ≥ 0.9, 60–500 Hz) and smoothed with a rolling
 * median of the last few valid pitches, so the needle doesn't jitter.
 */
import { getAudioContext } from './audio-engine.js';
import { PitchDetector } from 'pitchy';

// Standard tuning, low (6th) to high (1st).
export const STRINGS = [
  { name: 'E', label: 'Low E (6th)', freq: 82.41 },
  { name: 'A', label: 'A (5th)', freq: 110.0 },
  { name: 'D', label: 'D (4th)', freq: 146.83 },
  { name: 'G', label: 'G (3rd)', freq: 196.0 },
  { name: 'B', label: 'B (2nd)', freq: 246.94 },
  { name: 'e', label: 'High E (1st)', freq: 329.63 },
];

const MIN_HZ = 60;
const MAX_HZ = 500;
const MIN_CLARITY = 0.9;
const MEDIAN_WINDOW = 5;

export function centsOff(freq, target) {
  return 1200 * Math.log2(freq / target);
}

/** The string whose pitch is closest (in cents) to `freq`. */
export function nearestString(freq) {
  let best = STRINGS[0];
  let bestAbs = Infinity;
  for (const s of STRINGS) {
    const abs = Math.abs(centsOff(freq, s.freq));
    if (abs < bestAbs) {
      bestAbs = abs;
      best = s;
    }
  }
  return best;
}

export class TunerEngine {
  constructor() {
    this.running = false;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.detector = null;
    this.input = null;
    this.raf = null;
    this.recent = [];
  }

  /**
   * @param {(reading:object)=>void} onReading - {ok, pitch?, clarity, string?, cents?}
   * @param {(error:Error)=>void} onError - called if mic access fails
   * @returns {Promise<boolean>} whether the tuner started
   */
  async start(onReading, onError) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      if (onError) onError(err);
      return false;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* best effort */
      }
    }

    this.source = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser); // deliberately NOT to destination

    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);
    this.input = new Float32Array(this.detector.inputLength);
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(this.input);
      const [pitch, clarity] = this.detector.findPitch(this.input, ctx.sampleRate);

      if (clarity >= MIN_CLARITY && pitch >= MIN_HZ && pitch <= MAX_HZ) {
        this.recent.push(pitch);
        if (this.recent.length > MEDIAN_WINDOW) this.recent.shift();
        const sorted = [...this.recent].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const string = nearestString(median);
        if (onReading) onReading({ ok: true, pitch: median, clarity, string, cents: centsOff(median, string.freq) });
      } else {
        if (onReading) onReading({ ok: false, clarity });
      }

      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return true;
  }

  stop() {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* already gone */
      }
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.detector = null;
    this.recent = [];
  }
}

/** Play a short reference tone at `freq` so the user can tune by ear. */
export function playReferenceTone(freq, duration = 1.6) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  gain.gain.setValueAtTime(0.25, t + duration - 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}
