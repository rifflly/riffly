/**
 * The single global "Tap to enable sound" prompt (rule c).
 * Shows until audio is unlocked, then removes itself. Also opportunistically
 * unlocks on the first tap anywhere so most users never need to tap it twice.
 */
import { createBanner } from './banner.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';

/** @returns {HTMLElement|null} */
export function createAudioBanner() {
  if (isAudioUnlocked()) return null;

  const banner = createBanner({
    tone: 'sound',
    leading: '🔊',
    message: 'Tap to enable sound',
    action: { label: 'Enable', onClick: () => unlockAudio() },
  });

  // Remove the banner as soon as audio unlocks (by button or by first tap).
  const off = onAudioUnlock(() => {
    banner.remove();
    off();
    window.removeEventListener('pointerdown', tryUnlock, true);
  });

  // First-gesture convenience unlock.
  function tryUnlock() {
    unlockAudio();
  }
  window.addEventListener('pointerdown', tryUnlock, { capture: true, once: false });

  return banner;
}
