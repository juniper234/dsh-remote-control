import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TunnelManager, verifyTunnelExecutable, CLOUDFLARED_SHA256 } from '../lib/tunnel.js';
import { serveTunnelWorker, parseQuickTunnelOutput } from '../lib/tunnel-worker.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
async function eventually(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); }
  assert.fail('Expected lifecycle event did not arrive.');
}

class FakeWorker extends EventEmitter {
  constructor() { super(); this.connected = true; this.messages = []; this.exitCode = null; this.signalCode = null; }
  send(value, callback) { this.messages.push(value); callback?.(); }
  disconnect() { this.connected = false; this.disconnected = true; queueMicrotask(() => { this.exitCode = 0; this.emit('exit', 0); }); }
}
class FakeChannel extends EventEmitter {
  constructor() { super(); this.connected = true; this.messages = []; }
  send(value, callback) { this.messages.push(value); callback?.(); }
  disconnect() { this.connected = false; this.emit('disconnect'); }
}
class FakeCloudflare extends EventEmitter {
  constructor() { super(); this.stdout = new EventEmitter(); this.stderr = new EventEmitter(); this.exitCode = null; this.signalCode = null; this.kills = 0; this.pid = 42; }
  kill() { this.kills++; this.signalCode = 'SIGTERM'; queueMicrotask(() => this.emit('exit', null, 'SIGTERM')); return true; }
}

async function managerFixture(t, overrides = {}) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-tunnel-'));
  const spawned = [];
  const manager = new TunnelManager({ home, platform: 'win32', verifyExecutable: async () => {},
    forkImpl: (...args) => { const child = new FakeWorker(); spawned.push({ child, args }); return child; }, ...overrides });
  t.after(async () => { await manager.dispose().catch(() => {}); await rm(home, { recursive: true, force: true }); });
  return { manager, spawned, home };
}

test('tunnel verifies exact executable hash and rejects missing/modified files without leaking paths', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-tunnel-hash-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'private-location.exe');
  const bytes = Buffer.from('harmless fixture'); await writeFile(file, bytes);
  await verifyTunnelExecutable(file, createHash('sha256').update(bytes).digest('hex'));
  await assert.rejects(verifyTunnelExecutable(file), error => error.code === 'network/helper-integrity' && !error.message.includes(dir));
  await assert.rejects(verifyTunnelExecutable(join(dir, 'missing')), error => error.code === 'network/helper-missing' && !error.message.includes(dir));
});

test('start coalesces, verifies before fork, and config uses dedicated empty file and loopback port', async t => {
  let verified = false;
  const { manager, spawned, home } = await managerFixture(t, { verifyExecutable: async () => { verified = true; } });
  const a = manager.start({ port: 8099 }), b = manager.start({ port: 8099 });
  assert.equal(a, b);
  await eventually(() => spawned.length === 1);
  assert.equal(verified, true);
  const { child, args } = spawned[0];
  assert.equal(args[2].windowsHide, true);
  assert.deepEqual(args[2].stdio, ['ignore', 'ignore', 'ignore', 'ipc']);
  assert.equal(args[2].env.ELECTRON_RUN_AS_NODE, '1');
  const message = child.messages[0];
  assert.equal(message.port, 8099);
  assert.equal(message.expectedSha256, CLOUDFLARED_SHA256);
  assert.equal(await readFile(join(home, 'remote-control/network/quick-tunnel.yml'), 'utf8'), '{}\n');
  child.emit('message', { type: 'ready', url: 'https://owned-test-link.trycloudflare.com' });
  assert.deepEqual(await a, { url: 'https://owned-test-link.trycloudflare.com', kind: 'automatic', state: 'ready' });
  assert.deepEqual(manager.status(), { kind: 'automatic', state: 'ready' });
  await assert.rejects(manager.start({ port: 8100 }), { code: 'network/port' });
});

test('invalid port, unsupported OS, and failed integrity never launch a worker', async t => {
  const { manager, spawned } = await managerFixture(t, { platform: 'linux' });
  await assert.rejects(manager.start({ port: '8099' }), { code: 'request/port' });
  await assert.rejects(manager.start({ port: 0 }), { code: 'request/port' });
  await assert.rejects(manager.start({ port: 65536 }), { code: 'request/port' });
  await assert.rejects(manager.start({ port: 8099 }), { code: 'network/platform' });
  assert.equal(spawned.length, 0);
  const other = await managerFixture(t, { verifyExecutable: async () => { throw new Error('secret provider detail'); } });
  await assert.rejects(other.manager.start({ port: 8099 }), error => error.code === 'network/unavailable' && !error.message.includes('secret'));
  assert.equal(other.spawned.length, 0);
});

