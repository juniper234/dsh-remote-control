import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createDesktopBackend } from '../lib/desktop-backend.mjs';

test('read-only Win32 smoke: enumerates physical monitors and captures a scaled PNG', { skip: process.env.DSH_NATIVE_CAPTURE_SMOKE !== '1' }, async t => {
  assert.equal(process.platform, 'win32');
  const koffiPath = process.env.DSH_REMOTE_KOFFI_PATH || join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar.unpacked', 'dsh', 'node_modules', 'koffi');
  const backend = createDesktopBackend({ koffiPath, execPath: process.env.DSH_REMOTE_EXEC_PATH });
  t.after(() => backend.dispose());
  const state = await backend.monitors();
  assert.equal(state.available, true, state.reason);
  assert(state.monitors.length > 0);
  for (const monitor of state.monitors) {
    assert(Number.isInteger(monitor.x)); assert(Number.isInteger(monitor.y));
    assert(monitor.width > 0); assert(monitor.height > 0); assert.equal(typeof monitor.primary, 'boolean');
  }
  const monitor = state.monitors.find(m => m.primary) || state.monitors[0];
  const frame = await backend.frame({ monitorId: monitor.id, maxWidth: 640 });
  assert.equal(frame.contentType, 'image/png'); assert.equal(frame.width, Math.min(640, monitor.width));
  assert.equal(frame.height, Math.max(1, Math.round(monitor.height * frame.width / monitor.width)));
  assert.equal(frame.x, monitor.x); assert.equal(frame.y, monitor.y);
  assert.equal(frame.bytes.readUInt32BE(16), frame.width); assert.equal(frame.bytes.readUInt32BE(20), frame.height);
  assert.equal(frame.bytes.toString('ascii', 12, 16), 'IHDR');
  t.diagnostic(`Read-only native capture: ${state.monitors.length} monitor(s), ${frame.width}x${frame.height}, ${frame.bytes.length} PNG bytes.`);
});
