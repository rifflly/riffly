import './styles/main.css';
import { boot } from './app.js';
import { APP_VERSION } from './config.js';

/**
 * Riffly entry point: register the service worker, then boot the app.
 * Feature work continues per the phase plan in CLAUDE.md.
 */

// Register the service worker. Real caching + the "New version ready" update
// banner arrive later in Phase 1; for now this establishes the registration.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[Riffly] Service worker registration failed:', err);
    });
  });
}

boot().catch((err) => {
  console.error('[Riffly] Boot failed:', err);
});

console.info(`[Riffly] v${APP_VERSION} — Learn. Play. Riff.`);
