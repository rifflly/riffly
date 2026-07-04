/**
 * The combined song library: read-only starter songs shipped in /data (rule f)
 * plus the user's own songs from IndexedDB. Screens read songs from here.
 */
import happyBirthday from '../../data/songs/happy-birthday.json';
import amazingGrace from '../../data/songs/amazing-grace.json';
import clementine from '../../data/songs/clementine.json';
import { normalizeSong } from './song-model.js';
import { getUserSongs, getUserSong } from '../storage/songs.js';

const STARTERS = [happyBirthday, amazingGrace, clementine].map((s) =>
  normalizeSong({ ...s, source: 'starter' })
);

export function starterSongs() {
  return STARTERS;
}

export function allSongs() {
  return [...STARTERS, ...getUserSongs()];
}

export function getSong(id) {
  return STARTERS.find((s) => s.id === id) || getUserSong(id) || null;
}

export function isStarter(id) {
  return STARTERS.some((s) => s.id === id);
}
