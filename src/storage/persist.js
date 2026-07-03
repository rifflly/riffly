/**
 * Requests persistent storage on first run (rule c) so the browser is less
 * likely to evict Riffly's IndexedDB data under storage pressure.
 */
import { getSetting, setSetting } from './settings.js';

export async function requestPersistentStorage() {
  if (getSetting('persistRequested')) return;
  try {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      console.info(`[Riffly] Persistent storage ${granted ? 'granted' : 'not granted'}.`);
    }
  } catch {
    // Ignore — persistence is a best-effort nicety.
  }
  await setSetting('persistRequested', true);
}
