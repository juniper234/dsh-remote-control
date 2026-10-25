import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RemoteController, messagesFromRecords } from '../lib/controller.js';

test('transcripts include user/assistant messages but omit injected runtime context',()=>{
  const records=[
    {event:{type:'user/message',seq:1,data:{source:{kind:'runtime'},content:[{type:'text',text:'hidden context'}]}}},
    {event:{type:'user/message',seq:2,data:{source:{kind:'user'},content:[{type:'text',text:'hello'}]}}},
    {event:{type:'assistant/message',seq:3,data:{message:{content:[{type:'text',text:'hi'}]}}}},
  ];
  assert.deepEqual(messagesFromRecords(records).map(x=>[x.role,x.text]),[['user','hello'],['assistant','hi']]);
});

test('controller does not replay a prompt with the same request id',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-'));let prompts=0;
  const connection={mode:'companion',connect:async()=>({connected:true,mode:'companion'}),listSessions:async()=>[],prompt:async()=>{prompts++;return {accepted:true};}};
  const c=new RemoteController({home,connectionFactory:()=>connection});
  try {const d=c.store.save({name:'Home',url:'https://home.example/?k=private-value'});
    const args={action:'sessions.prompt',remoteId:d.id,sessionId:'s1',text:'hello',requestId:'same-id'};
    await Promise.all([c.action(args),c.action(args)]);assert.equal(prompts,1);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('authenticated local API still rejects cross-origin posts and malformed inputs',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-api-'));const c=new RemoteController({home});
  const request=(headers,body)=>new Request('http://127.0.0.1:9999/api/remote-control',{method:'POST',headers,body});
  try {
    const blocked=await c.handleApi(request({'content-type':'application/json','x-dsh-remote-control':'1',origin:'https://evil.example'},JSON.stringify({action:'devices.list'})));
    assert.equal(blocked.status,403);
    const good=await c.handleApi(request({'content-type':'application/json','x-dsh-remote-control':'1',origin:'http://127.0.0.1:9999'},JSON.stringify({action:'devices.list'})));
    assert.equal(good.status,200);assert.equal((await good.json()).ok,true);
    assert.equal((await c.handleApi(request({'content-type':'text/plain'},'{}'))).status,415);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('sustained desktop movement expires old dedup entries without replaying current IDs',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-movement-'));let moves=0;let now=0;
  const connection={desktop:async()=>{moves++;return {accepted:true};}};
  const c=new RemoteController({home,now:()=>now,connectionFactory:()=>connection});
  try {
    const d=c.store.save({name:'Home',url:'https://home.example/?k=private-value'});
    for(let i=0;i<6000;i++){now+=50;await c.action({action:'desktop.input',remoteId:d.id,eventId:`move-${i}`,input:{type:'move',x:i%100,y:1}});}
    const last={action:'desktop.input',remoteId:d.id,eventId:'move-5999',input:{type:'move',x:99,y:1}};
    await c.action(last);assert.equal(moves,6000);
    assert.ok(c.mutations.size<1000,'old movement IDs must expire rather than exhaust a long control session');
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('an ambiguous failed input keeps its dedup tombstone even after normal cache expiry',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-failure-'));let calls=0;let now=0;
  const c=new RemoteController({home,now:()=>now,connectionFactory:()=>({desktop:async()=>{calls++;throw new Error('Connection lost after send');}})});
  try {const d=c.store.save({name:'Home',url:'https://home.example'});const args={action:'desktop.input',remoteId:d.id,eventId:'ambiguous-input',input:{type:'click',x:1,y:1,button:'left',count:1}};
    await assert.rejects(c.action(args));now=1000000;await assert.rejects(c.action(args));assert.equal(calls,1);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('real DSH bridge requests use their admitted Host authority rather than dsh.internal',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-bridge-'));const c=new RemoteController({home});
  try {
    const make=origin=>new Request('http://dsh.internal/api/remote-control',{method:'POST',headers:{host:'127.0.0.1:18320',origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-dsh-remote-control':'1'},body:JSON.stringify({action:'devices.list'})});
    assert.equal((await c.handleApi(make('http://127.0.0.1:18320'))).status,200);
    assert.equal((await c.handleApi(make('https://evil.example'))).status,403);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('explicit connection checks refresh changed remote desktop capabilities',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-probe-'));let desktop=false;
  const c=new RemoteController({home,connectionFactory:()=>{const available=desktop;return {connect:async()=>({connected:true,mode:'companion',capabilities:{sessions:true,desktop:available}})};}});
  try {const d=c.store.save({name:'Home',url:'https://home.example'});const args={action:'devices.probe',remoteId:d.id};
    assert.equal((await c.action(args)).capabilities.desktop,false);desktop=true;
    assert.equal((await c.action(args)).capabilities.desktop,true);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});

test('a slow probe cannot restore credentials after a device is edited or replace a newer probe',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-controller-probe-race-'));const pending=[];
  const c=new RemoteController({home,connectionFactory:device=>({device,connect:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))})});
  try {const d=c.store.save({name:'Home',url:'https://old.example'});
    const old=c.action({action:'devices.probe',remoteId:d.id});
    await c.action({action:'devices.save',id:d.id,name:'Home',url:'https://new.example'});
    pending.shift().resolve({connected:true});await old;
    assert.equal(c.connection(d.id).connection.device.url,'https://new.example');
    const first=c.action({action:'devices.probe',remoteId:d.id});const second=c.action({action:'devices.probe',remoteId:d.id});
    const [a,b]=pending.splice(0);b.resolve({connected:true});await second;
    const newest=c.connections.get(d.id);a.reject(new Error('Old check failed'));await first;
    assert.equal(c.connections.get(d.id),newest);
  }finally{c.dispose();fs.rmSync(home,{recursive:true,force:true});}
});
