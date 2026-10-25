import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { createCompanion } from '../index.js';
import { ControlAccess, installSessionFence } from '../lib/control-access.mjs';

const legacy = 'legacy-fixture-credential-more-than-32-bytes';
const identity = 'fixture-client-one';
const packageVersion = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version;

async function fixture(t, { incomplete = false } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-handoff-fixture-'));
  const calls = { prompts: [], inputs: [], proxies: 0, releases: 0 };
  let now = 1_000_000;
  const upstream = createServer((req, res) => {
    if (req.url === '/?token=fixture-upstream') { res.writeHead(303, { 'set-cookie': 'host=fixture', location: '/' }); res.end(); }
    else { calls.proxies++; res.end('proxied'); }
  });
  const sockets = new Set();
  upstream.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  upstream.on('upgrade', (req, socket) => { socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'); });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const controller = {
    list: async () => ({ items: [{ sessionId: 'one' }] }), page: async () => ({ records: [] }), projections: async () => ({}),
    create: async () => ({ sessionId: 'new' }), rename: async () => ({}), cancel: async () => ({}),
    updateQueue: async () => ({}), fork: async () => ({}), selectModel: async () => ({}),
    prompt: async request => { calls.prompts.push(request); if (request.content[0].text === 'ambiguous') throw new Error('fixture failure after accept'); }
  };
  if (incomplete) delete controller.updateQueue;
  const originals = Object.fromEntries(Object.entries(controller));
  const services = { sessionController: controller, webServer: { getOrigin: () => origin }, connection: { authenticatedUrl: () => `${origin}/?token=fixture-upstream` } };
  const backend = {
    monitors: async () => ({ monitors: [] }), frame: async () => ({}),
    input: async input => { calls.inputs.push(input); }, releaseAll: async () => { calls.releases++; }, dispose: async () => {}
  };
  const ctx = { get: name => services[name], logger: { warn() {}, error() {}, info() {} } };
  const options = { home, now: () => now, desktopBackendFactory: () => backend };
  let manager = createCompanion(ctx, options);
  await manager.ready;
  await manager.start({ port: 0, token: legacy, desktopEnabled: true, label: 'Host fixture' });
  let base = manager.status().localUrl;
  t.after(async () => { await manager.dispose(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => upstream.close(resolve)); await rm(home, { recursive: true, force: true }); });
  const call = (path, body, token = legacy, clientId = identity) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { connection: 'close', ...(token ? { 'x-companion-token': token, 'x-dsh-client-id': clientId } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const pair = async (invite, clientId = identity, label = 'Laptop fixture') => {
    const response = await call('/companion/pair', { secret: invite.secret, clientId, label }, null);
    return { status: response.status, value: await response.json() };
  };
  const invite = (policy = {}) => manager.createInvitation({ publicUrl: base, ...policy });
  const restart = async () => { await manager.dispose(); manager = createCompanion(ctx, options); await manager.ready; base = manager.status().localUrl; };
  const startAgain = async () => { await manager.start({}); base = manager.status().localUrl; };
  return { home, get manager() { return manager; }, get base() { return base; }, call, pair, invite, restart, startAgain, controller, originals, calls, backend, tick: ms => { now += ms; } };
}

const prompt = (requestId = 'fixture-prompt', text = 'hello') => ({ text, requestId });

test('single-use invitation mints a separate bound credential and fences host commands', async t => {
  const f = await fixture(t), invitation = await f.invite();
  assert.equal(invitation.expiresAt, 2_800_000); assert.equal(invitation.useLimit, 'once');
  const paired = await f.pair(invitation);
  assert.equal(paired.status, 200); assert.notEqual(paired.value.token, invitation.secret); assert.notEqual(paired.value.token, legacy);
  assert.deepEqual(paired.value.capabilities, { sessions: true, desktop: true, pairing: true, control: true });
  assert.equal(paired.value.version, packageVersion);
  assert.equal(paired.value.control.heldByYou, true); assert.equal(f.manager.status().control.owner, 'remote');
  assert.equal((await f.pair(invitation)).status, 401);
  assert.equal((await f.call('/companion/health', undefined, paired.value.token, 'wrong-client')).status, 401);
  for (const method of ['prompt', 'create', 'rename', 'cancel', 'fork', 'updateQueue', 'selectModel'])
    assert.throws(() => f.controller[method]({}), error => error.code === 'control/remote-active');
  const response = await f.call('/companion/session/one/prompt', prompt(), paired.value.token);
  assert.equal(response.status, 200); assert.equal(f.calls.prompts.length, 1);
  const saved = await readFile(join(f.home, 'remote-control', 'companion.json'), 'utf8');
  assert.equal(saved.includes(invitation.secret), false); assert.equal(saved.includes(paired.value.token), false);
});

test('expired/replaced invitations fail and a missing fence cannot hand off', async t => {
  const f = await fixture(t), first = await f.invite(), second = await f.invite();
  assert.equal((await f.pair(first)).status, 401);
  f.tick(1_800_001); assert.equal((await f.pair(second)).status, 401);
  assert.equal(f.manager.status().control.owner, 'local');
  const unsupported = await fixture(t, { incomplete: true });
  assert.equal(unsupported.manager.status().control.supported, false);
  await assert.rejects(unsupported.invite, error => error.code === 'control/unavailable');
});

test('lease heartbeat extends ownership; expiry restores local and remote needs explicit acquire', async t => {
  const f = await fixture(t), { value } = await f.pair(await f.invite());
  f.tick(20_000);
  assert.equal((await f.call('/companion/control/heartbeat', {}, value.token)).status, 200);
  f.tick(20_000); assert.equal(f.manager.status().control.owner, 'remote');
  f.tick(10_001); assert.equal(f.manager.status().control.owner, 'local');
  await f.controller.prompt({ content: [{ text: 'local' }] });
  assert.equal((await f.call('/companion/session/one/prompt', prompt(), value.token)).status, 409);
  assert.equal((await f.call('/companion/control/heartbeat', {}, value.token)).status, 409);
  assert.equal((await f.call('/companion/control/acquire', {}, value.token)).status, 200);
  assert.equal((await f.call('/companion/session/one/prompt', prompt(), value.token)).status, 200);
});

test('competing clients cannot take or release another lease or send desktop input', async t => {
  const f = await fixture(t), a = (await f.pair(await f.invite())).value;
  assert.equal((await f.call('/companion/control/release', {}, a.token)).status, 200);
  const b = (await f.pair(await f.invite(), 'fixture-client-two', 'Second laptop')).value;
  assert.equal((await f.call('/companion/control/acquire', {}, a.token)).status, 409);
  assert.equal((await f.call('/companion/control/release', {}, a.token)).status, 409);
  assert.equal((await f.call('/companion/desktop/release', {}, a.token)).status, 409);
  assert.equal((await f.call('/companion/desktop/input', { eventId: 'one', input: { type: 'text', text: 'forbidden' } }, a.token)).status, 409);
  assert.equal((await f.call('/companion/sessions', undefined, a.token)).status, 200);
  assert.equal((await (await f.call('/companion/control', undefined, b.token, 'fixture-client-two')).json()).heldByYou, true);
  assert.equal(f.calls.inputs.length, 0);
});

test('local reclaim revokes tokens and pauses pending codes and leaves the owner in control', async t => {
  const f = await fixture(t), a = (await f.pair(await f.invite())).value;
  assert.equal((await f.call('/companion/desktop/input', { eventId: 'key-down', input: { type: 'key', key: 'a', down: true } }, a.token)).status, 200);
  const reclaimed = await f.manager.reclaim();
  assert.equal(reclaimed.control.owner, 'local'); assert.ok(f.calls.releases > 0);
  assert.equal((await f.call('/companion/control/acquire', {}, a.token)).status, 401);
  assert.equal((await f.call('/companion/session/one/prompt', prompt(), a.token)).status, 401);
  await f.controller.prompt({ content: [{ text: 'local' }] });
  const unused = await f.invite(); await f.manager.reclaim();
  assert.equal((await f.pair(unused)).status, 403);
  assert.equal((await f.pair(await f.invite())).status, 200);
});

test('paired and legacy credentials cannot bypass handoff through transparent proxy routes', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/legacy-proxy')).status, 200);
  for (const path of ['/api/remote-control', '/api/remote-control/window', '/api/%72emote-control', '/%61pi/remote-control'])
    assert.equal((await f.call(path, { action: 'sharing.reclaim' })).status, 403);
  const a = (await f.pair(await f.invite())).value;
  for (const token of [a.token, legacy]) {
    assert.equal((await f.call('/api/session/prompt', {}, token)).status, 403);
    assert.equal((await f.call('/api/remote-control', { action: 'sharing.reclaim' }, token)).status, 403);
    assert.equal((await f.call('/', undefined, token)).status, 403);
  }
  assert.equal((await f.call('/companion/session/one/prompt', prompt())).status, 403);
  await f.manager.reclaim();
  assert.equal((await f.call('/api/remote-control', { action: 'sharing.pairing' })).status, 403);
  assert.equal(f.calls.proxies, 1);
});

test('opening invitation closes an existing legacy WebSocket and refuses new upgrades', async t => {
  const f = await fixture(t);
  const open = token => new Promise((resolve, reject) => {
    const url = new URL(f.base), socket = connect({ host: url.hostname, port: Number(url.port) });
    socket.on('error', reject); socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('fixture upgrade timed out')); });
    socket.once('data', bytes => { socket.setTimeout(0); resolve({ socket, status: Number(bytes.toString().split(' ')[1]) }); });
    socket.once('connect', () => socket.write(`GET /api/remote.mux HTTP/1.1\r\nHost: ${url.host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nx-companion-token: ${token}\r\nx-dsh-client-id: ${identity}\r\nOrigin: ${f.base}\r\n\r\n`));
  });
  const live = await open(legacy); assert.equal(live.status, 101);
  const closed = new Promise(resolve => live.socket.once('close', resolve));
  const invitation = await f.invite(); await closed;
  const paired = await f.pair(invitation);
  for (const token of [legacy, paired.value.token]) { const result = await open(token); assert.equal(result.status, 403); result.socket.destroy(); }
});

