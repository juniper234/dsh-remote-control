import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanion} from '../companion/index.js';
import {RemoteController} from '../lib/controller.js';
import {DeviceStore} from '../lib/store.js';

const tunnel=()=>({state:'idle',status(){return {state:this.state,kind:'automatic'};},async stop(){this.state='idle';},async dispose(){await this.stop();},async start(){throw Error('Unexpected public tunnel request in offline tests');}});
async function fixture(t){
  const home=await mkdtemp(join(tmpdir(),'dsh-pair-workflow-'));
  let now=Date.now();const prompts=[];
  const native={
    list:async()=>({items:[{sessionId:'fixture-session',title:'Existing chat',agentAvailable:true,projections:{asOfSeq:2}}]}),
    page:async()=>({records:[{event:{type:'assistant/message',seq:2,data:{content:[{type:'text',text:'Existing reply'}]}}}],hasMore:false}),
    create:async()=>({sessionId:'new-fixture'}),rename:async()=>({}),cancel:async()=>({}),
    prompt:async args=>{prompts.push(args);},updateQueue:async()=>({}),fork:async()=>({}),selectModel:async()=>({}),
  };
  const services={sessionController:native,webServer:{getOrigin:()=> 'http://127.0.0.1:1'},connection:{authenticatedUrl:()=> 'http://127.0.0.1:1'}};
  const sharing=createCompanion({get:name=>services[name]},{home:join(home,'host'),now:()=>now});
  await sharing.ready;await sharing.start({port:0,label:'Fixture PC',desktopEnabled:false});
  const host=new RemoteController({home:join(home,'host'),sharing,tunnel:tunnel(),now:()=>now});
  const clientHome=join(home,'client');
  const client=new RemoteController({home:clientHome,tunnel:tunnel(),now:()=>now});
  t.after(async()=>{await host.dispose();await client.dispose();await sharing.dispose();await rm(home,{recursive:true,force:true});});
  const invite=()=>host.action({action:'sharing.invite',label:'Fixture PC',desktopEnabled:false,publicUrl:sharing.status().localUrl});
  return {host,client,sharing,native,prompts,invite,clientHome,advance:ms=>{now+=ms;}};
}
test('copy code -> connect -> chat -> take back control works through real loopback HTTP',async t=>{
  const f=await fixture(t);
  const invitation=await f.invite();
  assert.match(invitation.code,/^DSH1\./);
  const args={action:'devices.connect',code:invitation.code,requestId:'one-pair-request'};
  const [a,b]=await Promise.all([f.client.action(args),f.client.action(args)]);
  assert.equal(a.device.id,b.device.id);assert.equal(a.control.heldByYou,true);
  assert.equal(JSON.stringify(a).includes('token'),false);
  assert.equal(a.connection.capabilities.control,true);
  assert.equal(f.sharing.status().control.owner,'remote');
  assert.throws(()=>f.native.prompt({}),{code:'control/remote-active'});
  const sessions=await f.client.action({action:'sessions.list',remoteId:a.device.id});
  assert.equal(sessions.items[0].sessionId,'fixture-session');
  const page=await f.client.action({action:'sessions.page',remoteId:a.device.id,sessionId:'fixture-session'});
  assert.equal(page.messages[0].text,'Existing reply');
  const prompt={action:'sessions.prompt',remoteId:a.device.id,sessionId:'fixture-session',text:'Fixture only',requestId:'one-prompt'};
  await Promise.all([f.client.action(prompt),f.client.action(prompt)]);assert.equal(f.prompts.length,1);
  const restored=new DeviceStore(f.clientHome).private(a.device.id);
  assert(restored.clientId);assert(restored.token);
  await f.host.action({action:'sharing.reclaim'});
  assert.equal(f.sharing.status().control.owner,'local');
  await f.native.prompt({content:[]});assert.equal(f.prompts.length,2);
  await assert.rejects(f.client.action({action:'control.heartbeat',remoteId:a.device.id}),{code:'remote/access-ended'});
  await assert.rejects(f.client.action({...prompt,requestId:'late-prompt'}));assert.equal(f.prompts.length,2);
});
test('expired lease restores local input; remote must explicitly acquire, and used code cannot reconnect',async t=>{
  const f=await fixture(t);const invitation=await f.invite();
  const result=await f.client.action({action:'devices.connect',code:invitation.code});
  f.advance(31000);
  assert.equal(f.sharing.status().control.owner,'local');
  await assert.rejects(f.client.action({action:'control.heartbeat',remoteId:result.device.id}),{code:'control/not-owner'});
  await f.native.prompt({content:[]});
  assert.equal((await f.client.action({action:'control.acquire',remoteId:result.device.id})).heldByYou,true);
  await f.client.action({action:'control.release',remoteId:result.device.id});
  assert.equal(f.sharing.status().control.owner,'local');
  await assert.rejects(f.client.action({action:'devices.connect',code:invitation.code,requestId:'reuse'}),{code:'pairing/expired'});
});
test('unlimited no-expiry choice survives the whole owner API flow, including pause, resume, copy and revoke',async t=>{
  const f=await fixture(t);
  const invitation=await f.host.action({action:'sharing.invite',label:'Fixture PC',publicUrl:f.sharing.status().localUrl,useLimit:'unlimited',expiresInMs:null});
  assert.equal(invitation.expiresAt,null);assert.equal(invitation.useLimit,'unlimited');
  assert((await f.host.action({action:'sharing.code'})).code===invitation.code);
  await f.client.action({action:'devices.connect',code:invitation.code,requestId:'first-unlimited'});
  await f.host.action({action:'sharing.reclaim'});
  assert.equal(f.sharing.status().code.paused,true);
  await assert.rejects(f.client.action({action:'devices.connect',code:invitation.code,requestId:'while-paused'}),{code:'pairing/paused'});
  await f.host.action({action:'sharing.resume'});
  const again=await f.client.action({action:'devices.connect',code:invitation.code,requestId:'after-resume'});
  assert.equal(again.control.heldByYou,true);
  await f.host.action({action:'sharing.revoke'});
  assert.equal(await f.host.action({action:'sharing.code'}),null);
  assert.equal(f.sharing.status().code.exists,false);
});
test('stop while network setup is pending cannot return a late valid invitation',async t=>{
  const f=await fixture(t);let resolve;
  const pending=new Promise(r=>{resolve=r;});
  f.host.tunnel={status:()=>({state:'starting',kind:'automatic'}),start:()=>pending,stop:async()=>resolve({url:'https://fixture.example'}),dispose:async()=>{}};
  const creating=f.host.action({action:'sharing.invite',label:'Fixture PC'});
  await new Promise(r=>setImmediate(r));
  const stopping=f.host.action({action:'sharing.stop'});
  await assert.rejects(creating,{code:'sharing/cancelled'});await stopping;
  assert.equal(f.sharing.status().enabled,false);
});

