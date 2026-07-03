/**
 * Generates placeholder Riffly PWA icons: a coral rounded square with a white "R".
 *
 * Zero dependencies — encodes PNGs by hand using Node's built-in zlib. Run with:
 *   npm run icons
 *
 * Outputs to /public/icons so Vite serves them at the site root.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CORAL = [232, 112, 90]; // #E8705A
const WHITE = [255, 255, 255];

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---- PNG encoding -------------------------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Drawing ------------------------------------------------------------

function insideRounded(px, py, size, r) {
  const minX = r, maxX = size - r, minY = r, maxY = size - r;
  let dx = 0, dy = 0;
  if (px < minX) dx = minX - px; else if (px > maxX) dx = px - maxX;
  if (py < minY) dy = minY - py; else if (py > maxY) dy = py - maxY;
  return dx * dx + dy * dy <= r * r;
}

// Blocky white "R" built from rectangles + a diagonal leg.
function isR(px, py, s) {
  const bx0 = 0.30 * s, bw = 0.40 * s;
  const by0 = 0.26 * s, bh = 0.48 * s, by1 = by0 + bh;
  const t = 0.11 * s;
  const bowlRight = bx0 + bw * 0.80;
  const mid = by0 + bh * 0.50;

  const inX = (a, b) => px >= a && px <= b;
  const inY = (a, b) => py >= a && py <= b;

  // Left vertical stem.
  if (inX(bx0, bx0 + t) && inY(by0, by1)) return true;
  // Top bar of the bowl.
  if (inY(by0, by0 + t) && inX(bx0, bowlRight)) return true;
  // Right edge of the bowl (upper half only).
  if (inX(bowlRight - t, bowlRight) && inY(by0, mid)) return true;
  // Bottom bar of the bowl.
  if (inY(mid - t / 2, mid + t / 2) && inX(bx0, bowlRight)) return true;
  // Diagonal leg from the bowl's midpoint down to the bottom-right.
  if (py >= mid && py <= by1) {
    const frac = (py - mid) / (by1 - mid);
    const legStartX = bx0 + bw * 0.34;
    const legEndX = bowlRight;
    const xc = legStartX + (legEndX - legStartX) * frac;
    if (px >= xc - t / 2 && px <= xc + t / 2) return true;
  }
  return false;
}

function drawIcon(size, { rounded }) {
  const rgba = new Uint8Array(size * size * 4); // transparent by default
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const bg = rounded ? insideRounded(px, py, size, r) : true;
      if (!bg) continue;
      const i = (y * size + x) * 4;
      const [rr, gg, bb] = isR(px, py, size) ? WHITE : CORAL;
      rgba[i] = rr;
      rgba[i + 1] = gg;
      rgba[i + 2] = bb;
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(size, rgba);
}

// ---- Emit ---------------------------------------------------------------

mkdirSync(outDir, { recursive: true });

const files = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  // Maskable + apple-touch: full-bleed square so the OS applies its own mask.
  ['icon-192-maskable.png', 192, { rounded: false }],
  ['icon-512-maskable.png', 512, { rounded: false }],
  ['apple-touch-icon.png', 180, { rounded: false }],
];

for (const [name, size, opts] of files) {
  writeFileSync(join(outDir, name), drawIcon(size, opts));
  console.log(`  ✓ ${name} (${size}×${size})`);
}
console.log('Icons written to public/icons/');