test('take-back during a partially read request rejects late mutation admission', async t => {
  const f = await fixture(t), a = (await f.pair(await f.invite())).value;
  const body = JSON.stringify(prompt('late-action'));
  let req;
  const result = new Promise((resolve, reject) => {
    req = request(`${f.base}/companion/session/one/prompt`, { method: 'POST', headers: {
      'x-companion-token': a.token, 'x-dsh-client-id': identity, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body)
    } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.flushHeaders(); req.write(body.slice(0, 5));
  });
  await new Promise(resolve => setTimeout(resolve, 20)); await f.manager.reclaim(); req.end(body.slice(5));
  assert.equal(await result, 401); assert.equal(f.calls.prompts.length, 0);
});

test('a failed accepted prompt never replays and scopes action IDs per paired client', async t => {
  const f = await fixture(t), a = (await f.pair(await f.invite())).value;
  for (let i = 0; i < 2; i++) assert.equal((await f.call('/companion/session/one/prompt', prompt('same', 'ambiguous'), a.token)).status, 500);
  assert.equal(f.calls.prompts.length, 1);
  await f.manager.reclaim(); const b = (await f.pair(await f.invite())).value;
  assert.equal((await f.call('/companion/session/one/prompt', prompt('same'), b.token)).status, 200);
  assert.equal(f.calls.prompts.length, 2);
});

test('fence preserves the invocation receiver, restores descriptors, and rejects stale async permits', async () => {
  const access = new ControlAccess({ label: 'fixture' });
  const original = { marker: 'original' };
  for (const name of ['create', 'prompt', 'cancel', 'rename', 'fork', 'selectModel', 'updateQueue'])
    original[name] = function () { return this.marker; };
  const originalPrompt = original.prompt;
  const unmount = installSessionFence({ [Symbol.for('cordis.original')]: original }, access);
  const invitation = access.createInvitation('http://127.0.0.1:1234');
  const pair = access.pair({ secret: invitation.secret, clientId: identity, label: 'fixture-client' });
  const client = access.authenticate(pair.token, identity), receiver = Object.create(original); receiver.marker = 'invocation';
  assert.equal(access.permit(client, () => receiver.prompt()), 'invocation');
  let continueRequest;
  const waiting = new Promise(resolve => { continueRequest = resolve; });
  const late = access.permit(client, async () => { await waiting; return receiver.prompt(); });
  access.reclaim(); continueRequest(); await assert.rejects(late, error => error.code === 'control/revoked');
  unmount(); assert.equal(original.prompt, originalPrompt); assert.equal(original.prompt(), 'original'); access.dispose();
});

test('unlimited use and never expiry are independent and permit sequential connections only', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'unlimited', expiresInMs: null });
  assert.equal(invitation.expiresAt, null); assert.equal(invitation.useLimit, 'unlimited');
  const attempts = await Promise.all([f.pair(invitation), f.pair(invitation, 'fixture-client-two', 'Second')]);
  assert.deepEqual(attempts.map(value => value.status).sort(), [200, 409]);
  const winner = attempts.find(value => value.status === 200).value;
  const winnerId = attempts[0].status === 200 ? identity : 'fixture-client-two';
  assert.equal((await f.call('/companion/control/release', {}, winner.token, winnerId)).status, 200);
  f.tick(10 * 365 * 24 * 60 * 60_000);
  assert.equal(f.manager.status().code.expired, false);
  const next = await f.pair(invitation, 'fixture-client-three', 'Third'); assert.equal(next.status, 200);
  assert.equal(f.manager.status().code.used, false);
});

