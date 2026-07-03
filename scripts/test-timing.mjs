/**
 * Deterministic test for the shared timing engine.
 *
 * The engine only reads `audioContext.currentTime`, so we drive it with a fake
 * clock and pump the scheduler by hand — no browser or real audio needed.
 * Run with: node scripts/test-timing.mjs
 */
import { TimingEngine } from '../src/audio/timing-engine.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}
function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// --- Test 1: quarter notes at 120 BPM land on a clean 0.5s grid ------------
{
  const clock = { currentTime: 0 };
  const engine = new TimingEngine(clock, { lookahead: 0.1 });
  engine.setTempo(120); // 0.5s per beat
  engine.setBeatsPerBar(4);

  const events = [];
  engine.addScheduler((e) => events.push(e));

  // Prime at t=0, then step the fake clock in 0.1s slices for 2 seconds.
  engine._prime(0);
  for (let t = 0; t <= 2.0001; t += 0.1) {
    clock.currentTime = t;
    engine._pump();
  }

  const times = events.map((e) => e.time);
  assert(events.length === 5, `emits 5 beats over 2s at 120bpm (got ${events.length})`);
  assert(
    [0, 0.5, 1.0, 1.5, 2.0].every((exp, i) => approx(times[i], exp)),
    `beat times are 0,0.5,1.0,1.5,2.0 (got ${times.map((t) => t.toFixed(2)).join(',')})`
  );
  assert(
    events.map((e) => e.beatInBar).join(',') === '0,1,2,3,0',
    'beatInBar cycles 0,1,2,3,0'
  );
  assert(
    events[0].isDownbeat && events[4].isDownbeat && !events[1].isDownbeat,
    'downbeats fall on beat 0 of each bar'
  );
  assert(events[4].bar === 1, 'the 5th beat starts bar index 1');
}

// --- Test 2: subdivisions (8th notes) double the tick rate -----------------
{
  const clock = { currentTime: 0 };
  const engine = new TimingEngine(clock, { lookahead: 0.1 });
  engine.setTempo(60); // 1s per beat
  engine.setSubdivisionsPerBeat(2); // 0.5s per subdivision

  const events = [];
  engine.addScheduler((e) => events.push(e));
  engine._prime(0);
  for (let t = 0; t <= 2.0001; t += 0.1) {
    clock.currentTime = t;
    engine._pump();
  }

  assert(events.length === 5, `emits 5 eighth-notes over 2s at 60bpm (got ${events.length})`);
  assert(
    events.map((e) => e.subdivision).join(',') === '0,1,0,1,0',
    'subdivision alternates 0,1,0,1,0'
  );
  assert(
    events.filter((e) => e.isBeat).length === 3,
    'exactly 3 of them are on-beat (subdivision 0)'
  );
}

// --- Test 3: tempo clamping ------------------------------------------------
{
  const engine = new TimingEngine({ currentTime: 0 });
  assert(engine.setTempo(5) === 30, 'tempo clamps up to a 30bpm minimum');
  assert(engine.setTempo(9999) === 300, 'tempo clamps down to a 300bpm maximum');
}

console.log('');
if (failures) {
  console.error(`FAILED: ${failures} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('All timing-engine tests passed.');
}
