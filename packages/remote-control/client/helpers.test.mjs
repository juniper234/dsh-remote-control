import test from 'node:test'
import assert from 'node:assert/strict'
import {requestRemote, safeMessage, pointerPosition, desktopKey, draftKey, frameUrl, deviceAddress, filterSessions, createDesktopInputQueue, canPromptSession} from './helpers.mjs'

test('controller requests use same-origin DSH authentication and the required marker', async () => {
  let request
  const value = await requestRemote('sessions.prompt', {remoteId:'home', sessionId:'chat', text:'hello', requestId:'once', mode:'queue'}, {fetchImpl:async (url, init) => {
    request = {url, ...init}
    return {ok:true, json:async () => ({ok:true,value:{accepted:true}})}
  }})
  assert.equal(request.url, '/api/remote-control')
  assert.equal(request.credentials, 'same-origin')
  assert.equal(request.method, 'POST')
  assert.equal(request.headers['x-dsh-remote-control'], '1')
  assert.equal(request.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(request.body), {action:'sessions.prompt', remoteId:'home', sessionId:'chat', text:'hello', requestId:'once', mode:'queue'})
  assert.deepEqual(value, {accepted:true})
})

test('failed mutations are sent once and their error does not expose pairing secrets', async () => {
  let calls = 0
  await assert.rejects(requestRemote('desktop.input', {eventId:'once',input:{type:'text',text:'sample'}}, {fetchImpl:async () => {
    calls++
    return {ok:false,status:502,json:async () => ({ok:false,error:{code:'OFFLINE',message:'Unavailable at https://host/?k=private-secret&token=another-secret'}})}
  }}), error => error.code === 'OFFLINE' && !error.message.includes('private-secret') && !error.message.includes('another-secret'))
  assert.equal(calls, 1)
})

test('network failure does not retry a prompt', async () => {
  let calls = 0
  await assert.rejects(requestRemote('sessions.prompt', {}, {fetchImpl:async () => { calls++; throw new Error('Network offline') }}), /Network offline/)
  assert.equal(calls, 1)
})

test('switching away aborts a pending request through the supplied signal', async () => {
  const controller = new AbortController()
  let observed
  const result = requestRemote('sessions.page', {}, {signal:controller.signal, fetchImpl:async (_url, init) => {
    observed = init.signal
    return await new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), {once:true}))
  }})
  controller.abort()
  await assert.rejects(result, {name:'AbortError'})
  assert.equal(observed.aborted, true)
})

test('desktop coordinates map scaled images to virtual monitor bounds including negative origins', () => {
  const rect = {left:100,top:20,width:960,height:540}
  const monitor = {x:-1920,y:-200,width:1920,height:1080}
  assert.deepEqual(pointerPosition(rect,{clientX:100,clientY:20},monitor),{x:-1920,y:-200})
  assert.deepEqual(pointerPosition(rect,{clientX:1060,clientY:560},monitor),{x:-1,y:879})
  assert.deepEqual(pointerPosition(rect,{clientX:2000,clientY:-50},monitor),{x:-1,y:-200})
  assert.equal(pointerPosition({...rect,width:0},{clientX:1,clientY:1},monitor),null)
})

test('only supported browser keys become native input', () => {
  for (const key of ['a','Z','7',' ','Control','Alt','Shift','Meta','Enter','Escape','Tab','ArrowLeft','PageDown','F1','F12']) assert.equal(desktopKey(key), key)
  for (const key of ['Dead','Process','Unidentified','F13','MediaPlayPause','😊',null]) assert.equal(desktopKey(key),null)
})

test('physical key codes preserve shifted letters, number-row symbols and punctuation', () => {
  assert.equal(desktopKey('A','KeyA'),'a')
  assert.equal(desktopKey('a','KeyA'),'a')
  assert.equal(desktopKey('!','Digit1'),'1')
  assert.equal(desktopKey('1','Digit1'),'1')
  for (const [code, shifted, unshifted] of [['Semicolon',':',';'],['Equal','+','='],['Comma','<',','],
    ['Minus','_','-'],['Period','>','.'],['Slash','?','/'],['Backquote','~','`'],['BracketLeft','{','['],
    ['Backslash','|','\\'],['BracketRight','}',']'],['Quote','"',"'"]]) {
    assert.equal(desktopKey(shifted,code),unshifted)
    assert.equal(desktopKey(unshifted,code),unshifted)
    assert.equal(desktopKey(unshifted),unshifted)
  }
  assert.equal(desktopKey('Control','ControlLeft'),'Control')
  assert.equal(desktopKey('Shift','ShiftRight'),'Shift')
})

