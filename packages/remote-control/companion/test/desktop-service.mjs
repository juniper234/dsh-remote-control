import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../lib/desktop-service.mjs').catch(() => ({}));
const monitors = [{ id: 'left', name: 'Left', x: -1920, y: -100, width: 1920, height: 1080, primary: false }, { id: 'main', name: 'Main', x: 0, y: 0, width: 2560, height: 1440, primary: true }];

test('scales the selected monitor while keeping absolute physical coordinates', async () => {
  assert.equal(typeof api.createDesktopService, 'function');
  const captured = [];
  const service = api.createDesktopService({ assertAvailable() {}, monitors() { return monitors; }, capture(monitor, size) { captured.push({ id: monitor.id, ...size }); return Buffer.alloc(size.width * size.height * 4); }, sendInputs() { throw new Error('No input allowed in capture test'); }, dispose() {} });
  const selected = await service.frame({ monitorId: 'left', maxWidth: 640 });
  assert.deepEqual(captured, [{ id: 'left', width: 640, height: 360 }]);
  assert.deepEqual({ width: selected.width, height: selected.height, x: selected.x, y: selected.y, monitorId: selected.monitorId, type: selected.contentType }, { width: 640, height: 360, x: -1920, y: -100, monitorId: 'left', type: 'image/png' });
  assert(Buffer.isBuffer(selected.bytes)); assert(selected.capturedAt > 0);
  const primary = await service.frame({ maxWidth: 4096 });
  assert.equal(primary.width, 2560); assert.equal(primary.height, 1440);
  await assert.rejects(() => service.frame({ monitorId: 'missing' }), { code: 'MONITOR_NOT_FOUND' });
});

test('reports an unavailable desktop without returning fabricated pixels or native errors', async () => {
  assert.equal(typeof api.createDesktopService, 'function');
  const service = api.createDesktopService({ assertAvailable() { throw Object.assign(new Error('private native details'), { code: 'DESKTOP_UNAVAILABLE' }); }, monitors() { throw new Error('must not enumerate locked desktop'); }, dispose() {} });
  const state = await service.monitors();
  assert.equal(state.available, false); assert.deepEqual(state.monitors, []); assert(!state.reason.includes('private'));
  await assert.rejects(() => service.frame({}), { code: 'DESKTOP_UNAVAILABLE' });
});

test('dispose releases tracked inputs before unloading the native boundary and prevents reuse', async () => {
  assert.equal(typeof api.createDesktopService, 'function');
  const actions = [];
  const service = api.createDesktopService({ assertAvailable() {}, monitors() { return monitors; }, sendInputs(events) { actions.push(events.map(e => e.flags)); return events.length; }, dispose() { actions.push('disposed'); } });
  await service.input({ type: 'key', key: 'Control', down: true });
  await service.dispose(); await service.dispose();
  assert.deepEqual(actions, [[0], [2], 'disposed']);
  await assert.rejects(() => service.input({ type: 'key', key: 'a', down: true }), { code: 'DESKTOP_DISPOSED' });
});
