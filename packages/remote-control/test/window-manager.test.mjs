import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowManager,launchAppWindow} from '../lib/window-manager.js';

async function fixture(t,options={}){
  let launched;const calls=[],launches=[];let token='fixture-token';
  const controller={store:{list:()=>[{id:'paired-one',name:'Test PC'},{id:'private-other',name:'Other PC'}],private:()=>({url:'https://fixture.example',token,clientId:'fixture-client'}),redact:String},
    action:async args=>{calls.push(args);if(args.action==='control.status')return {heldByYou:true,owner:'remote'};return {items:[],accepted:true};},
    handleFrame:async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}})};
  const manager=new WindowManager({controller,launch:async url=>{launched=new URL(url);launches.push(launched);},readBundle:async()=>Buffer.from('/* fixture */'),...options});
  t.after(()=>manager.dispose());
  const result=await manager.open('paired-one');
  const ticket=new URLSearchParams(launched.hash.slice(1)).get('ticket');
  const origin=launched.origin;
  const request=(path,body,headers={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const claim=()=>request('/window/claim',{ticket});
  return {manager,origin,result,calls,request,claim,ticket,launches,changeCredential:()=>{token='replacement-fixture-token';}};
}
test('standalone gateway uses one-use browser capability and only exposes the selected remote',async t=>{
  const f=await fixture(t);
  assert.deepEqual(f.result,{opened:true,mode:'app'});assert.equal(JSON.stringify(f.result).includes(f.ticket),false);
  const html=await f.request('/api/remote-control/window?remoteId=paired-one');
  assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal((await html.text()).includes(f.ticket),false);
  assert.equal((await f.request('/api/remote-control',{action:'devices.list'})).status,403);
  const claim=await f.claim();assert.equal(claim.status,200);
  const setCookie=claim.headers.get('set-cookie');assert.match(setCookie,/HttpOnly; SameSite=Strict/);
  assert.equal((await f.claim()).status,403);
  const headers={cookie:setCookie.split(';')[0],'x-dsh-remote-control':'1'};
  const list=await f.request('/api/remote-control',{action:'devices.list'},headers);
  assert.deepEqual((await list.json()).value.items,[{id:'paired-one',name:'Test PC'}]);
  for(const action of ['sharing.status','sharing.invite','sharing.reclaim','devices.save','window.open'])assert.equal((await f.request('/api/remote-control',{action,remoteId:'paired-one'},headers)).status,403);
  assert.equal((await f.request('/api/remote-control',{action:'sessions.list',remoteId:'private-other'},headers)).status,403);
  assert.equal((await f.request('/api/remote-control',{action:'sessions.list',remoteId:'paired-one'},headers)).status,200);
  assert.equal((await f.request('/api/remote-control/frame?remoteId=private-other',undefined,headers)).status,403);
  assert.equal((await f.request('/api/remote-control/frame?remoteId=paired-one',undefined,headers)).status,200);
  assert.equal((await f.request('/api/remote-control',{action:'control.release',remoteId:'paired-one'},{...headers,origin:'https://untrusted.example'})).status,403);
});
test('expired or cross-origin window claims do not grant cookies',async t=>{
  let now=0;const f=await fixture(t,{now:()=>now,claimMs:100});
  assert.equal((await f.request('/window/claim',{ticket:f.ticket},{origin:'https://untrusted.example'})).status,403);
  now=101;const result=await f.claim();assert.equal(result.status,403);assert.equal(result.headers.get('set-cookie'),null);
});
test('app launcher uses fixed Edge executable, literal argv and no shell',async()=>{
  const seen=[];
  await launchAppWindow('http://127.0.0.1:12345/#ticket=fixture-only',{
    platform:'win32',env:{ProgramFiles:'C:\\Program Files'},exists:async()=>true,
    spawnImpl:(exe,args,options)=>{seen.push({exe,args,options});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},
  });
  assert.equal(seen.length,1);assert.match(seen[0].exe,/Microsoft.*Edge.*msedge\.exe$/);
  assert.equal(seen[0].args[0],'--app=http://127.0.0.1:12345/#ticket=fixture-only');
  assert.equal(seen[0].options.shell,false);assert.equal(seen[0].options.windowsHide,true);
});
test('failed app launch closes its scoped listener instead of leaving a hidden gateway',async t=>{
  let url;
  const controller={store:{list:()=>[{id:'one'}],private:()=>({token:'fixture-token'})},action:async()=>({heldByYou:true})};
  const manager=new WindowManager({controller,launch:async value=>{url=value;throw Error('launch failed');}});t.after(()=>manager.dispose());
  await assert.rejects(manager.open('one'),/launch failed/);assert.equal(manager.entries.size,0);
  await assert.rejects(fetch(url));
});
test('multiple viewers have distinct cookies and only the last leaving viewer releases control',async t=>{
  const f=await fixture(t,{leaveMs:15});
  const first=await f.claim();const firstCookie=first.headers.get('set-cookie').split(';')[0];
  await f.manager.open('paired-one');const secondUrl=f.launches.at(-1),secondOrigin=secondUrl.origin;
  const secondTicket=new URLSearchParams(secondUrl.hash.slice(1)).get('ticket');
  const second=await fetch(secondOrigin+'/window/claim',{method:'POST',headers:{origin:secondOrigin,'content-type':'application/json'},body:JSON.stringify({ticket:secondTicket})});
  const secondCookie=second.headers.get('set-cookie').split(';')[0];
  assert.notEqual(firstCookie.split('=')[0],secondCookie.split('=')[0]);
  const cookies=firstCookie+'; '+secondCookie;
  assert.equal((await f.request('/api/remote-control',{action:'devices.list'},{cookie:cookies,'x-dsh-remote-control':'1'})).status,200);
  await f.request('/api/remote-control',{action:'window.leave',remoteId:'paired-one'},{cookie:cookies,'x-dsh-remote-control':'1'});
  await new Promise(r=>setTimeout(r,35));
  assert.equal(f.calls.filter(x=>x.action==='control.release').length,0);
  const secondCall=body=>fetch(secondOrigin+'/api/remote-control',{method:'POST',headers:{origin:secondOrigin,'content-type':'application/json','x-dsh-remote-control':'1',cookie:cookies},body:JSON.stringify(body)});
  assert.equal((await secondCall({action:'devices.list'})).status,200);
  await secondCall({action:'window.leave',remoteId:'paired-one'});await new Promise(r=>setTimeout(r,35));
  assert.equal(f.calls.filter(x=>x.action==='control.release').length,1);
});
test('a viewer cannot inherit replacement pairing credentials under the same saved device ID',async t=>{
  const f=await fixture(t);const response=await f.claim();const cookie=response.headers.get('set-cookie').split(';')[0];
  f.changeCredential();
  assert.equal((await f.request('/api/remote-control',{action:'sessions.list',remoteId:'paired-one'},{cookie,'x-dsh-remote-control':'1'})).status,403);
});
