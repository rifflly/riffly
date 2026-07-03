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
  { path: 'practice', label: 'Practice', icon: 'practice' },
  { path: 'settings', label: 'Settings', icon: 'settings' },
];

export const DEFAULT_ROUTE = 'learn';
