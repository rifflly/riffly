/**
 * Practice screen — a hub for the timing-driven practice tools (Phase 2).
 *
 * A switcher at the top lets the user pick a tool; each tool is a self-contained
 * module exposing create() → { node, dispose }. All tools share the one timing
 * engine (rule b), and only one is mounted at a time — switching disposes the
 * previous tool so nothing keeps ticking. Audio must be unlocked first (rule c).
 */
import { el, clear } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import * as metronomeTool from './practice/metronome-tool.js';
import * as chordChangesTool from './practice/chord-changes.js';
import * as backingTool from './practice/backing-tool.js';

const TOOLS = [
  { id: 'metronome', label: 'Metronome', mod: metronomeTool },
  { id: 'changes', label: 'Changes', mod: chordChangesTool },
  { id: 'backing', label: 'Rhythm', mod: backingTool },
];

export function render() {
  const root = el('div', { class: 'practice' });
  mount(root);
  return root;
}

function mount(root) {
  clear(root);
  if (!isAudioUnlocked()) {
    mountEnablePrompt(root);
  } else {
    mountHub(root);
  }
}

function mountEnablePrompt(root) {
  root.append(
    card(
      el('h2', { class: 'card-title' }, 'Practice'),
      el(
        'div',
        { class: 'enable-block' },
        el('p', { class: 'card-text' }, 'Turn on sound to use the practice tools.'),
        el('p', { class: 'row-desc' }, 'You only need to do this once each visit.'),
        el(
          'button',
          { class: 'btn btn-primary', type: 'button', onclick: () => unlockAudio() },
          'Enable sound'
        )
      )
    )
  );
  const off = onAudioUnlock(() => {
    off();
    mount(root);
  });
  root._dispose = off;
}

function mountHub(root) {
  let active = null; // { node, dispose }
  let currentId = TOOLS[0].id;

  const switcher = el('div', {
    class: 'segmented tool-switch',
    role: 'group',
    'aria-label': 'Practice tools',
  });
  const container = el('div', { class: 'tool-container' });

  function renderSwitch() {
    clear(switcher);
    for (const t of TOOLS) {
      switcher.append(
        el(
          'button',
          {
            class: `seg${t.id === currentId ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => select(t.id),
          },
          t.label
        )
      );
    }
  }

  function select(id) {
    if (id === currentId && active) return;
    if (active && typeof active.dispose === 'function') active.dispose();
    clear(container);
    currentId = id;
    active = TOOLS.find((t) => t.id === id).mod.create();
    container.append(active.node);
    renderSwitch();
  }

  root.append(switcher, container);
  root._dispose = () => {
    if (active && typeof active.dispose === 'function') active.dispose();
  };

  select(currentId);
}
