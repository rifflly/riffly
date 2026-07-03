/**
 * Settings screen. Functional now:
 *  - Sound status + enable button (rule c)
 *  - Left-handed mode toggle (rule e) — mirrors chord diagrams once they exist
 *  - Install help (platform-aware)
 *  - About: app version (rule d) + tagline
 */
import { el } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { icon } from '../ui/icons.js';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../config.js';
import { getSetting, setSetting } from '../storage/settings.js';
import { applyLeftHanded } from '../app-state.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { isIosSafari, isStandalone } from '../install/platform.js';

function toggleRow({ label, description, checked, onChange }) {
  const input = el('input', {
    type: 'checkbox',
    class: 'switch-input',
    ...(checked ? { checked: true } : {}),
    onchange: (e) => onChange(e.target.checked),
  });
  return el(
    'label',
    { class: 'row row--toggle' },
    el(
      'span',
      { class: 'row-text' },
      el('span', { class: 'row-label' }, label),
      description ? el('span', { class: 'row-desc' }, description) : null
    ),
    el('span', { class: 'switch' }, input, el('span', { class: 'switch-track' }))
  );
}

export function render() {
  const root = el('div', { class: 'settings' });

  // --- Sound ---------------------------------------------------------------
  const soundStatus = el('span', { class: 'row-desc' });
  const soundBtn = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Enable sound');

  function refreshSound() {
    const on = isAudioUnlocked();
    soundStatus.textContent = on ? 'Sound is on for this session.' : 'Sound is off until you enable it.';
    soundBtn.style.display = on ? 'none' : '';
  }
  soundBtn.addEventListener('click', () => unlockAudio());
  onAudioUnlock(refreshSound);
  refreshSound();

  const soundCard = card(
    el('h2', { class: 'card-title' }, 'Sound'),
    el(
      'div',
      { class: 'row' },
      el('span', { class: 'row-text' }, el('span', { class: 'row-label' }, 'Audio'), soundStatus),
      soundBtn
    )
  );

  // --- Playing -------------------------------------------------------------
  const playingCard = card(
    el('h2', { class: 'card-title' }, 'Playing'),
    toggleRow({
      label: 'Left-handed mode',
      description: 'Mirror every chord diagram for left-handed players.',
      checked: getSetting('leftHanded'),
      onChange: async (checked) => {
        await setSetting('leftHanded', checked);
        applyLeftHanded(checked);
      },
    })
  );

  // --- Install -------------------------------------------------------------
  let installText;
  if (isStandalone()) {
    installText = 'Riffly is installed on this device. Nice!';
  } else if (isIosSafari()) {
    installText = 'To install: tap the Share button, then “Add to Home Screen”.';
  } else {
    installText =
      'To install: open your browser menu and choose “Install app” or “Add to Home Screen”.';
  }
  const installCard = card(
    el('h2', { class: 'card-title' }, 'Install Riffly'),
    el('p', { class: 'card-text' }, installText)
  );

  // --- About ---------------------------------------------------------------
  const aboutCard = card(
    el('h2', { class: 'card-title' }, 'About'),
    el(
      'div',
      { class: 'about' },
      icon('check', 20),
      el(
        'div',
        {},
        el('p', { class: 'about-name' }, `${APP_NAME} — ${APP_TAGLINE}`),
        el('p', { class: 'row-desc' }, `Version ${APP_VERSION}`)
      )
    )
  );

  root.append(soundCard, playingCard, installCard, aboutCard);
  return root;
}
