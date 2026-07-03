/**
 * Service worker registration + the "New version ready — tap to refresh" update
 * flow (rule d).
 *
 * Only runs in production builds (the dev server has no service worker, which
 * also avoids caching getting in the way of hot reloads).
 */
import { createBanner } from './ui/banner.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    // Reload once the new worker takes control, so the fresh assets load.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    try {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      const reg = await navigator.serviceWorker.register(swUrl);

      // An update may already be waiting from a previous visit.
      if (reg.waiting && navigator.serviceWorker.controller) {
        promptUpdate(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          // "installed" + an existing controller == a genuine update (not first install).
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(incoming);
          }
        });
      });
    } catch (err) {
      console.warn('[Riffly] Service worker registration failed:', err);
    }
  });
}

let bannerShown = false;
function promptUpdate(worker) {
  if (bannerShown) return;
  bannerShown = true;

  const banner = createBanner({
    tone: 'update',
    message: 'New version ready',
    action: {
      label: 'Refresh',
      onClick: () => worker.postMessage('SKIP_WAITING'),
    },
  });

  const host = document.querySelector('.banner-host') || document.body;
  host.append(banner);
}