test('draft keys cannot collide across devices or sessions', () => {
  assert.notEqual(draftKey('a:b','c'),draftKey('a','b:c'))
  assert.notEqual(draftKey('home','first'),draftKey('work','first'))
})

test('frame URLs encode identifiers and device labels never show URL secrets', () => {
  assert.equal(frameUrl('home & work','monitor/1'),'/api/remote-control/frame?remoteId=home+%26+work&monitorId=monitor%2F1&maxWidth=1280')
  assert.equal(deviceAddress('https://sample.test:8443/path?k=secret'),'sample.test:8443')
  assert.equal(deviceAddress('bad address'),'Saved connection')
  assert.equal(safeMessage('token: private-token'), 'token: [hidden]')
})

test('session search matches titles and working directories without mutating results', () => {
  const sessions = [{title:'Research',cwd:'C:/Projects/Carbon'},{title:'Notes',cwd:'C:/Other'}]
  assert.deepEqual(filterSessions(sessions,' carbon '),[sessions[0]])
  assert.deepEqual(filterSessions(sessions,'NOTES'),[sessions[1]])
  assert.equal(filterSessions(sessions,''),sessions)
})

test('companion can resume saved cold sessions while web requires a live agent', () => {
  assert.equal(canPromptSession('companion',false),true)
  assert.equal(canPromptSession('companion',true),true)
  assert.equal(canPromptSession('web',false),false)
  assert.equal(canPromptSession('web',true),true)
})

test('native input preserves order and uses a fresh event ID for each explicit command', async () => {
  const requests = []
  const queue = createDesktopInputQueue({remoteId:'home',request:async (action,args) => requests.push({action,...args})})
  queue.enable()
  await Promise.all([queue.send({type:'key',key:'Control',down:true}),queue.send({type:'key',key:'c',down:true}),queue.send({type:'key',key:'c',down:false}),queue.send({type:'key',key:'Control',down:false})])
  assert.deepEqual(requests.map(request => request.input.key),['Control','c','c','Control'])
  assert.equal(new Set(requests.map(request => request.eventId)).size,4)
  await queue.release()
  assert.equal(requests.at(-1).action,'desktop.release')
})

test('a failed native command discards later queued input and releases once without retrying', async () => {
  const requests = [], errors = []
  const queue = createDesktopInputQueue({remoteId:'home',onFailure:error => errors.push(error.message),request:async (action,args) => {
    requests.push({action,...args})
    if (action === 'desktop.input') throw new Error('Device disconnected')
  }})
  queue.enable()
  assert.deepEqual(await Promise.all([queue.send({type:'key',key:'a',down:true}),queue.send({type:'key',key:'a',down:false}),queue.send({type:'text',text:'do not replay'})]),[false,false,false])
  await queue.release()
  assert.deepEqual(requests.map(request => request.action),['desktop.input','desktop.release'])
  assert.deepEqual(errors,['Device disconnected'])
  assert.equal(await queue.send({type:'text',text:'still disabled'}),false)
})

test('blur release discards stale keys but allows a later explicit text command while Control stays enabled', async () => {
  const requests = []
  const queue = createDesktopInputQueue({remoteId:'home',request:async (action,args) => requests.push({action,...args})})
  queue.enable()
  const obsolete = queue.send({type:'key',key:'Shift',down:true})
  const released = queue.release(true)
  const text = queue.send({type:'text',text:'explicit text'})
  assert.equal(await obsolete,false)
  await released
  assert.equal(await text,true)
  assert.deepEqual(requests.map(request => request.action),['desktop.release','desktop.input'])
  assert.equal(requests[1].input.text,'explicit text')
  await queue.release()
})
