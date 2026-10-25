import { desktopError } from './desktop-errors.mjs';

const invalid = () => { throw desktopError('INVALID_INPUT', 'The desktop request is invalid.'); };
const buttons = { left: [2, 4], right: [8, 16], middle: [32, 64] };
const specialKeys = {
  Control: [0x11, 0], Alt: [0x12, 0], Shift: [0x10, 0], Meta: [0x5b, 1],
  Enter: [13, 0], Escape: [27, 0], Tab: [9, 0], Backspace: [8, 0], Delete: [46, 1],
  ArrowLeft: [37, 1], ArrowUp: [38, 1], ArrowRight: [39, 1], ArrowDown: [40, 1],
  Home: [36, 1], End: [35, 1], PageUp: [33, 1], PageDown: [34, 1], Insert: [45, 1],
  CapsLock: [20, 0], NumLock: [144, 1], ScrollLock: [145, 0], Pause: [19, 0], PrintScreen: [44, 1],
  ContextMenu: [93, 1], ' ': [32, 0], Space: [32, 0],
  ';': [186, 0], '=': [187, 0], ',': [188, 0], '-': [189, 0], '.': [190, 0], '/': [191, 0],
  '`': [192, 0], '[': [219, 0], '\\': [220, 0], ']': [221, 0], "'": [222, 0],
};

function keyCode(key) {
  if (typeof key !== 'string') return null;
  if (/^[a-z0-9]$/i.test(key)) return [key.toUpperCase().charCodeAt(0), 0];
  if (/^F([1-9]|1[0-2])$/.test(key)) return [111 + Number(key.slice(1)), 0];
  return Object.hasOwn(specialKeys, key) ? specialKeys[key] : null;
}

function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid();
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
}

function coordinate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) invalid();
  return Math.round(value);
}

export function validateInput(value) {
  object(value, ['type', 'x', 'y', 'button', 'down', 'count', 'deltaX', 'deltaY', 'key', 'text']);
  const fields = {
    move: ['type', 'x', 'y'], click: ['type', 'x', 'y', 'button', 'count'],
    button: ['type', 'button', 'down', 'x', 'y'], scroll: ['type', 'x', 'y', 'deltaX', 'deltaY'],
    key: ['type', 'key', 'down'], text: ['type', 'text'],
  };
  if (typeof value.type !== 'string' || !Object.hasOwn(fields, value.type)) invalid();
  object(value, fields[value.type]);
  const result = { ...value };
  if (value.type === 'move' || value.type === 'click' || value.x !== undefined || value.y !== undefined) {
    result.x = coordinate(value.x); result.y = coordinate(value.y);
  }
  if (value.type === 'button' || value.type === 'click') {
    if (!Object.hasOwn(buttons, value.button)) invalid();
    if (value.type === 'click' && value.count !== 1 && value.count !== 2) invalid();
  }
  if ((value.type === 'key' || value.type === 'button') && typeof value.down !== 'boolean') invalid();
  if (value.type === 'key' && !keyCode(value.key)) invalid();
  if (value.type === 'scroll') {
    for (const key of ['deltaX', 'deltaY']) {
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Math.abs(value[key]) > 12000) invalid();
      result[key] = Math.round(value[key]);
    }
  }
  if (value.type === 'text') {
    if (typeof value.text !== 'string' || value.text.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.text)) invalid();
    // Reject lone surrogates while preserving valid supplementary characters.
    for (let i = 0; i < value.text.length; i++) {
      const code = value.text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) { const low = value.text.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) invalid(); }
      else if (code >= 0xdc00 && code <= 0xdfff) invalid();
    }
  }
  return result;
}

export function validateFrameRequest(value = {}) {
  object(value, ['monitorId', 'maxWidth']);
  const maxWidth = value.maxWidth === undefined ? 1280 : value.maxWidth;
  if (!Number.isInteger(maxWidth) || maxWidth < 64 || maxWidth > 4096) invalid();
  const result = { maxWidth };
  if (value.monitorId !== undefined) {
    if (typeof value.monitorId !== 'string' || !/^[a-zA-Z0-9_.\\-]{1,128}$/.test(value.monitorId)) invalid();
    result.monitorId = value.monitorId;
  }
  return result;
}

const mouse = (flags, data = 0, dx = 0, dy = 0) => ({ kind: 'mouse', dx, dy, data, flags });
const keyboard = (vk, scan, flags) => ({ kind: 'key', vk, scan, flags });

function movement(x, y, monitors) {
  if (!monitors.some(m => x >= m.x && y >= m.y && x < m.x + m.width && y < m.y + m.height)) invalid();
  const left = Math.min(...monitors.map(m => m.x)); const top = Math.min(...monitors.map(m => m.y));
  const right = Math.max(...monitors.map(m => m.x + m.width)); const bottom = Math.max(...monitors.map(m => m.y + m.height));
  return mouse(0xc001, 0, Math.round((x - left) * 65535 / Math.max(1, right - left - 1)), Math.round((y - top) * 65535 / Math.max(1, bottom - top - 1)));
}

export function createInputController(native) {
  const held = new Map();
  function track(event) {
    if (event.kind === 'key') {
      const id = `key:${event.vk}:${event.scan}:${event.flags & 4}`;
      if (event.flags & 2) held.delete(id); else held.set(id, { ...event, flags: event.flags | 2 });
    } else {
      for (const [button, [down, up]] of Object.entries(buttons)) {
        if (event.flags & down) held.set(`button:${button}`, mouse(up));
        if (event.flags & up) held.delete(`button:${button}`);
      }
    }
  }
  async function send(events) {
    if (!events.length) return;
    const count = await native.sendInputs(events);
    const sent = Number.isInteger(count) && count >= 0 && count <= events.length ? count : 0;
    events.slice(0, sent).forEach(track);
    if (sent !== events.length) throw desktopError('INPUT_BLOCKED', 'Windows blocked some desktop input.');
  }
  async function releaseAll() {
    if (!held.size) return { accepted: true };
    await native.assertAvailable();
    await send([...held.values()].reverse());
    return { accepted: true };
  }
  async function input(raw) {
    const value = validateInput(raw);
    await native.assertAvailable();
    const events = [];
    if (value.x !== undefined) events.push(movement(value.x, value.y, await native.monitors()));
    if (value.type === 'click') for (let i = 0; i < value.count; i++) events.push(mouse(buttons[value.button][0]), mouse(buttons[value.button][1]));
    if (value.type === 'button') events.push(mouse(buttons[value.button][value.down ? 0 : 1]));
    if (value.type === 'scroll') {
      if (value.deltaY) events.push(mouse(0x800, -value.deltaY));
      if (value.deltaX) events.push(mouse(0x1000, value.deltaX));
    }
    if (value.type === 'key') { const [vk, flags] = keyCode(value.key); events.push(keyboard(vk, 0, flags | (value.down ? 0 : 2))); }
    if (value.type === 'text') for (let i = 0; i < value.text.length; i++) events.push(keyboard(0, value.text.charCodeAt(i), 4), keyboard(0, value.text.charCodeAt(i), 6));
    try { await send(events); }
    catch (error) { try { await releaseAll(); } catch {} throw error; }
    return { accepted: true };
  }
  return { input, releaseAll };
}
