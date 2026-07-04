/**
 * Global AudioContext + iOS unlock (rule c).
 *
 * iOS/Safari starts every AudioContext suspended and only lets it produce sound
 * after a user gesture. Riffly uses a SINGLE global "Tap to enable sound" unlock
 * per session: on the first tap we resume the context and play a silent buffer.
 * Every audio feature shares this one context.
 *
 * The context is created lazily inside unlockAudio() (within the user gesture)
 * to avoid autoplay-policy warnings from creating it at page load.
 */

let ctx = null;
let unlocked = false;
let autoResumeSet = false;
const listeners = new Set();

// iOS/Safari suspends the AudioContext when the screen locks or the app goes to
// the background. Once we've unlocked audio, resume it whenever the page becomes
// visible/focused again so playback recovers without another tap (rule c).
function setupAutoResume() {
  if (autoResumeSet) return;
  autoResumeSet = true;
  const resume = () => {
    if (unlocked && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resume();
  });
  window.addEventListener('focus', resume);
}

export function getAudioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  return ctx;
}

export function isAudioUnlocked() {
  return unlocked;
}

/**
 * Resume the AudioContext and mark audio as unlocked. Must be called from
 * within a user-gesture handler (tap/click/keydown). Safe to call repeatedly.
 * @returns {Promise<boolean>} whether audio is now unlocked
 */
export async function unlockAudio() {
  const context = getAudioContext();
  try {
    if (context.state === 'suspended') await context.resume();
  } catch {
    // resume() can reject if not in a gesture; the silent-buffer trick below
    // still nudges some iOS versions awake.
  }

  // iOS unlock trick: play a 1-sample silent buffer inside the gesture.
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    // Ignore — some browsers don't need it.
  }

  if (context.state === 'running' && !unlocked) {
    unlocked = true;
    setupAutoResume();
    listeners.forEach((fn) => fn());
  }
  return unlocked;
}

/** Subscribe to the one-time unlock event. Returns an unsubscribe function. */
export function onAudioUnlock(fn) {
  if (unlocked) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}
