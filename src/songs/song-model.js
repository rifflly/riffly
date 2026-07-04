/**
 * Song-sheet data model (Phase 2 item 3).
 *
 * A songSheet is:
 *   { id, title, artist?, bpm, timeSignature, key?, barsPerLine, source,
 *     createdAt?, modifiedAt?,
 *     lines: [ { lyrics?, chords: [{chord, position}], tab?, timeSec? } ] }
 *
 * `position` is the character index in the lyric line where the chord lands.
 * `timeSec` is optional (Phase 3 tap-along); until then each line's duration is
 * computed from the tempo and how many bars the line spans — a song-level
 * `barsPerLine` default with an optional per-line `bars` override.
 */

export const DEFAULT_BPM = 90;
export const DEFAULT_TIME_SIGNATURE = '4/4';
export const DEFAULT_BARS_PER_LINE = 2;

/** Beats in one bar, from the time signature's top number. */
export function beatsPerBar(song) {
  const top = Number(String(song.timeSignature || DEFAULT_TIME_SIGNATURE).split('/')[0]);
  return top > 0 ? top : 4;
}

/** How many bars a given line spans (per-line override, else song default). */
export function lineBars(song, line) {
  return line && line.bars > 0 ? line.bars : song.barsPerLine || DEFAULT_BARS_PER_LINE;
}

/** How long a line lasts in seconds at the song's tempo (used by the studio). */
export function lineDurationSec(song, line) {
  const secondsPerBeat = 60 / (song.bpm || DEFAULT_BPM);
  return lineBars(song, line) * beatsPerBar(song) * secondsPerBeat;
}

/** Total playing time of the song in seconds. */
export function songDurationSec(song) {
  return song.lines.reduce((sum, line) => sum + lineDurationSec(song, line), 0);
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `song-${crypto.randomUUID()}`;
  return `song-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyLine() {
  return { lyrics: '', chords: [] };
}

export function emptySong() {
  return {
    id: null,
    title: '',
    artist: '',
    bpm: DEFAULT_BPM,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    key: '',
    barsPerLine: DEFAULT_BARS_PER_LINE,
    source: 'user',
    lines: [emptyLine()],
  };
}

function normalizeLine(line) {
  const chords = Array.isArray(line.chords) ? line.chords : [];
  return {
    lyrics: typeof line.lyrics === 'string' ? line.lyrics : '',
    chords: chords
      .filter((c) => c && c.chord)
      .map((c) => ({ chord: String(c.chord), position: Math.max(0, Math.round(c.position || 0)) }))
      .sort((a, b) => a.position - b.position),
    ...(line.bars > 0 ? { bars: Math.round(line.bars) } : {}),
    ...(typeof line.tab === 'string' ? { tab: line.tab } : {}),
    ...(typeof line.timeSec === 'number' ? { timeSec: line.timeSec } : {}),
  };
}

/** Fill in defaults and clean up a raw song object so the rest of the app can trust it. */
export function normalizeSong(raw = {}) {
  const lines = Array.isArray(raw.lines) && raw.lines.length ? raw.lines : [emptyLine()];
  return {
    id: raw.id || newId(),
    title: (raw.title || '').trim(),
    artist: (raw.artist || '').trim(),
    bpm: raw.bpm > 0 ? Math.round(raw.bpm) : DEFAULT_BPM,
    timeSignature: raw.timeSignature || DEFAULT_TIME_SIGNATURE,
    key: (raw.key || '').trim(),
    barsPerLine: raw.barsPerLine > 0 ? Math.round(raw.barsPerLine) : DEFAULT_BARS_PER_LINE,
    source: raw.source === 'starter' ? 'starter' : 'user',
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    lines: lines.map(normalizeLine),
  };
}
