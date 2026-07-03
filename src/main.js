import './styles/main.css';
import { boot } from './app.js';
import { registerServiceWorker } from './pwa.js';
import { APP_VERSION } from './config.js';

/**
 * Riffly entry point: boot the app, then register the service worker (which
 * enables offline use and the "New version ready" update banner — rule d).
 */

boot().catch((err) => {
  console.error('[Riffly] Boot failed:', err);
});

registerServiceWorker();

console.info(`[Riffly] v${APP_VERSION} — Learn. Play. Riff.`);