test('reusable code is paused by Take back control until explicitly resumed locally', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'unlimited', expiresInMs: null });
  const first = (await f.pair(invitation)).value;
  await f.manager.reclaim(); assert.equal(f.manager.status().code.paused, true);
  assert.equal((await f.pair(invitation)).status, 403);
  assert.equal((await f.call('/companion/control/acquire', {}, first.token)).status, 401);
  assert.equal((await f.manager.resume()).code.paused, false);
  assert.equal((await f.pair(invitation)).status, 200);
});

test('custom and 60-minute expirations apply separately from unlimited use', async t => {
  const f = await fixture(t), hour = await f.invite({ useLimit: 'unlimited', expiresInMs: 3_600_000 });
  assert.equal(hour.expiresAt, 4_600_000);
  const twoYearsMs = 730 * 24 * 60 * 60_000;
  const longLived = await f.invite({ useLimit: 'unlimited', expiresInMs: twoYearsMs });
  assert.equal(longLived.expiresAt, 1_000_000 + twoYearsMs);
  const custom = await f.invite({ useLimit: 'unlimited', expiresInMs: 123_000 });
  f.tick(123_000); assert.equal((await f.pair(custom)).status, 401);
  assert.equal(f.manager.status().code.expired, true);
  await assert.rejects(() => f.manager.resume(), error => error.code === 'pairing/expired');
});

