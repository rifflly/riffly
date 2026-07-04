/**
 * AI Tutor screen (Phase 3 item 5). No key yet → a bring-your-own-key setup
 * screen with step-by-step instructions for Google Gemini and Groq. With a key
 * → a streaming chat. Friendly handling for rate-limits (suggests lessons),
 * rejected keys (re-setup), and network trouble. The rest of the app works fully
 * without ever setting this up.
 */
import { el, clear } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { allLessons } from '../content.js';
import { hasAiKey, setAiConfig, clearAiConfig, getAiConfig } from '../storage/ai-config.js';
import { PROVIDERS, streamTutorReply, TutorError } from '../ai/tutor-client.js';
import { getHistory, addMessage, clearHistory, takePendingContext } from '../ai/tutor-chat.js';

const EXAMPLES = [
  'How do I switch chords more smoothly?',
  'My F chord buzzes — any tips?',
  'How often should a beginner practise?',
];

const INSTRUCTIONS = {
  gemini: [
    'Open aistudio.google.com/app/apikey and sign in with a Google account.',
    'Click “Create API key” (choose a project if asked).',
    'Copy the key it shows you and paste it below.',
  ],
  groq: [
    'Open console.groq.com/keys and sign up — it’s free.',
    'Click “Create API Key” and give it any name.',
    'Copy the key and paste it below (you only see it once).',
  ],
};

