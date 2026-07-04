/**
 * Practice stats: the daily streak, chord-change trainer best scores, and the
 * list of songs the user has practised. Persisted to IndexedDB (rule a) and
 * loaded once at boot into a synchronous cache — like settings/progress, and
 * kept separate so Phase 2 backup/restore can treat it as its own thing.
 */
import { kvGet, kvSet } from './kv.js';

const KEY = 'stats';

const DEFAULTS = {
  streak: 0, // consecutive days with at least one practice session
  lastPracticeDate: null, // YYYY-MM-DD (local) of the last counted session
  trainerBests: {}, // { [pairKey]: bestCleanBars }
  practisedSongs: [], // song ids marked practised in the studio
};

let cache = { ...DEFAULTS };
const listeners = new Set();

export async function loadStats() {
  const saved = (await kvGet(KEY)) || {};
  cache = {
    ...DEFAULTS,
    ...saved,
    trainerBests: { ...(saved.trainerBests || {}) },
    practisedSongs: Array.isArray(saved.practisedSongs) ? [...saved.practisedSongs] : [],
  };
  return cache;
}

export function getStats() {
  return cache;
}

async function persist() {
  await kvSet(KEY, cache);
  listeners.forEach((fn) => fn(cache));
}

// ---- daily streak --------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD (streaks follow the user's own day). */
function localDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from date-string `a` to `b` (b - a), using local midnights. */
function dayDiff(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = new Date(ay, am - 1, ad).getTime();
  const tb = new Date(by, bm - 1, bd).getTime();
  return Math.round((tb - ta) / 86400000);
}

export function getStreak() {
  return cache.streak;
}

/**
 * Record that the user practised today. Extends the streak if yesterday was the
 * last practice day, resets to 1 after a gap, and is a no-op if already counted
 * today. Returns the current streak.
 */
export async function recordPracticeSession() {
  const today = localDateStr();
  if (cache.lastPracticeDate === today) return cache.streak;

  if (cache.lastPracticeDate && dayDiff(cache.lastPracticeDate, today) === 1) {
    cache.streak += 1;
  } else {
    cache.streak = 1;
  }
  cache.lastPracticeDate = today;
  await persist();
  return cache.streak;
}

// ---- chord-change trainer best scores ------------------------------------

export function getTrainerBest(pairKey) {
  return cache.trainerBests[pairKey] || 0;
}

/** Store a challenge score, keeping only the best. Returns whether it's a new best. */
export async function recordTrainerScore(pairKey, cleanBars) {
  const best = getTrainerBest(pairKey);
  if (cleanBars <= best) return false;
  cache.trainerBests = { ...cache.trainerBests, [pairKey]: cleanBars };
  await persist();
  return true;
}

// ---- practised songs -----------------------------------------------------

export function isSongPractised(id) {
  return cache.practisedSongs.includes(id);
}

export async function markSongPractised(id) {
  if (cache.practisedSongs.includes(id)) {
    await recordPracticeSession();
    return;
  }
  cache.practisedSongs = [...cache.practisedSongs, id];
  await persist();
  await recordPracticeSession();
}

/** Replace all stats (used by Restore in item 5). */
export async function replaceStats(obj) {
  const src = obj && typeof obj === 'object' ? obj : {};
  cache = {
    ...DEFAULTS,
    ...src,
    trainerBests: { ...(src.trainerBests || {}) },
    practisedSongs: Array.isArray(src.practisedSongs) ? [...src.practisedSongs] : [],
  };
  await persist();
  return cache;
}

export function onStatsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
