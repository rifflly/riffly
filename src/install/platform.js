/**
 * Small platform detection helpers for install prompts (rule c).
 */

export function isIos() {
  const ua = navigator.userAgent;
  const iOSDevice = /iPhone|iPad|iPod/.test(ua);
  // iPadOS 13+ masquerades as desktop Safari; catch it via touch points.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function isIosSafari() {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  // On iOS every browser is WebKit, but only Safari offers Add to Home Screen.
  // Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS, Opera=OPiOS/OPT.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
}

/** True when already running as an installed / home-screen app. */
export function isStandalone() {
  return (
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
}
