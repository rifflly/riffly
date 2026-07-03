/**
 * Central access to lesson & chord content (rule f — content lives in /data).
 */
import lessons from '../data/lessons.json';
import chords from '../data/chords.json';

export const STAGES = lessons.stages;
export const CHORDS = chords.chords;

const chordMap = new Map(CHORDS.map((c) => [c.id, c]));

export function getChord(id) {
  return chordMap.get(id);
}

export function allLessons() {
  return STAGES.flatMap((s) => s.lessons);
}
