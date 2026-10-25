import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react'
import styles from './styles.mjs'
import {openRemoteWindow, invitationLifetime, expiryText, watchControl, releaseRemote, installLocalHandoffBanner} from './pairing.mjs'
import {requestRemote, safeMessage, makeRequestId, draftKey, frameUrl, pointerPosition, desktopKey,
  deviceAddress, formatTime, filterSessions, createDesktopInputQueue, canPromptSession} from './helpers.mjs'
export {requestRemote, safeMessage, draftKey, frameUrl, pointerPosition, desktopKey, filterSessions} from './helpers.mjs'

const paths = {
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  sessions: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8m-8 4h5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  send: <><path d="m5 12 7-7 7 7M12 5v15"/></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
  warning: <><path d="m10.3 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 8v5m0 4h.01"/></>,
  link: <><path d="m10 13 4-4m-6 7-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0m2 10a4.2 4.2 0 0 0 6 0l4-4a4.2 4.2 0 0 0-6-6l-1 1"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/></>,
  edit: <><path d="m15 4 5 5M4 20l4-1 12-12a3.5 3.5 0 0 0-5-5L3 14l-1 6 6-1"/></>,
  cursor: <path d="m4 3 7 18 3-7 7-3L4 3Z"/>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/></>,
}

export function Icon({name = 'monitor', size = 16, ...props}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.monitor}</svg>
}

function Button({icon, children, primary, quiet, className = '', ...props}) {
  return <button type="button" className={`rc-btn ${primary ? 'rc-btn-primary' : ''} ${quiet ? 'rc-btn-quiet' : ''} ${className}`} {...props}>{icon && <Icon name={icon}/>} {children}</button>
}

function Notice({children, error, onDismiss}) {
  if (!children) return null
  return <div className="rc-banner" data-kind={error ? 'error' : 'info'} role={error ? 'alert' : 'status'}><Icon name={error ? 'warning' : 'link'}/><p>{children}</p>{onDismiss && <button className="rc-dismiss" aria-label="Dismiss message" onClick={onDismiss}><Icon name="close" size={14}/></button>}</div>
}

function Empty({icon = 'monitor', title, children, action}) {
  return <div className="rc-empty"><div className="rc-empty-inner"><div className="rc-empty-symbol"><Icon name={icon} size={23}/></div><h2>{title}</h2><p>{children}</p>{action}</div></div>
}

function useVisible(root) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    let intersects = true
    const update = () => setVisible(intersects && document.visibilityState !== 'hidden')
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      intersects = entries[0]?.isIntersecting !== false
      update()
    }) : null
    if (root.current) observer?.observe(root.current)
    document.addEventListener('visibilitychange', update)
    update()
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [root])
  return visible
}

function usePoll(action, args, active, interval, revision = 0) {
  const [state, setState] = useState({value: null, error: '', loading: active})
  const key = JSON.stringify(args)
  const intervalRef = useRef(interval)
  const previousKey = useRef('')
  intervalRef.current = interval
  useEffect(() => {
    if (!active) return
    let alive = true
    let timer
    const controller = new AbortController()
    const identity = `${action}:${key}`
    const same = previousKey.current === identity
    previousKey.current = identity
    setState(previous => same ? {...previous, error:'', loading:!previous.value} : {value:null, error:'', loading:true})
    const tick = async () => {
      try {
        const value = await requestRemote(action, JSON.parse(key), {signal: controller.signal})
        if (alive) setState({value, error: '', loading: false})
      } catch (error) {
        if (alive && !controller.signal.aborted) setState(previous => ({...previous, error: safeMessage(error), loading: false}))
      } finally {
        if (alive) timer = setTimeout(tick, intervalRef.current)
      }
    }
    tick()
    return () => { alive = false; clearTimeout(timer); controller.abort() }
  }, [action, key, active, revision])
  return previousKey.current === `${action}:${key}` ? state : {value:null, error:'', loading:active}
}

function useTaskScope(identity) {
  const scope = useRef({controllers: new Set(), generation: 0})
  useEffect(() => {
    const current = scope.current
    current.generation++
    return () => {
      current.generation++
      for (const controller of current.controllers) controller.abort()
      current.controllers.clear()
    }
  }, [identity])
  return useCallback(async (action, args, onSuccess, onError, onFinally) => {
    const current = scope.current
    const generation = current.generation
    const controller = new AbortController()
    current.controllers.add(controller)
    try {
      const value = await requestRemote(action, args, {signal: controller.signal})
      if (generation === current.generation && !controller.signal.aborted) onSuccess?.(value)
    } catch (error) {
      if (generation === current.generation && !controller.signal.aborted) onError?.(safeMessage(error))
    } finally {
      current.controllers.delete(controller)
      if (generation === current.generation && !controller.signal.aborted) onFinally?.()
    }
  }, [])
}

function DeviceDialog({device, onClose, onSaved, onRemoved}) {
  const id = useId()
  const [name, setName] = useState(device?.name || '')
  const [url, setUrl] = useState(device?.url || '')
  const [token, setToken] = useState('')
  const [mode, setMode] = useState(device?.mode || 'auto')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const task = useTaskScope(device?.id || 'new-device')
  useEffect(() => {
    const previousFocus = document.activeElement
    formRef.current?.querySelector('input')?.focus()
    return () => previousFocus?.isConnected && previousFocus.focus?.()
  }, [])
  function save(event) {
    event.preventDefault()
    if (busy || !name.trim() || !url.trim()) return
    setBusy(true); setError('')
    task('devices.save', {id: device?.id, name: name.trim(), url: url.trim(), mode, ...(token ? {token} : {})}, onSaved, setError, () => setBusy(false))
  }
  function remove() {
    if (!window.confirm(`Remove ${device.name} from this device list? Its sessions will remain on the remote device.`)) return
    setBusy(true); setError('')
    task('devices.remove', {remoteId: device.id}, () => onRemoved(device.id), setError, () => setBusy(false))
  }
  function trap(event) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const items = [...formRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')]
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div className="rc-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <form className="rc-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onSubmit={save} onKeyDown={trap} ref={formRef}>
      <div className="rc-dialog-head"><h2 id={`${id}-title`}>{device ? 'Device settings' : 'Add a device'}</h2><Button quiet className="rc-icon-btn" icon="close" aria-label="Close device settings" disabled={busy} onClick={onClose}/></div>
      <div className="rc-dialog-body">
        <p id={`${id}-description`}>Paste the pairing link from the device you want to access. Its private token is stored securely by DSH.</p>
        <div className="rc-field"><label htmlFor={`${id}-name`}>Device name</label><input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} placeholder="Home desktop" required maxLength={120} disabled={busy} autoComplete="off"/></div>
        <div className="rc-field"><label htmlFor={`${id}-url`}>Pairing link or device URL</label><div className="rc-input-with-button"><input id={`${id}-url`} type={show ? 'text' : 'password'} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-device.example" required disabled={busy} autoComplete="off" spellCheck={false}/><Button quiet icon="eye" aria-label={show ? 'Hide pairing link' : 'Show pairing link'} aria-pressed={show} onClick={() => setShow(!show)} disabled={busy}/></div><span className="rc-tiny">Pairing tokens are hidden from the device list.</span></div>
        <details><summary className="rc-label">Connection options</summary><div style={{display:'flex',flexDirection:'column',gap:12,marginTop:12}}><div className="rc-field"><label htmlFor={`${id}-mode`}>Connection type</label><select id={`${id}-mode`} value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><option value="auto">Automatic</option><option value="companion">Companion · sessions and desktop</option><option value="web">Web · sessions only</option></select></div><div className="rc-field"><label htmlFor={`${id}-token`}>{device?.hasToken ? 'Replace token (optional)' : 'Access token (optional)'}</label><input id={`${id}-token`} type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="new-password" disabled={busy}/><span className="rc-tiny">Leave blank when the pairing link includes a token{device?.hasToken ? ', or to keep the saved token' : ''}.</span></div></div></details>
        {error && <p className="rc-inline-error" role="alert">{error}</p>}
      </div>
      <div className="rc-dialog-foot">{device && <Button className="rc-btn-danger" disabled={busy} onClick={remove}>Remove device</Button>}<Button disabled={busy} onClick={onClose}>Cancel</Button><button className="rc-btn rc-btn-primary" type="submit" disabled={busy || !name.trim() || !url.trim()}>{busy ? 'Saving…' : device ? 'Save changes' : 'Add device'}</button></div>
    </form>
  </div>
}

