/**
 * Uploaded backing-track player (Phase 3 items 2 + 4).
 *
 * Plays a decoded AudioBuffer through the shared AudioContext (rule c) with an
 * optional A/B loop, and pitch-preserving slow-down (50–100%) via soundtouchjs.
 *
 * Two playback engines behind one interface:
 *   - AudioBufferSourceNode: full speed (best quality) and the honest fallback
 *     (playbackRate slow-down — lowers pitch) when time-stretch can't keep up.
 *   - soundtouchjs PitchShifter: pitch-preserving slow-down (a ScriptProcessor
 *     runs on the main thread; if its callback overruns we auto-fall-back).
 *
 * `position()` is always in TRACK SECONDS (source time). At slower speeds it
 * advances slower in real time — the studio scroll follows it, staying in sync.
 */
import { getAudioContext } from './audio-engine.js';
import { PitchShifter } from 'soundtouchjs';

const BUFFER_SIZE = 4096;

export class AudioTrack {
  constructor() {
    this.ctx = getAudioContext();
    this.buffer = null;
    this.playing = false;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.speed = 1;
    this.reduceVocals = false; // center-channel (L−R) vocal reduction for sing-along
    this._karaokeBuffer = null; // lazily built L−R buffer
    this.stretchFailed = false; // sticky: once the device can't keep up, stay on fallback
    this.onEnded = null;
    this.onFallback = null; // called when we drop to playbackRate slow-down

    this.startOffset = 0;
    this._mode = null; // 'source' | 'shifter'

    // source engine
    this._source = null;
    this._gain = null;
    this._startedAt = 0;
    this._rate = 1;

    // shifter engine
    this._shifter = null;
    this._shifterGain = null;
    this._shifterTime = 0;
    this._playListener = null;
    this._procTimes = [];
    this._cbCount = 0;
  }

  async decode(arrayBuffer) {
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.loopEnd = this.buffer.duration;
    return this.buffer;
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  /** Vocal reduction only works on true stereo (needs a left/right difference). */
  get canReduceVocals() {
    return !!(this.buffer && this.buffer.numberOfChannels >= 2);
  }

  /**
   * Toggle center-channel vocal reduction. Builds an L−R buffer once and swaps
   * which buffer plays; restarts the current engine in place if playing so loop
   * + slow-down carry over. Returns the effective state.
   */
  setReduceVocals(on) {
    const next = !!on && this.canReduceVocals;
    if (next === this.reduceVocals) return this.reduceVocals;
    this.reduceVocals = next;
    if (next && !this._karaokeBuffer) this._buildKaraokeBuffer();
    if (this.playing) {
      const pos = this.position();
      this._teardown();
      this._startAt(pos);
    }
    return this.reduceVocals;
  }

  _activeBuffer() {
    return this.reduceVocals && this._karaokeBuffer ? this._karaokeBuffer : this.buffer;
  }

  // Poor-man's karaoke: vocals are usually centre-panned, so (L−R) cancels a lot
  // of them. Crude (also dents centre bass/drums, silent on mono) but free and
  // instant. Same length/rate as the source, so position/loop are unaffected.
  _buildKaraokeBuffer() {
    const b = this.buffer;
    if (!b || b.numberOfChannels < 2) return;
    const L = b.getChannelData(0);
    const R = b.getChannelData(1);
    const n = b.length;
    const out = this.ctx.createBuffer(2, n, b.sampleRate);
    const o0 = out.getChannelData(0);
    const o1 = out.getChannelData(1);
    for (let i = 0; i < n; i++) {
      const d = (L[i] - R[i]) * 0.5;
      o0[i] = d;
      o1[i] = d;
    }
    this._karaokeBuffer = out;
  }

  setLoop(enabled, a = this.loopStart, b = this.loopEnd) {
    this.loop = enabled;
    this.loopStart = a;
    this.loopEnd = b;
    if (this._mode === 'source' && this._source) {
      this._source.loop = enabled;
      this._source.loopStart = a;
      this._source.loopEnd = b;
    }
  }

  /** 0.5–1.0. Restarts the right engine at the current position if playing. */
  setSpeed(s) {
    const next = Math.min(1, Math.max(0.5, s));
    if (Math.abs(next - this.speed) < 0.001) return;
    this.speed = next;
    if (this.playing) {
      const pos = this.position();
      this._teardown();
      this._startAt(pos);
    }
  }

  play(offset = null) {
    if (!this.buffer) return;
    let o = offset != null ? offset : this.startOffset;
    if (this.loop && (o < this.loopStart || o >= this.loopEnd)) o = this.loopStart;
    this._teardown();
    this.playing = true;
    this._startAt(o);
  }

  pause() {
    if (!this.playing) return;
    this.startOffset = this.position();
    this._teardown();
    this.playing = false;
  }

  stop() {
    this._teardown();
    this.playing = false;
    this.startOffset = this.loop ? this.loopStart : 0;
  }

  seek(offset) {
    const wasPlaying = this.playing;
    this.startOffset = offset;
    if (wasPlaying) this.play(offset);
  }

  position() {
    if (!this.buffer) return 0;
    if (!this.playing) return this.startOffset;
    if (this._mode === 'shifter') return this._shifterTime;
    let pos = this.startOffset + (this.ctx.currentTime - this._startedAt) * this._rate;
    if (this.loop && this.loopEnd > this.loopStart) {
      const span = this.loopEnd - this.loopStart;
      if (pos >= this.loopEnd) pos = this.loopStart + ((pos - this.loopStart) % span);
    } else if (pos > this.duration) {
      pos = this.duration;
    }
    return pos;
  }

  /** True while pitch-preserving slow-down is active (for honest labelling). */
  get isStretching() {
    return this._mode === 'shifter';
  }

  // ---- engine selection -------------------------------------------------
  _startAt(offset) {
    this.startOffset = offset;
    if (this.speed >= 0.999 || this.stretchFailed) this._startSource(offset);
    else this._startShifter(offset);
  }

  _startSource(offset) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._activeBuffer();
    // At full speed, rate 1. On fallback slow-down, rate = speed (pitch drops).
    this._rate = this.stretchFailed ? this.speed : 1;
    src.playbackRate.value = this._rate;
    src.loop = this.loop;
    if (this.loop) {
      src.loopStart = this.loopStart;
      src.loopEnd = this.loopEnd;
    }
    this._gain = this.ctx.createGain();
    this._gain.gain.value = 0.9;
    src.connect(this._gain).connect(this.ctx.destination);
    src.onended = () => {
      if (this.playing && this._mode === 'source' && !this.loop) {
        this.playing = false;
        this.startOffset = this.duration;
        if (this.onEnded) this.onEnded();
      }
    };
    src.start(0, offset);
    this._source = src;
    this._startedAt = this.ctx.currentTime;
    this._mode = 'source';
  }

