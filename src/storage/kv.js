/**
 * Minimal IndexedDB key/value store.
 *
 * Per architecture rule (a), ALL personal data lives in IndexedDB on-device —
 * this is the shared foundation for settings now and progress later (Phase 1).
 *
 * If IndexedDB is unavailable (e.g. private browsing), every call degrades to a
 * safe no-op so the app still runs (just without persistence).
 */

const DB_NAME = 'riffly';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = run(store);
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function kvGet(key) {
  try {
    return await tx('readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function kvSet(key, value) {
  try {
    await tx('readwrite', (s) => s.put(value, key));
    return true;
  } catch {
    return false;
  }
}

export async function kvDelete(key) {
  try {
    await tx('readwrite', (s) => s.delete(key));
    return true;
  } catch {
    return false;
  }
}

export async function kvKeys() {
  try {
    return (await tx('readonly', (s) => s.getAllKeys())) || [];
  } catch {
    return [];
  }
}
