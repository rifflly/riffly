/**
 * Uploaded backing-track player (Phase 3 item 2).
 *
 * Plays a decoded AudioBuffer through the shared AudioContext (rule c) with an
 * optional seamless A/B loop (AudioBufferSourceNode.loopStart/loopEnd). Exposes
 * `position()` in TRACK SECONDS — the Practice Studio scrolls from this, not the
 * bar clock, when My Audio backs a song (the item-2 sync rule).
 */
import { getAudioContext } from './audio-engine.js';

export class AudioTrack {
  constructor() {
    this.ctx = getAudioContext();
    this.buffer = null;
    this.source = null;
    this.gain = null;
    this.playing = false;
    this.startedAt = 0; // ctx time when the current source started
    this.startOffset = 0; // track seconds the current source started from
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.onEnded = null;
  }

  async decode(arrayBuffer) {
    // decodeAudioData detaches its input, so hand it a copy (callers may reuse).
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.loopEnd = this.buffer.duration;
    return this.buffer;
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  setLoop(enabled, a = this.loopStart, b = this.loopEnd) {
    this.loop = enabled;
    this.loopStart = a;
    this.loopEnd = b;
    if (this.source) {
      this.source.loop = enabled;
      this.source.loopStart = a;
      this.source.loopEnd = b;
    }
  }

  play(offset = null) {
    if (!this.buffer) return;
    this._stopSource();
    let o = offset != null ? offset : this.startOffset;
    if (this.loop && (o < this.loopStart || o >= this.loopEnd)) o = this.loopStart;

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.loop;
    if (this.loop) {
      src.loopStart = this.loopStart;
      src.loopEnd = this.loopEnd;
    }
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.9;
    src.connect(this.gain).connect(this.ctx.destination);
    src.onended = () => {
      if (this.playing && !this.loop) {
        this.playing = false;
        this.startOffset = this.duration;
        if (this.onEnded) this.onEnded();
      }
    };
    src.start(0, o);
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.startOffset = o;
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this.startOffset = this.position();
    this._stopSource();
    this.playing = false;
  }

  stop() {
    this._stopSource();
    this.playing = false;
    this.startOffset = this.loop ? this.loopStart : 0;
  }

  seek(offset) {
    const wasPlaying = this.playing;
    this.startOffset = offset;
    if (wasPlaying) this.play(offset);
  }

  /** Current play-head position in track seconds (handles loop wrap). */
  position() {
    if (!this.buffer) return 0;
    if (!this.playing) return this.startOffset;
    let pos = this.startOffset + (this.ctx.currentTime - this.startedAt);
    if (this.loop && this.loopEnd > this.loopStart) {
      const span = this.loopEnd - this.loopStart;
      if (pos >= this.loopEnd) pos = this.loopStart + ((pos - this.loopStart) % span);
    } else if (pos > this.duration) {
      pos = this.duration;
    }
    return pos;
  }

  _stopSource() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* not started */
      }
      try {
        this.source.disconnect();
      } catch {
        /* already gone */
      }
      this.source = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch {
        /* already gone */
      }
      this.gain = null;
    }
  }
}
