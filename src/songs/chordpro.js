/**
 * ChordPro (and two-line) importer + exporter (Phase 2 item 3).
 *
 * Handles two common ways people share chord sheets:
 *   1. Inline ChordPro:  "[G]Happy birthday to [D]you"
 *   2. Two-line:         chord names on a line, aligned by column, above the lyric
 *
 * Also reads {directives} like {title:}, {artist:}, {key:}, {tempo:}, {time:}.
 * Unknown chords are surfaced (never fatal) — this module stays free of app
 * imports so it can be unit-tested in plain Node.
 *
 * Output is a raw song object (run it through normalizeSong before use) plus the
 * de-duplicated list of chord names seen, so callers can flag ones not in the
 * chord library.
 */

// Permissive chord matcher: root, optional accidental, quality/extensions, bass.
const CHORD_RE =
  /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M)?[0-9]*(?:sus[0-9]|add[0-9]+)?(?:\/[A-G][#b]?)?$/;

function isChordToken(t) {
  return CHORD_RE.test(t);
}

function isDirective(line) {
  return /^\s*\{.*\}\s*$/.test(line);
}

/** A line is a "chord line" if every whitespace-separated token looks like a chord. */
function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(isChordToken);
}

function applyDirective(song, raw) {
  const m = raw.match(/^\s*\{\s*([^:}]+?)\s*(?::\s*([\s\S]*?))?\s*\}\s*$/);
  if (!m) return;
  const name = m[1].toLowerCase();
  const value = (m[2] || '').trim();
  if (name === 'title' || name === 't') song.title = value;
  else if (name === 'artist' || name === 'subtitle' || name === 'st') song.artist = value;
  else if (name === 'key') song.key = value;
  else if (name === 'tempo' || name === 'bpm') {
    const n = parseInt(value, 10);
    if (n > 0) song.bpm = n;
  } else if (name === 'time') song.timeSignature = value;
  // comments and unrecognised directives are ignored
}

/** Parse one inline line ("[G]Happy [D]days") → { lyrics, chords }. */
function parseInlineLine(text) {
  const chords = [];
  let lyrics = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const end = text.indexOf(']', i);
      if (end === -1) {
        lyrics += text.slice(i);
        break;
      }
      const chord = text.slice(i + 1, end).trim();
      if (chord) chords.push({ chord, position: lyrics.length });
      i = end + 1;
    } else {
      lyrics += text[i];
      i += 1;
    }
  }
  return { lyrics: lyrics.replace(/\s+$/, ''), chords };
}

/** Combine a chord line above a lyric line, aligning chords by column. */
function combineTwoLine(chordLine, lyricLine) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine))) {
    chords.push({ chord: m[0], position: Math.min(m.index, lyricLine.length) });
  }
  return { lyrics: lyricLine.replace(/\s+$/, ''), chords };
}

function trimBlankEdges(lines) {
  const isBlank = (l) => !l.lyrics && (!l.chords || l.chords.length === 0);
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start])) start += 1;
  while (end > start && isBlank(lines[end - 1])) end -= 1;
  return lines.slice(start, end);
}

/**
 * Parse ChordPro / two-line text into a raw song + the chord names used.
 * @returns {{ song: object, chords: string[] }}
 */
export function parseChordPro(text) {
  const raw = String(text).replace(/\r\n?/g, '\n').split('\n');
  const song = { title: '', artist: '', key: '', lines: [] };
  const lines = [];

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (isDirective(line)) {
      applyDirective(song, line);
      continue;
    }
    if (line.includes('[')) {
      lines.push(parseInlineLine(line));
      continue;
    }
    const next = raw[i + 1];
    if (
      isChordLine(line) &&
      next != null &&
      next.trim() !== '' &&
      !next.includes('[') &&
      !isDirective(next) &&
      !isChordLine(next)
    ) {
      lines.push(combineTwoLine(line, next));
      i += 1; // consume the lyric line
      continue;
    }
    lines.push({ lyrics: line.replace(/\s+$/, ''), chords: [] });
  }

  song.lines = trimBlankEdges(lines);
  const chords = [...new Set(song.lines.flatMap((l) => l.chords.map((c) => c.chord)))];
  return { song, chords };
}

/** Render one line back to inline ChordPro. */
function lineToChordPro(line) {
  const lyrics = line.lyrics || '';
  const chords = [...(line.chords || [])].sort((a, b) => a.position - b.position);
  if (!chords.length) return lyrics;
  let out = '';
  let last = 0;
  for (const c of chords) {
    const pos = Math.max(0, Math.min(c.position, lyrics.length));
    out += lyrics.slice(last, pos) + `[${c.chord}]`;
    last = pos;
  }
  return out + lyrics.slice(last);
}

/** Serialize a song to ChordPro text (round-trips with parseChordPro). */
export function songToChordPro(song) {
  const out = [];
  if (song.title) out.push(`{title: ${song.title}}`);
  if (song.artist) out.push(`{artist: ${song.artist}}`);
  if (song.key) out.push(`{key: ${song.key}}`);
  if (song.bpm) out.push(`{tempo: ${song.bpm}}`);
  if (song.timeSignature) out.push(`{time: ${song.timeSignature}}`);
  out.push('');
  for (const line of song.lines) out.push(lineToChordPro(line));
  return out.join('\n');
}
