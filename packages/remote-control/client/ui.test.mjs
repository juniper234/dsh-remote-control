import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {build} from 'esbuild'
import React, {act} from 'react'
import {fileURLToPath} from 'node:url'

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="test-root"></div></body></html>', {url:'http://localhost:18320/'})
for (const name of ['window','document','navigator','HTMLElement','Event','MouseEvent']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]})
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const {createRoot} = await import('react-dom/client')
const built = await build({entryPoints:[fileURLToPath(new URL('./source.jsx',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react(?:\/|$)/},args=>({path:import.meta.resolve(args.path),external:true}))}}]})
const {ShareCard,ConnectCard,RemoteWindow,DeviceWorkspace} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)

async function render(Component, props={}) {
  const element=document.getElementById('test-root')
  const root=createRoot(element)
  await act(async()=>root.render(React.createElement(Component,props)))
  return {element,unmount:()=>act(async()=>root.unmount())}
}
const response=value=>({ok:true,json:async()=>({ok:true,value})})
const click=element=>act(async()=>element.dispatchEvent(new MouseEvent('click',{bubbles:true})))

test('share UI creates a code only on explicit submit, defaults to chats, and copies the returned code',async()=>{
  const calls=[],copied=[]
  let code=null
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}})
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body);calls.push(args)
    if(args.action==='sharing.status')return response({enabled:!!code,label:'This computer',control:{owner:'local',supported:true}})
    if(args.action==='sharing.code')return response(code)
    if(args.action==='sharing.invite'){code={code:'DSH1.fixture-code',expiresAt:Date.now()+1800000,useLimit:args.useLimit};return response(code)}
    throw new Error(`Unexpected action ${args.action}`)
  }
  const {element,unmount}=await render(ShareCard)
  try {
    assert.deepEqual(calls.map(x=>x.action),['sharing.status','sharing.code'])
    assert.equal(element.querySelector('input[type=checkbox]').checked,false)
    await act(async()=>element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    const invite=calls.find(x=>x.action==='sharing.invite')
    assert.equal(invite.desktopEnabled,false);assert.equal(invite.label,'This computer')
    assert.equal(invite.useLimit,'once');assert.equal(invite.expiresInMs,1800000)
    assert.equal(invite.publicUrl,undefined)
    const copy=[...element.querySelectorAll('button')].find(x=>x.textContent.includes('Copy connection code'))
    assert.ok(copy);await click(copy);assert.deepEqual(copied,['DSH1.fixture-code'])
  } finally { await unmount() }
})

test('connect UI exchanges a code once and asks the plugin to open an app window',async()=>{
  const events=[],calls=[]
  window.open=()=>{throw new Error('Desktop popups are unsupported')}
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body);calls.push(args);events.push(args.action)
    if(args.action==='devices.connect')return response({device:{id:'remote-fixture',name:'Home'},control:{heldByYou:true}})
    if(args.action==='window.open')return response({opened:true,mode:'app'})
    throw new Error(`Unexpected action ${args.action}`)
  }
  const {element,unmount}=await render(ConnectCard)
  try {
    const textarea=element.querySelector('textarea')
    await act(async()=>{
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'DSH1.fixture-code')
      textarea.dispatchEvent(new Event('input',{bubbles:true}))
    })
    await act(async()=>element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    assert.deepEqual(events,['devices.connect','window.open'])
    assert.equal(calls.length,2);assert.ok(calls[0].requestId);assert.equal(calls[0].code,'DSH1.fixture-code')
    assert.deepEqual(calls[1],{action:'window.open',remoteId:'remote-fixture'})
    assert.equal(textarea.value,'');assert.match(element.textContent,/remote window opened/)
  } finally { await unmount() }
})

