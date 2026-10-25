import { createRequire } from 'node:module';
import { join } from 'node:path';
import { desktopError } from './desktop-errors.mjs';

const require = createRequire(import.meta.url);
const unavailable = () => desktopError('DESKTOP_UNAVAILABLE', 'The interactive Windows desktop is unavailable.');

function loadKoffi(path) {
  const candidates = [path, 'koffi'];
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar.unpacked', 'dsh', 'node_modules', 'koffi'));
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return require(candidate); } catch {}
  }
  throw desktopError('DESKTOP_UNSUPPORTED', 'The bundled Windows native runtime is unavailable.');
}

export function createWin32Native(options = {}) {
  if (process.platform !== 'win32') throw desktopError('DESKTOP_UNSUPPORTED', 'Desktop sharing requires Windows.');
  const koffi = loadKoffi(options.koffiPath);
  const user = koffi.load('user32.dll'); const gdi = koffi.load('gdi32.dll');
  const kernel = koffi.load('kernel32.dll'); const wts = koffi.load('wtsapi32.dll');
  const rect = koffi.struct({ left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' });
  const monitorInfo = koffi.struct({ cbSize: 'uint32_t', rcMonitor: rect, rcWork: rect, dwFlags: 'uint32_t', szDevice: koffi.array('uint16_t', 32) });
  const monitorCallback = koffi.proto('int __stdcall DesktopMonitorCallback(void *monitor, void *dc, void *rect, intptr_t data)');
  const mouseInput = koffi.struct({ dx: 'int32_t', dy: 'int32_t', mouseData: 'uint32_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t' });
  const keyInput = koffi.struct({ wVk: 'uint16_t', wScan: 'uint16_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t' });
  const hardwareInput = koffi.struct({ uMsg: 'uint32_t', wParamL: 'uint16_t', wParamH: 'uint16_t' });
  const inputStruct = koffi.struct({ type: 'uint32_t', u: koffi.union({ mi: mouseInput, ki: keyInput, hi: hardwareInput }) });
  const api = {
    EnumDisplayMonitors: user.func('__stdcall', 'EnumDisplayMonitors', 'int', ['void *', 'void *', koffi.pointer(monitorCallback), 'intptr_t']),
    GetMonitorInfo: user.func('__stdcall', 'GetMonitorInfoW', 'int', ['void *', koffi.inout(koffi.pointer(monitorInfo))]),
    OpenInputDesktop: user.func('void * __stdcall OpenInputDesktop(uint32_t flags, int inherit, uint32_t access)'),
    CloseDesktop: user.func('int __stdcall CloseDesktop(void *desktop)'),
    GetThreadDesktop: user.func('void * __stdcall GetThreadDesktop(uint32_t threadId)'),
    GetUserObjectInformation: user.func('int __stdcall GetUserObjectInformationW(void *object, int index, void *buffer, uint32_t size, _Out_ uint32_t *needed)'),
    GetCurrentThreadId: kernel.func('uint32_t __stdcall GetCurrentThreadId()'),
    GetCurrentProcessId: kernel.func('uint32_t __stdcall GetCurrentProcessId()'),
    ProcessIdToSessionId: kernel.func('int __stdcall ProcessIdToSessionId(uint32_t processId, _Out_ uint32_t *sessionId)'),
    WTSQuerySessionInformation: wts.func('int __stdcall WTSQuerySessionInformationW(void *server, uint32_t sessionId, int infoClass, _Out_ void **buffer, _Out_ uint32_t *bytes)'),
    WTSFreeMemory: wts.func('void __stdcall WTSFreeMemory(void *memory)'),
    GetDC: user.func('void * __stdcall GetDC(void *window)'),
    ReleaseDC: user.func('int __stdcall ReleaseDC(void *window, void *dc)'),
    CreateCompatibleDC: gdi.func('void * __stdcall CreateCompatibleDC(void *dc)'),
    DeleteDC: gdi.func('int __stdcall DeleteDC(void *dc)'),
    CreateDIBSection: gdi.func('void * __stdcall CreateDIBSection(void *dc, const void *info, uint32_t usage, _Out_ void **bits, void *section, uint32_t offset)'),
    SelectObject: gdi.func('void * __stdcall SelectObject(void *dc, void *object)'),
    DeleteObject: gdi.func('int __stdcall DeleteObject(void *object)'),
    StretchBlt: gdi.func('int __stdcall StretchBlt(void *dest, int x, int y, int width, int height, void *src, int sx, int sy, int swidth, int sheight, uint32_t op)'),
    SetStretchBltMode: gdi.func('int __stdcall SetStretchBltMode(void *dc, int mode)'),
    SetBrushOrgEx: gdi.func('int __stdcall SetBrushOrgEx(void *dc, int x, int y, void *oldOrigin)'),
    GdiFlush: gdi.func('int __stdcall GdiFlush()'),
    SendInput: user.func('__stdcall', 'SendInput', 'uint32_t', ['uint32_t', koffi.pointer(inputStruct), 'int']),
  };
  // This helper owns no windows. Thread awareness avoids parent Electron DPI
  // state and keeps GetMonitorInfo/GDI/SendInput in physical desktop pixels.
  try {
    const dpi = user.func('void * __stdcall SetThreadDpiAwarenessContext(void *context)');
    if (!dpi(-4n)) throw unavailable();
  } catch { throw desktopError('DESKTOP_UNSUPPORTED', 'Per-monitor Windows DPI awareness is unavailable.'); }
  const expectedSize = process.arch === 'ia32' ? 28 : 40;
  if (koffi.sizeof(inputStruct) !== expectedSize) throw desktopError('DESKTOP_UNSUPPORTED', 'The Windows input ABI is unsupported.');

  function desktopName(handle) {
    const buffer = Buffer.alloc(512); const needed = [0];
    if (!handle || !api.GetUserObjectInformation(handle, 2, buffer, buffer.length, needed)) throw unavailable();
    return buffer.toString('utf16le').split('\0')[0];
  }
  function assertAvailable() {
    const sessionId = [0]; const state = [null]; const bytes = [0];
    if (!api.ProcessIdToSessionId(api.GetCurrentProcessId(), sessionId)) throw unavailable();
    try {
      if (!api.WTSQuerySessionInformation(null, sessionId[0], 8, state, bytes) || !state[0] || bytes[0] < 4 || koffi.decode(state[0], 'int') !== 0) throw unavailable();
    } finally { if (state[0]) api.WTSFreeMemory(state[0]); }
    const inputDesktop = api.OpenInputDesktop(0, 0, 1);
    if (!inputDesktop) throw unavailable();
    try {
      const inputName = desktopName(inputDesktop);
      const threadName = desktopName(api.GetThreadDesktop(api.GetCurrentThreadId()));
      if (!inputName || inputName.toLowerCase() !== 'default' || inputName !== threadName) throw unavailable();
    } finally { api.CloseDesktop(inputDesktop); }
  }
  function monitors() {
    assertAvailable();
    const result = []; let error;
    const success = api.EnumDisplayMonitors(null, null, handle => {
      try {
        const info = { cbSize: koffi.sizeof(monitorInfo) };
        if (!api.GetMonitorInfo(handle, info)) throw unavailable();
        const name = String.fromCharCode(...info.szDevice).split('\0')[0]; const bounds = info.rcMonitor;
        const width = bounds.right - bounds.left; const height = bounds.bottom - bounds.top;
        if (width > 0 && height > 0) result.push({ id: name, name, x: bounds.left, y: bounds.top, width, height, primary: Boolean(info.dwFlags & 1) });
        return 1;
      } catch (caught) { error = caught; return 0; }
    }, 0);
    if (!success || error || !result.length) throw error || unavailable();
    return result;
  }
  function capture(monitor, size) {
    assertAvailable();
    const { width, height } = size;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16_777_216) throw desktopError('INVALID_FRAME', 'The desktop frame exceeds supported dimensions.');
    let screen; let memory; let bitmap; let old;
    try {
      screen = api.GetDC(null); if (!screen) throw unavailable();
      memory = api.CreateCompatibleDC(screen); if (!memory) throw unavailable();
      const info = Buffer.alloc(44); info.writeUInt32LE(40, 0); info.writeInt32LE(width, 4); info.writeInt32LE(-height, 8); info.writeUInt16LE(1, 12); info.writeUInt16LE(32, 14);
      const bits = [null]; bitmap = api.CreateDIBSection(screen, info, 0, bits, null, 0);
      if (!bitmap || !bits[0]) throw unavailable();
      old = api.SelectObject(memory, bitmap);
      if (!old || old === -1n || old === 0xffffffffffffffffn) { old = null; throw unavailable(); }
      if (!api.SetStretchBltMode(memory, 4) || !api.SetBrushOrgEx(memory, 0, 0, null)) throw unavailable();
      // SRCCOPY | CAPTUREBLT includes layered windows. Negative source origins
      // belong to the virtual desktop DC and are kept intact.
      if (!api.StretchBlt(memory, 0, 0, width, height, screen, monitor.x, monitor.y, monitor.width, monitor.height, 0x40cc0020) || !api.GdiFlush()) throw unavailable();
      assertAvailable();
      return Buffer.from(koffi.decode(bits[0], 'uint8_t', width * height * 4));
    } finally {
      if (old && memory) api.SelectObject(memory, old);
      if (bitmap) api.DeleteObject(bitmap);
      if (memory) api.DeleteDC(memory);
      if (screen) api.ReleaseDC(null, screen);
    }
  }
  function sendInputs(events) {
    assertAvailable();
    const values = events.map(event => event.kind === 'mouse'
      ? { type: 0, u: { mi: { dx: event.dx, dy: event.dy, mouseData: event.data >>> 0, dwFlags: event.flags, time: 0, dwExtraInfo: 0 } } }
      : { type: 1, u: { ki: { wVk: event.vk, wScan: event.scan, dwFlags: event.flags, time: 0, dwExtraInfo: 0 } } });
    return api.SendInput(values.length, values, koffi.sizeof(inputStruct));
  }
  return { assertAvailable, monitors, capture, sendInputs, dispose() {} };
}