function Sessions({device, connected, available, connectionMode, active, drafts, setDrafts, canControl = false}) {
  const id = useId()
  const [sessionId, setSessionId] = useState('')
  const [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [mode, setMode] = useState('queue')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [older, setOlder] = useState([])
  const [olderMore, setOlderMore] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [pending, setPending] = useState(false)
  const [showPicker, setShowPicker] = useState(true)
  const chatHeading = useRef(null)
  const search = useRef(null)
  const runningRef = useRef(false)
  const list = usePoll('sessions.list', {remoteId:device.id}, active && connected && available, runningRef.current ? 1000 : 3000, revision)
  const items = list.value?.items || []
  const session = items.find(item => item.sessionId === sessionId)
  const promptAvailable = canControl && canPromptSession(connectionMode, session?.agentAvailable)
  runningRef.current = items.some(item => item.running)
  const page = usePoll('sessions.page', {remoteId:device.id, sessionId, maxMessages:100}, active && connected && available && !!sessionId, session?.running || pending ? 1000 : 3000, revision)
  const task = useTaskScope(`${device.id}:${sessionId}`)
  const transcript = useRef(null)
  const follow = useRef(true)
  const key = draftKey(device.id, sessionId)
  const draft = drafts[key] || ''
  useEffect(() => {
    if (!sessionId && items.length) setSessionId(items[0].sessionId)
  }, [items, sessionId])
  useEffect(() => { setOlder([]); setOlderMore(null); setError(''); setBusy(''); setPending(false); setLoadingOlder(false); follow.current = true }, [sessionId])
  useEffect(() => { if (page.value && follow.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight }, [page.value, sessionId])
  useEffect(() => { if (session?.running) setPending(false) }, [session?.running])
  useEffect(() => { if (pending) { const timer = setTimeout(() => setPending(false), 5000); return () => clearTimeout(timer) } }, [pending])
  const editDraft = text => setDrafts(previous => ({...previous, [key]:text}))
  function navigateSession(nextId) {
    setSessionId(nextId)
    setShowPicker(false)
    if (window.matchMedia?.('(max-width:720px),(max-height:500px) and (pointer:coarse)').matches) {
      requestAnimationFrame(() => chatHeading.current?.focus())
    }
  }
  function openPicker() {
    setShowPicker(true)
    requestAnimationFrame(() => search.current?.focus())
  }
  function create() {
    if (busy || !canControl) return
    setBusy('new'); setError('')
    task('sessions.create', {remoteId:device.id}, value => { navigateSession(value.sessionId); setRevision(value => value + 1) }, setError, () => setBusy(''))
  }
  function send(event) {
    event?.preventDefault()
    if (busy || !draft.trim() || !connected || !sessionId || !promptAvailable) return
    const text = draft
    setBusy('send'); setError('')
    task('sessions.prompt', {remoteId:device.id, sessionId, text, mode, requestId:makeRequestId()}, () => {
      setDrafts(previous => previous[key] === text ? {...previous, [key]:''} : previous)
      setPending(true); setRevision(value => value + 1)
    }, message => setError(`${message} Your draft is still here. A failed response may have reached the device; check the transcript before sending again.`), () => setBusy(''))
  }
  function stop() {
    if (busy || !canControl) return
    setBusy('stop'); setError('')
    task('sessions.cancel', {remoteId:device.id, sessionId}, () => { setPending(false); setRevision(value => value + 1) }, setError, () => setBusy(''))
  }
  function loadOlder() {
    const beforeSeq = (older[0] || page.value?.messages?.[0])?.seq
    if (beforeSeq == null || loadingOlder) return
    setLoadingOlder(true)
    const scrollHeight = transcript.current?.scrollHeight || 0
    const scrollTop = transcript.current?.scrollTop || 0
    task('sessions.page', {remoteId:device.id, sessionId, beforeSeq, maxMessages:100}, value => {
      setOlder(previous => [...value.messages, ...previous]); setOlderMore(value.hasMore)
      requestAnimationFrame(() => { if (transcript.current) transcript.current.scrollTop = scrollTop + transcript.current.scrollHeight - scrollHeight })
    }, setError, () => setLoadingOlder(false))
  }
  const latest = page.value?.messages || []
  const seen = new Set(latest.filter(message => message.seq != null).map(message => message.seq))
  const messages = [...older.filter(message => message.seq == null || !seen.has(message.seq)), ...latest]
  const shown = filterSessions(items, query)
  const showMore = olderMore == null ? page.value?.hasMore : olderMore
  return <>
    <Notice error>{error || list.error || page.error}</Notice>
    {connected && available === false && <Notice>This connection does not support sessions. Check the companion setup on the remote device.</Notice>}
    <div className="rc-sessions" data-mobile-view={showPicker || !sessionId ? 'sessions' : 'chat'}>
      <aside className="rc-session-rail" id={`${id}-sessions`} aria-label="Sessions"><div className="rc-mobile-picker-head"><h3>Sessions</h3>{sessionId && <Button quiet onClick={() => navigateSession(sessionId)}>Back to chat</Button>}</div><Button icon="plus" onClick={create} disabled={!!busy || !connected || !available || !canControl}>{busy === 'new' ? 'Creating session…' : 'New session'}</Button><div className="rc-search"><Icon name="search" size={14}/><label htmlFor={`${id}-search`} className="rc-sr-only">Search sessions</label><input ref={search} id={`${id}-search`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sessions" type="search"/></div><div className="rc-sessions-caption"><span>{items.length} session{items.length !== 1 ? 's' : ''}</span><span>{runningRef.current ? 'Live updates' : 'Recent first'}</span></div>
        <div className="rc-session-list">{list.loading && !items.length ? <div aria-label="Loading sessions"><div className="rc-skeleton"/><div className="rc-skeleton"/><div className="rc-skeleton"/></div> : shown.length ? shown.map(item => <button key={item.sessionId} className="rc-session-item" aria-pressed={item.sessionId === sessionId} onClick={() => navigateSession(item.sessionId)}><span className="rc-session-title"><span>{item.title || 'Untitled session'}</span>{item.running && <span className="rc-running"><span className="rc-running-dot"/>Running</span>}</span><span className="rc-session-path" title={item.cwd || ''}>{item.cwd || (item.updatedAt ? `Updated ${formatTime(item.updatedAt)}` : 'DSH session')}</span></button>) : <div className="rc-list-empty">{query ? 'No matching sessions.' : connected ? 'No sessions yet.' : 'Connect to load sessions.'}</div>}</div>
      </aside>
      {sessionId ? <div className="rc-chat">
        <div className="rc-chat-head"><Button className="rc-mobile-sessions" quiet icon="sessions" aria-controls={`${id}-sessions`} aria-expanded={showPicker} onClick={openPicker}>Sessions</Button><div className="rc-chat-heading"><h3 ref={chatHeading} tabIndex={-1}>{session?.title || 'Session'}</h3><p>{session?.cwd || 'Remote DSH session'}</p></div>{(session?.running || pending) && <div className="rc-actions"><span className="rc-running"><span className="rc-running-dot"/>{session?.running ? 'Running' : 'Prompt accepted'}</span><Button icon="stop" onClick={stop} disabled={!!busy || !connected || !canControl}>{busy === 'stop' ? 'Stopping…' : 'Stop'}</Button></div>}</div>
        <div className="rc-transcript" ref={transcript} aria-label="Session transcript" aria-busy={page.loading} onScroll={event => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }}>
          {showMore && <div className="rc-load-more"><Button quiet disabled={loadingOlder || !connected || (older[0] || latest[0])?.seq == null} onClick={loadOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</Button></div>}
          {messages.length ? messages.map((message, index) => <article className="rc-message" data-role={message.role} key={message.seq == null ? `${message.role}-${index}` : message.seq}><div className="rc-message-avatar" aria-hidden="true">{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'DS' : <Icon name={message.role === 'tool' ? 'keyboard' : 'sessions'} size={13}/>}</div><div className="rc-message-content"><div className="rc-message-meta"><span>{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role === 'tool' ? 'Tool' : message.role || 'Message'}</span>{message.time && <time>{formatTime(message.time)}</time>}</div><div className="rc-message-text">{message.text || ''}</div></div></article>) : <div className="rc-list-empty">{page.loading ? 'Loading transcript…' : 'This session is ready. Send a message to begin.'}</div>}
        </div>
        <form className="rc-composer-area" onSubmit={send}><label htmlFor={`${id}-draft`} className="rc-sr-only">Message this session</label><div className="rc-composer"><textarea id={`${id}-draft`} value={draft} onChange={event => editDraft(event.target.value)} placeholder={connected ? 'Message this session…' : 'Draft a message while the device is offline…'} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }}/><div className="rc-composer-bottom"><div><label htmlFor={`${id}-mode`} className="rc-sr-only">Prompt delivery</label><select id={`${id}-mode`} value={mode} onChange={event => setMode(event.target.value)} disabled={!!busy}><option value="queue">Queue message</option><option value="steer">Steer current run</option></select></div><button className="rc-btn rc-btn-primary" type="submit" disabled={!!busy || !connected || !available || !draft.trim() || !promptAvailable}><Icon name="send" size={14}/>{busy === 'send' ? 'Sending…' : 'Send'}</button></div></div><div className="rc-composer-hint"><span>{!connected ? 'Draft preserved · reconnect to send' : !canControl ? 'View only · take control to send' : !promptAvailable ? 'Use a companion connection to resume this closed session' : 'Ctrl / ⌘ + Enter to send'}</span><span>Messages are sent once.</span></div></form>
      </div> : <Empty icon="sessions" title={connected ? 'Choose a session' : 'Sessions are offline'} action={connected && available && <Button icon="plus" primary onClick={create} disabled={!!busy || !canControl}>Start a new session</Button>}>{connected ? 'Open a recent conversation or start a new one on this device.' : 'Check that the remote device and its sharing service are online, then check the connection.'}</Empty>}
    </div>
  </>
}

function useLiveFrame(remoteId, monitor, active) {
  const [frame, setFrame] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setFrame(null); setError(''); setLoading(!!active)
    if (!active || !monitor) return
    let alive = true, timer, currentUrl
    const controller = new AbortController()
    const tick = async () => {
      let nextUrl
      try {
        const signal = typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function' ? AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) : controller.signal
        const response = await fetch(frameUrl(remoteId, monitor.id), {credentials:'same-origin', headers:{'x-dsh-remote-control':'1'}, cache:'no-store', signal})
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(safeMessage(data?.error, 'The screen is unavailable. Check desktop access on the remote device.'))
        }
        const blob = await response.blob()
        if (blob.type && !blob.type.startsWith('image/')) throw new Error('The device did not return a screen image.')
        nextUrl = URL.createObjectURL(blob)
        const image = new Image()
        image.src = nextUrl
        if (image.decode) await image.decode()
        if (!alive) { URL.revokeObjectURL(nextUrl); return }
        const previous = currentUrl
        currentUrl = nextUrl
        setFrame({url:nextUrl, width:Number(response.headers.get('x-desktop-width')) || monitor.width, height:Number(response.headers.get('x-desktop-height')) || monitor.height, capturedAt:Date.now()})
        setError(''); setLoading(false)
        if (previous) URL.revokeObjectURL(previous)
      } catch (failure) {
        if (nextUrl && nextUrl !== currentUrl) URL.revokeObjectURL(nextUrl)
        if (alive && !controller.signal.aborted) { setError(safeMessage(failure)); setLoading(false) }
      } finally {
        if (alive) timer = setTimeout(tick, 500)
      }
    }
    tick()
    return () => { alive = false; clearTimeout(timer); controller.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl) }
  }, [remoteId, monitor?.id, active])
  return {frame, error, loading}
}

