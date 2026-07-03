/**
 * Riffly shared timing engine (architecture rule b).
 *
 * ONE engine drives EVERY rhythmic feature — metronome, chord-change trainer,
 * practice-studio scrolling. It uses the Web Audio "lookahead scheduling"
 * pattern (Chris Wilson, "A Tale of Two Clocks"):
 *
 *   - A lightweight timer wakes the scheduler roughly every `tickInterval` ms.
 *   - Each wake-up schedules every beat/subdivision that falls within the next
 *     `lookahead` seconds, stamping each one at a precise `audioContext.currentTime`.
 *   - Consumers schedule their sounds AT those exact times.
 *
 * IMPORTANT: the setTimeout below only *wakes the scheduler*. It never times a
 * musical event itself — all musical timing is anchored to audioContext.currentTime.
 * This is exactly the pattern rule (b) mandates; do NOT time notes with
 * setInterval/setTimeout.
 *
 * Consumers:
 *   engine.addScheduler(fn) — fn(event) is called when a beat is scheduled, with
 *     the precise audio `time`. Use it to schedule sounds (e.g. a metronome click).
 *   engine.popDueVisualEvents(now) — drain beats whose time has now passed, for
 *     UI sync inside a requestAnimationFrame loop.
 *
 * Event shape:
 *   { time, beat, beatInBar, bar, subdivision, isBeat, isDownbeat }
 */

const MIN_BPM = 30;
const MAX_BPM = 300;

export class TimingEngine {
  /**
   * @param {AudioContext} audioContext
   * @param {{ lookahead?: number, tickInterval?: number }} [opts]
   */
  constructor(audioContext, { lookahead = 0.1, tickInterval = 25 } = {}) {
    this.ctx = audioContext;
    this.lookahead = lookahead; // seconds scheduled ahead of currentTime
    this.tickInterval = tickInterval; // ms between scheduler wake-ups

    this.bpm = 90;
    this.beatsPerBar = 4;
    this.subdivisionsPerBeat = 1;

    this.isRunning = false;
    this._timer = null;
    this._nextNoteTime = 0; // audio-clock time of the next subdivision
    this._currentTick = 0; // absolute subdivision counter since start
    this._schedulers = new Set();
    this._visualQueue = [];
  }

  // ---- configuration (safe to change while running) ---------------------

  setTempo(bpm) {
    this.bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
    return this.bpm;
  }

  setBeatsPerBar(n) {
    this.beatsPerBar = Math.max(1, Math.round(n));
    return this.beatsPerBar;
  }

  setSubdivisionsPerBeat(n) {
    this.subdivisionsPerBeat = Math.max(1, Math.round(n));
    return this.subdivisionsPerBeat;
  }

  /** Seconds between subdivisions at the current tempo. */
  get secondsPerSubdivision() {
    return 60 / this.bpm / this.subdivisionsPerBeat;
  }

  // ---- lifecycle --------------------------------------------------------

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._visualQueue = [];
    // Start slightly in the future so the first beat isn't clipped.
    this._prime(this.ctx.currentTime + 0.06);
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._visualQueue = [];
  }

  // ---- scheduling -------------------------------------------------------

  addScheduler(fn) {
    this._schedulers.add(fn);
    return () => this._schedulers.delete(fn);
  }

  /** Remove and return visual events whose time is at or before `now`. */
  popDueVisualEvents(now = this.ctx.currentTime) {
    const due = [];
    while (this._visualQueue.length && this._visualQueue[0].time <= now) {
      due.push(this._visualQueue.shift());
    }
    return due;
  }

  // ---- internals --------------------------------------------------------

  _prime(startTime) {
    this._nextNoteTime = startTime;
    this._currentTick = 0;
  }

  _loop() {
    this._pump();
    // Wake again soon. This timer only paces the scheduler; it does NOT time notes.
    this._timer = setTimeout(() => this._loop(), this.tickInterval);
  }

  /** Schedule every subdivision that falls within the lookahead window. */
  _pump() {
    while (this._nextNoteTime < this.ctx.currentTime + this.lookahead) {
      this._scheduleTick(this._currentTick, this._nextNoteTime);
      this._nextNoteTime += this.secondsPerSubdivision;
      this._currentTick += 1;
    }
  }

  _scheduleTick(tick, time) {
    const s = this.subdivisionsPerBeat;
    const beat = Math.floor(tick / s);
    const subdivision = tick % s;
    const beatInBar = beat % this.beatsPerBar;
    const bar = Math.floor(beat / this.beatsPerBar);
    const isBeat = subdivision === 0;
    const isDownbeat = isBeat && beatInBar === 0;

    const event = { time, beat, beatInBar, bar, subdivision, isBeat, isDownbeat };
    this._visualQueue.push(event);
    this._schedulers.forEach((fn) => fn(event));
  }
}
