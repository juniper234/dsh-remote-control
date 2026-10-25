export function desktopError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function safeDesktopError(error) {
  const messages = {
    INVALID_INPUT: 'The desktop request is invalid.',
    INVALID_FRAME: 'The desktop frame is invalid.',
    MONITOR_NOT_FOUND: 'The selected monitor is no longer connected.',
    DESKTOP_UNSUPPORTED: 'Desktop sharing requires Windows and the bundled native runtime.',
    DESKTOP_UNAVAILABLE: 'The Windows desktop is locked, disconnected, or unavailable. Unlock it locally and reconnect.',
    INPUT_BLOCKED: 'Windows blocked some desktop input. Elevated windows and secure desktops may require local interaction.',
    HELPER_UNAVAILABLE: 'The desktop helper stopped or did not respond. Reconnect to try again.',
    DESKTOP_DISPOSED: 'Desktop sharing has stopped.',
  };
  const code = Object.hasOwn(messages, error?.code) ? error.code : 'DESKTOP_UNAVAILABLE';
  return { code, message: messages[code] };
}
