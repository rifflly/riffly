/**
 * "Sing or play along" guide — a small goal-first how-to for muting a part of a
 * song. Riffly can't split a finished recording, so this walks the user through
 * prepping the file with a free external tool, then coming back to Replace it.
 * Reused by the Songs screen card and the Studio's My Audio panel.
 */
import { el, clear } from './dom.js';
import { openModal } from './modal.js';

const TOOL = {
  sing: { url: 'https://vocalremover.org', open: 'Open the vocal remover' },
  play: { url: 'https://github.com/fabiogra/moseca', open: 'Open the stem splitter' },
};

/** @param {'sing'|'play'} [initialGoal] jump straight to one goal's steps */
export function openAudioHelp(initialGoal) {
  const body = el('div', { class: 'byo-modal audio-help' });
  draw(initialGoal || null);
  openModal(body, { label: 'Sing or play along' });

  function draw(goal) {
    clear(body);
    body.append(
      el('h2', { class: 'byo-modal-title' }, 'Sing or play along'),
      el('p', { class: 'byo-modal-body' }, 'Riffly plays your file as it is. To mute a part, prep it once with a free tool — then come back and tap Replace.')
    );

    if (!goal) {
      body.append(el('p', { class: 'byo-modal-sub' }, 'What do you want to do?'));
      body.append(
        goalButton('🎤', 'Sing it myself', 'Remove the singing', 'sing'),
        goalButton('🎸', 'Play an instrument myself', 'Mute one instrument', 'play')
      );
      return;
    }

    body.append(el('button', { class: 'link-btn audio-help-back', type: 'button', onclick: () => draw(null) }, '‹ Back'));

    if (goal === 'sing') {
      body.append(
        steps([
          ['Open the free vocal remover', TOOL.sing],
          ['Upload your song, then download the “Music / Instrumental” version.'],
          ['Back in Riffly, tap Replace and choose that file. Now you sing! 🎶'],
        ]),
        el('p', { class: 'byo-disclaimer' }, 'Quicker option: try the “Reduce vocals” switch in the studio first — one tap, no download.')
      );
    } else {
      body.append(
        steps([
          ['Open the free stem splitter', TOOL.play],
          ['Upload your song, mute the part you’ll play (e.g. guitar), then export the rest.'],
          ['Back in Riffly, tap Replace and choose that file. Now you play along! 🎸'],
        ])
      );
    }
    body.append(el('p', { class: 'byo-disclaimer' }, 'Heads up: results depend on the song. Removing vocals is usually cleaner than isolating a single instrument.'));
  }

  function goalButton(emoji, title, desc, goal) {
    return el(
      'button',
      { class: 'byo-action audio-goal', type: 'button', onclick: () => draw(goal) },
      el('span', { class: 'byo-action-main' },
        el('span', { class: 'byo-action-title' }, `${emoji}  ${title}`),
        el('span', { class: 'byo-action-desc' }, desc)),
      el('span', { class: 'byo-action-go', 'aria-hidden': 'true' }, '›')
    );
  }

  function steps(list) {
    const ol = el('ol', { class: 'audio-steps' });
    for (const [text, link] of list) {
      const li = el('li', {}, el('span', {}, text));
      if (link) {
        li.append(el('a', { class: 'btn btn-secondary btn-sm audio-step-link', href: link.url, target: '_blank', rel: 'noopener noreferrer' }, `${link.open} ↗`));
      }
      ol.append(li);
    }
    return ol;
  }
}
