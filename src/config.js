/**
 * App-wide constants.
 */

export const APP_NAME = 'Riffly';
export const APP_TAGLINE = 'Learn. Play. Riff.';

// Version is injected at build time from package.json (see vite.config.js).
export const APP_VERSION = __APP_VERSION__;

// The bottom navigation / screens. `path` is the hash route (#/learn, …).
export const ROUTES = [
  { path: 'learn', label: 'Learn', icon: 'learn' },
  { path: 'chords', label: 'Chords', icon: 'chords' },
  { path: 'practice', label: 'Play', icon: 'practice' },
  { path: 'songs', label: 'Songs', icon: 'songs' },
  { path: 'tutor', label: 'Ask', icon: 'ask' },
  { path: 'settings', label: 'Settings', icon: 'settings' },
];

// Top-level screens that are NOT in the bottom tab bar — reached via in-app
// links (e.g. the tuner, opened from Home and from a lesson).
export const EXTRA_ROUTES = [{ path: 'tuner', label: 'Tuner' }];

export const ALL_ROUTES = [...ROUTES, ...EXTRA_ROUTES];

export const DEFAULT_ROUTE = 'learn';
