import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {remoteWindowUrl, openRemoteWindow, claimRemoteWindow, invitationLifetime, expiryText, watchControl, releaseRemote, installLocalHandoffBanner} from './pairing.mjs'
import {safeMessage} from './helpers.mjs'

const settle = () => new Promise(resolve => setImmediate(resolve))

test('app launch asks the local plugin once and exposes only a public device ID', async () => {
  const calls=[]
  assert.deepEqual(await openRemoteWindow('device with spaces',async(action,args)=>{calls.push({action,args});return {opened:true,mode:'app'}}),{opened:true,mode:'app'})
  assert.deepEqual(calls,[{action:'window.open',args:{remoteId:'device with spaces'}}])
  await assert.rejects(openRemoteWindow('device',async()=>({opened:false})),/could not be opened/)
  assert.equal(remoteWindowUrl('device with spaces'),'/api/remote-control/window?remoteId=device+with+spaces')
  assert.throws(() => remoteWindowUrl(''), /Choose/)
})

test('window bootstrap removes its one-use ticket before POST and never puts it in a request URL',async()=>{
  const events=[]
  const location={hash:'#ticket=private-fixture-ticket',pathname:'/api/remote-control/window',search:'?remoteId=device'}
  const result=await claimRemoteWindow({location,history:{replaceState:(state,title,path)=>events.push({replace:path})},fetchImpl:async(url,options)=>{events.push({url,options});return {ok:true}}})
  assert.deepEqual(events[0],{replace:'/api/remote-control/window?remoteId=device'})
  assert.equal(events[1].url,'/window/claim');assert.equal(events[1].options.credentials,'same-origin')
  assert.deepEqual(JSON.parse(events[1].options.body),{ticket:'private-fixture-ticket'})
  assert.deepEqual(result,{claimed:true})
  const error=await claimRemoteWindow({location,history:{replaceState:()=>{}},fetchImpl:async()=>{throw new Error('private-fixture-ticket')}}).then(()=>null,error=>error)
  assert.equal(error.message.includes('private-fixture-ticket'),false)
  assert.deepEqual(await claimRemoteWindow({location:{hash:''},fetchImpl:()=>{throw new Error('Must not fetch')}}),{claimed:false})
})

test('code countdown expires exactly and encoded invitation text is redacted from errors', () => {
  assert.equal(expiryText(600000, 0), 'Expires in 10:00 · one use')
  assert.equal(expiryText(600000, 599001), 'Expires in 0:01 · one use')
  assert.equal(expiryText(600000, 600000), 'Code expired. Generate a new one.')
  assert.equal(expiryText(null, 600000, 'unlimited'), 'No expiry · unlimited uses')
  assert.equal(expiryText(null, 600000), 'No expiry · one use')
  assert.equal(safeMessage('Rejected DSH1.example_payload.other-part'), 'Rejected [hidden connection code]')
})

test('invitation settings support fixed, unlimited-time and positive safe custom lifetimes',()=>{
  assert.equal(invitationLifetime('never'),null)
  assert.equal(invitationLifetime('30min'),1800000)
  assert.equal(invitationLifetime('1hr'),3600000)
  assert.equal(invitationLifetime('custom','1.5','hours'),5400000)
  assert.equal(invitationLifetime('custom','2','days'),172800000)
  for(const value of ['',0,-1,'Infinity',1e30,NaN])assert.throws(()=>invitationLifetime('custom',value,'minutes'),/positive custom duration/)
  assert.throws(()=>invitationLifetime('custom',1,'months'),/positive custom duration/)
})

test('control watcher renews serially while held, loses input on failure and never automatically reacquires', async () => {
  const actions = [], states = [], timers = []
  let count = 0
  const stop = watchControl({remoteId:'device',schedule:fn=>(timers.push(fn),timers.length),unschedule:()=>{},onChange:s=>states.push(s),request:async action=>{
    actions.push(action); count++
    if (count === 3) throw new Error('Disconnected')
    return {owner:'remote',heldByYou:true}
  }})
  await settle(); assert.deepEqual(actions,['control.status']); assert.equal(states.at(-1).value.heldByYou,true)
  await timers.shift()(); assert.equal(actions.at(-1),'control.heartbeat')
  await timers.shift()(); assert.equal(states.at(-1).value.heldByYou,false)
  await timers.shift()(); assert.equal(actions.at(-1),'control.status'); assert.equal(states.at(-1).value.heldByYou,false)
  assert.equal(actions.includes('control.acquire'),false)
  stop()
})

test('control watcher never renews a reclaimed lease and ignores late results after disposal', async () => {
  const actions=[],states=[],timers=[]
  let resolve
  const stop=watchControl({remoteId:'device',schedule:fn=>(timers.push(fn),1),unschedule:()=>{},onChange:s=>states.push(s),request:async action=>{
    actions.push(action)
    if(actions.length===1)return {owner:'local',heldByYou:false}
    return new Promise(r=>{resolve=r})
  }})
  await settle(); const pending=timers.shift()(); await settle();stop();resolve({owner:'remote',heldByYou:true});await pending
  assert.deepEqual(actions,['control.status','control.status']);assert.equal(states.length,1)
})

test('release frees held native input before returning chat control even if the native release fails', async () => {
  const actions=[]
  await releaseRemote('device',async action=>{actions.push(action);if(action==='desktop.release')throw new Error('No desktop');return {owner:'local'}})
  assert.deepEqual(actions,['desktop.release','control.release'])
})

test('the original-computer recovery banner remains outside the panel and reclaims with one click', async () => {
  const dom=new JSDOM('<body><main>Ordinary DSH chat</main></body>')
  const actions=[],timers=[]
  const dispose=installLocalHandoffBanner({document:dom.window.document,schedule:fn=>(timers.push(fn),1),unschedule:()=>{},request:async action=>{
    actions.push(action)
    return action==='sharing.reclaim'?{control:{owner:'local'}}:{control:{owner:'remote',label:'My laptop'}}
  }})
  await settle()
  const banner=dom.window.document.querySelector('.dsh-remote-handoff')
  assert.equal(banner.hidden,false);assert.match(banner.textContent,/My laptop/)
  banner.querySelector('button').click();await settle()
  assert.equal(banner.hidden,true);assert.deepEqual(actions,['sharing.status','sharing.reclaim'])
  dispose();assert.equal(dom.window.document.querySelector('.dsh-remote-handoff'),null);dom.window.close()
})
