/**
 * Metronome click synth. Generates a short percussive tick with the Web Audio
 * API, scheduled at a precise audio-clock time (from the timing engine).
 *
 * The accented click (downbeat) is higher and a touch louder so beginners can
 * feel where each bar begins.
 */

/**
 * Schedule a single click.
 * @param {AudioContext} ctx
 * @param {number} time - audioContext time to sound the click
 * @param {{ accent?: boolean }} [opts]
 */
export function playClick(ctx, time, { accent = false } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1600 : 1000, time);

  const peak = accent ? 0.5 : 0.32;
  // Fast attack, quick exponential decay = a clean "tick".
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}
