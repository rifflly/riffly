/**
 * Backup & restore (Phase 2 item 5). Everything Riffly stores lives on-device
 * (rule a); this bundles it into a single JSON file the user can download and
 * later restore — settings, lesson progress, streak + scores, and user song
 * sheets. (Uploaded audio, a Phase 3 feature, is deliberately not included.)
 */
import { APP_VERSION } from '../config.js';
import { getSettings, replaceSettings } from './settings.js';
import { getCompletedLessons, replaceProgress } from './progress.js';
import { getStats, replaceStats } from './stats.js';
import { getUserSongs, replaceAllSongs } from './songs.js';

const BACKUP_TYPE = 'riffly-backup';

/** Gather everything into a plain, serialisable backup object. */
export function buildBackup() {
  return {
    app: 'riffly',
    type: BACKUP_TYPE,
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: getSettings(),
      progress: { completedLessons: getCompletedLessons() },
      stats: getStats(),
      songs: getUserSongs(),
    },
  };
}

export function isValidBackup(obj) {
  return !!obj && obj.type === BACKUP_TYPE && obj.data && typeof obj.data === 'object';
}

/** A friendly summary for the "replace current data?" confirmation. */
export function summarizeBackup(obj) {
  const d = obj.data || {};
  return {
    songs: Array.isArray(d.songs) ? d.songs.length : 0,
    lessons: Array.isArray(d.progress && d.progress.completedLessons)
      ? d.progress.completedLessons.length
      : 0,
    streak: (d.stats && d.stats.streak) || 0,
    exportedAt: obj.exportedAt,
  };
}

/** Overwrite all local data with a validated backup. */
export async function applyBackup(obj) {
  const d = obj.data || {};
  if (d.settings) await replaceSettings(d.settings);
  await replaceProgress((d.progress && d.progress.completedLessons) || []);
  if (d.stats) await replaceStats(d.stats);

  const map = {};
  for (const song of Array.isArray(d.songs) ? d.songs : []) {
    if (song && song.id) map[song.id] = song;
  }
  await replaceAllSongs(map);
}

/** Trigger a download of the current data as riffly-backup-YYYY-MM-DD.json. */
export function downloadBackup() {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riffly-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
