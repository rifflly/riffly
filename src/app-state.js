/**
 * Small global-state helpers that affect the whole app.
 */

/** Toggle the document-level left-handed class (rule e). */
export function applyLeftHanded(enabled) {
  document.documentElement.classList.toggle('left-handed', !!enabled);
}
