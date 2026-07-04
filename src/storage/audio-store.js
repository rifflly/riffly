/**
 * On-device storage for uploaded backing tracks (Phase 3 item 2).
 *
 * Each song may have one attached audio file. The raw bytes live in IndexedDB
 * under `audio:<songId>` (rule a — all data on-device); a small metadata map
 * (name/size/type) is cached in memory for the storage meter and manage list.
 * Uploaded audio is intentionally excluded from backup/restore (it can be large).
 */
import { kvGet, kvSet, kvDelete } from './kv.js';

const META_KEY = 'audioMeta';
const dataKey = (songId) => `audio:${songId}`;

export const SOFT_LIMIT_BYTES = 200 * 1024 * 1024; // ~200 MB — warn kindly above this

let meta = {}; // { [songId]: { name, size, type, addedAt } }
const listeners = new Set();

export async function loadAudioMeta() {
  const m = await kvGet(META_KEY);
  meta = m && typeof m === 'object' ? { ...m } : {};
  return meta;
}

export function getAudioMeta(songId) {
  return meta[songId] || null;
}

export function allAudioMeta() {
  return meta;
}

export function hasAudio(songId) {
  return !!meta[songId];
}

export function totalAudioBytes() {
  return Object.values(meta).reduce((sum, m) => sum + (m.size || 0), 0);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Store an uploaded File against a song. Returns the new metadata entry. */
export async function saveAudioFile(songId, file) {
  const buf = await file.arrayBuffer();
  await kvSet(dataKey(songId), buf);
  meta = {
    ...meta,
    [songId]: {
      name: file.name || 'backing track',
      size: buf.byteLength,
      type: file.type || '',
      addedAt: new Date().toISOString(),
    },
  };
  await kvSet(META_KEY, meta);
  notify();
  return meta[songId];
}

/** The raw ArrayBuffer for a song's audio, or null. */
export async function getAudioData(songId) {
  return (await kvGet(dataKey(songId))) || null;
}

export async function deleteAudio(songId) {
  await kvDelete(dataKey(songId));
  const next = { ...meta };
  delete next[songId];
  meta = next;
  await kvSet(META_KEY, meta);
  notify();
}

export function onAudioChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Human-friendly size, e.g. "4.2 MB". */
export function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.round(bytes / 1024)} KB`;
  if (mb < 10) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb)} MB`;
}