export function render() {
  const root = el('div', { class: 'tutor' });
  mount();
  return root;

  function mount() {
    clear(root);
    if (hasAiKey()) renderChat();
    else renderSetup();
  }

  // ---- Setup ------------------------------------------------------------
  function renderSetup() {
    let provider = 'gemini';
    const keyInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Paste your API key', 'aria-label': 'API key', autocomplete: 'off' });
    const tabs = el('div', { class: 'segmented tutor-provider', role: 'group', 'aria-label': 'AI provider' });
    const steps = el('ol', { class: 'tutor-steps' });
    const keyLink = el('a', { class: 'link-btn', target: '_blank', rel: 'noopener' });

    function renderProvider() {
      clear(tabs);
      for (const id of Object.keys(PROVIDERS)) {
        tabs.append(
          el('button', { class: `seg${id === provider ? ' is-active' : ''}`, type: 'button', onclick: () => { provider = id; renderProvider(); } }, PROVIDERS[id].label)
        );
      }
      clear(steps);
      for (const s of INSTRUCTIONS[provider]) steps.append(el('li', {}, s));
      keyLink.textContent = `Open ${PROVIDERS[provider].keysLabel} →`;
      keyLink.href = PROVIDERS[provider].keysUrl;
    }
    renderProvider();

    const err = el('p', { class: 'tutor-setup-err' });
    const saveBtn = el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        onclick: async () => {
          const apiKey = keyInput.value.trim();
          if (!apiKey) {
            err.textContent = 'Paste your API key first.';
            return;
          }
          await setAiConfig({ provider, apiKey, model: PROVIDERS[provider].defaultModel });
          mount();
        },
      },
      'Save & start chatting'
    );

    root.append(
      card(
        el('h2', { class: 'card-title' }, 'Meet your AI tutor'),
        el('p', { class: 'card-text' }, 'Ask anything about guitar and get friendly, beginner-level answers. It uses a free key from Google or Groq that you set up once.'),
        el('p', { class: 'row-desc tutor-privacy' }, '🔒 Your key is stored only on this device and sent only to the provider you choose. Riffly has no server and never sees it.')
      ),
      card(
        el('h2', { class: 'card-title' }, 'Get a free key'),
        tabs,
        steps,
        keyLink,
        el('label', { class: 'edit-field' }, el('span', { class: 'edit-label' }, 'Your API key'), keyInput),
        err,
        saveBtn
      )
    );
  }

  // ---- Chat -------------------------------------------------------------
  function renderChat() {
    let streaming = false;
    let abort = null;

    const messages = el('div', { class: 'chat-messages' });
    const input = el('textarea', { class: 'chat-input', rows: '1', placeholder: 'Ask your tutor a question…', 'aria-label': 'Message' });
    const sendBtn = el('button', { class: 'btn btn-primary chat-send', type: 'button' }, 'Send');

    function scrollDown() {
      const main = document.getElementById('screen');
      if (main) main.scrollTop = main.scrollHeight;
    }

    function addBubble(role, text) {
      const bubble = el('div', { class: `chat-msg chat-msg--${role}` }, text || '');
      messages.append(bubble);
      scrollDown();
      return bubble;
    }

    function renderHistory() {
      clear(messages);
      const history = getHistory();
      if (!history.length) {
        messages.append(
          el(
            'div',
            { class: 'chat-intro' },
            el('p', { class: 'row-desc' }, 'Hi! I’m your guitar tutor. Ask me anything — here are a few ideas:'),
            el('div', { class: 'chat-examples' }, ...EXAMPLES.map((q) => el('button', { class: 'chip', type: 'button', onclick: () => { input.value = q; send(); } }, q)))
          )
        );
      } else {
        for (const m of history) addBubble(m.role, m.content);
      }
    }

    async function send() {
      const text = input.value.trim();
      if (!text || streaming) return;
      input.value = '';
      autosize();
      if (!getHistory().length) clear(messages);
      addMessage({ role: 'user', content: text });
      addBubble('user', text);

      streaming = true;
      sendBtn.disabled = true;
      const bubble = addBubble('assistant', '');
      bubble.classList.add('is-typing');
      bubble.append(el('span', { class: 'typing-dots' }, '•••'));

      abort = new AbortController();
      try {
        const full = await streamTutorReply(getHistory(), {
          signal: abort.signal,
          onToken: (t) => {
            if (bubble.classList.contains('is-typing')) {
              bubble.classList.remove('is-typing');
              clear(bubble);
            }
            bubble.textContent += t;
            scrollDown();
          },
        });
        bubble.classList.remove('is-typing');
        const answer = bubble.textContent || full || '…';
        bubble.textContent = answer;
        addMessage({ role: 'assistant', content: answer });
      } catch (err) {
        bubble.remove();
        showError(err, text);
      } finally {
        streaming = false;
        sendBtn.disabled = false;
        abort = null;
      }
    }

    function showError(err, question) {
      const type = err instanceof TutorError ? err.type : 'other';
      if (type === 'no_key' || type === 'auth') {
        const box = el(
          'div',
          { class: 'chat-error' },
          el('p', {}, type === 'auth' ? 'That API key was rejected. Let’s set it up again.' : 'Let’s set up your tutor first.'),
          el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { clearAiConfig().then(mount); } }, 'Set up the tutor')
        );
        messages.append(box);
      } else if (type === 'rate_limit') {
        const lessons = matchLessons(question);
        const box = el(
          'div',
          { class: 'chat-error' },
          el('p', {}, 'The tutor has answered a lot today and is resting — it’ll be back tomorrow. Meanwhile, these lessons might help:')
        );
        if (lessons.length) {
          const list = el('div', { class: 'chat-lesson-links' });
          for (const l of lessons) list.append(el('button', { class: 'chip', type: 'button', onclick: () => { location.hash = '#/learn'; } }, l.title));
          box.append(list);
        } else {
          box.append(el('button', { class: 'chip', type: 'button', onclick: () => { location.hash = '#/learn'; } }, 'Go to lessons'));
        }
        messages.append(box);
      } else {
        messages.append(el('div', { class: 'chat-error' }, el('p', {}, 'Couldn’t reach the tutor just now. Check your connection and try again.')));
      }
      scrollDown();
    }

    function autosize() {
      input.style.height = 'auto';
      input.style.height = `${Math.min(120, input.scrollHeight)}px`;
    }
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener('click', send);

    const cfg = getAiConfig();
    root.append(
      el(
        'div',
        { class: 'chat-head' },
        el('span', { class: 'chat-provider' }, `Powered by ${cfg ? PROVIDERS[cfg.provider].label : 'your key'}`),
        el(
          'span',
          { class: 'chat-head-actions' },
          el('button', { class: 'link-btn', type: 'button', onclick: () => { clearHistory(); renderHistory(); } }, 'Clear'),
          el('button', { class: 'link-btn', type: 'button', onclick: () => { clearAiConfig().then(mount); } }, 'Change key')
        )
      ),
      messages,
      el('div', { class: 'chat-composer' }, input, sendBtn)
    );

    renderHistory();

    // Pre-fill from a lesson's Ask button.
    const ctx = takePendingContext();
    if (ctx) {
      input.value = ctx;
      autosize();
      input.focus();
    }

    root._dispose = () => {
      if (abort) abort.abort();
    };
  }
}

function matchLessons(question) {
  const words = String(question)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  const scored = allLessons()
    .map((l) => {
      const hay = `${l.title} ${l.summary || ''}`.toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.l);
}
