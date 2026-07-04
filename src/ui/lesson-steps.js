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
import { buildLessonTrainer } from './lesson-trainer.js';
import { buildLessonRhythm } from './lesson-rhythm.js';

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

function trainerCard(step) {
  const { node, dispose } = buildLessonTrainer(step.pair || ['Em', 'Am'], step.bpm || 60);
  const card = el(
    'section',
    { class: 'card step step--trainer' },
    el(
      'div',
      { class: 'step-metro-head' },
      icon('practice', 20),
      el('span', { class: 'step-heading step-heading--inline' }, 'Chord-change trainer')
    ),
    step.body ? el('p', { class: 'step-body' }, step.body) : null,
    node
  );
  return { node: card, dispose };
}

function rhythmCard(step) {
  const { node, dispose } = buildLessonRhythm(step.pattern || 'downstrums', step.chordId, step.bpm);
  const card = el(
    'section',
    { class: 'card step step--rhythm' },
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

function tunerLinkCard(step) {
  return el(
    'section',
    { class: 'card step step--tuner' },
    el(
      'div',
      { class: 'step-metro-head' },
      icon('practice', 20),
      el('span', { class: 'step-heading step-heading--inline' }, 'Tuner')
    ),
    step.body ? el('p', { class: 'step-body' }, step.body) : null,
    el(
      'button',
      {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        onclick: () => {
          location.hash = '#/tuner';
        },
      },
      'Open the tuner'
    )
  );
}

function strumCard(step) {
  const tokens = Array.isArray(step.pattern)
    ? step.pattern
    : String(step.pattern || '').split(/\s+/).filter(Boolean);
  const counts = Array.isArray(step.counts) ? step.counts : null;
  const glyph = (t) => (t === 'D' ? '↓' : t === 'U' ? '↑' : '–');
  const cls = (t) => (t === 'D' ? 'is-down' : t === 'U' ? 'is-up' : 'is-miss');

  const grid = el('div', { class: 'strum-grid' });
  tokens.forEach((t, i) => {
    grid.append(
      el(
        'div',
        { class: `strum-cell ${cls(t)}` },
        el('span', { class: 'strum-arrow', 'aria-hidden': 'true' }, glyph(t)),
        counts ? el('span', { class: 'strum-count' }, counts[i] || '') : null
      )
    );
  });

  return el(
    'section',
    { class: 'card step step--strum' },
    step.heading ? el('h3', { class: 'step-heading' }, step.heading) : null,
    step.body ? el('p', { class: 'step-body' }, step.body) : null,
    grid,
    el('p', { class: 'strum-legend' }, '↓ down · ↑ up · – miss')
  );
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
    case 'trainer':
      return trainerCard(step);
    case 'rhythm':
      return rhythmCard(step);
    case 'strum':
      return { node: strumCard(step) };
    case 'tunerlink':
      return { node: tunerLinkCard(step) };
    case 'text':
    default:
      return { node: textCard(step) };
  }
}
