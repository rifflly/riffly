/**
 * Tutor chat memory (Phase 3 item 5 — token-lean rewrite).
 *
 * The full transcript is kept for the UI, but the model only ever receives:
 *     system prompt  +  a short rolling SUMMARY of older turns  +  the last few
 *     turns in full.
 * That keeps each request roughly constant in size no matter how long the chat
 * grows — the main lever for cutting quota use. Everything is persisted locally
 * (localStorage) so the chat + summary survive a reload; on-device only, no
 * server (rule a spirit).
 */

const LS_KEY = 'riffly.tutorChat.v1';
const KEEP_MESSAGES = 6; // recent messages sent verbatim (~3 exchanges)
const SUMMARY_MAX = 600; // characters — keeps the summary itself small

let history = []; // full transcript: { role:'user'|'assistant', content }
let summary = ''; // compressed gist of messages older than the recent window
let summarizedUpTo = 0; // count of leading messages already folded into `summary`
let pendingContext = ''; // one-shot pre-fill from a lesson's Ask button

load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    history = Array.isArray(s.history) ? s.history : [];
    summary = typeof s.summary === 'string' ? s.summary : '';
    summarizedUpTo = Number.isInteger(s.summarizedUpTo) ? s.summarizedUpTo : 0;
  } catch {
    /* corrupt or storage unavailable — start fresh */
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ history, summary, summarizedUpTo }));
  } catch {
    /* storage full/blocked — the session still works in memory */
  }
}

export function getHistory() {
  return history;
}

export function addMessage(msg) {
  history.push(msg);
  persist();
  return msg;
}

export function clearHistory() {
  history = [];
  summary = '';
  summarizedUpTo = 0;
  persist();
}

/**
 * What the model actually receives: the rolling summary of old turns plus the
 * recent turns in full. `recent` always includes the latest user question, and
 * `summarizedUpTo` guarantees no message falls between summary and recent.
 * @returns {{ summary:string, recent:Array<{role,content}> }}
 */
export function getRequestContext() {
  return { summary, recent: history.slice(summarizedUpTo) };
}

/**
 * Fold everything older than the recent window into the rolling summary.
 * Call after each successful assistant reply. Heuristic, local, no extra API
 * call: it records the topics the student asked about, trimmed to a cap.
 */
export function foldSummary() {
  const cutoff = history.length - KEEP_MESSAGES;
  if (cutoff <= summarizedUpTo) return;

  const topics = [];
  for (let i = summarizedUpTo; i < cutoff; i++) {
    if (history[i].role === 'user') topics.push(condense(history[i].content));
  }
  summarizedUpTo = cutoff;
  if (topics.length) {
    const lead = summary ? `${summary}; ` : 'Student has asked about: ';
    summary = clamp(lead + topics.join('; '));
  }
  persist();
}

function condense(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > 70 ? `${t.slice(0, 67)}…` : t;
}

function clamp(s) {
  return s.length <= SUMMARY_MAX ? s : `…${s.slice(s.length - SUMMARY_MAX + 1)}`;
}

// ---- lesson Ask button pre-fill (unchanged behaviour) -------------------
export function setPendingContext(text) {
  pendingContext = text || '';
}
export function takePendingContext() {
  const t = pendingContext;
  pendingContext = '';
  return t;
}
