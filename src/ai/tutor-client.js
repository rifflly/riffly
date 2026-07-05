/**
 * AI tutor client (Phase 3 item 5). Talks directly from the browser to the
 * user's chosen provider (Google Gemini or Groq) using their own key — no
 * backend, no shared key. Streams tokens when the provider supports SSE.
 */
import { getAiConfig } from '../storage/ai-config.js';

// Embedded verbatim per the product brief.
export const SYSTEM_PROMPT =
  "You are Riffly's guitar tutor. Your student is a complete beginner learning acoustic guitar. Answer in warm, plain, non-technical language. Keep answers short — a few sentences unless asked for more. Be encouraging, never condescending. If a question is not about guitar, music, or practising, gently steer back to guitar.";

// ---- Model + generation config (SINGLE SOURCE OF TRUTH) -----------------
// To migrate models later, change these two lines only — nothing else.
// gemini-2.0-flash was retired, so the Gemini model is bumped to the current
// supported flash model. The stream functions use MODELS[provider] directly,
// so this also fixes existing installs that saved the old model id.
export const MODELS = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.1-8b-instant',
};

// Shared generation settings for every provider (smaller cap = less quota use).
export const GENERATION = {
  maxOutputTokens: 300, // was 500
  temperature: 0.7,
};

export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: MODELS.gemini,
    keysUrl: 'https://aistudio.google.com/app/apikey',
    keysLabel: 'aistudio.google.com/app/apikey',
  },
  groq: {
    label: 'Groq',
    defaultModel: MODELS.groq,
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

/**
 * Classify a 429 into one of three kinds so the UI can be honest about it:
 *   'retry'   — a short-window (per-minute) limit; worth retrying in N seconds.
 *   'daily'   — a per-day / project quota; won't clear until the daily reset.
 *   'unknown' — a 429 we can't confidently label (do NOT claim it's daily).
 * Reads the Retry-After header, Gemini's error.details (RetryInfo/QuotaFailure),
 * and the human message as fallbacks.
 */
function classifyRateLimit(res, body) {
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

  let kind;
  if (perDay) kind = 'daily';
  else if (perMinute) kind = 'retry';
  else if (!Number.isNaN(sec) && sec <= 120) kind = 'retry';
  else kind = 'unknown'; // previously mislabelled as "daily" — the reported bug
  if (Number.isNaN(sec)) sec = kind === 'retry' ? 20 : 0;
  return { sec, kind };
}

async function buildError(res) {
  let body = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 429) {
    const { sec, kind } = classifyRateLimit(res, body);
    const err = new TutorError('rate_limit', 'The tutor is rate-limited.');
    err.limitKind = kind; // 'retry' | 'daily' | 'unknown'
    err.transient = kind === 'retry'; // kept for the quiet auto-retry below
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

// Fold the rolling summary of older turns into the system instruction so the
// model keeps continuity without us re-sending the whole transcript.
function buildSystemInstruction(summary) {
  if (!summary) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nContext from earlier in this chat (for your memory — don't repeat it back): ${summary}`;
}

async function streamGroq(cfg, context, onToken, signal) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: MODELS.groq,
      stream: true,
      max_tokens: GENERATION.maxOutputTokens,
      temperature: GENERATION.temperature,
      messages: [
        { role: 'system', content: buildSystemInstruction(context.summary) },
        ...context.recent.map((m) => ({ role: m.role, content: m.content })),
      ],
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

async function streamGemini(cfg, context, onToken, signal) {
  const model = MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(context.summary) }] },
      contents: context.recent.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: GENERATION.maxOutputTokens, temperature: GENERATION.temperature },
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

// Provider adapters. Each streams a reply for a lean context and returns the
// full text. To add a provider (or a fallback), add one entry + a stream fn.
const ADAPTERS = {
  gemini: streamGemini,
  groq: streamGroq,
};

// FALLBACK SEAM — return a { provider, apiKey } to try when the primary hits a
// hard quota. No-op for now (auto-fallback needs a second key from the user);
// wire it up here later, e.g. read a saved secondary key from ai-config.
function getFallback(/* cfg, err */) {
  return null;
}

/**
 * Stream a tutor reply for a lean request context.
 * @param {{ summary:string, recent:Array<{role:'user'|'assistant', content:string}> }} context
 * @param {{ onToken:(t:string)=>void, signal?:AbortSignal, onRetry?:(sec:number)=>void }} opts
 * @returns {Promise<string>} the full reply
 */
export async function streamTutorReply(context, { onToken, signal, onRetry } = {}) {
  const cfg = getAiConfig();
  if (!cfg || !cfg.apiKey) throw new TutorError('no_key', 'No API key set yet.');

  const adapter = ADAPTERS[cfg.provider] || streamGemini;
  const run = () => adapter(cfg, context, onToken, signal);
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