function useDesktopInput(remoteId, enabled, onFailure) {
  const errorHandler = useRef(onFailure)
  errorHandler.current = onFailure
  const queue = useMemo(() => createDesktopInputQueue({remoteId, onFailure:error => errorHandler.current?.(`${safeMessage(error)} Control has been turned off; the input will not be repeated.`)}), [remoteId])
  const release = useCallback(keepActive => queue.release(keepActive), [queue])
  useEffect(() => {
    if (enabled) queue.enable()
    else release()
    const blur = () => { if (enabled) { release(); errorHandler.current?.('', true) } }
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('blur', blur); release() }
  }, [enabled, release, queue])
  const send = useCallback(input => queue.send(input), [queue])
  const shortcut = useCallback(async keys => {
    for (const key of keys) if (!(await send({type:'key', key, down:true}))) return
    for (const key of [...keys].reverse()) if (!(await send({type:'key', key, down:false}))) return
  }, [send])
  return {send, release, shortcut}
}

function Desktop({device, connected, available, active, canControl = false}) {
  const id = useId()
  const [monitorId, setMonitorId] = useState('')
  const [control, setControl] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [focused, setFocused] = useState(false)
  const [revision, setRevision] = useState(0)
  const monitors = usePoll('desktop.monitors', {remoteId:device.id}, active && connected && available, 10000, revision)
  const items = monitors.value?.monitors || []
  const monitor = items.find(item => item.id === monitorId) || items.find(item => item.primary) || items[0]
  const canView = active && connected && available && monitors.value?.available !== false && !!monitor
  const live = useLiveFrame(device.id, monitor, canView)
  const surface = useRef(null)
  const stage = useRef(null)
  const [stageSize, setStageSize] = useState({width:0,height:0})
  const pointer = useRef(null)
  const lastMove = useRef(0)
  const movePending = useRef(false)
  const wheelPending = useRef(false)
  const input = useDesktopInput(device.id, control && canControl && canView && !live.error, (message, blur) => { setControl(false); setFocused(false); pointer.current = null; if (!blur) setError(message) })
  useEffect(() => { if (!canControl) { setControl(false); setFocused(false); pointer.current = null } }, [canControl])
  useEffect(() => { if (!canView || live.error) { setControl(false); setFocused(false); pointer.current = null } }, [canView, live.error])
  useEffect(() => { setControl(false); setError(''); setFocused(false); pointer.current = null }, [monitor?.id])
  useEffect(() => { if (control) surface.current?.focus() }, [control])
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const resize = () => {
      const computed = getComputedStyle(node)
      const width = node.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight)
      const height = node.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom)
      setStageSize(previous => previous.width === width && previous.height === height ? previous : {width,height})
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(node); resize()
    return () => observer?.disconnect()
  }, [canView, connected, available])
  useEffect(() => {
    const node = surface.current
    if (!control || !canView || !node) return
    const wheel = event => {
      if (document.activeElement !== node) return
      event.preventDefault()
      if (wheelPending.current) return
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1
      wheelPending.current = true
      input.send({type:'scroll', ...pointerPosition(node.getBoundingClientRect(), event, monitor), deltaX:Math.max(-3000,Math.min(3000,event.deltaX*factor)), deltaY:Math.max(-3000,Math.min(3000,event.deltaY*factor))}).finally(() => { wheelPending.current = false })
    }
    node.addEventListener('wheel', wheel, {passive:false})
    return () => node.removeEventListener('wheel', wheel)
  }, [control, canView, monitor?.id, monitor?.x, monitor?.y, monitor?.width, monitor?.height, input.send])
  function toggleControl() {
    if (!canControl) return
    if (control) input.release()
    setError(''); setControl(value => !value)
  }
  function position(event) { return pointerPosition(event.currentTarget.getBoundingClientRect(), event, monitor) }
  function pointerDown(event) {
    if (!control || !canView || pointer.current || ![0,1,2].includes(event.button)) return
    event.preventDefault(); event.currentTarget.focus()
    const button = ['left','middle','right'][event.button]
    pointer.current = {id:event.pointerId, button}
    event.currentTarget.setPointerCapture?.(event.pointerId)
    input.send({type:'button', button, down:true, ...position(event)})
  }
  function pointerMove(event) {
    if (!control || !canView || !focused || movePending.current || performance.now() - lastMove.current < 60) return
    lastMove.current = performance.now()
    movePending.current = true
    input.send({type:'move', ...position(event)}).finally(() => { movePending.current = false })
  }
  function pointerUp(event) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const button = pointer.current.button
    pointer.current = null
    if (control) { event.preventDefault(); input.send({type:'button', button, down:false, ...position(event)}) }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keyDown(event) {
    if (!control || event.nativeEvent.isComposing || event.repeat) return
    if (event.key === 'Escape') { event.preventDefault(); input.release(); setControl(false); return }
    const key = desktopKey(event.key, event.code)
    if (key) { event.preventDefault(); event.stopPropagation(); input.send({type:'key', key, down:true}) }
  }
  function keyUp(event) {
    if (!control || event.key === 'Escape') return
    const key = desktopKey(event.key, event.code)
    if (key) { event.preventDefault(); event.stopPropagation(); input.send({type:'key', key, down:false}) }
  }
  async function sendText(event) {
    event.preventDefault()
    if (!control || !text || sending) return
    setSending(true); setError('')
    const value = text
    const accepted = await input.send({type:'text', text:value})
    if (accepted) setText(previous => previous === value ? '' : previous)
    setSending(false)
  }
  const screenWidth = monitor && stageSize.width > 0 && stageSize.height > 0 ? Math.max(1, Math.min(stageSize.width, stageSize.height * monitor.width / monitor.height)) : null
  if (!available) return <Empty icon="monitor" title="Desktop access is not enabled">Enable desktop access in “Share this device” on the remote computer, then use a companion connection.</Empty>
  if (!connected) return <Empty icon="monitor" title="Desktop is offline">Bring the remote device online and check the connection. Control is off until you enable it again.</Empty>
  return <div className="rc-desktop">
    <div className="rc-desktop-toolbar"><div className="rc-monitor-select"><Icon name="monitor"/><label htmlFor={`${id}-monitor`} className="rc-sr-only">Monitor</label><select id={`${id}-monitor`} value={monitor?.id || ''} disabled={!items.length || monitors.loading} onChange={event => { input.release(); setControl(false); setMonitorId(event.target.value) }}>{items.length ? items.map(item => <option key={item.id} value={item.id}>{item.name || `Monitor ${item.id}`}{item.primary ? ' · Primary' : ''}</option>) : <option value="">{monitors.loading ? 'Loading monitors…' : 'No monitor available'}</option>}</select></div><div className="rc-actions"><Button quiet icon="refresh" className="rc-icon-btn" aria-label="Refresh monitors" onClick={() => setRevision(value => value + 1)} disabled={monitors.loading}/><Button icon={control ? 'cursor' : 'eye'} className="rc-control-toggle" aria-pressed={control} disabled={!canControl || !canView || !live.frame || !!live.error} onClick={toggleControl}>{control ? 'Control on' : 'Enable control'}</Button></div></div>
    {(error || monitors.error || live.error || monitors.value?.reason) && <p className="rc-inline-error" role="alert">{error || monitors.error || live.error || safeMessage(monitors.value?.reason)}</p>}
    <div className="rc-screen-stage" ref={stage}>{monitor && live.frame ? <div className="rc-screen" ref={surface} style={{aspectRatio:`${monitor.width}/${monitor.height}`, ...(screenWidth ? {width:screenWidth} : {})}} data-control={control} tabIndex={control ? 0 : -1} role="application" aria-label={`Remote desktop, ${monitor.name || 'selected monitor'}. ${control ? 'Control enabled. Escape exits control.' : 'View only.'}`} aria-describedby={`${id}-help`} onFocus={() => setFocused(true)} onBlur={() => { input.release(true); setFocused(false); pointer.current = null }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { input.release(); setControl(false); pointer.current = null }} onLostPointerCapture={() => { if (pointer.current) { input.release(); setControl(false); pointer.current = null } }} onContextMenu={event => { if (control) event.preventDefault() }} onKeyDown={keyDown} onKeyUp={keyUp}><img src={live.frame.url} alt={`Live desktop of ${device.name}, ${monitor.name || 'selected monitor'}`} draggable={false}/></div> : <div className="rc-screen-placeholder">{monitors.loading || live.loading ? 'Connecting to the remote screen…' : monitors.value?.reason || 'No screen is available. Check that the remote Windows desktop is unlocked.'}</div>}</div>
    <div className="rc-desktop-footer"><span>{live.frame ? `${monitor.width} × ${monitor.height} · Live screen` : 'Waiting for screen'}{monitor?.x < 0 || monitor?.y < 0 ? ' · Extended display' : ''}</span><span>{control ? focused ? 'Keyboard connected · Esc exits control' : 'Control enabled · click screen to focus' : 'View only · mouse and keyboard are local'}</span></div>
    <p className="rc-control-note" id={`${id}-help`}>{control ? 'Click the screen to use your keyboard. Drag, right-click and scroll work inside it. Escape turns control off; leaving the screen releases held keys.' : 'Enable control to use this device’s mouse and keyboard. Each connection starts in view only.'}</p>
    <form className="rc-text-entry" onSubmit={sendText}><div className="rc-field"><label htmlFor={`${id}-text`}>Type text on the remote device</label><input id={`${id}-text`} value={text} onChange={event => setText(event.target.value)} placeholder="Text to insert into the remote focused field" maxLength={4096} autoComplete="off"/></div><button className="rc-btn" type="submit" disabled={!control || !text || sending}><Icon name="keyboard"/>{sending ? 'Sending…' : 'Send text'}</button></form>
    <div className="rc-shortcuts" aria-label="Remote keyboard shortcuts"><span className="rc-tiny">Send shortcut</span>{[['Ctrl + C',['Control','c']],['Ctrl + V',['Control','v']],['Alt + Tab',['Alt','Tab']],['Windows',['Meta']],['Escape',['Escape']]].map(([label,keys]) => <Button key={label} disabled={!control} onClick={() => input.shortcut(keys)}>{label}</Button>)}</div>
  </div>
}

