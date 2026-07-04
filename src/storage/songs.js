/**
 * User song sheets, persisted to IndexedDB (rule a). All user songs live under
 * one kv key as an id→song map, loaded once at boot into a synchronous cache —
 * like settings/progress/stats. Starter songs come from /data and are read-only;
 * this store only holds songs the user creates or imports.
 */
import { kvGet, kvSet } from './kv.js';
import { normalizeSong } from '../songs/song-model.js';

const KEY = 'userSongs';

let cache = {}; // id → song
const listeners = new Set();

export async function loadSongs() {
  const saved = await kvGet(KEY);
  cache = saved && typeof saved === 'object' ? { ...saved } : {};
  return cache;
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** User songs, newest first. */
export function getUserSongs() {
  return Object.values(cache).sort((a, b) =>
    String(b.modifiedAt || '').localeCompare(String(a.modifiedAt || ''))
  );
}

export function getUserSong(id) {
  return cache[id];
}

/** Insert or update a song. Assigns an id + timestamps; returns the saved song. */
export async function saveSong(song) {
  const now = new Date().toISOString();
  const normalized = normalizeSong({ ...song, source: 'user' });
  const saved = {
    ...normalized,
    createdAt: song.createdAt || now,
    modifiedAt: now,
  };
  cache = { ...cache, [saved.id]: saved };
  await kvSet(KEY, cache);
  notify();
  return saved;
}

export async function deleteSong(id) {
  const next = { ...cache };
  delete next[id];
  cache = next;
  await kvSet(KEY, cache);
  notify();
}

/** Replace the whole store (used by Restore in item 5). */
export async function replaceAllSongs(map) {
  cache = map && typeof map === 'object' ? { ...map } : {};
  await kvSet(KEY, cache);
  notify();
}

export function onSongsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
