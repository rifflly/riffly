/**
 * One-time iOS "Add to Home Screen" hint (rule c).
 * Shown only when running in iOS Safari, not already installed, and not yet
 * dismissed. Dismissal is remembered in settings so it never nags twice.
 */
import { createBanner } from '../ui/banner.js';
import { icon } from '../ui/icons.js';
import { isIosSafari, isStandalone } from './platform.js';
import { getSetting, setSetting } from '../storage/settings.js';

/** @returns {HTMLElement|null} the banner, or null if it shouldn't show. */
export function maybeCreateIosInstallBanner() {
  if (!isIosSafari() || isStandalone() || getSetting('iosInstallDismissed')) {
    return null;
  }
  return createBanner({
    tone: 'install',
    leading: icon('share', 20),
    message: "Add Riffly to your Home Screen: tap the Share button, then “Add to Home Screen”.",
    onDismiss: () => setSetting('iosInstallDismissed', true),
  });
}
