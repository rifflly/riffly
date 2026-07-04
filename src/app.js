/**
 * App bootstrap. Loads settings, applies global state, mounts the shell, and
 * kicks off first-run housekeeping (persistent storage).
 */
import { loadSettings, getSetting } from './storage/settings.js';
import { loadProgress } from './storage/progress.js';
import { loadStats } from './storage/stats.js';
import { loadSongs } from './storage/songs.js';
import { loadAudioMeta } from './storage/audio-store.js';
import { loadAiConfig } from './storage/ai-config.js';
import { requestPersistentStorage } from './storage/persist.js';
import { applyLeftHanded } from './app-state.js';
import { mountShell } from './ui/shell.js';

export async function boot() {
  await Promise.all([loadSettings(), loadProgress(), loadStats(), loadSongs(), loadAudioMeta(), loadAiConfig()]);
  applyLeftHanded(getSetting('leftHanded'));

  mountShell(document.getElementById('app'));

  // First-run: ask the browser to keep our on-device data (rule c).
  requestPersistentStorage();
}