export function DeviceWorkspace({device, visible, drafts, setDrafts, onEdit, canControl = false}) {
  const [tab, setTab] = useState('sessions')
  const [revision, setRevision] = useState(0)
  const probe = usePoll('devices.status', {remoteId:device.id}, visible, 10000, revision)
  const connected = !!probe.value?.connected && !probe.error
  const capabilities = probe.value?.capabilities || {}
  const probeError = probe.error || (!connected && probe.value?.error ? safeMessage(probe.value.error) : '')
  function tabKey(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'sessions' : event.key === 'End' ? 'desktop' : tab === 'sessions' ? 'desktop' : 'sessions'
    setTab(next)
    requestAnimationFrame(() => document.getElementById(`rc-tab-${next}-${device.id}`)?.focus())
  }
  return <section className="rc-workspace" aria-label={`${device.name} workspace`}>
    <div className="rc-workspace-head"><div className="rc-workspace-title"><div><div className="rc-title-line"><h2>{device.name}</h2><span className="rc-status" data-state={connected ? 'online' : probe.loading ? 'loading' : 'error'} role="status"><span className="rc-status-dot"/>{probe.loading ? 'Connecting…' : connected ? probe.value?.mode === 'web' ? 'Online · Web' : 'Online' : 'Offline'}</span></div><p className="rc-address">{deviceAddress(device.url)}</p></div><div className="rc-actions"><Button quiet icon="refresh" aria-label="Check device connection" disabled={probe.loading} onClick={() => setRevision(value => value + 1)}><span className="rc-check-label">Check connection</span></Button>{onEdit && <Button quiet className="rc-icon-btn" icon="edit" aria-label={`Edit ${device.name}`} onClick={onEdit}/>}</div></div><div className="rc-tabs" role="tablist" aria-label="Device workspace" onKeyDown={tabKey}><button id={`rc-tab-sessions-${device.id}`} className="rc-tab" role="tab" tabIndex={tab === 'sessions' ? 0 : -1} aria-selected={tab === 'sessions'} aria-controls={`rc-panel-${device.id}`} onClick={() => setTab('sessions')}><Icon name="sessions" size={15}/>Sessions</button><button id={`rc-tab-desktop-${device.id}`} className="rc-tab" role="tab" tabIndex={tab === 'desktop' ? 0 : -1} aria-selected={tab === 'desktop'} aria-controls={`rc-panel-${device.id}`} onClick={() => setTab('desktop')}><Icon name="monitor" size={15}/>Desktop</button></div></div>
    {probeError && <Notice error>{probeError}</Notice>}
    {connected && probe.value?.mode === 'web' && tab === 'sessions' && <Notice>Web connection · sessions only. If this DSH profile is already open elsewhere, close its other writer before starting a session. Use the companion for desktop access.</Notice>}
    <div className="rc-workspace-content" id={`rc-panel-${device.id}`} role="tabpanel" aria-labelledby={`rc-tab-${tab}-${device.id}`}><div className="rc-workspace-content" style={{display:tab === 'sessions' ? 'flex' : 'none'}} hidden={tab !== 'sessions'}><Sessions device={device} connected={connected} available={capabilities.sessions !== false} connectionMode={probe.value?.mode} active={visible && tab === 'sessions'} drafts={drafts} setDrafts={setDrafts} canControl={canControl}/></div><div className="rc-workspace-content" style={{display:tab === 'desktop' ? 'flex' : 'none'}} hidden={tab !== 'desktop'}><Desktop device={device} connected={connected} available={!!capabilities.desktop} active={visible && tab === 'desktop'} canControl={canControl}/></div></div>
  </section>
}

