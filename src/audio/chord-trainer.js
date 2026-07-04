/**
 * ChordTrainer controller — a thin consumer of the shared timing engine (rule b),
 * shared by the Practice-tab trainer and the embedded lesson trainer.
 *
 * Plays a click on every beat (accented downbeat) and reports beats/bars to the
 * UI via the engine's visual-event queue, so the highlight flips exactly on the
 * bar line in time with what you hear.
 */
import { getAudioContext } from './audio-engine.js';
import { getTimingEngine } from './timing.js';
import { playClick } from './click.js';

export class ChordTrainer {
  constructor() {
    this.engine = getTimingEngine();
    this.running = false;
    this._removeScheduler = null;
    this._raf = null;
    this.onBeat = null;
    this.onBar = null;
  }

  get bpm() {
    return this.engine.bpm;
  }

  setTempo(bpm) {
    return this.engine.setTempo(bpm);
  }

  start({ onBeat, onBar } = {}) {
    if (this.running) return;
    this.running = true;
    this.onBeat = onBeat;
    this.onBar = onBar;
    this.engine.setSubdivisionsPerBeat(1);
    this.engine.setBeatsPerBar(4);

    const ctx = getAudioContext();
    this._removeScheduler = this.engine.addScheduler((e) => {
      if (e.isBeat) playClick(ctx, e.time, { accent: e.isDownbeat });
    });
    this.engine.start();

    const tick = () => {
      if (!this.running) return;
      const due = this.engine.popDueVisualEvents(ctx.currentTime);
      for (const e of due) {
        if (this.onBeat) this.onBeat(e);
        if (e.isDownbeat && this.onBar) this.onBar(e.bar, e);
      }
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
}
