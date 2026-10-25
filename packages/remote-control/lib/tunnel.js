import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLOUDFLARED_SHA256 = '4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6';
export const CLOUDFLARED_VERSION = '2026.10.1';

export class TunnelError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const failure = (code = 'network/unavailable') => new TunnelError(code,
  code === 'network/cancelled' ? 'Sharing was stopped before the connection was ready.' :
  code === 'network/timeout' ? 'The secure connection took too long. Check your internet connection and try again.' :
  code === 'network/closed' ? 'The secure connection closed. Generate a new connection code to reconnect.' :
  'The secure connection could not start. Check your internet connection, or use an existing HTTPS address in Connection settings.');

export async function verifyTunnelExecutable(executable, expectedSha256 = CLOUDFLARED_SHA256) {
  let bytes;
  try { bytes = await readFile(executable); }
  catch { throw new TunnelError('network/helper-missing', 'The secure connection helper is missing. Reinstall the full Remote Control package, or use an existing HTTPS address in Connection settings.'); }
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    throw new TunnelError('network/helper-integrity', 'The secure connection helper failed its integrity check. Reinstall the full Remote Control package.');
  }
}

/** One owned quick tunnel, created only by an explicit sharing action. */
export class TunnelManager {
  constructor({ home = process.env.DSH_HOME || join(homedir(), '.dsh'), executable,
    expectedSha256 = CLOUDFLARED_SHA256, forkImpl = fork, verifyExecutable = verifyTunnelExecutable,
    timeoutMs = 75000, shutdownMs = 5000, execPath = process.execPath, platform = process.platform } = {}) {
    this.home = home;
    this.executable = executable || fileURLToPath(new URL('../vendor/cloudflared.exe', import.meta.url));
    this.expectedSha256 = expectedSha256;
    this.fork = forkImpl;
    this.verify = verifyExecutable;
    this.timeoutMs = timeoutMs;
    this.shutdownMs = shutdownMs;
    this.execPath = execPath;
    this.platform = platform;
    this.current = undefined;
    this.state = 'idle';
    this.error = undefined;
    this.disposed = false;
    this.stopping = undefined;
  }

  status() {
    return { kind: 'automatic', state: this.state, ...(this.error ? { error: this.error.message } : {}) };
  }

  start({ port } = {}) {
    if (this.disposed) return Promise.reject(new TunnelError('network/disposed', 'Remote Control is reloading. Reopen the panel.'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.reject(new TunnelError('request/port', 'Choose a valid local sharing port.'));
    if (this.stopping) return this.stopping.then(() => this.start({ port }));
    if (this.current) {
      if (this.current.port !== port) return Promise.reject(new TunnelError('network/port', 'Stop sharing before changing its port.'));
      return this.current.promise;
    }
    const current = { port, child: undefined, cancelled: false, settled: false, exited: false };
    this.current = current;
    this.state = 'starting'; this.error = undefined;
    current.promise = new Promise((resolve, reject) => { current.resolve = resolve; current.reject = reject; });
    // Retain one handled promise even if the panel closes during startup.
    current.promise.catch(() => {});
    this.prepare(current).catch(error => this.fail(current, error instanceof TunnelError ? error : failure()));
    return current.promise;
  }

  async prepare(current) {
    if (this.platform !== 'win32') throw new TunnelError('network/platform', 'Automatic connections currently require Windows. Use an existing HTTPS address in Connection settings.');
    await this.verify(this.executable, this.expectedSha256);
    if (current.cancelled) return;
    const config = join(this.home, 'remote-control', 'network', 'quick-tunnel.yml');
    await mkdir(dirname(config), { recursive: true, mode: 0o700 });
    await writeFile(config, '{}\n', { mode: 0o600 });
    if (current.cancelled) return;
    const child = this.fork(fileURLToPath(new URL('./tunnel-worker.mjs', import.meta.url)), [], {
      execPath: this.execPath, execArgv: [],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true, serialization: 'json', stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    current.child = child;
    current.exitedPromise = new Promise(resolve => { current.onExited = resolve; });
    child.on('error', () => this.fail(current, failure()));
    child.once('exit', () => {
      current.exited = true; clearTimeout(current.timer); current.onExited();
      if (!current.cancelled) this.fail(current, failure('network/closed'));
    });
    child.on('message', message => {
      if (message?.type === 'ready' && !current.cancelled) {
        let url;
        try { url = new URL(message.url); } catch { return this.fail(current, failure()); }
        if (url.protocol !== 'https:' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname)
          || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return this.fail(current, failure());
        clearTimeout(current.timer); current.settled = true;
        this.state = 'ready'; this.error = undefined;
        current.resolve({ url: url.origin, kind: 'automatic', state: 'ready' });
      } else if (message?.type === 'fatal' && !current.cancelled) this.fail(current, failure(message.code === 'network/timeout' ? message.code : undefined));
    });
    current.timer = setTimeout(() => this.fail(current, failure('network/timeout')), this.timeoutMs + 1000);
    try {
      child.send({ type: 'start', executable: this.executable, expectedSha256: this.expectedSha256,
        config, port: current.port, timeoutMs: this.timeoutMs }, error => { if (error) this.fail(current, failure()); });
    } catch { this.fail(current, failure()); }
  }

  fail(current, error) {
    if (this.current !== current || current.cancelled) return;
    this.state = 'error'; this.error = error;
    clearTimeout(current.timer);
    if (!current.settled) { current.settled = true; current.reject(error); }
    // Disconnect invokes the independent worker's exact-child cleanup. Do not
    // kill the watchdog, which could strand the tunnel it is supervising.
    try { if (current.child?.connected) current.child.disconnect(); } catch {}
    if (!current.child || current.exited) this.current = undefined;
    else current.exitedPromise.then(() => { if (this.current === current) this.current = undefined; });
  }

  stop() {
    if (this.stopping) return this.stopping;
    const current = this.current;
    if (!current) { this.state = 'idle'; this.error = undefined; return Promise.resolve(this.status()); }
    current.cancelled = true;
    clearTimeout(current.timer);
    if (!current.settled) { current.settled = true; current.reject(failure('network/cancelled')); }
    this.stopping = (async () => {
      if (current.child && !current.exited) {
        try { if (current.child.connected) current.child.disconnect(); } catch {}
        let timer;
        try {
          await Promise.race([current.exitedPromise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new TunnelError('network/cleanup', 'The secure connection is still closing. Wait briefly and stop sharing again.')), this.shutdownMs);
          })]);
        } finally { clearTimeout(timer); }
      }
      if (this.current === current) this.current = undefined;
      this.state = 'idle'; this.error = undefined;
      return this.status();
    })().catch(error => { this.state = 'error'; this.error = error; throw error; }).finally(() => { this.stopping = undefined; });
    return this.stopping;
  }

  dispose() { this.disposed = true; return this.stop(); }
}