export function ShareCard({onChanged}) {
  const id = useId()
  const [revision, setRevision] = useState(0)
  const status = usePoll('sharing.status', {}, true, 2000, revision)
  const sharing = status.value || {}
  const [label, setLabel] = useState('')
  const [desktop, setDesktop] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [useLimit, setUseLimit] = useState('once')
  const [expiry, setExpiry] = useState('30min')
  const [customDuration, setCustomDuration] = useState('1')
  const [customUnit, setCustomUnit] = useState('hours')
  const [invitation, setInvitation] = useState(null)
  const [now, setNow] = useState(Date.now)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [codeLoaded, setCodeLoaded] = useState(false)
  const mounted = useRef(true)
  const operation = useRef(0)
  const pendingInvite = useRef(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setCodeLoaded(false)
    requestRemote('sharing.code', {}, {signal:controller.signal}).then(value => {
      if (!controller.signal.aborted) { setInvitation(typeof value?.code === 'string' ? value : null); setCodeLoaded(true) }
    }).catch(() => { if (!controller.signal.aborted) setCodeLoaded(true) })
    return () => controller.abort()
  }, [revision])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (sharing.enabled === false || sharing.code?.exists === false || (sharing.code?.useLimit !== 'unlimited' && sharing.code?.used)) { setInvitation(null); setCopied(false) } }, [sharing.enabled, sharing.code?.exists, sharing.code?.useLimit, sharing.code?.used])
  const validCode = invitation && (invitation.expiresAt === null || Number(invitation.expiresAt) > now) && !sharing.code?.paused
  const refresh = () => { setRevision(value => value + 1); onChanged?.() }
  async function generate(event) {
    event?.preventDefault()
    if (busy) return
    let expiresInMs
    try { expiresInMs = invitationLifetime(expiry, customDuration, customUnit) }
    catch (failure) { setError(safeMessage(failure)); return }
    const generation = ++operation.current
    const controller = new AbortController()
    pendingInvite.current = controller
    setBusy('invite'); setError(''); setInvitation(null); setCopied(false)
    try {
      const value = await requestRemote('sharing.invite', {label:label.trim() || sharing.label || undefined, desktopEnabled:desktop, useLimit, expiresInMs, ...(publicUrl.trim() ? {publicUrl:publicUrl.trim()} : {})}, {timeout:120000,signal:controller.signal})
      if (mounted.current && operation.current === generation) { setInvitation({...value,useLimit:value.useLimit || useLimit}); setNow(Date.now()); refresh() }
    } catch (failure) { if (mounted.current && operation.current === generation) setError(safeMessage(failure)) }
    finally { if (mounted.current && operation.current === generation) { pendingInvite.current = null; setBusy(''); refresh() } }
  }
  async function copy() {
    if (!validCode) return
    try { await navigator.clipboard.writeText(invitation.code); setCopied(true); setError('') }
    catch { setError('Clipboard access is unavailable. Select the connection code below and copy it.') }
  }
  async function change(action) {
    if (busy && !(action === 'sharing.stop' && busy === 'invite')) return
    const generation = ++operation.current
    pendingInvite.current?.abort(); pendingInvite.current = null
    setBusy(action); setError(''); setCopied(false)
    if (action === 'sharing.stop' || action === 'sharing.revoke') setInvitation(null)
    try { await requestRemote(action); if (mounted.current && operation.current === generation) refresh() }
    catch (failure) { if (mounted.current && operation.current === generation) setError(safeMessage(failure)) }
    finally { if (mounted.current && operation.current === generation) setBusy('') }
  }
  const remote = sharing.control?.owner === 'remote'
  const unavailable = sharing.enabled && sharing.control?.supported === false
  return <section className="rc-pair-card" aria-labelledby={`${id}-title`}>
    <div className="rc-card-heading"><span className="rc-card-symbol"><Icon name="monitor" size={23}/></span><span className="rc-status" data-state={sharing.enabled && !sharing.code?.paused ? 'online' : 'idle'}><span className="rc-status-dot"/>{remote ? 'Remote control active' : sharing.code?.paused ? 'Remote access paused' : sharing.enabled ? 'Ready to connect' : 'Only you have access'}</span></div>
    <h2 id={`${id}-title`}>Share this computer</h2><p className="rc-card-intro">Continue this DSH from another computer. Create a code and paste it into Remote Control there.</p>
    <form onSubmit={generate} className="rc-setup-form">
      <div className="rc-field"><label htmlFor={`${id}-name`}>Computer name</label><input id={`${id}-name`} value={label} onChange={event => setLabel(event.target.value)} placeholder={sharing.label || 'My computer'} maxLength={80} disabled={!!busy || remote} autoComplete="off"/></div>
      <label className="rc-access-option"><input type="checkbox" checked={desktop} onChange={event => setDesktop(event.target.checked)} disabled={!!busy || remote}/><span><strong>Include desktop access</strong><small>Share your screen, mouse and keyboard. DSH chats are included by default.</small></span></label>
      <div className="rc-form-grid"><div className="rc-field"><label htmlFor={`${id}-uses`}>Code uses</label><select id={`${id}-uses`} value={useLimit} onChange={event => setUseLimit(event.target.value)} disabled={!!busy || remote}><option value="once">Once</option><option value="unlimited">Unlimited</option></select></div><div className="rc-field"><label htmlFor={`${id}-expiry`}>Code expiry</label><select id={`${id}-expiry`} value={expiry} onChange={event => setExpiry(event.target.value)} disabled={!!busy || remote}><option value="never">Never</option><option value="30min">30 minutes</option><option value="1hr">1 hour</option><option value="custom">Custom</option></select></div></div>
      {expiry === 'custom' && <div className="rc-form-grid"><div className="rc-field"><label htmlFor={`${id}-duration`}>Expires after</label><input id={`${id}-duration`} type="number" min="0.001" step="any" value={customDuration} onChange={event => setCustomDuration(event.target.value)} required disabled={!!busy || remote}/></div><div className="rc-field"><label htmlFor={`${id}-unit`}>Duration unit</label><select id={`${id}-unit`} value={customUnit} onChange={event => setCustomUnit(event.target.value)} disabled={!!busy || remote}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div></div>}
      <details className="rc-advanced"><summary>Connection options</summary><div className="rc-field"><label htmlFor={`${id}-address`}>Existing HTTPS address <span className="rc-tiny">(optional)</span></label><input id={`${id}-address`} value={publicUrl} onChange={event => setPublicUrl(event.target.value)} type="url" placeholder="https://your-tunnel.example" disabled={!!busy || remote} autoComplete="off" spellCheck={false}/><span className="rc-tiny">Leave blank to create a temporary internet connection automatically.</span></div></details>
      <p className="rc-privacy-note">Internet sharing uses Cloudflare unless you supply your own address. Keep DSH open. Temporary addresses change when sharing restarts.</p>
      {sharing.code?.paused && <div className="rc-code-box"><p className="rc-tiny">Remote access is paused. {sharing.code.useLimit === 'once' && sharing.code.used ? 'This code was used. Create a new one to connect again.' : 'Resume when you want this code to accept connections again.'}</p>{!(sharing.code.useLimit === 'once' && sharing.code.used) && <Button onClick={() => change('sharing.resume')} disabled={!!busy}>{busy === 'sharing.resume' ? 'Resuming…' : 'Resume remote access'}</Button>}</div>}
      {remote ? <div className="rc-handoff-card"><Icon name="link"/><div><strong>{sharing.control.label || 'Another computer'} has control</strong><p>Your sessions keep running here. You can return control at any time.</p></div><Button primary disabled={!!busy} onClick={() => change('sharing.reclaim')}>{busy === 'sharing.reclaim' ? 'Taking back…' : 'Take back control'}</Button></div> : <>
        <button className="rc-btn rc-btn-primary rc-wide" type="submit" disabled={!!busy || unavailable}><Icon name={busy === 'invite' ? 'refresh' : 'link'}/>{busy === 'invite' ? 'Preparing secure connection…' : invitation || sharing.code?.exists ? 'Generate replacement code' : 'Create connection code'}</button>
        {busy === 'invite' && <div className="rc-card-footer"><p className="rc-tiny" role="status">Setting up internet access. This can take about a minute.</p><Button quiet onClick={() => change('sharing.stop')}>Cancel setup</Button></div>}
      </>}
      {invitation && <div className="rc-code-box"><div className="rc-code-label"><label htmlFor={`${id}-code`}>Your connection code</label><span role="status">{expiryText(invitation.expiresAt, now, invitation.useLimit)}</span></div>{validCode && <><textarea id={`${id}-code`} value={invitation.code} readOnly rows={3} onFocus={event => event.target.select()} spellCheck={false} autoComplete="off"/><Button icon="copy" primary className="rc-wide" onClick={copy}>{copied ? 'Copied to clipboard' : 'Copy connection code'}</Button><p className="rc-tiny">Send this code privately to the person connecting.</p></>}</div>}
      {!invitation && codeLoaded && sharing.code?.exists && <div className="rc-code-box"><p className="rc-tiny">Current code: {expiryText(sharing.code.expiresAt, now, sharing.code.useLimit)}</p><p className="rc-tiny">The existing code still follows these settings. To copy a code from this screen, generate a replacement.</p></div>}
    </form>
    {sharing.enabled && busy !== 'invite' && <div className="rc-card-footer"><span className="rc-tiny">{sharing.network?.state === 'ready' ? 'Internet connection ready' : 'Sharing enabled'}</span><div className="rc-actions">{(sharing.code?.exists || invitation) && <Button quiet disabled={!!busy} onClick={() => change('sharing.revoke')}>{busy === 'sharing.revoke' ? 'Revoking…' : 'Revoke code'}</Button>}<Button quiet disabled={!!busy} onClick={() => change('sharing.stop')}>{busy === 'sharing.stop' ? 'Stopping…' : 'Stop sharing'}</Button></div></div>}
    {(error || status.error || sharing.error || sharing.network?.error || unavailable) && <p className="rc-inline-error" role="alert">{error || status.error || sharing.error || sharing.network?.error || 'This DSH version cannot safely hand off local control. Sharing is unavailable.'}</p>}
  </section>
}

