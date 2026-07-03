/**
 * Riffly service worker — PLACEHOLDER.
 *
 * Real caching logic (cache-first app shell + data, and the
 * "New version ready — tap to refresh" update flow) is implemented in Phase 1.
 * For now this file only registers cleanly and does nothing else, so the app
 * still works fully online during early development.
 *
 * See CLAUDE.md → "Architecture rules" (d) for the intended behaviour.
 */

const CACHE_VERSION = 'riffly-v0';

self.addEventListener('install', () => {
  // Do not skipWaiting yet — the update banner in Phase 1 will drive activation.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler yet: requests fall through to the network as normal.
