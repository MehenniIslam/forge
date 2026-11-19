// =============================================================
// make-icons.mjs — dessine l'icône de l'app (haltère vert sur fond sombre) en PNG.
// Utilisation (une seule fois, déjà fait) :  node tools/make-icons.mjs
// Aucune librairie nécessaire : encodeur PNG écrit à la main avec zlib (inclus dans Node).
// =============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- PNG ----
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Dessin (formes "distance signée", anti-crénelage par sur-échantillonnage) ----
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const LIME = hex('#b5f23d');
const TOP = hex('#1d2536');
const BOTTOM = hex('#0b0d12');

function roundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// haltère : barre + 2 disques de chaque côté (coordonnées de 0 à 1)
function dumbbell(x, y) {
  return Math.min(
    roundBox(x, y, 0.5, 0.5, 0.2, 0.032, 0.03),
    roundBox(x, y, 0.315, 0.5, 0.042, 0.19, 0.035),
    roundBox(x, y, 0.685, 0.5, 0.042, 0.19, 0.035),
    roundBox(x, y, 0.225, 0.5, 0.03, 0.13, 0.028),
    roundBox(x, y, 0.775, 0.5, 0.03, 0.13, 0.028),
  );
}
// barre de traction au-dessus
function spark(x, y) {
  return roundBox(x, y, 0.5, 0.27, 0.11, 0.018, 0.018);
}

function draw(size, scale = 1) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // fond : dégradé vertical + halo vert léger au centre
      const v = j / (size - 1);
      let col = TOP.map((t, k) => t + (BOTTOM[k] - t) * v);
      const dc = Math.hypot(i / size - 0.5, j / size - 0.5);
      const glow = Math.max(0, 0.32 - dc) * 0.35;
      col = col.map((c, k) => c + (LIME[k] - c) * glow);
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = 0.5 + ((i + (sx + 0.5) / SS) / size - 0.5) / scale;
          const y = 0.5 + ((j + (sy + 0.5) / SS) / size - 0.5) / scale;
          if (Math.min(dumbbell(x, y), spark(x, y + 0.5 - 0.5)) <= 0) cover++;
        }
      }
      const a = cover / (SS * SS);
      const o = (j * size + i) * 4;
      buf[o] = Math.round(col[0] + (LIME[0] - col[0]) * a);
      buf[o + 1] = Math.round(col[1] + (LIME[1] - col[1]) * a);
      buf[o + 2] = Math.round(col[2] + (LIME[2] - col[2]) * a);
      buf[o + 3] = 255;
    }
  }
  return png(size, size, buf);
}

const files = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.74], // contenu réduit : zone de sécurité Android
];
for (const [name, size, scale] of files) {
  writeFileSync(join(OUT, name), draw(size, scale));
  console.log('✓', name);
}
