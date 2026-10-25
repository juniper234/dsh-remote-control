import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EventEmitter, once } from 'node:events';
const api = await import('../lib/desktop-backend.mjs').catch(() => ({}));
const helperPath = fileURLToPath(new URL('./desktop-helper-fixture.mjs', import.meta.url));

test('keeps one isolated helper alive and restores PNG bytes after IPC', async t => {
  assert.equal(typeof api.createDesktopBackend, 'function');
  const children = [];
  const backend = api.createDesktopBackend({ forkHelper(path, _args, options) { const child = fork(path, ['--desktop-fixture'], options); children.push(child); return child; }, helperPath });
  t.after(() => backend.dispose());
  const first = await backend.monitors(); const second = await backend.monitors();
  assert.equal(first.available, true); assert.equal(second.monitors[0].x, -100); assert.equal(children.length, 1);
  const frame = await backend.frame({ maxWidth: 100 });
  assert(Buffer.isBuffer(frame.bytes)); assert.equal(frame.bytes.readUInt32BE(16), 100); assert.equal(frame.width, 100); assert.equal(frame.height, 50);
  await backend.releaseAll(); await backend.dispose();
  assert(children[0].exitCode !== null || children[0].signalCode !== null);
  await assert.rejects(() => backend.frame({}), { code: 'DESKTOP_DISPOSED' });
});

test('rejects invalid input before starting a native helper', async () => {
  assert.equal(typeof api.createDesktopBackend, 'function');
  const backend = api.createDesktopBackend({ forkHelper() { assert.fail('invalid input started helper'); } });
  await assert.rejects(() => backend.input({ type: 'text', text: '\u0000' }), { code: 'INVALID_INPUT' });
  await assert.rejects(() => backend.frame({ maxWidth: '1280' }), { code: 'INVALID_INPUT' });
  await backend.dispose();
});

test('helper timeout fails closed and never automatically replays an input request', async t => {
  assert.equal(typeof api.createDesktopBackend, 'function');
  let children = 0;
  const backend = api.createDesktopBackend({ timeoutMs: 200, helperPath, forkHelper(path, _args, options) { children++; return fork(path, ['--desktop-fixture', '--hang'], options); } });
  t.after(() => backend.dispose());
  await assert.rejects(() => backend.input({ type: 'move', x: 0, y: 0 }), { code: 'HELPER_UNAVAILABLE' });
  assert.equal(backend.failed, true, 'the companion must be able to identify a failed helper');
  await assert.rejects(() => backend.input({ type: 'key', key: 'a', down: true }), { code: 'HELPER_UNAVAILABLE' });
  assert.equal(children, 1);
});

test('dispose waits for forced helper termination before a replacement can start', async () => {
  const child = new EventEmitter();
  Object.assign(child, { connected: true, exitCode: null, signalCode: null,
    send(message, callback) { queueMicrotask(() => { child.emit('message', { id: message.id, ok: true, value: { monitors: [], available: true } }); callback?.(); }); },
    disconnect() { child.connected = false; },
    kill() { setTimeout(() => { child.exitCode = 0; child.emit('exit', 0, null); }, 20); return true; }
  });
  const backend = api.createDesktopBackend({ forkHelper() { queueMicrotask(() => child.emit('message', { type: 'ready' })); return child; } });
  await backend.monitors();
  await backend.dispose();
  assert.equal(child.exitCode, 0, 'dispose must wait beyond sending the termination signal');
});

test('a timed-out helper gets time to release its held inputs before termination', async t => {
  assert.equal(typeof api.createDesktopBackend, 'function');
  let child; let output = '';
  const backend = api.createDesktopBackend({ timeoutMs: 200, helperPath, forkHelper(path, _args, options) {
    child = fork(path, ['--desktop-fixture', '--hang'], { ...options, stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
    child.stdout.on('data', data => { output += data; });
    return child;
  } });
  t.after(() => backend.dispose());
  await backend.input({ type: 'key', key: 'Control', down: true });
  const exited = once(child, 'exit');
  await assert.rejects(() => backend.frame({}), { code: 'HELPER_UNAVAILABLE' });
  await exited;
  const events = output.trim().split('\n').flatMap(line => JSON.parse(line));
  assert.deepEqual(events.map(event => [event.vk, event.flags]), [[17, 0], [17, 2]]);
});

test('disposing the backend releases held buttons and modifiers before child exit', async t => {
  assert.equal(typeof api.createDesktopBackend, 'function');
  let output = '';
  const backend = api.createDesktopBackend({ helperPath, forkHelper(path, _args, options) {
    const child = fork(path, ['--desktop-fixture'], { ...options, stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
    child.stdout.on('data', data => { output += data; }); return child;
  } });
  t.after(() => backend.dispose());
  await backend.input({ type: 'key', key: 'Alt', down: true });
  await backend.input({ type: 'button', button: 'left', down: true });
  await backend.dispose();
  assert.deepEqual(output.trim().split('\n').flatMap(line => JSON.parse(line)).map(event => event.flags), [0, 2, 4, 2]);
});
