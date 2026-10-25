import { desktopError, safeDesktopError } from './desktop-errors.mjs';
import { createInputController, validateFrameRequest } from './desktop-input.mjs';
import { encodeBgraPng } from './desktop-png.mjs';

export function createDesktopService(native) {
  const controller = createInputController(native);
  let disposed = false;
  function active() { if (disposed) throw desktopError('DESKTOP_DISPOSED', 'Desktop sharing has stopped.'); }
  async function monitors() {
    active();
    try {
      await native.assertAvailable();
      const items = await native.monitors();
      if (!items.length) throw desktopError('DESKTOP_UNAVAILABLE', 'No active monitors are available.');
      return { monitors: items, available: true };
    } catch (error) { return { monitors: [], available: false, reason: safeDesktopError(error).message }; }
  }
  async function frame(raw = {}) {
    active();
    const request = validateFrameRequest(raw);
    await native.assertAvailable();
    const items = await native.monitors();
    const monitor = request.monitorId ? items.find(m => m.id === request.monitorId) : items.find(m => m.primary) || items[0];
    if (!monitor) throw desktopError(request.monitorId ? 'MONITOR_NOT_FOUND' : 'DESKTOP_UNAVAILABLE', 'No selected monitor is available.');
    const width = Math.min(request.maxWidth, monitor.width);
    const height = Math.max(1, Math.round(monitor.height * width / monitor.width));
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || width * height > 16_777_216) throw desktopError('INVALID_FRAME', 'The desktop frame exceeds supported dimensions.');
    const bgra = await native.capture(monitor, { width, height });
    return { bytes: encodeBgraPng(bgra, width, height), contentType: 'image/png', width, height, x: monitor.x, y: monitor.y, monitorId: monitor.id, capturedAt: Date.now() };
  }
  async function input(value) { active(); return controller.input(value); }
  async function releaseAll() { active(); return controller.releaseAll(); }
  async function dispose() {
    if (disposed) return;
    try { await controller.releaseAll(); }
    finally { disposed = true; await native.dispose?.(); }
  }
  return { monitors, frame, input, releaseAll, dispose };
}
