/**
 * Rewards layer (Part 2) — streaks, daily mission, weekly goal, and badges.
 *
 * Pure logic over the existing stores (stats + progress). No new storage: state
 * lives in stats.js (IndexedDB, on-device only, already in backup/restore).
 * `recordActivity(type)` is THE entry point every counted practice action calls;
 * it updates the streak, today's mission, and evaluates badges, returning any
 * newly earned ones so the UI can celebrate.
 */
import {
  getStreak,
  getStats,
  recordPracticeSession,
  awardBadge,
  hasBadge,
  getBadges,
  addActivityType,
  getActivityTypes,
  markMissionType,
  getMissionTypes,
  getPracticeDays,
} from './stats.js';
import { completedCount } from './progress.js';

// Badge definitions — edit here to add/tweak badges. `test(ctx)` decides earning.
export const BADGES = [
  { id: 'first-win', emoji: '🌟', label: 'First Win', desc: 'Finished your first lesson', test: (c) => c.completed >= 1 },
  { id: 'smooth-switch', emoji: '🔀', label: 'Smooth Switch', desc: 'Practised a chord switch', test: (c) => c.activity.has('chordswitch') },
  { id: 'song-starter', emoji: '🎵', label: 'Song Starter', desc: 'Played along to a song', test: (c) => c.practised >= 1 },
  { id: 'rhythm-rookie', emoji: '🥁', label: 'Rhythm Rookie', desc: 'Kept time with a rhythm tool', test: (c) => c.activity.has('rhythm') },
  { id: 'streak-3', emoji: '🔥', label: '3-Day Streak', desc: 'Practised 3 days in a row', test: (c) => c.streak >= 3 },
  { id: 'chord-climber', emoji: '🧗', label: 'Chord Climber', desc: 'Finished 5 lessons', test: (c) => c.completed >= 5 },
];

// Daily missions rotate deterministically by date. `types` = which activity
// types complete the mission that day.
export const MISSIONS = [
  { id: 'play2', text: 'Play for 2 minutes', hint: 'Any practice counts', types: ['rhythm', 'chordswitch', 'song', 'lesson'] },
  { id: 'lesson', text: 'Finish one lesson', hint: 'Learn tab', types: ['lesson'] },
  { id: 'switch', text: 'Practise a chord switch', hint: 'Play → Changes', types: ['chordswitch'] },
];

export const WEEK_GOAL = 4; // days per week

function ctx() {
  return {
    completed: completedCount(),
    streak: getStreak(),
    practised: getStats().practisedSongs.length,
    activity: new Set(getActivityTypes()),
  };
}

async function evaluateBadges() {
  const c = ctx();
  const earned = [];
  for (const b of BADGES) {
    if (!hasBadge(b.id) && b.test(c)) {
      if (await awardBadge(b.id)) earned.push(b);
    }
  }
  return earned;
}

/**
 * Record one counted practice action.
 * @param {'lesson'|'chordswitch'|'song'|'rhythm'} type
 * @returns {Promise<{ newBadges: object[], streak: number, missionDone: boolean }>}
 */
export async function recordActivity(type) {
  await recordPracticeSession(); // streak + practice day + mission rollover
  if (type) {
    await addActivityType(type);
    await markMissionType(type);
  }
  const newBadges = await evaluateBadges();
  return { newBadges, streak: getStreak(), missionDone: isTodayMissionDone() };
}

// ---- mission + weekly goal ----------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}
function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getTodayMission() {
  const dayIndex = Math.floor(new Date().getTime() / 86400000);
  return MISSIONS[dayIndex % MISSIONS.length];
}

export function isTodayMissionDone() {
  const done = new Set(getMissionTypes());
  return getTodayMission().types.some((t) => done.has(t));
}

export function getWeekProgress() {
  const now = new Date();
  const monOffset = (now.getDay() + 6) % 7; // Monday = 0
  const start = dateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - monOffset));
  const days = getPracticeDays().filter((d) => d >= start);
  return { done: new Set(days).size, goal: WEEK_GOAL };
}

/** All badges with an `earned` flag, for the badges strip. */
export function getBadgeState() {
  const earned = new Set(getBadges());
  return BADGES.map((b) => ({ ...b, earned: earned.has(b.id) }));
}
