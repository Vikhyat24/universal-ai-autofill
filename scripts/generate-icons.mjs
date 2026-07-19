/**
 * Generates the extension icons (purple rounded tile + white lightning bolt)
 * as PNGs without any image library — raw pixels + zlib + manual PNG chunks.
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---- PNG encoding helpers -------------------------------------------------

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // filter type 0 per scanline
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Drawing --------------------------------------------------------------

// Lightning bolt polygon in a 0..1 unit square.
const BOLT = [
  [0.58, 0.08], [0.28, 0.55], [0.46, 0.55], [0.40, 0.92], [0.72, 0.42], [0.52, 0.42],
];

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const SS = 4; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, bolt = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (x + (sx + 0.5) / SS) / size;
          const fy = (y + (sy + 0.5) / SS) / size;
          // rounded-rect test
          const px = fx * size, py = fy * size;
          const cx = Math.max(radius, Math.min(size - radius, px));
          const cy = Math.max(radius, Math.min(size - radius, py));
          const inRect = (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2 ||
            (px >= radius && px <= size - radius) || (py >= radius && py <= size - radius)
            ? ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) : false;
          if (inRect) {
            bg++;
            if (pointInPoly(fx, fy, BOLT)) bolt++;
          }
        }
      }
      const total = SS * SS;
      const i = (y * size + x) * 4;
      const bgA = bg / total;
      const boltA = bolt / total;
      // near-black tile with a subtle vertical gradient
      const t = y / size;
      const r1 = 0x1c, g1 = 0x1c, b1 = 0x1c;
      const r2 = 0x0d, g2 = 0x0d, b2 = 0x0d;
      let r = r1 + (r2 - r1) * t;
      let g = g1 + (g2 - g1) * t;
      let b = b1 + (b2 - b1) * t;
      // composite lime bolt (#91e63e) over the tile
      const br = 0x91, bg2 = 0xe6, bb = 0x3e;
      r = r * (1 - boltA / (bgA || 1)) + br * (boltA / (bgA || 1));
      g = g * (1 - boltA / (bgA || 1)) + bg2 * (boltA / (bgA || 1));
      b = b * (1 - boltA / (bgA || 1)) + bb * (boltA / (bgA || 1));
      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePng(size, size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size));
  console.log(`icons/icon-${size}.png`);
}
console.log('Done.');
