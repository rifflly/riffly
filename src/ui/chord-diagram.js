/**
 * Renders a chord as an SVG diagram string.
 *
 * Strings are laid out low E (6th) → high E (1st). Left-handed mode (rule e)
 * mirrors the string order so the diagram matches a left-handed player's view —
 * we mirror by reversing which physical string each data index maps to, NOT by
 * flipping the whole SVG, so finger numbers stay upright and readable.
 *
 * Data shape (see /data/chords.json):
 *   frets:  number[6]  (-1 muted, 0 open, >0 fretted)
 *   fingers:number[6]  (0 none, 1 index … 4 pinky)
 *   baseFret: number   (1 for open chords)
 */

const STRINGS = 6;
const FRETS = 4;
const CELL_W = 20;
const CELL_H = 24;
const MARGIN_X = 18;
const MARGIN_TOP = 26;
const MARGIN_BOTTOM = 10;

export function chordDiagramSVG(chord, { mirror = false } = {}) {
  const boardW = CELL_W * (STRINGS - 1);
  const W = MARGIN_X * 2 + boardW;
  const H = MARGIN_TOP + CELL_H * FRETS + MARGIN_BOTTOM;
  const baseFret = chord.baseFret || 1;

  // x position for a given data string index (mirrored or not).
  const sx = (i) => MARGIN_X + (mirror ? STRINGS - 1 - i : i) * CELL_W;

  const topY = MARGIN_TOP;
  const botY = MARGIN_TOP + CELL_H * FRETS;
  const parts = [];

  // Fret lines (top line is the nut, drawn thick only in open position).
  for (let f = 0; f <= FRETS; f++) {
    const y = MARGIN_TOP + f * CELL_H;
    const thick = f === 0 && baseFret === 1 ? 3 : 1;
    parts.push(
      `<line x1="${MARGIN_X}" y1="${y}" x2="${MARGIN_X + boardW}" y2="${y}" stroke="var(--diagram-line)" stroke-width="${thick}" stroke-linecap="round"/>`
    );
  }

  // String lines (evenly spaced — symmetric, so unaffected by mirroring).
  for (let i = 0; i < STRINGS; i++) {
    const x = MARGIN_X + i * CELL_W;
    parts.push(
      `<line x1="${x}" y1="${topY}" x2="${x}" y2="${botY}" stroke="var(--diagram-line)" stroke-width="1"/>`
    );
  }

  // Base-fret label for chords played up the neck.
  if (baseFret > 1) {
    parts.push(
      `<text x="${MARGIN_X - 6}" y="${MARGIN_TOP + CELL_H * 0.7}" text-anchor="end" class="cd-fret">${baseFret}fr</text>`
    );
  }

  // Open/muted markers above the nut, and fretted dots with finger numbers.
  chord.frets.forEach((fret, i) => {
    const x = sx(i);
    if (fret < 0) {
      parts.push(`<text x="${x}" y="${MARGIN_TOP - 8}" text-anchor="middle" class="cd-x">×</text>`);
    } else if (fret === 0) {
      parts.push(
        `<circle cx="${x}" cy="${MARGIN_TOP - 11}" r="4" fill="none" stroke="var(--diagram-line)" stroke-width="1.5"/>`
      );
    } else {
      const rel = fret - (baseFret - 1);
      const cy = MARGIN_TOP + (rel - 0.5) * CELL_H;
      parts.push(`<circle cx="${x}" cy="${cy}" r="8" fill="var(--color-primary)"/>`);
      const finger = chord.fingers && chord.fingers[i];
      if (finger) {
        parts.push(
          `<text x="${x}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="cd-finger">${finger}</text>`
        );
      }
    }
  });

  const label = `${chord.longName || chord.name} chord diagram`;
  return (
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="chord-diagram" ` +
    `role="img" aria-label="${label}">${parts.join('')}</svg>`
  );
}
