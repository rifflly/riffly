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
  // ---- rewards (Part 2) ----
  badges: [], // earned badge ids
  activityTypes: [], // all-time set of practice-action types done (for badges)
  practiceDays: [], // YYYY-MM-DD list of days practised (for the weekly goal)
  missionDate: null, // YYYY-MM-DD the mission types below belong to
  missionTypes: [], // action types done TODAY (for today's mission)
};

let cache = { ...DEFAULTS };
const listeners = new Set();

// Normalise a raw saved object into a full, array-safe stats cache.
function hydrate(saved = {}) {
  const arr = (v) => (Array.isArray(v) ? [...v] : []);
  return {
    ...DEFAULTS,
    ...saved,
    trainerBests: { ...(saved.trainerBests || {}) },
    practisedSongs: arr(saved.practisedSongs),
    badges: arr(saved.badges),
    activityTypes: arr(saved.activityTypes),
    practiceDays: arr(saved.practiceDays),
    missionTypes: arr(saved.missionTypes),
  };
}

export async function loadStats() {
  cache = hydrate((await kvGet(KEY)) || {});
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

  // Today's mission rolls over at local midnight.
  if (cache.missionDate !== today) {
    cache.missionDate = today;
    cache.missionTypes = [];
  }
  // Track which days were practised (for the weekly goal); keep ~90 days.
  if (!cache.practiceDays.includes(today)) {
    cache.practiceDays = [...cache.practiceDays, today].slice(-90);
  }

  if (cache.lastPracticeDate === today) {
    await persist(); // day/mission bookkeeping may have changed
    return cache.streak;
  }
  if (cache.lastPracticeDate && dayDiff(cache.lastPracticeDate, today) === 1) {
    cache.streak += 1;
  } else {
    cache.streak = 1;
  }
  cache.lastPracticeDate = today;
  await persist();
  return cache.streak;
}

// ---- rewards: badges, activity types, mission (Part 2) -------------------

export function getBadges() {
  return cache.badges;
}
export function hasBadge(id) {
  return cache.badges.includes(id);
}
/** Add a badge if new. Returns true only the first time it's earned. */
export async function awardBadge(id) {
  if (cache.badges.includes(id)) return false;
  cache.badges = [...cache.badges, id];
  await persist();
  return true;
}

export function getActivityTypes() {
  return cache.activityTypes;
}
export async function addActivityType(type) {
  if (!type || cache.activityTypes.includes(type)) return;
  cache.activityTypes = [...cache.activityTypes, type];
  await persist();
}

export function getPracticeDays() {
  return cache.practiceDays;
}

/** Action types done today (empty if the stored mission day isn't today). */
export function getMissionTypes() {
  return cache.missionDate === localDateStr() ? cache.missionTypes : [];
}
export async function markMissionType(type) {
  const today = localDateStr();
  if (cache.missionDate !== today) {
    cache.missionDate = today;
    cache.missionTypes = [];
  }
  if (type && !cache.missionTypes.includes(type)) {
    cache.missionTypes = [...cache.missionTypes, type];
    await persist();
  }
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
  cache = hydrate(obj && typeof obj === 'object' ? obj : {});
  await persist();
  return cache;
}

export function onStatsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