test('stop during executable verification prevents late process creation', async t => {
  let finish;
  const { manager, spawned } = await managerFixture(t, { verifyExecutable: () => new Promise(resolve => { finish = resolve; }) });
  const result = manager.start({ port: 8099 });
  await manager.stop();
  await assert.rejects(result, { code: 'network/cancelled' });
  finish(); await tick();
  assert.equal(spawned.length, 0);
  assert.equal(manager.status().state, 'idle');
});

test('stop during startup closes only the owned watchdog and ignores late readiness', async t => {
  const { manager, spawned } = await managerFixture(t);
  const result = manager.start({ port: 8099 });
  await eventually(() => spawned.length === 1);
  const child = spawned[0].child;
  const stop = manager.stop();
  child.emit('message', { type: 'ready', url: 'https://late-test-link.trycloudflare.com' });
  await stop;
  await assert.rejects(result, { code: 'network/cancelled' });
  assert.equal(child.disconnected, true);
  assert.equal(manager.status().state, 'idle');
});

test('unexpected worker exit invalidates ready state without silently restarting', async t => {
  const { manager, spawned } = await managerFixture(t);
  const result = manager.start({ port: 8099 }); await eventually(() => spawned.length);
  const child = spawned[0].child;
  child.emit('message', { type: 'ready', url: 'https://test-link.trycloudflare.com' }); await result;
  child.exitCode = 1; child.emit('exit', 1);
  assert.equal(manager.status().state, 'error');
  assert.match(manager.status().error, /closed/);
  assert.equal(spawned.length, 1);
});

test('untrusted readiness address is refused and never returned', async t => {
  const { manager, spawned } = await managerFixture(t);
  const result = manager.start({ port: 8099 }); await eventually(() => spawned.length);
  spawned[0].child.emit('message', { type: 'ready', url: 'https://test.trycloudflare.com.attacker.example' });
  await assert.rejects(result, { code: 'network/unavailable' });
  await tick();
  assert.equal(spawned[0].child.disconnected, true);
});

test('worker timeout is safe, does not expose raw messages, and stops the exact child', async t => {
  const { manager, spawned } = await managerFixture(t);
  const result = manager.start({ port: 8099 }); await eventually(() => spawned.length);
  spawned[0].child.emit('message', { type: 'fatal', code: 'network/timeout', message: 'sensitive provider log' });
  await assert.rejects(result, { code: 'network/timeout' });
  assert.doesNotMatch(manager.status().error, /sensitive/);
  assert.equal(spawned[0].child.disconnected, true);
});

test('stop refuses to claim successful shutdown if watchdog has not exited', async t => {
  const child = new FakeWorker(); child.disconnect = () => { child.connected = false; };
  const { manager } = await managerFixture(t, { forkImpl: () => child, shutdownMs: 10 });
  const result = manager.start({ port: 8099 }); await eventually(() => child.messages.length);
  child.emit('message', { type: 'ready', url: 'https://test-link.trycloudflare.com' }); await result;
  await assert.rejects(manager.stop(), { code: 'network/cleanup' });
  assert.equal(manager.status().state, 'error');
  child.exitCode = 0; child.emit('exit', 0);
  await manager.stop();
  assert.equal(manager.status().state, 'idle');
});

test('worker output parser requires official HTTPS hostname and a registration acknowledgement', () => {
  assert.deepEqual(parseQuickTunnelOutput('https://a-b.trycloudflare.com Registered tunnel connection'), { url: 'https://a-b.trycloudflare.com', registered: true });
  assert.equal(parseQuickTunnelOutput('https://a-b.trycloudflare.com.evil.example').url, undefined);
  assert.equal(parseQuickTunnelOutput('http://a-b.trycloudflare.com').url, undefined);
  assert.equal(parseQuickTunnelOutput('https://a-b.trycloudflare.com:1234').url, undefined);
  assert.equal(parseQuickTunnelOutput('https://a-b.trycloudflare.com/path').url, undefined);
  assert.equal(parseQuickTunnelOutput('https://a-b.trycloudflare.com').registered, false);
});

