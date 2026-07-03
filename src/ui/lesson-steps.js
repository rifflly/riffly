/**
 * Renders a single lesson step to a DOM node. Some steps (metronome) own live
 * resources, so each returns an optional `dispose` the lesson view aggregates.
 */
import { el } from './dom.js';
import { chordDiagramSVG } from './chord-diagram.js';
import { getChord } from '../content.js';
import { getSetting } from '../storage/settings.js';
import { icon } from './icons.js';
import { buildLessonMetronome } from './lesson-metronome.js';

function paragraphs(text) {
  return String(text || '')
    .split('\n\n')
    .filter(Boolean)
    .map((p) => el('p', { class: 'step-body' }, p));
}

function textCard(step) {
  return el(
    'section',
    { class: 'card step step--text' },
    step.heading ? el('h3', { class: 'step-heading' }, step.heading) : null,
    ...paragraphs(step.body)
  );
}

function tipCard(step) {
  return el(
    'div',
    { class: 'step step--tip' },
    el('span', { class: 'tip-icon', 'aria-hidden': 'true' }, '💡'),
    el('p', { class: 'tip-body' }, step.body)
  );
}

function chordCard(step) {
  const chord = getChord(step.chordId);
  const mirror = getSetting('leftHanded');
  return el(
    'section',
    { class: 'card step step--chord' },
    chord
      ? el(
          'div',
          { class: 'step-chord-head' },
          el('span', { class: 'step-chord-diagram', html: chordDiagramSVG(chord, { mirror }) }),
          el('span', { class: 'step-chord-name' }, chord.longName || chord.name)
        )
      : null,
    step.body ? el('p', { class: 'step-body' }, step.body) : null
  );
}

function practiceCard(step) {
  return el(
    'section',
    { class: 'card step step--practice' },
    el('h3', { class: 'step-heading' }, step.heading || 'Try it'),
    step.body ? el('p', { class: 'step-body' }, step.body) : null,
    Array.isArray(step.checklist)
      ? el(
          'ul',
          { class: 'checklist' },
          ...step.checklist.map((item) =>
            el('li', { class: 'checklist-item' }, icon('check', 18), el('span', {}, item))
          )
        )
      : null
  );
}

function metronomeCard(step) {
  const { node, dispose } = buildLessonMetronome(step.bpm || 60);
  const card = el(
    'section',
    { class: 'card step step--metronome' },
    el(
      'div',
      { class: 'step-metro-head' },
      icon('practice', 20),
      el('span', { class: 'step-heading step-heading--inline' }, 'Play along')
    ),
    step.body ? el('p', { class: 'step-body' }, step.body) : null,
    node
  );
  return { node: card, dispose };
}

/**
 * @param {object} step
 * @returns {{ node: HTMLElement, dispose?: Function }}
 */
export function renderStep(step) {
  switch (step.type) {
    case 'tip':
      return { node: tipCard(step) };
    case 'chord':
      return { node: chordCard(step) };
    case 'practice':
      return { node: practiceCard(step) };
    case 'metronome':
      return metronomeCard(step);
    case 'text':
    default:
      return { node: textCard(step) };
  }
}
