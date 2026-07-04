/**
 * Song model + ChordPro parser tests (no browser needed).
 * Run via `npm test`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseChordPro, songToChordPro } from '../src/songs/chordpro.js';
import { normalizeSong } from '../src/songs/song-model.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data', 'songs');

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}`);
  }
}

console.log('ChordPro inline parsing');
{
  const { song } = parseChordPro('[G]Happy birthday to [D]you');
  const line = song.lines[0];
  ok(line.lyrics === 'Happy birthday to you', 'strips brackets from lyrics');
  ok(line.chords.length === 2, 'finds two chords');
  ok(line.chords[0].chord === 'G' && line.chords[0].position === 0, 'G lands at position 0');
  ok(line.chords[1].chord === 'D' && line.chords[1].position === 18, 'D lands at position 18');
}

console.log('\nTwo-line (chords above lyrics) parsing');
{
  const text = 'G           C\nAmazing grace how sweet';
  const { song } = parseChordPro(text);
  ok(song.lines.length === 1, 'collapses the two rows into one line');
  const line = song.lines[0];
  ok(line.lyrics === 'Amazing grace how sweet', 'keeps the lyric row');
  ok(line.chords[0].chord === 'G' && line.chords[0].position === 0, 'G aligned to column 0');
  ok(line.chords[1].chord === 'C' && line.chords[1].position === 12, 'C aligned to column 12');
}

console.log('\nDirectives');
{
  const { song } = parseChordPro('{title: Test Song}\n{tempo: 120}\n{time: 3/4}\n[C]Hello');
  ok(song.title === 'Test Song', 'reads {title}');
  ok(song.bpm === 120, 'reads {tempo}');
  ok(song.timeSignature === '3/4', 'reads {time}');
}

console.log('\nUnknown chords are surfaced, not fatal');
{
  const { song, chords } = parseChordPro('[Bmaj7]Fancy [G]plain');
  ok(chords.includes('Bmaj7'), 'reports the used chord names');
  ok(song.lines[0].chords.length === 2, 'still parses the line');
}

console.log('\nStarter songs: positions in bounds + ChordPro round-trip');
for (const file of ['happy-birthday.json', 'amazing-grace.json', 'clementine.json']) {
  const raw = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  const song = normalizeSong(raw);

  let inBounds = true;
  for (const line of song.lines) {
    for (const c of line.chords) {
      if (c.position > line.lyrics.length) inBounds = false;
    }
  }
  ok(inBounds, `${raw.title}: every chord sits within its lyric line`);

  const text1 = songToChordPro(song);
  const song2 = normalizeSong(parseChordPro(text1).song);
  const text2 = songToChordPro(song2);
  ok(text1 === text2, `${raw.title}: import round-trips exactly`);

  const sameLines =
    song.lines.length === song2.lines.length &&
    song.lines.every(
      (l, i) =>
        l.lyrics === song2.lines[i].lyrics &&
        l.chords.length === song2.lines[i].chords.length &&
        l.chords.every(
          (c, j) => c.chord === song2.lines[i].chords[j].chord && c.position === song2.lines[i].chords[j].position
        )
    );
  ok(sameLines, `${raw.title}: lines + chords preserved`);
}

console.log(`\n${fail ? '✗' : '✓'} songs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
