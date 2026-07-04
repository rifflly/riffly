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
  }
}

function errorFromStatus(status) {
  if (status === 429) return new TutorError('rate_limit', 'The tutor is rate-limited.');
  if (status === 400 || status === 401 || status === 403) return new TutorError('auth', 'The API key was rejected.');
  return new TutorError('other', `The provider returned an error (${status}).`);
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
  if (!res.ok) throw errorFromStatus(res.status);
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
  if (!res.ok) throw errorFromStatus(res.status);
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
export async function streamTutorReply(history, { onToken, signal }) {
  const cfg = getAiConfig();
  if (!cfg || !cfg.apiKey) throw new TutorError('no_key', 'No API key set yet.');
  try {
    if (cfg.provider === 'groq') return await streamGroq(cfg, history, onToken, signal);
    return await streamGemini(cfg, history, onToken, signal);
  } catch (err) {
    if (err instanceof TutorError) throw err;
    if (err && err.name === 'AbortError') throw err;
    throw new TutorError('network', 'Couldn’t reach the tutor. Check your connection.');
  }
}