test('only code hash and policy persist; reusable never-expiring code survives normal restart', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'unlimited', expiresInMs: null, networkKind: 'custom' });
  const first = (await f.pair(invitation)).value;
  const stored = await readFile(join(f.home, 'remote-control', 'connection-code.json'), 'utf8');
  assert.equal(stored.includes(invitation.secret), false); assert.equal(stored.includes(first.token), false);
  const data = JSON.parse(stored);
  assert.match(data.invitation.digest, /^[a-f0-9]{64}$/); assert.equal(data.invitation.expiresAt, null);
  assert.equal(data.invitation.url, invitation.url); assert.equal(data.engaged, true);
  assert.equal(data.invitation.networkKind, 'custom');
  await f.restart();
  assert.equal(f.manager.status().control.owner, 'local'); assert.equal(f.manager.status().code.paused, false);
  assert.equal((await f.call('/companion/control/acquire', {}, first.token)).status, 401);
  assert.equal((await f.pair(invitation)).status, 200);
  const statusText = JSON.stringify(f.manager.status()); assert.equal(statusText.includes(data.invitation.digest), false);
  assert.equal(f.manager.status().code.address, invitation.url); assert.equal(f.manager.status().code.networkKind, 'custom');
});

test('once plus never stays spent across restart and Resume cannot resurrect it', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'once', expiresInMs: null });
  assert.equal((await f.pair(invitation)).status, 200); assert.equal(f.manager.status().code.used, true);
  await f.restart(); assert.equal((await f.pair(invitation)).status, 401);
  await assert.rejects(() => f.manager.resume(), error => error.code === 'pairing/expired');
  assert.equal(f.manager.status().code.used, true);
});