test('stop while companion start is still awaited never opens a late network tunnel',async t=>{
  const f=await fixture(t);let releaseStart,enteredStart;
  const gate=new Promise(resolve=>{releaseStart=resolve;});
  const entered=new Promise(resolve=>{enteredStart=resolve;});
  const originalStart=f.sharing.start;
  f.sharing.start=async args=>{const value=await originalStart(args);enteredStart();await gate;return value;};
  let networkStarts=0;
  f.host.tunnel={status:()=>({state:'idle',kind:'automatic'}),start:async()=>{networkStarts++;return {url:'https://fixture.example'};},stop:async()=>{},dispose:async()=>{}};
  const creating=f.host.action({action:'sharing.invite',label:'Changed fixture PC'});
  const rejected=assert.rejects(creating,{code:'sharing/cancelled'});
  await entered;
  await f.host.action({action:'sharing.stop'});
  releaseStart();await rejected;
  assert.equal(networkStarts,0);
  assert.equal(f.sharing.status().enabled,false);
});

test('network cleanup failure cannot keep companion access active after Stop sharing',async t=>{
  const f=await fixture(t);const invitation=await f.invite();
  const result=await f.client.action({action:'devices.connect',code:invitation.code});
  assert.equal(f.sharing.status().control.owner,'remote');
  f.host.tunnel={status:()=>({state:'error',kind:'automatic'}),stop:async()=>{throw Object.assign(new Error('Owned helper cleanup is unconfirmed.'),{code:'network/cleanup'});},dispose:async()=>{}};
  await assert.rejects(f.host.action({action:'sharing.stop'}),{code:'network/cleanup'});
  assert.equal(f.sharing.status().enabled,false);
  assert.equal(f.sharing.status().control.owner,'local');
  await f.native.prompt({content:[]});
  await assert.rejects(f.client.action({action:'control.heartbeat',remoteId:result.device.id}));
});

test('controller disposal drains pending invitation cleanup before a replacement can start',async t=>{
  const f=await fixture(t);await f.sharing.stop();let releaseStart,enteredStart;
  const gate=new Promise(resolve=>{releaseStart=resolve;});
  const entered=new Promise(resolve=>{enteredStart=resolve;});
  const originalStart=f.sharing.start;
  f.sharing.start=async args=>{const value=await originalStart(args);enteredStart();await gate;return value;};
  const creating=f.host.action({action:'sharing.invite',label:'Fixture PC'});
  const rejected=assert.rejects(creating,{code:'sharing/cancelled'});
  await entered;
  let settled=false;
  const disposing=f.host.dispose().then(()=>{settled=true;});
  await new Promise(resolve=>setImmediate(resolve));
  const returnedBeforeCleanup=settled;
  releaseStart();await rejected;await disposing;
  assert.equal(returnedBeforeCleanup,false,'Disposal returned while an old invite could still reclaim or stop a replacement companion.');
  assert.equal(f.sharing.status().enabled,false);
});
