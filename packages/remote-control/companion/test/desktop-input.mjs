import test from 'node:test';
import assert from 'node:assert/strict';

const api = await import('../lib/desktop-input.mjs').catch(() => ({}));
const monitors = [{ id: 'left', x: -1920, y: -200, width: 1920, height: 1080 }, { id: 'main', x: 0, y: 0, width: 1920, height: 1080, primary: true }];

test('rejects malformed input before the native boundary', () => {
  assert.equal(typeof api.validateInput, 'function');
  for (const value of [null, [], {}, { type: 'exec', command: 'anything' }, { type: 'move', x: NaN, y: 0 }, { type: 'move', x: 1000001, y: 0 }, { type: 'move', x: 1, y: 2, command: 'anything' }, { type: 'button', button: 'left', down: 1 }, { type: 'button', button: 'left', down: true, x: 1 }, { type: 'click', button: 'left', x: 0, y: 0, count: 3 }, { type: 'scroll', deltaX: Infinity, deltaY: 0 }, { type: 'key', key: 'LaunchApplication1', down: true }, { type: 'key', key: 'Control+a', down: true }, { type: 'text', text: 'a'.repeat(4097) }, { type: 'text', text: '\u0000' }, { type: 'text', text: '\ud800' }]) {
    assert.throws(() => api.validateInput(value), { code: 'INVALID_INPUT' });
  }
  assert.deepEqual(api.validateInput({ type: 'move', x: -1919.7, y: -199.8 }), { type: 'move', x: -1920, y: -200 });
});

test('validates capture limits and does not coerce arbitrary values', () => {
  assert.equal(typeof api.validateFrameRequest, 'function');
  assert.deepEqual(api.validateFrameRequest({}), { maxWidth: 1280 });
  assert.deepEqual(api.validateFrameRequest({ monitorId: 'left', maxWidth: 640 }), { monitorId: 'left', maxWidth: 640 });
  for (const value of [{ maxWidth: 0 }, { maxWidth: 4097 }, { maxWidth: '1280' }, { monitorId: '../bad' }, { unknown: true }]) {
    assert.throws(() => api.validateFrameRequest(value), { code: 'INVALID_INPUT' });
  }
});

function boundary() {
  const events = [];
  let count;
  return { events, setCount(value) { count = value; }, native: { assertAvailable() {}, monitors() { return monitors; }, sendInputs(batch) { const n = count === undefined ? batch.length : Math.min(count, batch.length); events.push(...batch.slice(0, n)); count = undefined; return n; } } };
}

test('maps negative monitor coordinates across the full physical desktop and rejects gaps', async () => {
  assert.equal(typeof api.createInputController, 'function');
  const b = boundary(); const c = api.createInputController(b.native);
  await c.input({ type: 'move', x: -1920, y: -200 });
  await c.input({ type: 'move', x: 1919, y: 1079 });
  assert.deepEqual(b.events, [{ kind: 'mouse', dx: 0, dy: 0, data: 0, flags: 0xc001 }, { kind: 'mouse', dx: 65535, dy: 65535, data: 0, flags: 0xc001 }]);
  await assert.rejects(() => c.input({ type: 'move', x: -1000, y: 1000 }), { code: 'INVALID_INPUT' });
  assert.equal(b.events.length, 2);
});

test('maps extended keys, Unicode surrogate pairs and browser scroll direction', async () => {
  assert.equal(typeof api.createInputController, 'function');
  const b = boundary(); const c = api.createInputController(b.native);
  await c.input({ type: 'key', key: 'ArrowLeft', down: true });
  await c.input({ type: 'key', key: 'ArrowLeft', down: false });
  await c.input({ type: 'text', text: 'A😀' });
  await c.input({ type: 'scroll', deltaX: 120, deltaY: 120 });
  assert.deepEqual(b.events, [
    { kind: 'key', vk: 37, scan: 0, flags: 1 }, { kind: 'key', vk: 37, scan: 0, flags: 3 },
    { kind: 'key', vk: 0, scan: 65, flags: 4 }, { kind: 'key', vk: 0, scan: 65, flags: 6 },
    { kind: 'key', vk: 0, scan: 55357, flags: 4 }, { kind: 'key', vk: 0, scan: 55357, flags: 6 },
    { kind: 'key', vk: 0, scan: 56832, flags: 4 }, { kind: 'key', vk: 0, scan: 56832, flags: 6 },
    { kind: 'mouse', dx: 0, dy: 0, data: -120, flags: 0x800 }, { kind: 'mouse', dx: 0, dy: 0, data: 120, flags: 0x1000 },
  ]);
});

test('releases only remotely held keys and buttons once, including key aliases', async () => {
  assert.equal(typeof api.createInputController, 'function');
  const b = boundary(); const c = api.createInputController(b.native);
  await c.input({ type: 'key', key: 'a', down: true });
  await c.input({ type: 'key', key: 'A', down: true });
  await c.input({ type: 'button', button: 'right', down: true });
  b.events.length = 0;
  await c.releaseAll(); await c.releaseAll();
  assert.deepEqual(b.events, [{ kind: 'mouse', dx: 0, dy: 0, data: 0, flags: 16 }, { kind: 'key', vk: 65, scan: 0, flags: 2 }]);
});

test('cleans a partially inserted click without replaying it', async () => {
  assert.equal(typeof api.createInputController, 'function');
  const b = boundary(); const c = api.createInputController(b.native);
  b.setCount(2);
  await assert.rejects(() => c.input({ type: 'click', button: 'left', x: 0, y: 0, count: 1 }), { code: 'INPUT_BLOCKED' });
  assert.equal(b.events.length, 3);
  assert.equal(b.events[1].flags, 2);
  assert.equal(b.events[2].flags, 4);
  b.events.length = 0; await c.releaseAll(); assert.equal(b.events.length, 0);
});

test('maps two clicks and rejects synthetic commands without sending anything', async () => {
  assert.equal(typeof api.createInputController, 'function');
  const b = boundary(); const c = api.createInputController(b.native);
  await c.input({ type: 'click', button: 'middle', x: 0, y: 0, count: 2 });
  assert.deepEqual(b.events.map(e => e.flags), [0xc001, 32, 64, 32, 64]);
  b.events.length = 0;
  await assert.rejects(() => c.input({ type: 'key', key: 'F13', down: true }), { code: 'INVALID_INPUT' });
  assert.equal(b.events.length, 0);
});
