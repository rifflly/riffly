/**
 * Metronome controller — the first consumer of the shared timing engine.
 *
 * It adds a scheduler that plays a click on every beat (accented on the
 * downbeat), and runs a requestAnimationFrame loop that reports beats to the UI
 * for the pulsing dots — kept in sync via the engine's visual-event queue so the
 * visuals line up with what you hear.
 */
import { getAudioContext } from './audio-engine.js';
import { getTimingEngine } from './timing.js';
import { playClick } from './click.js';

export class Metronome {
  constructor() {
    this.engine = getTimingEngine();
    this.engine.setSubdivisionsPerBeat(1); // one click per beat
    this.running = false;
    this._removeScheduler = null;
    this._raf = null;
    this._onBeat = null;
  }

  get bpm() {
    return this.engine.bpm;
  }

  get beatsPerBar() {
    return this.engine.beatsPerBar;
  }

  setTempo(bpm) {
    return this.engine.setTempo(bpm);
  }

  setBeatsPerBar(n) {
    return this.engine.setBeatsPerBar(n);
  }

  /** @param {(event:object)=>void} onBeat - called (roughly) as each beat sounds */
  start(onBeat) {
    if (this.running) return;
    this.running = true;
    this._onBeat = onBeat;

    const ctx = getAudioContext();
    this._removeScheduler = this.engine.addScheduler((e) => {
      if (e.isBeat) playClick(ctx, e.time, { accent: e.isDownbeat });
    });
    this.engine.start();

    const tick = () => {
      if (!this.running) return;
      const due = this.engine.popDueVisualEvents(ctx.currentTime);
      if (due.length && this._onBeat) this._onBeat(due[due.length - 1]);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.engine.stop();
    if (this._removeScheduler) {
      this._removeScheduler();
      this._removeScheduler = null;
    }
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  toggle(onBeat) {
    if (this.running) this.stop();
    else this.start(onBeat);
    return this.running;
  }
}
