import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';

const module = await import('../index.js').catch(() => ({}));
const secret = 'test-companion-token-with-more-than-32-bytes';

async function fixture(t, options = {}) {
  assert.equal(typeof module.createCompanion, 'function', 'companion must expose a lifecycle manager');
  const home = await mkdtemp(join(tmpdir(), 'dsh-companion-test-'));
  const received = { prompts: [], inputs: [], proxies: [], releases: 0, disposals: 0, natives: 0, upgrades: 0 };
  const upstream = createServer((req, res) => {
    if (req.url === '/?token=upstream-fixture-only') {
      res.writeHead(303, { 'set-cookie': 'dsh-auth-fixture=fixture-cookie; HttpOnly', location: '/' });
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received.proxies.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      const denied = req.url === '/deny' || (req.url === '/refresh' && received.proxies.filter(x => x.path === '/refresh').length === 1);
      res.writeHead(denied ? 401 : 200, { 'content-type': 'text/plain' });
      res.end(denied ? 'denied' : 'proxied');
    });
  });
  const upstreamSockets = new Set();
  upstream.on('connection', socket => { upstreamSockets.add(socket); socket.on('close', () => upstreamSockets.delete(socket)); });
  upstream.on('upgrade', (req, socket) => {
    received.upgrades++;
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    socket.on('data', chunk => socket.write(chunk));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  const controller = {
    list: async () => ({ items: [{ sessionId: 'session-1', title: 'Fixture' }] }),
    create: async body => ({ sessionId: body.sessionId || 'created-session' }),
    page: async () => ({ messages: [{ role: 'user', text: 'hello', seq: 1 }], hasMore: false }),
    projections: async () => ({ running: false }),
    prompt: async body => { received.prompts.push(body); if (body.content[0].text === 'fail-after-accept') throw new Error(secret); },
    cancel: async () => ({ accepted: true }),
    rename: async body => ({ title: body.title })
  };
  const services = { webServer: { getOrigin: () => upstreamUrl }, connection: { authenticatedUrl: () => `${upstreamUrl}/?token=upstream-fixture-only` }, sessionController: controller };
  const ctx = { get: name => services[name], logger: { info() {}, warn() {}, error() {} } };
  const backend = {
    monitors: async () => ({ available: true, monitors: [{ id: 'primary', name: 'Fixture', x: -100, y: 0, width: 200, height: 100, primary: true }] }),
    frame: async () => ({ bytes: Buffer.from([137,80,78,71]), contentType: 'image/png', width: 200, height: 100, x: -100, y: 0, monitorId: 'primary' }),
    input: async input => { received.inputs.push(input); if (input.type === 'text' && input.text === 'fail-after-input') throw new Error(secret); },
    releaseAll: async () => { received.releases++; },
    dispose: async () => { received.disposals++; }
  };
  const manager = module.createCompanion(ctx, { home, desktopBackendFactory: () => { received.natives++; return backend; }, ...options });
  await manager.ready;
  t.after(async () => {
    await manager.dispose();
    for (const socket of upstreamSockets) socket.destroy();
    await new Promise(resolve => upstream.close(resolve));
    await rm(home, { recursive: true, force: true });
  });
  const start = async (args = {}) => { await manager.start({ port: 0, token: secret, ...args }); return manager.status().localUrl; };
  const call = (base, path, body, headers = {}) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-companion-token': secret, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual'
  });
  return { home, received, manager, ctx, services, start, call, backend };
}

test('sharing stays off until enabled and private token survives a stopped reload', async t => {
  const f = await fixture(t);
  assert.equal(f.manager.status().enabled, false);
  assert.equal(f.manager.status().desktopEnabled, false);
  assert.equal(f.received.natives, 0);
  const base = await f.start();
  assert.equal((await f.call(base, '/companion/health')).status, 200);
  assert.equal(JSON.stringify(f.manager.status()).includes(secret), false);
  await f.manager.stop();
  assert.equal(f.manager.status().enabled, false);
  const saved = JSON.parse(await readFile(join(f.home, 'remote-control', 'companion.json'), 'utf8'));
  assert.equal(saved.enabled, false);
  assert.equal(saved.token, secret);
  await f.manager.dispose();
  const replacement = module.createCompanion(f.ctx, { home: f.home });
  t.after(() => replacement.dispose());
  await replacement.ready;
  assert.equal(replacement.status().enabled, false);
  assert.equal(new URL(await replacement.pairingUrl()).searchParams.get('k'), secret);
});

