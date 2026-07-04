/**
 * AI tutor client (Phase 3 item 5). Talks directly from the browser to the
 * user's chosen provider (Google Gemini or Groq) using their own key — no
 * backend, no shared key. Streams tokens when the provider supports SSE.
 */
import { getAiConfig } from '../storage/ai-config.js';

// Embedded verbatim per the product brief.
export const SYSTEM_PROMPT =
  "You are Riffly's guitar tutor. Your student is a complete beginner learning acoustic guitar. Answer in warm, plain, non-technical language. Keep answers short — a few sentences unless asked for more. Be encouraging, never condescending. If a question is not about guitar, music, or practising, gently steer back to guitar.";

export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    keysUrl: 'https://aistudio.google.com/app/apikey',
    keysLabel: 'aistudio.google.com/app/apikey',
  },
  groq: {
    label: 'Groq',
    defaultModel: 'llama-3.1-8b-instant',
    keysUrl: 'https://console.groq.com/keys',
    keysLabel: 'console.groq.com/keys',
  },
};

export class TutorError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type; // 'no_key' | 'auth' | 'rate_limit' | 'network' | 'other'
    this.transient = false; // rate_limit only: short-term (per-minute) vs daily
    this.retryAfterSec = 0;
  }
}

/** Inspect a 429 to tell a short per-minute limit from a daily quota. */
function parseRetryAfter(res, body) {
  let sec = NaN;
  const hdr = res.headers && res.headers.get && res.headers.get('retry-after');
  if (hdr) sec = parseFloat(hdr);

  let perDay = false;
  let perMinute = false;
  const details = body && body.error && body.error.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const type = d['@type'] || '';
      if (type.includes('RetryInfo') && d.retryDelay) {
        const m = /([\d.]+)s/.exec(d.retryDelay);
        if (m) sec = parseFloat(m[1]);
      }
      if (type.includes('QuotaFailure')) {
        const s = JSON.stringify(d).toLowerCase();
        if (s.includes('perday') || s.includes('per_day')) perDay = true;
        if (s.includes('perminute') || s.includes('per_minute')) perMinute = true;
      }
    }
  }
  const msg = ((body && body.error && body.error.message) || (body && body.message) || '').toLowerCase();
  if (msg.includes('per day') || msg.includes('daily')) perDay = true;
  if (msg.includes('per minute') || msg.includes('per-minute')) perMinute = true;
  if (Number.isNaN(sec)) {
    const mm = /in\s+(?:(\d+)m)?\s*([\d.]+)s/.exec(msg);
    if (mm) sec = parseInt(mm[1] || '0', 10) * 60 + parseFloat(mm[2]);
  }

  let transient;
  if (perDay) transient = false;
  else if (perMinute) transient = true;
  else transient = !Number.isNaN(sec) && sec <= 120;
  if (Number.isNaN(sec)) sec = transient ? 20 : 0;
  return { sec, transient };
}

async function buildError(res) {
  let body = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 429) {
    const { sec, transient } = parseRetryAfter(res, body);
    const err = new TutorError('rate_limit', 'The tutor is rate-limited.');
    err.transient = transient;
    err.retryAfterSec = sec;
    return err;
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return new TutorError('auth', 'The API key was rejected.');
  }
  return new TutorError('other', `The provider returned an error (${res.status}).`);
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    }
  });
}

async function readSSE(res, onData) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('data:')) {
        const data = l.slice(5).trim();
        if (data) onData(data);
      }
    }
  }
}

async function streamGroq(cfg, history, onToken, signal) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model || PROVIDERS.groq.defaultModel,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw await buildError(res);
  let full = '';
  await readSSE(res, (data) => {
    if (data === '[DONE]') return;
    try {
      const j = JSON.parse(data);
      const t = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
      if (t) {
        full += t;
        onToken(t);
      }
    } catch {
      /* skip keep-alives / partials */
    }
  });
  return full;
}

async function streamGemini(cfg, history, onToken, signal) {
  const model = cfg.model || PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw await buildError(res);
  let full = '';
  await readSSE(res, (data) => {
    try {
      const j = JSON.parse(data);
      const t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
      if (t) {
        full += t;
        onToken(t);
      }
    } catch {
      /* skip */
    }
  });
  return full;
}

/**
 * Stream a tutor reply for the given chat history.
 * @param {Array<{role:'user'|'assistant', content:string}>} history
 * @param {{ onToken:(t:string)=>void, signal?:AbortSignal }} opts
 * @returns {Promise<string>} the full reply
 */
export async function streamTutorReply(history, { onToken, signal, onRetry } = {}) {
  const cfg = getAiConfig();
  if (!cfg || !cfg.apiKey) throw new TutorError('no_key', 'No API key set yet.');

  const run = () => (cfg.provider === 'groq' ? streamGroq(cfg, history, onToken, signal) : streamGemini(cfg, history, onToken, signal));
  const mapNet = (err) => {
    if (err instanceof TutorError) return err;
    if (err && err.name === 'AbortError') return err;
    return new TutorError('network', 'Couldn’t reach the tutor. Check your connection.');
  };

  try {
    return await run();
  } catch (e) {
    const err = mapNet(e);
    // A short per-minute limit? Wait it out once, quietly, before giving up.
    if (err instanceof TutorError && err.type === 'rate_limit' && err.transient && (err.retryAfterSec || 0) <= 12) {
      const wait = Math.max(2, Math.min(12, err.retryAfterSec || 4));
      if (onRetry) onRetry(wait);
      await delay(wait * 1000, signal); // rejects (AbortError) if the user cancels
      try {
        return await run();
      } catch (e2) {
        throw mapNet(e2);
      }
    }
    throw err;
  }
}
