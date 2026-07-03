import './styles/main.css';

/**
 * Riffly app entry point.
 *
 * This is intentionally minimal — Phase 1 adds the shell, timing engine,
 * metronome, chord library, lessons and progress. See CLAUDE.md for the plan.
 */

// Injected at build time by Vite from package.json (see vite.config.js).
export const APP_VERSION = __APP_VERSION__;

// Register the service worker. Real caching + the "New version ready" update
// banner arrive in Phase 1; for now this just establishes the registration.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[Riffly] Service worker registration failed:', err);
    });
  });
}

console.info(`[Riffly] v${APP_VERSION} — Learn. Play. Riff.`);