export function ConnectCard({onConnected}) {
  const id = useId()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(null)
  const [opened, setOpened] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function connect(event) {
    event.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true); setError(''); setConnected(null); setOpened(false)
    try {
      const value = await requestRemote('devices.connect', {code:code.trim(), ...(name.trim() ? {name:name.trim()} : {}), requestId:makeRequestId()}, {timeout:30000})
      if (!mounted.current) { await releaseRemote(value.device.id).catch(() => {}); return }
      setCode(''); setConnected(value.device); onConnected?.(value.device)
      try {
        await openRemoteWindow(value.device.id)
        if (mounted.current) setOpened(true)
      } catch (failure) {
        if (mounted.current) setError(`${safeMessage(failure)} The computer is paired. Choose Open remote window below.`)
      }
    } catch (failure) {
      if (mounted.current) setError(`${safeMessage(failure)} If the connection timed out, create a fresh code on the other computer before trying again.`)
    } finally { if (mounted.current) setBusy(false) }
  }
  async function open() {
    if (!connected || busy) return
    setBusy(true); setError('')
    try {
      await requestRemote('control.acquire', {remoteId:connected.id})
      await openRemoteWindow(connected.id)
      setOpened(true)
    } catch (failure) { if (mounted.current) setError(safeMessage(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  return <section className="rc-pair-card rc-connect-card" aria-labelledby={`${id}-title`}>
    <div className="rc-card-heading"><span className="rc-card-symbol"><Icon name="link" size={23}/></span><span className="rc-step-label">On this computer</span></div>
    <h2 id={`${id}-title`}>Connect to another computer</h2><p className="rc-card-intro">Open Remote Control on the other computer, create a connection code, and paste it here.</p>
    <form className="rc-setup-form" onSubmit={connect}>
      <div className="rc-field"><label htmlFor={`${id}-paste`}>Paste connection code here</label><textarea id={`${id}-paste`} className="rc-paste-code" value={code} onChange={event => setCode(event.target.value)} placeholder="DSH1.…" rows={5} required maxLength={12000} autoComplete="off" spellCheck={false} disabled={busy}/></div>
      <div className="rc-field"><label htmlFor={`${id}-label`}>Save as <span className="rc-tiny">(optional)</span></label><input id={`${id}-label`} value={name} onChange={event => setName(event.target.value)} placeholder="Home computer" maxLength={80} autoComplete="off" disabled={busy}/></div>
      <button className="rc-btn rc-btn-primary rc-wide" type="submit" disabled={busy || !code.trim()}><Icon name="link"/>{busy ? 'Connecting…' : 'Connect and open DSH'}</button>
      <p className="rc-privacy-note">The remote DSH opens in its own window. The original computer can take back control with one click.</p>
    </form>
    {connected && <div className="rc-connected-result" role="status"><Icon name="monitor"/><span><strong>{connected.name}</strong><small>{opened ? 'Connected · remote window opened' : 'Paired · ready to open'}</small></span>{!opened && <Button onClick={open} disabled={busy}>Open remote window</Button>}</div>}
    {error && <p className="rc-inline-error" role="alert">{error}</p>}
  </section>
}

export function RemoteControlPanel() {
  const [revision, setRevision] = useState(0)
  const listing = usePoll('devices.list', {}, true, 10000, revision)
  const devices = listing.value?.items || []
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const refresh = () => setRevision(value => value + 1)
  async function open(device) {
    if (busy) return
    setBusy(device.id); setError('')
    try {
      await requestRemote('control.acquire', {remoteId:device.id}, {timeout:20000})
      await openRemoteWindow(device.id)
    } catch (failure) { setError(safeMessage(failure)) }
    finally { setBusy('') }
  }
  return <div className="dsh-remote-control rc-setup-page"><style>{styles}</style>
    <header className="rc-topbar"><div><div className="rc-eyebrow">YOUR DSH, WHEREVER YOU ARE</div><h1>Remote Control</h1><p>Share a code. Pick up where you left off.</p></div><span className="rc-top-icon"><Icon name="monitor" size={28}/></span></header>
    <div className="rc-setup-scroll"><div className="rc-pair-grid"><ShareCard onChanged={refresh}/><ConnectCard onConnected={refresh}/></div>
      <section className="rc-saved" aria-label="Paired computers"><div className="rc-saved-heading"><div><h2>Paired computers</h2><p>Reopen an available connection, or pair again with a fresh code.</p></div><Button quiet icon="refresh" aria-label="Refresh paired computers" onClick={refresh} disabled={listing.loading}/></div>
        {(error || listing.error) && <p className="rc-inline-error" role="alert">{error || listing.error}</p>}
        {devices.length ? <div className="rc-saved-list">{devices.map(device => <div className="rc-saved-device" key={device.id}><span className="rc-device-icon"><Icon name="monitor" size={20}/></span><span className="rc-saved-copy"><strong>{device.name}</strong><small>{deviceAddress(device.url)}</small></span><Button primary icon="link" onClick={() => open(device)} disabled={!!busy}>{busy === device.id ? 'Connecting…' : 'Open remote window'}</Button><Button quiet icon="edit" className="rc-icon-btn" aria-label={`Edit ${device.name}`} onClick={() => setDialog(device)}/></div>)}</div> : <div className="rc-saved-empty"><Icon name="monitor"/><p>{listing.loading ? 'Loading paired computers…' : 'Your paired computers will appear here.'}</p></div>}
      </section><p className="rc-setup-footnote">Each computer needs this plugin and must stay awake with DSH open.</p>
    </div>
    {dialog && <DeviceDialog device={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh() }} onRemoved={() => { setDialog(null); refresh() }}/ >}
  </div>
}

export function RemoteWindow({remoteId = new URLSearchParams(globalThis.location?.search || '').get('remoteId')}) {
  const root = useRef(null)
  const visible = useVisible(root)
  const [device, setDevice] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [state, setState] = useState({value:null,error:''})
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState('')
  const [disconnected, setDisconnected] = useState(false)
  const [suspended, setSuspended] = useState(false)
  const task = useTaskScope(remoteId || 'missing')
  useEffect(() => {
    if (!remoteId) { setError('No computer was selected. Open this window from Remote Control.'); return }
    task('devices.list', {}, value => {
      const found = value.items?.find(item => item.id === remoteId)
      if (found) { setDevice(found); document.title = `${found.name} · DSH Remote` }
      else setError('This computer is no longer paired. Open Remote Control and connect with a fresh code.')
    }, setError)
  }, [remoteId, task])
  useEffect(() => {
    if (!device || disconnected || suspended || busy) return
    return watchControl({remoteId:device.id, onChange:setState})
  }, [device?.id, revision, disconnected, suspended, busy])
  useEffect(() => {
    const lost = () => {
      setSuspended(true)
      setState({value:{owner:'local',heldByYou:false},error:''})
    }
    window.addEventListener('dsh-remote-control-lost', lost)
    return () => window.removeEventListener('dsh-remote-control-lost', lost)
  }, [])
  useEffect(() => {
    if (!device) return
    const close = () => {
      // The gateway releases only when its last viewer leaves. A short grace
      // period lets a reload reattach without interrupting another open window.
      fetch('/api/remote-control', {method:'POST',credentials:'same-origin',keepalive:true,headers:{'content-type':'application/json','x-dsh-remote-control':'1'},body:JSON.stringify({action:'window.leave',remoteId:device.id})}).catch(() => {})
    }
    window.addEventListener('pagehide', close)
    return () => window.removeEventListener('pagehide', close)
  }, [device?.id])
  const canControl = !disconnected && !suspended && !busy && state.value?.heldByYou === true && !state.error
  async function release(disconnect = false) {
    if (busy || !device) return
    setBusy('release'); setError(''); setState({value:{owner:'local',heldByYou:false},error:''})
    try { await releaseRemote(device.id); if (disconnect) setDisconnected(true); else setRevision(value => value + 1) }
    catch (failure) { setError(`${safeMessage(failure)} Local control returns automatically when the connection lease expires.`); setDisconnected(true) }
    finally { setBusy('') }
  }
  async function acquire() {
    if (busy || !device) return
    setBusy('acquire'); setError('')
    try { await requestRemote('control.acquire', {remoteId:device.id}); setDisconnected(false); setSuspended(false); setRevision(value => value + 1) }
    catch (failure) { setError(safeMessage(failure)) }
    finally { setBusy('') }
  }
  return <div className="dsh-remote-control rc-remote-window" ref={root}><style>{styles}</style>
    <header className="rc-window-bar"><div className="rc-window-brand"><Icon name="monitor" size={21}/><strong>deepseek <span>REMOTE</span></strong></div><div className="rc-window-status" role="status"><span className="rc-status-dot"/>{disconnected ? 'Disconnected' : canControl ? 'You have control' : state.value ? 'View only' : 'Checking control…'}</div><div className="rc-actions">{canControl ? <Button quiet onClick={() => release()} disabled={!!busy}>Release control</Button> : device && <Button primary onClick={acquire} disabled={!!busy}>{busy === 'acquire' ? 'Connecting…' : disconnected ? 'Reconnect' : 'Take control'}</Button>}<Button onClick={() => release(true)} disabled={!!busy || disconnected || !device}>Disconnect</Button></div></header>
    {(error || state.error) && <Notice error>{error || safeMessage(state.error)}</Notice>}
    {!canControl && !disconnected && state.value && <Notice>Local control is active or your connection ended. Your draft is preserved. If the owner took back control, ask them to resume remote access and connect again.</Notice>}
    {device && !disconnected ? <DeviceWorkspace device={device} visible={visible} drafts={drafts} setDrafts={setDrafts} canControl={canControl}/> : <Empty icon="monitor" title={disconnected ? 'Control returned' : error ? 'Connection unavailable' : 'Opening your remote DSH…'}>{disconnected ? 'This computer has been disconnected. Its sessions continue running.' : error || 'Loading the paired computer and checking your connection.'}</Empty>}
  </div>
}

export const inject = ['slots']
export function apply(ctx) {
  const lifetimeBanner = typeof ctx.effect === 'function'
  if (lifetimeBanner) ctx.effect(() => installLocalHandoffBanner(), 'remote-control local handoff banner')
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({name:'sidebar.panellist', id:'remote-control', order:15, label:'Remote Control'}, function RemoteControlIcon() { useEffect(() => lifetimeBanner ? undefined : installLocalHandoffBanner(), []); return <Icon name="monitor" size={18}/> }))
  ctx.slots.inject('main', () => ctx.slots.register({name:'main', key:'remote-control'}, RemoteControlPanel))
}