  _startShifter(offset) {
    const shifter = new PitchShifter(this.ctx, this._activeBuffer(), BUFFER_SIZE);
    shifter.tempo = this.speed;
    shifter.percentagePlayed = (offset / this.duration) * 100;
    this._shifterTime = offset;

    this._shifterGain = this.ctx.createGain();
    this._shifterGain.gain.value = 0.9;
    shifter.connect(this._shifterGain);
    this._shifterGain.connect(this.ctx.destination);

    // Time the ScriptProcessor callback; if it overruns its real-time budget the
    // device can't keep up — fall back to plain playbackRate slow-down.
    const budgetMs = (BUFFER_SIZE / this.ctx.sampleRate) * 1000;
    const original = shifter.node.onaudioprocess;
    this._procTimes = [];
    this._cbCount = 0;
    shifter.node.onaudioprocess = (e) => {
      const t0 = performance.now();
      original(e);
      const dt = performance.now() - t0;
      this._procTimes.push(dt);
      if (this._procTimes.length > 8) this._procTimes.shift();
      this._cbCount += 1;
      if (this._cbCount > 6 && !this.stretchFailed) {
        const over = this._procTimes.filter((x) => x > budgetMs * 0.8).length;
        if (over >= 4) this._fallback();
      }
    };

    this._playListener = (e) => {
      this._shifterTime = e.detail.timePlayed;
      if (this.loop && this.loopEnd > this.loopStart && this._shifterTime >= this.loopEnd) {
        shifter.percentagePlayed = (this.loopStart / this.duration) * 100;
        this._shifterTime = this.loopStart;
      } else if (!this.loop && this._shifterTime >= this.duration - 0.03) {
        this.playing = false;
        this.startOffset = this.duration;
        this._teardown();
        if (this.onEnded) this.onEnded();
      }
    };
    shifter.node.addEventListener('play', this._playListener);
    this._shifter = shifter;
    this._mode = 'shifter';
  }

  _fallback() {
    // Called from inside onaudioprocess — defer the swap to avoid re-entrancy.
    if (this.stretchFailed) return;
    this.stretchFailed = true;
    setTimeout(() => {
      if (!this.playing) return;
      const pos = this.position();
      this._teardown();
      this._startAt(pos);
      if (this.onFallback) this.onFallback();
    }, 0);
  }

  _teardown() {
    if (this._source) {
      try {
        this._source.onended = null;
        this._source.stop();
      } catch {
        /* not started */
      }
      try {
        this._source.disconnect();
      } catch {
        /* gone */
      }
      this._source = null;
    }
    if (this._gain) {
      try {
        this._gain.disconnect();
      } catch {
        /* gone */
      }
      this._gain = null;
    }
    if (this._shifter) {
      try {
        if (this._playListener) this._shifter.node.removeEventListener('play', this._playListener);
        this._shifter.node.onaudioprocess = null;
        this._shifter.disconnect();
      } catch {
        /* gone */
      }
      this._shifter = null;
      this._playListener = null;
    }
    if (this._shifterGain) {
      try {
        this._shifterGain.disconnect();
      } catch {
        /* gone */
      }
      this._shifterGain = null;
    }
    this._mode = null;
  }
}
