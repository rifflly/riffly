/**
 * The practice-rewards card shown on the Learn path: streak, today's mission,
 * weekly goal, and a badges strip. Reads current state from the rewards layer
 * (synchronous, from the cached stats). Rebuilt each time the path renders.
 */
import { el } from './dom.js';
import { getStreak } from '../storage/stats.js';
import { getTodayMission, isTodayMissionDone, getWeekProgress, getBadgeState } from '../storage/rewards.js';

export function buildRewardsHub() {
  const streak = getStreak();
  const mission = getTodayMission();
  const missionDone = isTodayMissionDone();
  const week = getWeekProgress();
  const badges = getBadgeState();

  const earnedCount = badges.filter((b) => b.earned).length;
  const weekMet = week.done >= week.goal;

  const weekDots = el('div', { class: 'week-dots', 'aria-hidden': 'true' });
  for (let i = 0; i < week.goal; i++) {
    weekDots.append(el('span', { class: `week-dot${i < week.done ? ' is-done' : ''}` }));
  }

  const badgeRow = el('div', { class: 'badge-row' });
  for (const b of badges) {
    badgeRow.append(
      el(
        'span',
        { class: `badge-chip${b.earned ? ' is-earned' : ''}`, title: `${b.label} — ${b.desc}` },
        el('span', { class: 'badge-emoji', 'aria-hidden': 'true' }, b.earned ? b.emoji : '🔒'),
        el('span', { class: 'badge-label' }, b.label)
      )
    );
  }

  return el(
    'section',
    { class: 'card rewards-hub' },
    el(
      'div',
      { class: 'rewards-top' },
      el(
        'div',
        { class: `streak-box${streak === 0 ? ' is-cold' : ''}`, title: 'Practise any day to keep your streak alive' },
        el('span', { class: 'streak-flame', 'aria-hidden': 'true' }, streak === 0 ? '✨' : '🔥'),
        el('span', { class: 'streak-num' }, String(streak)),
        el('span', { class: 'streak-label' }, streak === 0 ? 'Start today!' : streak === 1 ? 'day streak' : 'day streak')
      ),
      el(
        'div',
        { class: `mission-box${missionDone ? ' is-done' : ' is-pending'}` },
        el('span', { class: 'mission-kicker' }, missionDone ? 'Mission done' : "Today's mission"),
        el('span', { class: 'mission-text' }, missionDone ? `✓ ${mission.text}` : mission.text),
        el('span', { class: 'mission-hint-sm' }, missionDone ? 'Nice one — come back tomorrow!' : mission.hint)
      )
    ),
    el(
      'div',
      { class: 'week-goal' },
      el('span', { class: 'week-label' }, weekMet ? '🎉 Weekly goal reached!' : `This week · ${week.done}/${week.goal} days`),
      weekDots
    ),
    el(
      'div',
      { class: 'badge-strip' },
      el('span', { class: 'badge-strip-count' }, `Badges · ${earnedCount}/${badges.length}`),
      badgeRow
    )
  );
}
