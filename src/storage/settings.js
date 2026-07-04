/**
 * User settings, persisted to IndexedDB (rule a).
 *
 * Settings are loaded once at boot into an in-memory cache so the rest of the
 * app can read them synchronously; writes update the cache and persist async.
 */
import { kvGet, kvSet } from './kv.js';

const KEY = 'settings';

export const DEFAULT_SETTINGS = {
  leftHanded: false, // rule e — mirrors all chord diagrams when on
  iosInstallDismissed: false, // one-time iOS "Add to Home Screen" banner
  persistRequested: false, // whether navigator.storage.persist() was requested
  metronomeBpm: 90, // remembered metronome tempo
  metronomeBeats: 4, // remembered metronome beats-per-bar
  trainerBpm: 70, // remembered chord-change trainer tempo
  trainerPair: ['Em', 'Am'], // remembered chord-change trainer pair
  trainerAuto: false, // trainer auto-advance mode on/off
  trainerCeiling: 120, // trainer auto-advance tempo ceiling
  backingPattern: 'downstrums', // remembered backing-rhythm pattern
  backingChord: 'G', // remembered backing-rhythm chord
  backingBpm: 90, // remembered backing-rhythm tempo
  studioView: 'both', // Practice Studio view mode: play | sing | both
  studioBacking: 'app', // Practice Studio backing: app | silent
  studioTempoPct: 100, // Practice Studio tempo as % of the song's written tempo
};

let cache = { ...DEFAULT_SETTINGS };
const listeners = new Set();

export async function loadSettings() {
  const saved = (await kvGet(KEY)) || {};
  cache = { ...DEFAULT_SETTINGS, ...saved };
  return cache;
}

export function getSettings() {
  return cache;
}

export function getSetting(key) {
  return cache[key];
}

export async function setSetting(key, value) {
  cache = { ...cache, [key]: value };
  const snapshot = cache;
  await kvSet(KEY, snapshot);
  listeners.forEach((fn) => fn(snapshot));
  return snapshot;
}

/** Replace all settings (used by Restore in item 5). */
export async function replaceSettings(obj) {
  cache = { ...DEFAULT_SETTINGS, ...(obj && typeof obj === 'object' ? obj : {}) };
  const snapshot = cache;
  await kvSet(KEY, snapshot);
  listeners.forEach((fn) => fn(snapshot));
  return snapshot;
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
