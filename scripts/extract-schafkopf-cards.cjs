const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const table = (() => {
  const values = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    values[n] = c >>> 0;
  }
  return values;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = table[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function decode(file) {
  const png = fs.readFileSync(file);
  let offset = 8, width, height, depth, color;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; color = data[9];
    } else if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (depth !== 8 || color !== 2) throw new Error('Expected 8-bit RGB PNG: ' + file);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 3, pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    const start = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[source++];
      const left = x >= 3 ? pixels[start + x - 3] : 0;
      const up = y ? pixels[start + x - stride] : 0;
      const upperLeft = y && x >= 3 ? pixels[start + x - stride - 3] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      } else if (filter !== 0) throw new Error('Unsupported PNG filter ' + filter);
      pixels[start + x] = (value + predictor) & 255;
    }
  }
  return { width, height, pixels };
}
function encodeCrop(image, x, y, width, height) {
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * image.width + x) * 3;
    image.pixels.copy(rows, row * (width * 3 + 1) + 1, from, from + width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

const [,, sheet, outputDir, columnsText] = process.argv;
const columns = Number(columnsText);
const image = decode(sheet);
if (image.width !== 1536 || image.height !== 1024 || ![8, 9].includes(columns)) throw new Error('Unexpected sheet dimensions or grid');
const suits = ['eichel', 'gras', 'herz', 'schellen'];
const ranks = ['7', '8', '9', '10', 'unter', 'ober', 'king', 'ace'];
const gridWidth = columns === 8 ? 1440 : image.width;
const cellWidth = gridWidth / columns;

function isDark(x, y) {
  const offset = (y * image.width + x) * 3;
  return image.pixels[offset] + image.pixels[offset + 1] + image.pixels[offset + 2] < 690;
}
function bestBorderLine(axis, start, end, from, to, takeLast) {
  const candidates = [];
  const segmentLength = to - from;
  for (let coordinate = Math.max(0, start); coordinate <= Math.min(axis === 'x' ? image.width - 1 : image.height - 1, end); coordinate++) {
    let dark = 0;
    for (let along = from; along < to; along++) {
      if (axis === 'x' ? isDark(coordinate, along) : isDark(along, coordinate)) dark++;
    }
    if (dark >= segmentLength * 0.84) candidates.push([coordinate, dark]);
  }
  if (!candidates.length) throw new Error(`Card border missing at ${axis} ${start}..${end}`);
  const maxScore = Math.max(...candidates.map(([, dark]) => dark));
  const best = candidates.filter(([, dark]) => dark >= maxScore - 2);
  return (takeLast ? best.at(-1) : best[0])[0];
}

fs.mkdirSync(outputDir, {recursive: true});
const baseColumns = [];
for (let col = 0; col < 8; col++) {
  const sheetCol = columns === 9 && col >= 6 ? col + 1 : col;
  const cellStart = Math.round(sheetCol * cellWidth);
  const cellEnd = Math.round((sheetCol + 1) * cellWidth);
  baseColumns.push([
    bestBorderLine('x', cellStart - 20, cellStart + 40, 40, 215, true),
    bestBorderLine('x', cellEnd - 45, cellEnd + 20, 40, 215, false),
  ]);
}
const baseRows = [];
for (let row = 0; row < 4; row++) {
  const [left, right] = baseColumns[0];
  baseRows.push([
    bestBorderLine('y', row * 256 - 10, row * 256 + 50, left + 12, right - 12, true),
    bestBorderLine('y', (row + 1) * 256 - 40, (row + 1) * 256 + 45, left + 12, right - 12, false),
  ]);
}
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 8; col++) {
    const sampleTop = row * 256 + 40;
    const sampleBottom = row * 256 + 215;
    const [baseLeft, baseRight] = baseColumns[col];
    const [baseTop, baseBottom] = baseRows[row];
    const left = bestBorderLine('x', baseLeft - 5, baseLeft + 5, sampleTop, sampleBottom, true);
    const right = bestBorderLine('x', baseRight - 5, baseRight + 5, sampleTop, sampleBottom, false);
    let top = baseTop;
    let bottom = baseBottom;
    try { top = bestBorderLine('y', baseTop - 5, baseTop + 5, left + 12, right - 12, true); } catch { /* The shared row border is still valid. */ }
    try { bottom = bestBorderLine('y', baseBottom - 5, baseBottom + 5, left + 12, right - 12, false); } catch { /* The shared row border is still valid. */ }
    const x0 = Math.max(0, left - 2);
    const y0 = Math.max(0, top - 2);
    const x1 = Math.min(image.width, right + 3);
    const y1 = Math.min(image.height, bottom + 3);
    if (x1 - x0 < 130 || y1 - y0 < 210) throw new Error(`Suspicious bounds for ${suits[row]}-${ranks[col]}: ${x0},${y0} ${x1},${y1}`);
    const output = path.join(outputDir, `${suits[row]}-${ranks[col]}.png`);
    fs.writeFileSync(output, encodeCrop(image, x0, y0, x1 - x0, y1 - y0));
    console.log(`${suits[row]}-${ranks[col]} ${x0},${y0} ${x1 - x0}x${y1 - y0}`);
  }
}
console.log(`Extracted 32 cards to ${outputDir}`);
