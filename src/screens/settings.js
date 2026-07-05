/**
 * Settings screen. Functional now:
 *  - Sound status + enable button (rule c)
 *  - Left-handed mode toggle (rule e) — mirrors chord diagrams once they exist
 *  - Install help (platform-aware)
 *  - About: app version (rule d) + tagline
 */
import { el, clear } from '../ui/dom.js';
import { card } from '../ui/screen.js';
import { icon } from '../ui/icons.js';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../config.js';
import { getSetting, setSetting } from '../storage/settings.js';
import { applyLeftHanded } from '../app-state.js';
import { isAudioUnlocked, unlockAudio, onAudioUnlock } from '../audio/audio-engine.js';
import { isIosSafari, isStandalone } from '../install/platform.js';
import { downloadBackup, isValidBackup, summarizeBackup, applyBackup } from '../storage/backup.js';
import { allAudioMeta, totalAudioBytes, deleteAudio, formatBytes, SOFT_LIMIT_BYTES } from '../storage/audio-store.js';
import { getSong } from '../songs/song-library.js';

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

  // --- Your data (backup & restore) ---------------------------------------
  const dataCard = card(
    el('h2', { class: 'card-title' }, 'Your data'),
    el(
      'p',
      { class: 'card-text' },
      'Everything you do in Riffly is saved on this device only. Back it up to keep it safe or move it to another device.'
    ),
    renderDataTools()
  );

  // --- Backing tracks (manage uploads) ------------------------------------
  const tracksCard = card(el('h2', { class: 'card-title' }, 'Backing tracks'), renderBackingTracks());

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

  // --- Help / user guide ---------------------------------------------------
  const guideCard = card(
    el('h2', { class: 'card-title' }, 'User guide'),
    el('p', { class: 'card-text' }, 'A friendly, step-by-step guide to everything in Riffly.'),
    el(
      'a',
      { class: 'btn btn-secondary btn-sm', href: `${import.meta.env.BASE_URL}manual.html`, target: '_blank', rel: 'noopener noreferrer' },
      'Open the guide ↗'
    )
  );

  root.append(soundCard, playingCard, dataCard, tracksCard, installCard, guideCard, aboutCard);
  return root;
}

// ---- Backing tracks manager (Phase 3 item 2) ----------------------------

function renderBackingTracks() {
  const host = el('div', { class: 'tracks-tools' });

  function refresh() {
    clear(host);
    const meta = allAudioMeta();
    const ids = Object.keys(meta);
    const total = totalAudioBytes();

    host.append(
      el('p', { class: 'card-text' }, `Using ${formatBytes(total)} of on-device space for backing tracks.`)
    );

    if (total > SOFT_LIMIT_BYTES) {
      host.append(
        el(
          'p',
          { class: 'restore-note restore-note--err' },
          'That’s quite a lot of audio — your device may start to run low on space. Consider removing a track or two.'
        )
      );
    }

    if (!ids.length) {
      host.append(el('p', { class: 'row-desc' }, 'No backing tracks yet. Add one in a song’s studio (Backing → My Audio).'));
      return;
    }

    const list = el('div', { class: 'track-list' });
    for (const id of ids) {
      const song = getSong(id);
      const m = meta[id];
      list.append(
        el(
          'div',
          { class: 'track-row' },
          el(
            'span',
            { class: 'row-text' },
            el('span', { class: 'row-label' }, song ? song.title : m.name),
            el('span', { class: 'row-desc' }, `${m.name} · ${formatBytes(m.size)}`)
          ),
          el(
            'button',
            {
              class: 'btn btn-danger btn-sm',
              type: 'button',
              onclick: async () => {
                await deleteAudio(id);
                refresh();
              },
            },
            'Remove'
          )
        )
      );
    }
    host.append(list);
  }

  refresh();
  return host;
}

// ---- Backup & restore (item 5) ------------------------------------------

function renderDataTools() {
  const wrap = el('div', { class: 'data-tools' });

  const backupBtn = el(
    'button',
    { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => downloadBackup() },
    'Back up my data'
  );

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    'aria-hidden': 'true',
  });
  const restoreBtn = el(
    'button',
    { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => fileInput.click() },
    'Restore from backup'
  );

  const msg = el('div', { class: 'restore-msg' });

  function showMessage(text, kind) {
    clear(msg);
    msg.append(el('p', { class: `restore-note restore-note--${kind}` }, text));
  }

  function showPreview(summary, backup) {
    clear(msg);
    const bits = [];
    bits.push(`${summary.songs} song${summary.songs === 1 ? '' : 's'}`);
    bits.push(`${summary.lessons} lesson${summary.lessons === 1 ? '' : 's'} complete`);
    if (summary.streak) bits.push(`a ${summary.streak}-day streak`);
    const when = summary.exportedAt ? ` (saved ${summary.exportedAt.slice(0, 10)})` : '';

    msg.append(
      el('p', { class: 'restore-note restore-note--info' }, `This backup has ${bits.join(', ')}${when}.`),
      el('p', { class: 'row-desc' }, 'Restoring replaces everything currently on this device. Continue?'),
      el(
        'div',
        { class: 'restore-actions' },
        el(
          'button',
          {
            class: 'btn btn-start btn-sm',
            type: 'button',
            onclick: async () => {
              await applyBackup(backup);
              clear(msg);
              msg.append(el('p', { class: 'restore-note restore-note--ok' }, 'Restored! Reloading…'));
              setTimeout(() => location.reload(), 700);
            },
          },
          'Replace my data'
        ),
        el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => clear(msg) }, 'Cancel')
      )
    );
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      showMessage('Sorry, that file couldn’t be read as a Riffly backup.', 'err');
      fileInput.value = '';
      return;
    }
    if (!isValidBackup(obj)) {
      showMessage('That doesn’t look like a Riffly backup file.', 'err');
      fileInput.value = '';
      return;
    }
    showPreview(summarizeBackup(obj), obj);
    fileInput.value = '';
  });

  wrap.append(el('div', { class: 'data-buttons' }, backupBtn, restoreBtn), fileInput, msg);
  return wrap;
}
