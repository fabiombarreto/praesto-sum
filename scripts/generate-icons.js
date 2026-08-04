/**
 * Generates every PWA icon in public/icons/ from the single vector definition
 * below — the same geometry as public/favicon.svg.
 *
 * Zero dependencies on purpose: this machine has no rasterizer (no ImageMagick,
 * no Pillow, no cairosvg) and ADR-0005 forbids incidental dependencies, so the
 * PNGs are rasterized and encoded here with nothing but node:zlib.
 *
 * Run: node scripts/generate-icons.js
 *
 * The mark is a plumb bob ("fio de prumo"): the tool that answers "is this
 * straight?" with no opinion of its own — Praesto Sum, ready and exact.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// --- Palette --------------------------------------------------------------
// Background matches theme_color/background_color in public/manifest.webmanifest.
const BACKGROUND = [0x0b, 0x0b, 0x0c];
const CORD = [0x9a, 0xa1, 0xab];
const BOB_TOP = [0xf2, 0xd0, 0x8a];
const BOB_TIP = [0xb5, 0x7f, 0x23];
const WHITE = [0xff, 0xff, 0xff];

// --- Geometry (normalized 0..1 over the icon's content box) ---------------
const CORD_TOP = 0.1;
// Wide enough to survive the 72px badge and a ~60px home-screen render: the cord
// is what stops the mark from reading as a map pin.
const CORD_HALF = 0.013;
const COLLAR_TOP = 0.285;
const COLLAR_TOP_HALF = 0.035;
const COLLAR_BOTTOM = 0.345;
const COLLAR_BOTTOM_HALF = 0.055;
const SHOULDER_Y = 0.5;
const SHOULDER_HALF = 0.16;
const TIP_Y = 0.86;

/** Half-width of the mark at height `y`, or -1 where the mark is absent. */
function halfWidthAt(y) {
  if (y < CORD_TOP || y > TIP_Y) return -1;
  if (y < COLLAR_TOP) return CORD_HALF;
  if (y < COLLAR_BOTTOM) {
    const t = (y - COLLAR_TOP) / (COLLAR_BOTTOM - COLLAR_TOP);
    return COLLAR_TOP_HALF + (COLLAR_BOTTOM_HALF - COLLAR_TOP_HALF) * t;
  }
  if (y <= SHOULDER_Y) {
    // Quarter ellipse from the collar out to the widest point. A smoothstep here
    // meets the taper at a hard corner and renders as a faceted gem instead of a
    // turned brass body.
    const t = (SHOULDER_Y - y) / (SHOULDER_Y - COLLAR_BOTTOM);
    return COLLAR_BOTTOM_HALF + (SHOULDER_HALF - COLLAR_BOTTOM_HALF) * Math.sqrt(1 - t * t);
  }
  // Straight taper to the point.
  return SHOULDER_HALF * ((TIP_Y - y) / (TIP_Y - SHOULDER_Y));
}

function markColorAt(y, monochrome) {
  if (monochrome) return WHITE;
  if (y < COLLAR_TOP) return CORD;
  const t = Math.min(1, Math.max(0, (y - COLLAR_TOP) / (TIP_Y - COLLAR_TOP)));
  return [
    Math.round(BOB_TOP[0] + (BOB_TIP[0] - BOB_TOP[0]) * t),
    Math.round(BOB_TOP[1] + (BOB_TIP[1] - BOB_TOP[1]) * t),
    Math.round(BOB_TOP[2] + (BOB_TIP[2] - BOB_TOP[2]) * t),
  ];
}

/** Signed distance to a rounded square covering the whole canvas. */
function roundedSquareSdf(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius);
  const qy = Math.abs(y - 0.5) - (0.5 - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

// --- Rasterizer -----------------------------------------------------------
const SUPERSAMPLE = 4;

/**
 * @param {object} spec
 * @param {number} spec.size          pixel width and height
 * @param {"rounded"|"square"|"none"} spec.background
 * @param {number} spec.contentScale  mark size relative to the canvas (maskable safe zone)
 * @param {boolean} [spec.monochrome] flat white mark, for the notification badge
 */
function rasterize({ size, background, contentScale, monochrome = false }) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const cornerRadius = background === "rounded" ? 0.22 : 0;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;

          let sampleR = 0;
          let sampleG = 0;
          let sampleB = 0;
          let sampleA = 0;

          if (background !== "none") {
            const inside = background === "square" || roundedSquareSdf(x, y, cornerRadius) <= 0;
            if (inside) {
              [sampleR, sampleG, sampleB] = BACKGROUND;
              sampleA = 1;
            }
          }

          // The mark is drawn in content space: scaled about the canvas centre so
          // maskable icons keep every pixel inside the platform's safe circle.
          const cx = 0.5 + (x - 0.5) / contentScale;
          const cy = 0.5 + (y - 0.5) / contentScale;
          const halfWidth = halfWidthAt(cy);
          if (halfWidth >= 0 && Math.abs(cx - 0.5) <= halfWidth) {
            [sampleR, sampleG, sampleB] = markColorAt(cy, monochrome);
            sampleA = 1;
          }

          r += sampleR * sampleA;
          g += sampleG * sampleA;
          b += sampleB * sampleA;
          a += sampleA;
        }
      }

      const offset = (py * size + px) * 4;
      if (a === 0) continue;
      // Accumulated premultiplied; divide by coverage to get straight alpha.
      pixels[offset] = Math.round(r / a);
      pixels[offset + 1] = Math.round(g / a);
      pixels[offset + 2] = Math.round(b / a);
      pixels[offset + 3] = Math.round((a / samples) * 255);
    }
  }

  return pixels;
}

// --- Minimal PNG encoder (RGBA8, no interlace) ----------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4;
  // One filter byte (0 = None) per scanline, as the PNG spec requires.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Outputs --------------------------------------------------------------
const ICONS = [
  // Referenced by public/manifest.webmanifest.
  { file: "icon-192.png", size: 192, background: "rounded", contentScale: 1 },
  { file: "icon-512.png", size: 512, background: "rounded", contentScale: 1 },
  // purpose: maskable — content must survive Android's circular crop, so it is
  // scaled into the central 80% safe zone and the background bleeds to the edge.
  { file: "maskable-512.png", size: 512, background: "square", contentScale: 0.8 },
  // iOS masks the corners itself; a square, full-bleed icon is what it expects.
  { file: "apple-touch-icon-180.png", size: 180, background: "square", contentScale: 0.92 },
  // Referenced by src/sw.ts: Android tints the badge, so it must be a flat white
  // silhouette on transparency.
  {
    file: "badge-72.png",
    size: 72,
    background: "none",
    contentScale: 0.95,
    monochrome: true,
  },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const icon of ICONS) {
  const png = encodePng(icon.size, rasterize(icon));
  writeFileSync(join(OUT_DIR, icon.file), png);
  console.log(`${icon.file.padEnd(26)} ${icon.size}x${icon.size}  ${png.length} bytes`);
}
