// One-off script to hand-build PWA icon PNGs without adding image-processing deps.
// Run with: node scripts/generate-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

const BG = [0x63, 0x66, 0xf1]; // #6366f1
const FG = [0xff, 0xff, 0xff]; // white

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

// Draw a simple "F" mark centered in the icon, on a solid background.
// `padFrac` reserves a safe-zone border (used for maskable icons).
function buildPixels(size, padFrac = 0) {
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            pixels[i] = BG[0];
            pixels[i + 1] = BG[1];
            pixels[i + 2] = BG[2];
            pixels[i + 3] = 0xff;
        }
    }

    const pad = size * (0.28 + padFrac);
    const left = pad;
    const top = pad;
    const right = size - pad;
    const bottom = size - pad;
    const w = right - left;
    const h = bottom - top;

    const stroke = Math.max(2, Math.round(w * 0.22));

    // Vertical bar of the "F"
    const vBarRight = left + stroke;
    // Top horizontal bar
    const topBarBottom = top + stroke;
    // Middle horizontal bar (shorter)
    const midBarTop = top + h * 0.42;
    const midBarBottom = midBarTop + stroke;
    const midBarRight = left + w * 0.75;

    for (let y = Math.round(top); y < Math.round(bottom); y++) {
        for (let x = Math.round(left); x < Math.round(right); x++) {
            let isFg = false;
            if (x < vBarRight) isFg = true;
            else if (y < topBarBottom) isFg = true;
            else if (y >= midBarTop && y < midBarBottom && x < midBarRight) isFg = true;

            if (isFg) {
                const i = (y * size + x) * 4;
                pixels[i] = FG[0];
                pixels[i + 1] = FG[1];
                pixels[i + 2] = FG[2];
                pixels[i + 3] = 0xff;
            }
        }
    }

    return pixels;
}

function encodePNG(size, pixels) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); // width
    ihdr.writeUInt32BE(size, 4); // height
    ihdr.writeUInt8(8, 8); // bit depth
    ihdr.writeUInt8(6, 9); // color type RGBA
    ihdr.writeUInt8(0, 10); // compression
    ihdr.writeUInt8(0, 11); // filter
    ihdr.writeUInt8(0, 12); // interlace

    // Raw scanlines: 1 filter-type byte (0 = none) + RGBA bytes per row
    const rowSize = size * 4;
    const raw = Buffer.alloc((rowSize + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (rowSize + 1)] = 0;
        pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
    }

    const idatData = deflateSync(raw, { level: 9 });

    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return Buffer.concat([
        signature,
        chunk("IHDR", ihdr),
        chunk("IDAT", idatData),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
    { name: "icon-192.png", size: 192, padFrac: 0 },
    { name: "icon-512.png", size: 512, padFrac: 0 },
    { name: "apple-touch-icon.png", size: 180, padFrac: 0 },
    { name: "icon-maskable-512.png", size: 512, padFrac: 0.12 },
];

for (const { name, size, padFrac } of targets) {
    const pixels = buildPixels(size, padFrac);
    const png = encodePNG(size, pixels);
    writeFileSync(join(OUT_DIR, name), png);
    console.log(`Wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}
