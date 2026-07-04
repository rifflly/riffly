/**
 * Learn screen — the guided lesson path (Phase 1, stages 1–2).
 *
 * Two views inside one screen: the PATH (stages + lessons + progress) and a
 * LESSON view (its steps + a "mark complete" button). Content is data-driven
 * from /data/lessons.json (rule f); completion is tracked in IndexedDB.
 */
import { el, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { STAGES, allLessons } from '../content.js';
import { isLessonComplete, completedCount, setLessonComplete } from '../storage/progress.js';
import { renderStep } from '../ui/lesson-steps.js';

export function render() {
  const root = el('div', { class: 'learn' });
  let disposeView = null;

  function setView(node, dispose) {
    if (disposeView) disposeView();
    disposeView = dispose || null;
    clear(root);
    root.append(node);
    const main = document.getElementById('screen');
    if (main) main.scrollTop = 0;
  }

  const showPath = () => setView(renderPath(showLesson), null);
  const showLesson = (lesson) => {
    const { node, dispose } = renderLesson(lesson, showPath);
    setView(node, dispose);
  };

  root._dispose = () => {
    if (disposeView) disposeView();
  };

  showPath();
  return root;
}

// ---- Path view ----------------------------------------------------------

function renderPath(onOpen) {
  const node = el('div', { class: 'path' });
  const lessons = allLessons();
  node.append(progressCard(completedCount(), lessons.length));

  node.append(
    el(
      'button',
      { class: 'tuner-cta', type: 'button', onclick: () => { location.hash = '#/tuner'; } },
      el('span', { class: 'tuner-cta-emoji', 'aria-hidden': 'true' }, '🎸'),
      el(
        'span',
        { class: 'tuner-cta-text' },
        el('span', { class: 'tuner-cta-title' }, 'Tune your guitar'),
        el('span', { class: 'tuner-cta-sub' }, 'Get in tune before you play')
      ),
      el('span', { class: 'lesson-chevron', 'aria-hidden': 'true' }, '›')
    )
  );

  for (const stage of STAGES) {
    node.append(stageSection(stage, onOpen));
  }
  return node;
}

function progressCard(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return el(
    'section',
    { class: 'card progress-card' },
    el('h2', { class: 'card-title' }, 'Your progress'),
    el(
      'p',
      { class: 'progress-count' },
      done === 0
        ? "Let's play your first note today."
        : done === total
          ? "You've finished every lesson so far — amazing! 🎉"
          : `${done} of ${total} lessons complete`
    ),
    el(
      'div',
      { class: 'progress-bar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      el('div', { class: 'progress-fill', style: `width:${pct}%` })
    )
  );
}

function stageSection(stage, onOpen) {
  const section = el('section', { class: 'stage' });
  section.append(
    el(
      'div',
      { class: 'stage-head' },
      el('span', { class: 'stage-badge' }, String(stage.number)),
      el(
        'div',
        {},
        el('h2', { class: 'stage-title' }, stage.title),
        el('p', { class: 'stage-subtitle' }, stage.subtitle)
      )
    )
  );

  const list = el('div', { class: 'lesson-list' });
  for (const lesson of stage.lessons) {
    const done = isLessonComplete(lesson.id);
    list.append(
      el(
        'button',
        { class: `lesson-row${done ? ' is-done' : ''}`, type: 'button', onclick: () => onOpen(lesson) },
        el('span', { class: 'lesson-check', 'aria-hidden': 'true' }, done ? icon('check', 18) : ''),
        el(
          'span',
          { class: 'lesson-row-text' },
          el('span', { class: 'lesson-row-title' }, lesson.title),
          el('span', { class: 'lesson-row-meta' }, lesson.summary || `About ${lesson.minutes} min`)
        ),
        el('span', { class: 'lesson-chevron', 'aria-hidden': 'true' }, '›')
      )
    );
  }
  section.append(list);
  return section;
}

// ---- Lesson view --------------------------------------------------------

function renderLesson(lesson, onBack) {
  const node = el('div', { class: 'lesson-view' });
  const disposers = [];

  node.append(
    el('button', { class: 'back-btn', type: 'button', onclick: onBack }, '‹ All lessons')
  );
  node.append(el('h2', { class: 'lesson-title' }, lesson.title));
  if (lesson.minutes) node.append(el('p', { class: 'lesson-meta' }, `About ${lesson.minutes} min`));

  for (const step of lesson.steps) {
    const { node: stepNode, dispose } = renderStep(step);
    if (dispose) disposers.push(dispose);
    node.append(stepNode);
  }

  const complete = isLessonComplete(lesson.id);
  if (complete) {
    node.append(el('p', { class: 'lesson-done-note' }, 'You’ve completed this lesson 🎉'));
    node.append(
      el('button', { class: 'btn btn-secondary lesson-done', type: 'button', onclick: onBack }, 'Back to lessons')
    );
  } else {
    node.append(
      el(
        'button',
        {
          class: 'btn btn-start lesson-done',
          type: 'button',
          onclick: async () => {
            await setLessonComplete(lesson.id, true);
            onBack();
          },
        },
        'I did it! ✓'
      )
    );
  }

  return { node, dispose: () => disposers.forEach((d) => d()) };
}