test('Cancel setup remains available during tunnel startup and discards a late invitation result',async()=>{
  const calls=[]
  let completeInvite
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body);calls.push(args.action)
    if(args.action==='sharing.invite')return new Promise(resolve=>{completeInvite=()=>resolve(response({code:'DSH1.cancelled-fixture',expiresAt:Date.now()+600000}))})
    if(args.action==='sharing.code')return response(null)
    return response({enabled:false,label:'This computer',control:{owner:'local',supported:false}})
  }
  const {element,unmount}=await render(ShareCard)
  try {
    assert.equal(element.querySelector('button[type=submit]').disabled,false)
    await act(async()=>element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    const cancel=[...element.querySelectorAll('button')].find(x=>x.textContent.trim()==='Cancel setup')
    assert.ok(cancel);assert.equal(cancel.disabled,false)
    await click(cancel)
    assert.equal(calls.filter(x=>x==='sharing.stop').length,1)
    await act(async()=>completeInvite())
    assert.equal(element.querySelector('textarea'),null)
    assert.equal(element.textContent.includes('Copy connection code'),false)
    assert.equal(element.querySelector('button[type=submit]').disabled,false)
  } finally { await unmount() }
})

test('expired invitation is removed from the UI and cannot be copied',async()=>{
  const oldNow=Date.now,oldInterval=globalThis.setInterval,oldClear=globalThis.clearInterval
  let current=100000,tick,code=null
  Date.now=()=>current
  globalThis.setInterval=callback=>(tick=callback,1)
  globalThis.clearInterval=()=>{}
  globalThis.fetch=async(url,options)=>{
    const {action}=JSON.parse(options.body)
    if(action==='sharing.code')return response(code)
    if(action==='sharing.invite'){code={code:'DSH1.expiring-fixture',expiresAt:current+1800000,useLimit:'once'};return response(code)}
    return response({enabled:!!code,label:'This computer',control:{owner:'local'}})
  }
  let mounted
  try {
    mounted=await render(ShareCard)
    await act(async()=>mounted.element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    assert.equal(mounted.element.querySelector('textarea').value,'DSH1.expiring-fixture')
    current+=1800000
    await act(async()=>tick())
    assert.equal(mounted.element.querySelector('textarea'),null)
    assert.equal(mounted.element.textContent.includes('Copy connection code'),false)
    assert.match(mounted.element.textContent,/Code expired/)
  } finally { if(mounted)await mounted.unmount();Date.now=oldNow;globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClear }
})

test('failed app launch offers recovery and leaves lease cleanup to the viewer-aware gateway',async()=>{
  const calls=[]
  window.open=()=>{throw new Error('Desktop popups are unsupported')}
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body);calls.push(args.action)
    return response(args.action==='devices.connect'?{device:{id:'remote-fixture',name:'Home'}}:args.action==='window.open'?{opened:false}:{owner:'local'})
  }
  const {element,unmount}=await render(ConnectCard)
  try {
    const textarea=element.querySelector('textarea')
    await act(async()=>{
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'DSH1.fixture-code')
      textarea.dispatchEvent(new Event('input',{bubbles:true}))
    })
    await act(async()=>element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    assert.deepEqual(calls,['devices.connect','window.open'])
    assert.ok([...element.querySelectorAll('button')].find(x=>x.textContent.trim()==='Open remote window'))
    assert.match(element.textContent,/could not be opened/)
  } finally { await unmount() }
})

