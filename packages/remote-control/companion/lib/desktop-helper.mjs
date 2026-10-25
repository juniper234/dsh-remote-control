import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeDesktopError } from './desktop-errors.mjs';
import { createDesktopService } from './desktop-service.mjs';

// Only fixed operation names cross this private, inherited IPC channel. No code,
// shell commands, file paths, or arbitrary native functions are accepted.
export function serveDesktopHelper(service) {
  let queue = Promise.resolve(); let closing = false; let lastInput = 0;
  const send = message => { if (process.connected) process.send(message, () => {}); };
  async function close() {
    if (closing) return;
    closing = true; clearInterval(safetyTimer);
    try { await service.dispose(); } catch {}
    if (process.connected) process.disconnect();
  }
  const safetyTimer = setInterval(() => {
    if (closing || !lastInput || Date.now() - lastInput < 15000) return;
    lastInput = 0;
    queue = queue.then(() => service.releaseAll()).catch(() => { lastInput = Date.now() - 15000; });
  }, 1000);
  safetyTimer.unref();
  process.on('message', message => {
    if (closing || !message || !Number.isSafeInteger(message.id) || message.id < 1) return;
    queue = queue.then(async () => {
      if (closing) return;
      const { id, operation, args } = message;
      if (!['monitors', 'frame', 'input', 'releaseAll', 'dispose'].includes(operation)) { send({ id, ok: false, error: { code: 'INVALID_INPUT' } }); return; }
      try {
        const value = await service[operation](args);
        if (operation === 'input') lastInput = Date.now();
        if (operation === 'releaseAll') lastInput = 0;
        send({ id, ok: true, value });
        if (operation === 'dispose') await close();
      } catch (error) { send({ id, ok: false, error: safeDesktopError(error) }); }
    }).catch(() => {});
  });
  process.once('disconnect', close);
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  send({ type: 'ready' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { createWin32Native } = await import('./desktop-win32.mjs');
    serveDesktopHelper(createDesktopService(createWin32Native({ koffiPath: process.env.DSH_REMOTE_KOFFI_PATH })));
  } catch (error) {
    if (process.connected) process.send({ type: 'fatal', error: safeDesktopError(error) }, () => process.disconnect());
  }
}
