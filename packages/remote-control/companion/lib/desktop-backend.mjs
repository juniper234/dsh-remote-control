import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopError, safeDesktopError } from './desktop-errors.mjs';
import { validateInput, validateFrameRequest } from './desktop-input.mjs';

export function createDesktopBackend(options = {}) {
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs >= 50 && options.timeoutMs <= 30000 ? options.timeoutMs : 5000;
  const helperPath = options.helperPath || fileURLToPath(new URL('./desktop-helper.mjs', import.meta.url));
  let child; let ready; let failure; let disposed = false; let sequence = 0; let queue = Promise.resolve(); let disposal;
  const pending = new Map();
  const unavailable = () => desktopError('HELPER_UNAVAILABLE', 'The desktop helper stopped or did not respond. Reconnect to try again.');
  function fail(error = unavailable()) {
    if (!failure) failure = error;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(failure); }
    pending.clear();
  }
  function stopHelper() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    // Disconnect first: the independent helper can release held inputs even
    // while the main operation queue is stalled. Windows kill is a last resort.
    const timer = setTimeout(() => child.kill(), 1000);
    child.once('exit', () => clearTimeout(timer));
    try { if (child.connected) child.disconnect(); } catch {}
  }
  function start() {
    if (failure) return Promise.reject(failure);
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { const error = unavailable(); fail(error); reject(error); child?.kill(); }, timeoutMs);
      const abort = error => { clearTimeout(timer); fail(error); reject(error); };
      try {
        const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
        if (options.koffiPath) env.DSH_REMOTE_KOFFI_PATH = options.koffiPath;
        else if (process.resourcesPath) env.DSH_REMOTE_KOFFI_PATH = join(process.resourcesPath, 'app.asar.unpacked', 'dsh', 'node_modules', 'koffi');
        else env.DSH_REMOTE_KOFFI_PATH = process.env.DSH_REMOTE_KOFFI_PATH || join(dirname(options.execPath || process.execPath), 'resources', 'app.asar.unpacked', 'dsh', 'node_modules', 'koffi');
        // JSON IPC also works when the caller uses a newer standalone Node than
        // the installed Electron runtime; V8 structured-clone versions differ.
        child = (options.forkHelper || fork)(helperPath, [], { execPath: options.execPath || process.execPath, execArgv: [], env, serialization: 'json', windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        child.on('error', () => abort(unavailable()));
        child.on('exit', () => { if (!disposed) abort(unavailable()); else fail(unavailable()); });
        child.on('message', message => {
          if (message?.type === 'ready') { clearTimeout(timer); resolve(); return; }
          if (message?.type === 'fatal') { const safe = safeDesktopError(message.error); abort(desktopError(safe.code, safe.message)); return; }
          const request = pending.get(message?.id);
          if (!request) return;
          pending.delete(message.id); clearTimeout(request.timer);
          if (message.ok === true) request.resolve(message.value);
          else { const safe = safeDesktopError(message.error); request.reject(desktopError(safe.code, safe.message)); }
        });
      } catch { abort(unavailable()); }
    });
    return ready;
  }
  async function call(operation, args) {
    await start();
    if (failure) throw failure;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { fail(unavailable()); stopHelper(); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { child.send({ id, operation, args }, error => { if (error) { fail(unavailable()); stopHelper(); } }); }
      catch { fail(unavailable()); stopHelper(); }
    });
  }
  function enqueue(operation, args) {
    const run = queue.then(() => {
      if (disposed) throw desktopError('DESKTOP_DISPOSED', 'Desktop sharing has stopped.');
      if (failure) throw failure;
      return call(operation, args);
    });
    queue = run.catch(() => {});
    return run;
  }
  async function monitors() {
    try { return await enqueue('monitors'); }
    catch (error) {
      if (error.code === 'DESKTOP_DISPOSED') throw error;
      return { monitors: [], available: false, reason: safeDesktopError(error).message };
    }
  }
  async function frame(request = {}) {
    const value = await enqueue('frame', validateFrameRequest(request));
    if (Buffer.isBuffer(value?.bytes)) return value;
    if (value?.bytes?.type === 'Buffer' && Array.isArray(value.bytes.data)) return { ...value, bytes: Buffer.from(value.bytes.data) };
    throw desktopError('INVALID_FRAME', 'The desktop helper returned an invalid frame.');
  }
  async function input(value) { return enqueue('input', validateInput(value)); }
  async function releaseAll() {
    if (!child && !disposed) return { accepted: true };
    return enqueue('releaseAll');
  }
  async function dispose() {
    if (disposal) return disposal;
    disposed = true;
    disposal = (async () => {
      await queue;
      if (!child) return;
      if (!failure && child.connected) { try { await call('dispose'); } catch {} }
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise((resolve, reject) => {
        let terminated = false, deadline;
        const cleanup = () => { clearTimeout(timer); clearTimeout(deadline); child.off('exit', exited); };
        const exited = () => { if (terminated) return; terminated = true; cleanup(); resolve(); };
        const refused = () => { if (terminated) return; terminated = true; cleanup(); reject(unavailable()); };
        const timer = setTimeout(() => {
          try {
            if (child.exitCode !== null || child.signalCode !== null) return exited();
            if (!child.kill()) return refused();
            if (!terminated) deadline = setTimeout(refused, 1500);
          } catch { refused(); }
        }, 1500);
        child.once('exit', exited);
        try { if (child.connected) child.disconnect(); } catch { /* the termination timer remains active */ }
      });
    })();
    return disposal;
  }
  return { monitors, frame, input, releaseAll, dispose, get failed() { return Boolean(failure); } };
}
