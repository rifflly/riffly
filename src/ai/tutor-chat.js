/**
 * In-memory tutor chat state (Phase 3 item 5).
 *
 * The conversation lives for the session so navigating away and back keeps it,
 * plus a one-shot "pending context" the lesson Ask button uses to pre-fill the
 * input (e.g. "I'm on the lesson about the G chord").
 */

let history = []; // { role: 'user'|'assistant', content }
let pendingContext = '';

export function getHistory() {
  return history;
}
export function addMessage(msg) {
  history.push(msg);
  return msg;
}
export function clearHistory() {
  history = [];
}

export function setPendingContext(text) {
  pendingContext = text || '';
}
export function takePendingContext() {
  const t = pendingContext;
  pendingContext = '';
  return t;
}
