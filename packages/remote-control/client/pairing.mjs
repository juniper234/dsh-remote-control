import {API_PATH, requestRemote} from './helpers.mjs'

export function remoteWindowUrl(remoteId) {
  if (typeof remoteId !== 'string' || !remoteId || remoteId.length > 200) throw new Error('Choose a saved device first.')
  return `${API_PATH}/window?${new URLSearchParams({remoteId})}`
}

// The desktop harness deliberately denies browser popups. Ask the local plugin
// to launch its authenticated app window; no bootstrap ticket reaches this UI.
export async function openRemoteWindow(remoteId, request = requestRemote) {
  const result = await request('window.open', {remoteId}, {timeout:20000})
  if (result?.opened !== true) throw new Error('The remote window could not be opened. Choose Open remote window to try again.')
  return result
}

export async function claimRemoteWindow({location = globalThis.location, history = globalThis.history, fetchImpl = globalThis.fetch} = {}) {
  if (!location?.hash) return {claimed:false}
  const ticket = new URLSearchParams(location.hash.slice(1)).get('ticket')
  // Remove the fragment before making any network request or rendering the app.
  // This also prevents the one-use ticket from surviving a reload in history.
  history.replaceState(null, '', `${location.pathname}${location.search}`)
  if (typeof ticket !== 'string' || !ticket || ticket.length > 4096 || /\s/.test(ticket)) throw new Error('This remote window link is invalid. Open it again from Remote Control.')
  try {
    const response = await fetchImpl('/window/claim', {method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({ticket}),signal:AbortSignal.timeout(15000)})
    if (!response.ok) throw new Error('Window claim failed')
    return {claimed:true}
  } catch { throw new Error('This remote window link has expired or could not be opened. Open it again from Remote Control.') }
}

export function invitationLifetime(preset, value, unit = 'minutes') {
  if (preset === 'never') return null
  if (preset === '30min') return 30 * 60 * 1000
  if (preset === '1hr') return 60 * 60 * 1000
  const factors = {minutes:60000,hours:3600000,days:86400000}
  const numeric = Number(value)
  const milliseconds = numeric * factors[unit]
  if (preset !== 'custom' || String(value).trim() === '' || !Object.hasOwn(factors,unit) || !Number.isFinite(numeric) || numeric <= 0 || !Number.isSafeInteger(milliseconds) || milliseconds <= 0 || !Number.isSafeInteger(Date.now() + milliseconds)) throw new Error('Enter a positive custom duration in minutes, hours or days.')
  return milliseconds
}

export function expiryText(expiresAt, now = Date.now(), useLimit = 'once') {
  const uses = useLimit === 'unlimited' ? 'unlimited uses' : 'one use'
  if (expiresAt === null) return `No expiry · ${uses}`
  const remaining = Math.max(0, Math.ceil((Number(expiresAt) - now) / 1000))
  if (!Number.isFinite(remaining) || remaining === 0) return 'Code expired. Generate a new one.'
  const duration = remaining >= 86400 ? `${Math.floor(remaining / 86400)}d ${Math.floor((remaining % 86400) / 3600)}h`
    : remaining >= 3600 ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`
    : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  return `Expires in ${duration} · ${uses}`
}

/** One serial status/heartbeat loop, including while the window is hidden.
 * A failed renewal loses local input immediately. Recovery is read-only until
 * the owner explicitly reconnects; no lease acquisition or mutation is replayed.
 */
export function watchControl({remoteId, request = requestRemote, onChange,
  schedule = setTimeout, unschedule = clearTimeout, interval = 8000}) {
  let stopped = false, timer, held = false, renewalFailed = false
  const controller = new AbortController()
  const tick = async () => {
    try {
      const action = held && !renewalFailed ? 'control.heartbeat' : 'control.status'
      const value = await request(action, {remoteId}, {signal:controller.signal, timeout:10000})
      if (stopped) return
      held = value?.heldByYou === true && !renewalFailed
      onChange({value:{...value, heldByYou:held}, error:''})
    } catch (error) {
      if (stopped) return
      held = false; renewalFailed = true
      onChange({value:{owner:'local', heldByYou:false}, error})
    } finally { if (!stopped) timer = schedule(tick, interval) }
  }
  tick()
  return () => { stopped = true; controller.abort(); unschedule(timer) }
}

export async function releaseRemote(remoteId, request = requestRemote) {
  // Release held native input first, then the chat-control lease. Best effort on
  // close is backed by the server's short lease timeout.
  try { await request('desktop.release', {remoteId}, {timeout:4000}) } catch {}
  return request('control.release', {remoteId}, {timeout:8000})
}

export function installLocalHandoffBanner({document:doc = globalThis.document, request = requestRemote,
  schedule = setTimeout, unschedule = clearTimeout} = {}) {
  if (!doc?.body) return () => {}
  const banner = doc.createElement('aside')
  banner.setAttribute('aria-label', 'Remote control handoff')
  banner.setAttribute('role', 'status')
  banner.className = 'dsh-remote-handoff'
  banner.hidden = true
  banner.style.cssText = 'position:fixed;z-index:2147483000;bottom:20px;left:50%;transform:translateX(-50%);width:min(620px,calc(100% - 32px));box-sizing:border-box;padding:14px 16px;border:1px solid #535a71;border-radius:14px;background:#1b1e29f5;box-shadow:0 14px 50px #0005;color:#f3f4f8;font:13px/1.5 system-ui;display:flex;align-items:center;gap:14px'
  banner.style.display = 'none'
  const copy = doc.createElement('span'); copy.style.flex = '1'
  const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Take back control'
  button.style.cssText = 'border:0;border-radius:8px;background:#e5e9ff;color:#171a29;padding:10px 13px;font:600 13px system-ui;cursor:pointer;white-space:nowrap'
  banner.append(copy, button); doc.body.append(banner)
  let stopped = false, timer, busy = false, generation = 0
  const controller = new AbortController()
  const render = state => {
    const remote = state?.control?.owner === 'remote'
    banner.hidden = !remote; banner.style.display = remote ? 'flex' : 'none'
    if (remote) copy.textContent = `${state.control.label || 'Another computer'} is controlling DSH. Local chat actions are paused.`
  }
  const tick = async () => {
    const current = generation
    try { const state = await request('sharing.status', {}, {signal:controller.signal}); if (!stopped && current === generation) render(state) }
    catch { /* Keep the last known handoff and recovery button visible. */ }
    finally { if (!stopped) timer = schedule(tick, 2000) }
  }
  button.onclick = async () => {
    if (busy) return
    busy = true; generation++; button.disabled = true; button.textContent = 'Taking back…'
    try {
      const state = await request('sharing.reclaim', {}, {signal:controller.signal})
      if (!stopped) render(state)
    } catch { if (!stopped) copy.textContent = 'Could not confirm control was returned. Keep DSH open and try Take back control again.' }
    finally { busy = false; button.disabled = false; button.textContent = 'Take back control' }
  }
  tick()
  return () => { stopped = true; controller.abort(); unschedule(timer); banner.remove() }
}
