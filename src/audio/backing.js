/**
 * Backing-rhythm generator (Phase 2 item 2).
 *
 * Extends the metronome idea into full strum/drum patterns. It is a consumer of
 * the ONE shared timing engine (rule b): it registers a scheduler that, on each
 * subdivision event, plays whatever voices the current pattern places on that
 * step — all stamped at the event's precise audio time.
 *
 * Built as a controller with start/stop/setPattern/setChord/setTempo so the
 * Practice Studio (item 4) can drive it as the "App Rhythm" backing, calling
 * setChord as the song moves from line to line.
 */
import { getAudioContext } from './audio-engine.js';
import { getTimingEngine } from './timing.js';
import { strumChord } from './chord-synth.js';
import { playKick, playSnare, playHat } from './drums.js';

// Voice tokens used in pattern step lists.
const D = { v: 'strum', dir: 'down' };
const U = { v: 'strum', dir: 'up' };
const K = { v: 'kick' };
const S = { v: 'snare' };
const H = { v: 'hat' };

/**
 * Each pattern sets the engine's time signature (beats × subdivisions) and lists
 * one step per subdivision; each step is the voices that fire on it.
 */
export const PATTERNS = [
  {
    id: 'downstrums',
    name: 'Down strums',
    signature: '4/4',
    beats: 4,
    sub: 1,
    usesChord: true,
    steps: [[D], [D], [D], [D]],
  },
  {
    id: 'dduudu',
    name: 'D · DU · UDU',
    signature: '4/4',
    beats: 4,
    sub: 2,
    usesChord: true,
    // 1  &  2  &  3  &  4  &
    steps: [[D], [], [D], [U], [], [U], [D], [U]],
  },
  {
    id: 'folk34',
    name: 'Folk 3/4',
    signature: '3/4',
    beats: 3,
    sub: 1,
    usesChord: true,
    // boom (bass thump + strum), strum, strum
    steps: [[K, D], [D], [D]],
  },
  {
    id: 'rock',
    name: 'Rock beat',
    signature: '4/4',
    beats: 4,
    sub: 2,
    usesChord: false,
    // kick 1 & 3, snare 2 & 4, hats on every eighth
    steps: [[K, H], [H], [S, H], [H], [K, H], [H], [S, H], [H]],
  },
];

export function getPattern(id) {
  return PATTERNS.find((p) => p.id === id) || PATTERNS[0];
}

export class BackingRhythm {
  constructor() {
    this.engine = getTimingEngine();
    this.pattern = PATTERNS[0];
    this.chordId = 'G';
    this.running = false;
    this.startBeat = 0; // engine beats below this are skipped (e.g. a count-in bar)
    this._removeScheduler = null;
    this._raf = null;
    this._master = null;
    this._comp = null;
    this.onStep = null; // optional visual callback(event)
  }

  get bpm() {
    return this.engine.bpm;
  }

  setTempo(bpm) {
    return this.engine.setTempo(bpm);
  }

  setChord(id) {
    this.chordId = id;
  }

  /** Engine beats below `n` are skipped — used by the studio for a count-in bar. */
  setStartBeat(n) {
    this.startBeat = Math.max(0, n || 0);
  }

  setPattern(id) {
    const p = getPattern(id);
    if (p === this.pattern) return;
    this.pattern = p;
    // Restart on a fresh bar so the new time signature stays phase-aligned.
    if (this.running) {
      const onStep = this.onStep;
      this.stop();
      this.start(onStep);
    }
  }

  _applyTimeSig() {
    this.engine.setBeatsPerBar(this.pattern.beats);
    this.engine.setSubdivisionsPerBeat(this.pattern.sub);
  }

  /**
   * Register this generator's scheduler on the shared engine WITHOUT starting
   * the engine or an rAF loop. Lets the Practice Studio own the engine run and
   * clock while this still produces the strums/drums.
   */
  attach() {
    const ctx = getAudioContext();
    this._master = ctx.createGain();
    this._master.gain.value = 0.85;
    this._comp = ctx.createDynamicsCompressor();
    this._master.connect(this._comp).connect(ctx.destination);

    this._applyTimeSig();
    this._removeScheduler = this.engine.addScheduler((e) => this._onEvent(ctx, e));
  }

  /** Unregister the scheduler and tear down the audio bus (after tails ring). */
  detach() {
    if (this._removeScheduler) {
      this._removeScheduler();
      this._removeScheduler = null;
    }
    const master = this._master;
    const comp = this._comp;
    this._master = null;
    this._comp = null;
    if (master) {
      setTimeout(() => {
        try {
          master.disconnect();
          comp.disconnect();
        } catch {
          /* already gone */
        }
      }, 2000);
    }
  }

  start(onStep) {
    if (this.running) return;
    this.running = true;
    this.onStep = onStep;

    const ctx = getAudioContext();
    this.attach();
    this.engine.start();

    const tick = () => {
      if (!this.running) return;
      const due = this.engine.popDueVisualEvents(ctx.currentTime);
      if (due.length && this.onStep) this.onStep(due[due.length - 1]);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _onEvent(ctx, e) {
    if (e.beat < this.startBeat) return;
    const p = this.pattern;
    const stepIndex = e.beatInBar * p.sub + e.subdivision;
    const step = p.steps[stepIndex];
    if (!step) return;
    for (const voice of step) {
      const t = e.time;
      if (voice.v === 'strum') {
        strumChord(ctx, t, this.chordId, { direction: voice.dir, destination: this._master });
      } else if (voice.v === 'kick') {
        playKick(ctx, t, { destination: this._master });
      } else if (voice.v === 'snare') {
        playSnare(ctx, t, { destination: this._master });
      } else if (voice.v === 'hat') {
        playHat(ctx, t, { destination: this._master });
      }
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.engine.stop();
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.detach();
  }
}