test('server enforces tokens, JSON boundaries, and cookie CSRF protections', async t => {
  const f = await fixture(t);
  const base = await f.start();
  assert.equal((await fetch(`${base}/companion/health`)).status, 401);
  assert.equal((await f.call(base, '/companion/health', undefined, { 'x-companion-token': 'wrong' })).status, 401);
  assert.equal(await new Promise((resolve, reject) => {
    const req = request(`${base}/companion/health`, { headers: { host: 'attacker.invalid', 'x-companion-token': secret } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  }), 403);
  const exchange = await fetch(`${base}/?k=${secret}`, { redirect: 'manual' });
  assert.equal(exchange.status, 303);
  const cookie = exchange.headers.get('set-cookie').split(';')[0];
  assert.match(exchange.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(exchange.headers.get('location'), '/');
  const prompt = { text: 'hello', requestId: 'csrf-test' };
  for (const headers of [
    { origin: 'https://attacker.invalid' },
    { origin: base, 'sec-fetch-site': 'cross-site' },
    { origin: base, 'sec-fetch-site': 'same-site' },
    {}
  ]) {
    const response = await fetch(`${base}/companion/session/session-1/prompt`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...headers }, body: JSON.stringify(prompt) });
    assert.equal(response.status, 403);
  }
  assert.equal(f.received.prompts.length, 0);
  const accepted = await fetch(`${base}/companion/session/session-1/prompt`, { method: 'POST', headers: { cookie, origin: base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: JSON.stringify(prompt) });
  assert.equal(accepted.status, 200);
  assert.equal(f.received.prompts.length, 1);
  assert.equal((await f.call(base, '/companion/session/session-1/prompt', prompt, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await f.call(base, '/companion/session/session-1/prompt', { text: 'x'.repeat(1_100_000), requestId: 'oversize' })).status, 413);
});

test('duplicate prompt IDs coalesce once and accepted failures never replay', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const path = '/companion/session/session-1/prompt';
  const bodies = await Promise.all([f.call(base, path, { text: 'hello', requestId: 'one' }), f.call(base, path, { text: 'hello', requestId: 'one' })]);
  assert.deepEqual(await bodies[0].json(), { accepted: true, requestId: 'one' });
  assert.deepEqual(await bodies[1].json(), { accepted: true, requestId: 'one' });
  assert.equal(f.received.prompts.length, 1);
  assert.equal((await f.call(base, path, { text: 'different', requestId: 'one' })).status, 409);
  for (let i = 0; i < 2; i++) {
    const failed = await f.call(base, path, { text: 'fail-after-accept', requestId: 'failed' });
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes(secret), false);
  }
  assert.equal(f.received.prompts.length, 2);
});

test('desktop starts lazily, returns frame coordinates, and deduplicates input', async t => {
  const f = await fixture(t);
  let base = await f.start();
  assert.equal((await f.call(base, '/companion/desktop/monitors')).status, 403);
  assert.equal(f.received.natives, 0);
  base = await f.start({ desktopEnabled: true });
  assert.equal(f.received.natives, 0);
  assert.equal((await f.call(base, '/companion/desktop/monitors')).status, 200);
  assert.equal(f.received.natives, 1);
  const frame = await f.call(base, '/companion/desktop/frame?monitorId=primary&maxWidth=320');
  assert.equal(frame.headers.get('content-type'), 'image/png');
  assert.equal(frame.headers.get('x-desktop-x'), '-100');
  assert.equal(frame.headers.get('x-desktop-width'), '200');
  assert.equal(frame.headers.get('x-desktop-monitor'), 'primary');
  const body = { eventId: 'one-input', input: { type: 'click', x: 1, y: 2, button: 'left', count: 1 } };
  assert.equal((await f.call(base, '/companion/desktop/input', body)).status, 200);
  assert.equal((await f.call(base, '/companion/desktop/input', body)).status, 200);
  assert.equal(f.received.inputs.length, 1);
  assert.equal((await f.call(base, '/companion/desktop/input', { input: body.input })).status, 400);
  assert.equal((await f.call(base, '/companion/desktop/input', { eventId: 'bad', input: { type: 'run', command: 'invalid' } })).status, 400);
  const bad = { eventId: 'fail-input', input: { type: 'text', text: 'fail-after-input' } };
  assert.equal((await f.call(base, '/companion/desktop/input', bad)).status, 500);
  assert.equal((await f.call(base, '/companion/desktop/input', bad)).status, 500);
  assert.equal(f.received.inputs.length, 2);
  await f.manager.stop();
  assert.equal(f.received.releases, 1);
  assert.equal(f.received.disposals, 1);
});

test('HTTP proxy preserves authority auth, strips companion token, and never replays a POST', async t => {
  const f = await fixture(t);
  const base = await f.start();
  assert.equal(await (await f.call(base, '/app')).text(), 'proxied');
  assert.equal(f.received.proxies[0].headers.cookie, 'dsh-auth-fixture=fixture-cookie');
  assert.equal(f.received.proxies[0].headers['x-companion-token'], undefined);
  assert.equal((await f.call(base, '/deny', { command: 'once' })).status, 401);
  assert.equal(f.received.proxies.filter(x => x.path === '/deny').length, 1);
  assert.equal(await (await f.call(base, '/refresh')).text(), 'proxied');
  assert.equal(f.received.proxies.filter(x => x.path === '/refresh').length, 2);
});

function upgrade(base, headers = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(url.port), url.hostname);
    let buffer = '';
    socket.on('error', reject);
    socket.on('connect', () => socket.write([
      'GET /api/remote.mux HTTP/1.1', `Host: ${url.host}`, 'Connection: Upgrade', 'Upgrade: websocket',
      'Sec-WebSocket-Key: Zml4dHVyZS1vbmx5LXNlY3JldA==', 'Sec-WebSocket-Version: 13',
      ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`), '', ''
    ].join('\r\n')));
    socket.on('data', bytes => { buffer += bytes.toString('latin1'); if (buffer.includes('\r\n\r\n')) { socket.destroy(); resolve(Number(buffer.split(' ')[1])); } });
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('upgrade timed out')); });
  });
}

test('WebSocket gate rejects missing tokens and cross-site cookie upgrades', async t => {
  const f = await fixture(t);
  const base = await f.start();
  assert.equal(await upgrade(base), 401);
  assert.equal(await upgrade(base, { cookie: `companion_gate=${secret}`, origin: 'https://attacker.invalid' }), 403);
  assert.equal(await upgrade(base, { cookie: `companion_gate=${secret}` }), 403);
  assert.equal(await upgrade(base, { cookie: `companion_gate=${secret}`, origin: base, 'sec-fetch-site': 'cross-site' }), 403);
  assert.equal(f.received.upgrades, 0);
  assert.equal(await upgrade(base, { cookie: `companion_gate=${secret}`, origin: base, 'sec-fetch-site': 'same-origin' }), 101);
  assert.equal(f.received.upgrades, 1);
});

test('dispose preserves saved sharing, and replacement releases the same listener', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const port = new URL(base).port;
  await f.manager.dispose();
  const replacement = module.createCompanion(f.ctx, { home: f.home });
  t.after(() => replacement.dispose());
  await replacement.ready;
  assert.equal(replacement.status().enabled, true);
  assert.equal(String(replacement.status().port), port);
  assert.equal((await f.call(base, '/companion/health')).status, 200);
  await replacement.stop();
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(Number(port), '127.0.0.1', resolve); });
  await new Promise(resolve => listener.close(resolve));
});

test('desktop explicit release and idle fail-safe release keys and stop cancels the timer', async t => {
  const f = await fixture(t);
  const base = await f.start({ desktopEnabled: true });
  const down = { eventId: 'held-key', input: { type: 'key', key: 'Control', down: true } };
  assert.equal((await f.call(base, '/companion/desktop/input', down)).status, 200);
  const release = await f.call(base, '/companion/desktop/release', {});
  assert.equal(release.status, 200);
  assert.equal(f.received.releases, 1);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  assert.equal((await f.call(base, '/companion/desktop/input', { ...down, eventId: 'held-again' })).status, 200);
  t.mock.timers.tick(15_001);
  await Promise.resolve();
  assert.equal(f.received.releases, 2);
  assert.equal((await f.call(base, '/companion/desktop/input', { ...down, eventId: 'held-before-stop' })).status, 200);
  await f.manager.stop();
  assert.equal(f.received.releases, 3);
  t.mock.timers.tick(20_000);
  await Promise.resolve();
  assert.equal(f.received.releases, 3);
  t.mock.timers.reset();
});

test('a pairing request persists its generated secret and malformed enabled settings stay disabled', async t => {
  const f = await fixture(t);
  const first = module.createCompanion(f.ctx, { home: join(f.home, 'new-profile') });
  const pairing = await first.pairingUrl();
  assert.equal(Buffer.from(new URL(pairing).searchParams.get('k'), 'hex').length, 32);
  await first.dispose();
  const second = module.createCompanion(f.ctx, { home: join(f.home, 'new-profile') });
  t.after(() => second.dispose());
  assert.equal(await second.pairingUrl() === pairing, true);
  const broken = join(f.home, 'broken-profile');
  await mkdir(join(broken, 'remote-control'), { recursive: true });
  await writeFile(join(broken, 'remote-control', 'companion.json'), JSON.stringify({ enabled: true, token: 'short', port: 0 }));
  const invalid = module.createCompanion(f.ctx, { home: broken });
  t.after(() => invalid.dispose());
  await invalid.ready;
  assert.equal(invalid.status().enabled, false);
  assert.match(invalid.status().error, /invalid/i);
});

test('native failures expose a fixed actionable reason without helper details or secrets', async t => {
  const f = await fixture(t);
  const base = await f.start({ desktopEnabled: true });
  f.backend.frame = async () => { throw Object.assign(new Error(secret), { code: 'DESKTOP_UNAVAILABLE' }); };
  const response = await f.call(base, '/companion/desktop/frame');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'DESKTOP_UNAVAILABLE');
  assert.match(body.error.message, /locked|disconnected|unavailable/i);
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test('session create/page/cancel/rename remain compatible while mutations require bounded JSON', async t => {
  const f = await fixture(t);
  const base = await f.start();
  assert.equal((await (await f.call(base, '/companion/sessions')).json()).items[0].sessionId, 'session-1');
  assert.deepEqual(await (await f.call(base, '/companion/sessions', {})).json(), { sessionId: 'created-session' });
  assert.equal((await f.call(base, '/companion/session/session-1/page?throughSeq=-1')).status, 200);
  assert.equal((await f.call(base, '/companion/session/session-1/projections')).status, 200);
  assert.deepEqual(await (await f.call(base, '/companion/session/session-1/rename', { title: 'Renamed' })).json(), { title: 'Renamed' });
  assert.equal((await f.call(base, '/companion/session/session-1/cancel', {}, { 'content-type': 'text/plain' })).status, 415);
  assert.deepEqual(await (await f.call(base, '/companion/session/session-1/cancel', {})).json(), { accepted: true });
});

test('Cordis service registration makes the lifecycle discoverable and scope disposal frees its port', async t => {
  const f = await fixture(t);
  const cleanups = [];
  f.ctx.provide = (name, value) => { f.services[name] = value; };
  f.ctx.effect = acquire => { cleanups.push(acquire()); };
  Object.defineProperty(f.ctx, 'remoteCompanion', { get() { throw new Error('cannot get property remoteCompanion without inject'); } });
  await module.apply(f.ctx, { home: join(f.home, 'cordis-profile') });
  const service = f.ctx.get('remoteCompanion');
  assert.equal(typeof service?.start, 'function');
  const status = await service.start({ port: 0, token: secret });
  assert.equal((await f.call(status.localUrl, '/companion/health')).status, 200);
  await Promise.all(cleanups.map(cleanup => cleanup()));
  assert.equal(service.status().enabled, false);
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(status.port, '127.0.0.1', resolve); });
  await new Promise(resolve => listener.close(resolve));
});

test('initialization failure remains discoverable as sharing status without exposing details', async t => {
  const f = await fixture(t);
  f.ctx.provide = (name, value) => { f.services[name] = value; };
  await module.apply(f.ctx, { home: { secret } });
  const service = f.ctx.get('remoteCompanion');
  assert.equal(typeof service?.status, 'function');
  const status = service.status();
  assert.equal(status.enabled, false);
  assert.match(status.error, /initialize/i);
  assert.equal(JSON.stringify(status).includes(secret), false);
  await assert.rejects(service.start(), /initialize/i);
});

test('a missing host dependency reports status without reading a guarded SDK property', async t => {
  const f = await fixture(t);
  delete f.services.webServer;
  Object.defineProperty(f.ctx, 'webServer', { get() { throw new Error('cannot get property webServer without inject'); } });
  await assert.rejects(f.manager.start({ port: 0 }), /services are unavailable/i);
  assert.equal(f.manager.status().enabled, false);
  assert.match(f.manager.status().error, /dependencies are ready/i);
});

test('service registration failures become safe loader-visible errors', async t => {
  const f = await fixture(t);
  f.ctx.provide = () => { throw new Error(secret); };
  await assert.rejects(module.apply(f.ctx, { home: join(f.home, 'registration-failure') }), error => {
    assert.match(error.message, /registration failed/i);
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});

test('successful input and prompt IDs expire by age while ambiguous failures never replay', async t => {
  let now = 1_000_000;
  const f = await fixture(t, { now: () => now });
  const base = await f.start({ desktopEnabled: true });
  const input = { eventId: 'aged-input', input: { type: 'move', x: 1, y: 2 } };
  const failed = { eventId: 'ambiguous-input', input: { type: 'text', text: 'fail-after-input' } };
  const prompt = { text: 'hello', requestId: 'aged-prompt' };
  assert.equal((await f.call(base, '/companion/desktop/input', input)).status, 200);
  assert.equal((await f.call(base, '/companion/desktop/input', failed)).status, 500);
  assert.equal((await f.call(base, '/companion/session/session-1/prompt', prompt)).status, 200);
  now += 29_000;
  assert.equal((await f.call(base, '/companion/desktop/input', input)).status, 200);
  assert.equal(f.received.inputs.length, 2);
  now += 2_000;
  assert.equal((await f.call(base, '/companion/desktop/input', input)).status, 200);
  assert.equal(f.received.inputs.length, 3);
  assert.equal((await f.call(base, '/companion/session/session-1/prompt', prompt)).status, 200);
  assert.equal(f.received.prompts.length, 1);
  now += 300_000;
  assert.equal((await f.call(base, '/companion/session/session-1/prompt', prompt)).status, 200);
  assert.equal(f.received.prompts.length, 2);
  assert.equal((await f.call(base, '/companion/desktop/input', failed)).status, 500);
  assert.equal(f.received.inputs.length, 3);
});

test('session writer errors preserve their safe machine code for reconnect guidance', async t => {
  const f = await fixture(t);
  const base = await f.start();
  f.services.sessionController.prompt = async () => { throw { isDSHRemoteError: true, code: 'session/writer-held', message: secret, details: { token: secret } }; };
  const response = await f.call(base, '/companion/session/session-1/prompt', { text: 'hi', requestId: 'writer-error' });
  const body = await response.json();
  assert.equal(body.error.code, 'session/writer-held');
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test('a live WebSocket tunnel forwards bytes and disposal closes upgraded sockets', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const url = new URL(base);
  const socket = connect(Number(url.port), url.hostname);
  t.after(() => socket.destroy());
  socket.on('error', () => {});
  const closed = new Promise(resolve => socket.once('close', resolve));
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.on('connect', () => socket.write(`GET /api/remote.mux HTTP/1.1\r\nHost: ${url.host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nx-companion-token: ${secret}\r\nOrigin: ${base}\r\n\r\n`));
    const handshake = bytes => { if (bytes.toString('latin1').includes('101 Switching Protocols')) { socket.off('data', handshake); resolve(); } };
    socket.on('data', handshake);
  });
  const echo = new Promise(resolve => socket.once('data', bytes => resolve(bytes.toString())));
  socket.write('fixture-frame');
  assert.equal(await echo, 'fixture-frame');
  await f.manager.dispose();
  await closed;
  assert.equal(socket.destroyed, true);
});

test('bounded chunked JSON fails safely and startup conflicts leave no companion listener', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const response = await new Promise((resolve, reject) => {
    const req = request(`${base}/companion/session/session-1/prompt`, { method: 'POST', headers: { 'x-companion-token': secret, 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.write('{"text":"');
    req.write('x'.repeat(1_100_000));
    req.end('","requestId":"chunked"}');
  });
  assert.equal(response, 413);
  assert.equal(f.received.prompts.length, 0);
  await f.manager.stop();
  const occupied = createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  await assert.rejects(f.manager.start({ port: occupied.address().port }), /could not start/i);
  assert.equal(f.manager.status().enabled, false);
});

test('monitor refresh replaces a failed helper after disposal without replaying failed input', async t => {
  let failed = false, created = 0, newInputs = 0, oldInputs = 0;
  const order = [];
  let announceDisposal, finishDisposal, disposal;
  const disposalStarted = new Promise(resolve => { announceDisposal = resolve; });
  const disposalGate = new Promise(resolve => { finishDisposal = resolve; });
  const unavailable = () => Object.assign(new Error('fixture helper failed'), { code: 'HELPER_UNAVAILABLE' });
  const replacement = {
    get failed() { return false; },
    monitors: async () => ({ available: true, monitors: [{ id: 'restored', name: 'Restored', x: 0, y: 0, width: 200, height: 100, primary: true }] }),
    input: async () => { newInputs++; },
    releaseAll: async () => {}, dispose: async () => {}
  };
  const original = {
    get failed() { return failed; },
    monitors: async () => ({ available: false, monitors: [], reason: 'The desktop helper stopped.' }),
    frame: async () => { throw unavailable(); },
    input: async () => { oldInputs++; failed = true; throw unavailable(); },
    releaseAll: async () => { order.push('release'); throw unavailable(); },
    dispose: () => disposal ??= (async () => { order.push('dispose:start'); announceDisposal(); await disposalGate; order.push('dispose:end'); })()
  };
  const f = await fixture(t, { desktopBackendFactory: () => { created++; if (created === 1) return original; order.push('create:new'); return replacement; } });
  const base = await f.start({ desktopEnabled: true });
  const input = { eventId: 'failed-before-reconnect', input: { type: 'key', key: 'a', down: true } };
  try {
    assert.equal((await f.call(base, '/companion/desktop/input', input)).status, 503);
    assert.equal((await f.call(base, '/companion/desktop/frame')).status, 503);
    assert.equal(created, 1, 'frame polling must not recreate the helper');
    const refresh = f.call(base, '/companion/desktop/monitors');
    const enteredDisposal = await Promise.race([disposalStarted.then(() => true), refresh.then(() => false)]);
    assert.equal(enteredDisposal, true, 'monitor refresh must dispose the failed backend');
    const concurrentRefresh = f.call(base, '/companion/desktop/monitors');
    assert.equal((await f.call(base, '/companion/desktop/input', { ...input, eventId: 'during-reconnect' })).status, 503);
    assert.equal(created, 1, 'a replacement cannot overlap the old helper');
    finishDisposal();
    const responses = await Promise.all([refresh, concurrentRefresh]);
    for (const response of responses) assert.equal((await response.json()).available, true);
    assert.equal(created, 2, 'concurrent refreshes must share one replacement');
    assert.deepEqual(order, ['release', 'dispose:start', 'dispose:end', 'create:new']);
    assert.equal((await f.call(base, '/companion/desktop/input', input)).status, 503);
    assert.equal(oldInputs, 1);
    assert.equal(newInputs, 0, 'the failed event ID must retain its tombstone after recovery');
    assert.equal((await f.call(base, '/companion/desktop/input', { ...input, eventId: 'new-after-reconnect' })).status, 200);
    assert.equal(newInputs, 1);
  } finally { finishDisposal(); }
});

test('stopping sharing during helper recovery prevents a replacement from starting', async t => {
  let created = 0, disposal, announceDisposal, finishDisposal;
  const disposalStarted = new Promise(resolve => { announceDisposal = resolve; });
  const disposalGate = new Promise(resolve => { finishDisposal = resolve; });
  const f = await fixture(t, { desktopBackendFactory: () => {
    created++;
    return { get failed() { return true; }, releaseAll: async () => {},
      dispose: () => disposal ??= (async () => { announceDisposal(); await disposalGate; })(),
      monitors: async () => ({ available: false, monitors: [] }) };
  } });
  const base = await f.start({ desktopEnabled: true });
  try {
    const refresh = f.call(base, '/companion/desktop/monitors').then(() => false, () => false);
    assert.equal(await Promise.race([disposalStarted.then(() => true), refresh]), true);
    const stopping = f.manager.stop();
    finishDisposal();
    await stopping;
    await refresh;
    assert.equal(f.manager.status().enabled, false);
    assert.equal(created, 1, 'stopping must not leave a newly created helper behind');
  } finally { finishDisposal(); }
});
