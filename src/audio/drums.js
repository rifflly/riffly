/**
 * Tiny synthesised drum kit for the backing-rhythm generator (Phase 2 item 2).
 *
 *   kick  = a low sine thump with a fast pitch drop
 *   snare = a filtered noise burst
 *   hat   = a very short high-passed noise tick
 *
 * Each voice is stamped at a precise audioContext time from the shared timing
 * engine (rule b), the same lightweight approach as click.js.
 */

let noiseBuffer = null;

/** A half-second of white noise, reused by snare and hat. */
function noise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function playKick(ctx, time, { gain = 0.8, destination } = {}) {
  const dest = destination || ctx.destination;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.2);
}

export function playSnare(ctx, time, { gain = 0.5, destination } = {}) {
  const dest = destination || ctx.destination;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  src.connect(hp).connect(bp).connect(g).connect(dest);
  src.start(time);
  src.stop(time + 0.2);
}

export function playHat(ctx, time, { gain = 0.28, destination, open = false } = {}) {
  const dest = destination || ctx.destination;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  const dur = open ? 0.12 : 0.04;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(hp).connect(g).connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
}