test('Take back pause survives restart; Stop sharing also pauses reusable admission', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'unlimited', expiresInMs: null });
  await f.manager.reclaim(); await f.restart();
  assert.equal((await f.pair(invitation)).status, 403);
  await f.manager.resume(); assert.equal((await f.pair(invitation)).status, 200);
  await f.manager.stop(); assert.equal(f.manager.status().code.paused, true);
  await f.restart(); assert.equal(f.manager.status().enabled, false);
  await f.startAgain(); assert.equal((await f.pair(invitation)).status, 403);
  await f.manager.resume(); assert.equal((await f.pair(invitation)).status, 200);
});

test('Revoke code revokes connected clients and remains deleted after restart', async t => {
  const f = await fixture(t), invitation = await f.invite({ useLimit: 'unlimited', expiresInMs: null });
  const first = (await f.pair(invitation)).value;
  const result = await f.manager.revokeInvitation();
  assert.deepEqual(result.code, { exists: false }); assert.equal(result.control.owner, 'local');
  assert.equal((await f.call('/companion/control', undefined, first.token)).status, 401);
  assert.equal((await f.pair(invitation)).status, 401);
  await f.restart(); assert.equal((await f.pair(invitation)).status, 401);
  assert.equal((await f.call('/api/session/prompt', {})).status, 403);
});

test('invalid policy does not replace a valid code', async t => {
  const f = await fixture(t), invitation = await f.invite();
  for (const policy of [{ useLimit: 'twice' }, { networkKind: 'relay' }, { expiresInMs: 0 }, { expiresInMs: -1 }, { expiresInMs: 1.5 }, { expiresInMs: 'never' }, { expiresInMs: Number.MAX_SAFE_INTEGER }])
    await assert.rejects(() => f.invite(policy), error => error.status === 400);
  assert.equal((await f.pair(invitation)).status, 200);
});

test('failed persistence cannot admit a one-use pair and reclaim still rejects live credentials', () => {
  let fail = false;
  const access = new ControlAccess({ label: 'fixture', persist: () => { if (fail) throw new Error('fixture storage failure'); } });
  access.fenceReady = true;
  const invitation = access.createInvitation('https://fixture.example');
  fail = true;
  assert.throws(() => access.pair({ secret: invitation.secret, clientId: identity, label: 'fixture' }), error => error.code === 'pairing/storage');
  assert.equal(access.clients.size, 0); assert.equal(access.status().owner, 'local');
  fail = false; const pair = access.pair({ secret: invitation.secret, clientId: identity, label: 'fixture' });
  fail = true; assert.throws(() => access.reclaim(), error => error.code === 'pairing/storage');
  assert.equal(access.authenticate(pair.token, identity), undefined); assert.equal(access.status().owner, 'local'); access.dispose();
});

test('unlimited pairing keeps bounded credentials without imposing a code-use cap', () => {
  const access = new ControlAccess({ label: 'fixture' }); access.fenceReady = true;
  const invitation = access.createInvitation('https://fixture.example', { useLimit: 'unlimited', expiresInMs: null, networkKind: 'automatic' });
  let first;
  for (let i = 0; i < 40; i++) {
    const clientId = `fixture-client-${i}`, paired = access.pair({ secret: invitation.secret, clientId, label: 'fixture' });
    first ??= { token: paired.token, clientId };
    access.release(access.authenticate(paired.token, clientId));
  }
  assert.equal(access.clients.size, 32); assert.equal(access.authenticate(first.token, first.clientId), undefined);
  assert.equal(access.codeStatus().networkKind, 'automatic'); assert.equal(access.codeStatus().used, false); access.dispose();
});
