import { deflateSync } from 'node:zlib';
import { desktopError } from './desktop-errors.mjs';

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function chunk(type, data) {
  const result = Buffer.allocUnsafe(data.length + 12);
  result.writeUInt32BE(data.length, 0); result.write(type, 4, 4, 'ascii'); data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, data.length + 8)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return result;
}

export function encodeBgraPng(bgra, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16_777_216 || !Buffer.isBuffer(bgra) || bgra.length !== width * height * 4) {
    throw desktopError('INVALID_FRAME', 'The desktop frame is invalid.');
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rowSize = width * 4 + 1; const raw = Buffer.allocUnsafe(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4; const dst = y * rowSize + x * 4 + 1;
      raw[dst] = bgra[src + 2]; raw[dst + 1] = bgra[src + 1]; raw[dst + 2] = bgra[src]; raw[dst + 3] = 255;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]);
}