test('code settings send unlimited with no expiry and validate custom days before generating',async()=>{
  const invites=[]
  let code=null
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body)
    if(args.action==='sharing.code')return response(code)
    if(args.action==='sharing.invite'){
      invites.push(args);code={code:'DSH1.settings-fixture',useLimit:args.useLimit,expiresAt:args.expiresInMs===null?null:Date.now()+args.expiresInMs};return response(code)
    }
    return response({enabled:!!code,label:'This computer',control:{owner:'local',supported:true}})
  }
  const {element,unmount}=await render(ShareCard)
  const select=async(suffix,value)=>act(async()=>{const field=element.querySelector(`select[id$="-${suffix}"]`);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}))})
  const duration=async value=>act(async()=>{const field=element.querySelector('input[id$="-duration"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}))})
  const generate=()=>act(async()=>element.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  try {
    await select('uses','unlimited');await select('expiry','never');await generate()
    assert.equal(invites[0].useLimit,'unlimited');assert.equal(invites[0].expiresInMs,null)
    assert.match(element.textContent,/No expiry · unlimited uses/)
    assert.equal(element.querySelector('textarea').value,'DSH1.settings-fixture')
    await select('expiry','custom');await select('unit','days');await duration('1.5');await generate()
    assert.equal(invites[1].expiresInMs,129600000)
    await duration('-1');await generate()
    assert.equal(invites.length,2);assert.match(element.textContent,/positive custom duration/)
  } finally { await unmount() }
})

test('paused reusable code is restored from the host, resumes only by click, and can be revoked',async()=>{
  const calls=[]
  let paused=true,code={code:'DSH1.resumable-fixture',useLimit:'unlimited',expiresAt:null}
  globalThis.fetch=async(url,options)=>{
    const {action}=JSON.parse(options.body);calls.push(action)
    if(action==='sharing.code')return response(code)
    if(action==='sharing.resume')paused=false
    if(action==='sharing.revoke')code=null
    return response({enabled:true,label:'This computer',control:{owner:'local',supported:true},code:{exists:!!code,useLimit:'unlimited',expiresAt:null,paused}})
  }
  const {element,unmount}=await render(ShareCard)
  try {
    assert.equal(element.querySelector('textarea'),null)
    assert.equal(calls.includes('sharing.resume'),false)
    await click([...element.querySelectorAll('button')].find(x=>x.textContent.trim()==='Resume remote access'))
    assert.equal(element.querySelector('textarea').value,'DSH1.resumable-fixture')
    await click([...element.querySelectorAll('button')].find(x=>x.textContent.trim()==='Revoke code'))
    assert.equal(element.querySelector('textarea'),null)
    assert.equal(calls.filter(x=>x==='sharing.resume').length,1)
    assert.equal(calls.filter(x=>x==='sharing.revoke').length,1)
  } finally { await unmount() }
})

test('remote window renders reclaimed control as view only with mutation buttons disabled',async()=>{
  const calls=[]
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body)
    calls.push({action:args.action,keepalive:options.keepalive})
    if(args.action==='window.leave')return response({left:true})
    if(args.action==='devices.list')return response({items:[{id:'remote-fixture',name:'Home',url:'https://device.example'}]})
    if(args.action==='control.status')return response({owner:'local',heldByYou:false})
    if(args.action==='devices.status')return response({connected:true,mode:'companion',capabilities:{sessions:true,desktop:false}})
    if(args.action==='sessions.list')return response({items:[{sessionId:'chat-fixture',title:'Existing chat',agentAvailable:true}]})
    if(args.action==='sessions.page')return response({messages:[{role:'assistant',text:'Existing answer',seq:1}]})
    throw new Error(`Unexpected action ${args.action}`)
  }
  const {element,unmount}=await render(RemoteWindow,{remoteId:'remote-fixture'})
  try {
    await act(async()=>{})
    assert.match(element.textContent,/View only/)
    const newSession=[...element.querySelectorAll('button')].find(x=>x.textContent.includes('New session'))
    const send=[...element.querySelectorAll('button')].find(x=>x.textContent==='Send')
    assert.equal(newSession.disabled,true);assert.equal(send.disabled,true)
    assert.match(element.textContent,/Existing answer/)
    await act(async()=>window.dispatchEvent(new Event('pagehide')))
    assert.deepEqual(calls.filter(call=>call.action==='window.leave'),[{action:'window.leave',keepalive:true}])
    assert.equal(calls.some(call=>call.action==='control.release'),false)
  } finally { await unmount() }
})

