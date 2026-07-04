/**
 * App shell: header, screen area, banner host, and bottom tab bar.
 * Builds the static chrome once and swaps screen content on route change.
 */
import { el, clear } from './dom.js';
import { APP_NAME, ROUTES, DEFAULT_ROUTE } from '../config.js';
import { createRouter } from '../router.js';
import { renderTabBar } from './tab-bar.js';
import { createAudioBanner } from './audio-banner.js';
import { maybeCreateIosInstallBanner } from '../install/ios-install.js';

import * as learn from '../screens/learn.js';
import * as chords from '../screens/chords.js';
import * as practice from '../screens/practice.js';
import * as songs from '../screens/songs.js';
import * as settings from '../screens/settings.js';

const SCREENS = { learn, chords, practice, songs, settings };

export function mountShell(root) {
  clear(root);

  const title = el('span', { class: 'screen-title', id: 'screen-title' });
  const header = el(
    'header',
    { class: 'app-header' },
    el('span', { class: 'brand' }, APP_NAME),
    title
  );

  const main = el('main', { class: 'screen', id: 'screen', tabindex: '-1' });
  const bannerHost = el('div', { class: 'banner-host' });
  const tabBar = el('nav', { class: 'tab-bar', id: 'tab-bar' });

  root.append(header, main, bannerHost, tabBar);

  // Banners (each returns null when it shouldn't show).
  const audioBanner = createAudioBanner();
  if (audioBanner) bannerHost.append(audioBanner);
  const iosBanner = maybeCreateIosInstallBanner();
  if (iosBanner) bannerHost.append(iosBanner);

  let currentScreen = null;
  const router = createRouter(ROUTES, DEFAULT_ROUTE, (route) => {
    // Let the outgoing screen clean up (e.g. stop the metronome).
    if (currentScreen && typeof currentScreen._dispose === 'function') currentScreen._dispose();
    clear(main);
    currentScreen = SCREENS[route.path].render();
    main.append(currentScreen);
    title.textContent = route.label;
    renderTabBar(tabBar, route.path, (path) => router.go(path));
    main.scrollTop = 0;
  });

  router.start();
}
