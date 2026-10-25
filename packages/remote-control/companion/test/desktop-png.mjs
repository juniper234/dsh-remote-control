import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
const api = await import('../lib/desktop-png.mjs').catch(() => ({}));

test('encodes top-down GDI BGRA pixels as an opaque PNG with correct CRCs', () => {
  assert.equal(typeof api.encodeBgraPng, 'function');
  const bytes = api.encodeBgraPng(Buffer.from([0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 255, 255, 0]), 2, 2);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = []; let pos = 8;
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos); const type = bytes.toString('ascii', pos + 4, pos + 8); const data = bytes.subarray(pos + 8, pos + 8 + length);
    let crc = 0xffffffff;
    for (const value of bytes.subarray(pos + 4, pos + 8 + length)) { crc ^= value; for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
    assert.equal(bytes.readUInt32BE(pos + 8 + length), (crc ^ 0xffffffff) >>> 0);
    chunks.push({ type, data }); pos += length + 12;
  }
  assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'IDAT', 'IEND']);
  assert.deepEqual([...chunks[0].data], [0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0]);
  assert.deepEqual([...inflateSync(chunks[1].data)], [0, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 255, 255, 255, 255]);
});

test('rejects malformed or oversized frame allocations', () => {
  assert.equal(typeof api.encodeBgraPng, 'function');
  for (const [bytes, w, h] of [[Buffer.alloc(0), 2, 2], [Buffer.alloc(4), 0, 1], [Buffer.alloc(4), 1.5, 1], [Buffer.alloc(4), 100000, 100000]]) {
    assert.throws(() => api.encodeBgraPng(bytes, w, h), { code: 'INVALID_FRAME' });
  }
});
