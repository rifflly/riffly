/**
 * Lesson progress, persisted to IndexedDB (rule a). Loaded once at boot into a
 * synchronous cache. Kept separate from settings so Phase 2 backup/restore can
 * treat progress as its own thing.
 */
import { kvGet, kvSet } from './kv.js';

const KEY = 'progress';

let cache = { completedLessons: [] };
const listeners = new Set();

export async function loadProgress() {
  const saved = (await kvGet(KEY)) || {};
  cache = { completedLessons: Array.isArray(saved.completedLessons) ? saved.completedLessons : [] };
  return cache;
}

export function isLessonComplete(id) {
  return cache.completedLessons.includes(id);
}

export function completedCount() {
  return cache.completedLessons.length;
}

export async function setLessonComplete(id, done = true) {
  const set = new Set(cache.completedLessons);
  if (done) set.add(id);
  else set.delete(id);
  cache = { completedLessons: [...set] };
  await kvSet(KEY, cache);
  listeners.forEach((fn) => fn(cache));
  return cache;
}

export function onProgressChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
