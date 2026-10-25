export const API_PATH = '/api/remote-control'

export function safeMessage(error, fallback = 'The request could not be completed. Try again when the device is connected.') {
  const raw = typeof error === 'string' ? error : error?.message
  if (!raw || error?.name === 'AbortError') return fallback
  return String(raw)
    .replace(/\bDSH1\.[A-Za-z0-9._-]+/g, '[hidden connection code]')
    .replace(/([?&](?:k|token)=)[^&\s"']+/gi, '$1[hidden]')
    .replace(/(bearer\s+)[^\s"']+/gi, '$1[hidden]')
    .replace(/((?:token|x-companion-token|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[hidden]')
    .slice(0, 400)
}

export async function requestRemote(action, args = {}, {signal, fetchImpl = globalThis.fetch, timeout = 15000} = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, {once: true})
  const timer = setTimeout(abort, timeout)
  try {
    const response = await fetchImpl(API_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'content-type': 'application/json', 'x-dsh-remote-control': '1'},
      body: JSON.stringify({action, ...args}),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok !== true) {
      const error = new Error(safeMessage(data?.error, response.status === 401
        ? 'Your DSH sign-in has expired. Sign in again, then reconnect.'
        : 'The device did not complete the request. Check the connection and try again.'))
      error.code = data?.error?.code || `HTTP_${response.status}`
      throw error
    }
    return data.value
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      const timeoutError = new Error('The request timed out. Its outcome may be unknown. Check the device before sending it again.')
      timeoutError.code = 'TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() || `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function draftKey(remoteId, sessionId) {
  return JSON.stringify([remoteId || '', sessionId || ''])
}

export function frameUrl(remoteId, monitorId, maxWidth = 1280) {
  const query = new URLSearchParams({remoteId, monitorId, maxWidth: String(maxWidth)})
  return `${API_PATH}/frame?${query}`
}

export function pointerPosition(rect, event, monitor) {
  if (!monitor || rect.width <= 0 || rect.height <= 0) return null
  const clamp = value => Math.max(0, Math.min(1, value))
  return {
    x: Math.round(monitor.x + clamp((event.clientX - rect.left) / rect.width) * Math.max(0, monitor.width - 1)),
    y: Math.round(monitor.y + clamp((event.clientY - rect.top) / rect.height) * Math.max(0, monitor.height - 1)),
  }
}

const keys = new Set(['Control', 'Alt', 'Shift', 'Meta', 'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
  'Insert', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'PrintScreen', 'ContextMenu', ' ', 'Space',
  ';', '=', ',', '-', '.', '/', '`', '[', '\\', ']', "'"])
const physicalPunctuation = {Semicolon:';', Equal:'=', Comma:',', Minus:'-', Period:'.', Slash:'/',
  Backquote:'`', BracketLeft:'[', Backslash:'\\', BracketRight:']', Quote:"'", Space:' '}

export function desktopKey(key, code) {
  if (typeof key !== 'string') return null
  // Modifiers are sent as their own key events. Keep down/up on the same physical key
  // even when Shift changes event.key ("!"/"1", ":"/";", "A"/"a").
  if (typeof code === 'string') {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
    if (/^Digit[0-9]$/.test(code)) return code.slice(5)
    if (Object.hasOwn(physicalPunctuation, code)) return physicalPunctuation[code]
  }
  return keys.has(key) || /^[a-zA-Z0-9]$/.test(key) || /^F(?:[1-9]|1[0-2])$/.test(key) ? key : null
}

export function deviceAddress(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`
  } catch { return 'Saved connection' }
}

export function formatTime(value) {
  if (value == null) return ''
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {hour: '2-digit', minute: '2-digit'}).format(date)
}

export function filterSessions(sessions, query) {
  const search = query.trim().toLocaleLowerCase()
  return search ? sessions.filter(item => `${item.title || ''} ${item.cwd || ''}`.toLocaleLowerCase().includes(search)) : sessions
}

export function canPromptSession(connectionMode, agentAvailable) {
  return connectionMode !== 'web' || agentAvailable !== false
}

// Native input is ordered once. Changing control ownership invalidates queued work.
export function createDesktopInputQueue({remoteId, request = requestRemote, onFailure = () => {}}) {
  let generation = 0, active = false, queue = Promise.resolve()
  const held = new Set(), buttons = new Set()
  function release(keepActive = false) {
    const hadControl = active || held.size || buttons.size
    generation++; active = keepActive; held.clear(); buttons.clear()
    if (!hadControl) return queue
    queue = queue.catch(() => {}).then(() => request('desktop.release', {remoteId}, {timeout:8000})).catch(() => {})
    return queue
  }
  function send(input) {
    if (!active) return Promise.resolve(false)
    const currentGeneration = generation
    if (input.type === 'key') input.down ? held.add(input.key) : held.delete(input.key)
    if (input.type === 'button') input.down ? buttons.add(input.button) : buttons.delete(input.button)
    const operation = queue.catch(() => {}).then(async () => {
      if (!active || generation !== currentGeneration) return false
      try { await request('desktop.input', {remoteId, eventId:makeRequestId(), input}, {timeout:8000}); return true }
      catch (error) {
        if (generation === currentGeneration) { release(); onFailure(error) }
        return false
      }
    })
    queue = operation
    return operation
  }
  return {enable:() => { active = true }, send, release}
}