test('mobile session picker closes on selection and new chat, restores drafts and returns focus',async()=>{
  const oldMatchMedia=window.matchMedia,oldRaf=globalThis.requestAnimationFrame
  window.matchMedia=()=>({matches:true})
  globalThis.requestAnimationFrame=fn=>setTimeout(fn,0)
  const items=[{sessionId:'first',title:'First chat',agentAvailable:true},{sessionId:'second',title:'Second chat',agentAvailable:true}]
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body)
    if(args.action==='devices.status')return response({connected:true,mode:'companion',capabilities:{sessions:true,desktop:false}})
    if(args.action==='sessions.list')return response({items:[...items]})
    if(args.action==='sessions.page')return response({messages:[{seq:1,role:'assistant',text:`Answer in ${args.sessionId}`}],hasMore:false})
    if(args.action==='sessions.create'){items.push({sessionId:'new-chat',title:'New chat',agentAvailable:true});return response({sessionId:'new-chat'})}
    throw new Error(`Unexpected action ${args.action}`)
  }
  function Workspace(){
    const [drafts,setDrafts]=React.useState({})
    return React.createElement('div',{className:'dsh-remote-control'},React.createElement(DeviceWorkspace,{device:{id:'mobile',name:'Home',url:'https://device.example'},visible:true,canControl:true,drafts,setDrafts}))
  }
  const {element,unmount}=await render(Workspace)
  const flush=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,5)))
  const picker=()=>element.querySelector('.rc-sessions')
  const button=text=>[...element.querySelectorAll('button')].find(x=>x.textContent.trim()===text)
  const select=title=>[...element.querySelectorAll('.rc-session-item')].find(x=>x.textContent.includes(title))
  try {
    await flush()
    assert.equal(picker().dataset.mobileView,'sessions')
    await click(select('Second chat'));await flush()
    assert.equal(picker().dataset.mobileView,'chat')
    assert.equal(document.activeElement.textContent,'Second chat')
    assert.match(element.querySelector('.rc-transcript').textContent,/Answer in second/)
    const textarea=element.querySelector('.rc-composer textarea')
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Unsent phone draft');textarea.dispatchEvent(new Event('input',{bubbles:true}))})
    await click(element.querySelector('.rc-mobile-sessions'));await flush()
    assert.equal(picker().dataset.mobileView,'sessions')
    assert.equal(document.activeElement.type,'search')
    await click(select('First chat'));await flush()
    assert.equal(textarea.value,'')
    await click(element.querySelector('.rc-mobile-sessions'));await click(select('Second chat'));await flush()
    assert.equal(textarea.value,'Unsent phone draft')
    await click(element.querySelector('.rc-mobile-sessions'));await click(button('New session'));await flush()
    assert.equal(picker().dataset.mobileView,'chat')
    assert.equal(element.querySelector('.rc-chat h3').textContent,'New chat')
    await click(element.querySelector('.rc-mobile-sessions'));await click(button('Back to chat'));await flush()
    assert.equal(picker().dataset.mobileView,'chat')
  } finally {await flush();await unmount();window.matchMedia=oldMatchMedia;globalThis.requestAnimationFrame=oldRaf}
})

test('backgrounding makes the remote view read only immediately and keeps drafts until explicit acquire',async()=>{
  const calls=[]
  globalThis.fetch=async(url,options)=>{
    const args=JSON.parse(options.body);calls.push(args.action)
    if(args.action==='devices.list')return response({items:[{id:'phone',name:'Home',url:'https://device.example'}]})
    if(args.action==='control.status'||args.action==='control.acquire')return response({owner:'remote',heldByYou:true})
    if(args.action==='devices.status')return response({connected:true,mode:'companion',capabilities:{sessions:true,desktop:false}})
    if(args.action==='sessions.list')return response({items:[{sessionId:'draft-chat',title:'Draft chat',agentAvailable:true}]})
    if(args.action==='sessions.page')return response({messages:[]})
    throw new Error(`Unexpected action ${args.action}`)
  }
  const {element,unmount}=await render(RemoteWindow,{remoteId:'phone'})
  try{
    await act(async()=>{})
    const textarea=element.querySelector('.rc-composer textarea')
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Keep this draft');textarea.dispatchEvent(new Event('input',{bubbles:true}))})
    const send=element.querySelector('.rc-composer button[type=submit]')
    assert.equal(send.disabled,false)
    await act(async()=>window.dispatchEvent(new Event('dsh-remote-control-lost')))
    assert.equal(send.disabled,true)
    assert.match(element.textContent,/View only/)
    assert.equal(textarea.value,'Keep this draft')
    assert.equal(calls.includes('control.acquire'),false)
    await click([...element.querySelectorAll('button')].find(x=>x.textContent.trim()==='Take control'))
    await act(async()=>{})
    assert.equal(calls.filter(x=>x==='control.acquire').length,1)
    assert.equal(send.disabled,false)
    assert.equal(textarea.value,'Keep this draft')
  }finally{await unmount()}
})

test.after(()=>dom.window.close())
