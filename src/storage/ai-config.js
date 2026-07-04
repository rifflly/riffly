/**
 * AI tutor configuration (Phase 3 item 5). Bring-your-own-key: the provider and
 * API key live ONLY in IndexedDB on this device (rule a) and are sent only to
 * the chosen provider's own endpoint — Riffly has no server and no shared key.
 */
import { kvGet, kvSet, kvDelete } from './kv.js';

const KEY = 'aiConfig';

let cache = null; // { provider, apiKey, model }

export async function loadAiConfig() {
  cache = (await kvGet(KEY)) || null;
  return cache;
}

export function getAiConfig() {
  return cache;
}

export function hasAiKey() {
  return !!(cache && cache.apiKey);
}

export async function setAiConfig(cfg) {
  cache = { provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model || '' };
  await kvSet(KEY, cache);
  return cache;
}

export async function clearAiConfig() {
  cache = null;
  await kvDelete(KEY);
}