const startMessage = { type: 'start', executable: 'verified.exe', expectedSha256: CLOUDFLARED_SHA256, config: 'empty.yml', port: 8099, timeoutMs: 200 };
test('watchdog uses fixed safe argv and chunked output emits exactly one ready event', async () => {
  const channel = new FakeChannel(), child = new FakeCloudflare(); let call;
  serveTunnelWorker({ channel, verify: async () => {}, spawnImpl: (...args) => { call = args; return child; } });
  channel.emit('message', startMessage); await tick();
  assert.deepEqual(call[1], ['tunnel', '--config', 'empty.yml', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:8099']);
  assert.equal(call[2].shell, false); assert.equal(call[2].windowsHide, true); assert.equal(call[2].detached, false);
  child.stdout.emit('data', 'Tunnel https://safe-pair.');
  child.stderr.emit('data', 'trycloudflare.com\n');
  assert.equal(channel.messages.length, 0);
  child.stderr.emit('data', 'Registered tunnel con');
  child.stderr.emit('data', 'nection\n');
  child.stdout.emit('data', 'https://other-link.trycloudflare.com Registered tunnel connection');
  assert.deepEqual(channel.messages, [{ type: 'ready', url: 'https://safe-pair.trycloudflare.com' }]);
  channel.disconnect(); await tick();
  assert.equal(child.kills, 1);
});

test('watchdog parent disconnect kills its child before exiting, without waiting for start timeout', async () => {
  const channel = new FakeChannel(), child = new FakeCloudflare();
  serveTunnelWorker({ channel, verify: async () => {}, spawnImpl: () => child });
  channel.emit('message', startMessage); await tick();
  channel.disconnect(); await tick();
  assert.equal(child.kills, 1);
  assert.deepEqual(channel.messages, []);
});

test('watchdog cancels pending integrity read when the parent disappears', async () => {
  const channel = new FakeChannel(); let finish, spawns = 0;
  serveTunnelWorker({ channel, verify: () => new Promise(resolve => { finish = resolve; }), spawnImpl: () => { spawns++; } });
  channel.emit('message', startMessage); channel.disconnect(); finish(); await tick();
  assert.equal(spawns, 0);
});

test('watchdog fails bounded startup, kills child, and discards provider output', async () => {
  const channel = new FakeChannel(), child = new FakeCloudflare();
  serveTunnelWorker({ channel, verify: async () => {}, spawnImpl: () => child });
  channel.emit('message', { ...startMessage, timeoutMs: 10 }); await tick();
  child.stderr.emit('data', 'provider-secret-details');
  await eventually(() => child.kills === 1);
  assert.deepEqual(channel.messages, [{ type: 'fatal', code: 'network/timeout' }]);
});

test('watchdog disconnects on an asynchronous spawn failure without an exit event', async () => {
  const channel = new FakeChannel(), child = new FakeCloudflare(); child.pid = undefined;
  child.kill = () => false;
  serveTunnelWorker({ channel, verify: async () => {}, spawnImpl: () => child });
  channel.emit('message', startMessage); await tick();
  child.emit('error', new Error('private executable path'));
  assert.equal(channel.connected, false);
  assert.deepEqual(channel.messages, [{ type: 'fatal', code: 'network/unavailable' }]);
});

test('real watchdog IPC disconnect terminates an owned harmless Node child (no tunnel)', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-tunnel-ipc-'));
  const marker = join(dir, 'child-exited.txt');
  const worker = fork(fileURLToPath(new URL('./tunnel-watchdog-fixture.mjs', import.meta.url)), [], {
    execArgv: [], env: { ...process.env, DSH_TUNNEL_TEST_EXIT_MARKER: marker },
    windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const exited = new Promise(resolve => worker.once('exit', resolve));
  t.after(async () => {
    if (worker.connected) worker.disconnect();
    await exited;
    await rm(dir, { recursive: true, force: true });
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local watchdog fixture timed out.')), 5000);
    worker.on('message', message => { if (message.type === 'ready') { clearTimeout(timer); resolve(); } });
  });
  worker.send({ ...startMessage, timeoutMs: 4000 });
  await ready;
  worker.disconnect();
  await exited;
  assert.equal(await readFile(marker, 'utf8'), 'owned-child-exited');
});
