import { randomUUID, createHash } from 'node:crypto';
import { DeviceStore } from './store.js';
import { RemoteConnection, ConnectionError } from './transport.js';
import { hostname } from 'node:os';
import { decodeConnectionCode, encodeConnectionCode, connectionOrigin } from './connection-code.js';
import { TunnelManager } from './tunnel.js';
import { WindowManager } from './window-manager.js';

const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function text(value,field,{max=1000,optional=false}={}) {
  if (optional && (value===undefined || value==='')) return undefined;
  if (typeof value!=='string' || !value.trim() || value.length>max) throw new ConnectionError('request/invalid',`Enter a valid ${field} (maximum ${max} characters).`);
  return value;
}
function contentText(content) {
  if(typeof content==='string')return content;
  return Array.isArray(content)?content.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n'):'';
}
export function messagesFromRecords(records) {
  const messages=[];const seen=new Set();
  for(const record of records??[]) {
    const event=record?.event??record;const data=event?.data??{};let role,body;
    if(event?.type==='user/message' && (!data.source?.kind || data.source.kind==='user')) {
      const id=data.id??event.seq;if(seen.has(id))continue;seen.add(id);
      role='user';body=contentText(data.content??data.message?.content);
    } else if(event?.type==='assistant/message') {role='assistant';body=contentText(data.message?.content??data.content);}
    if(role && body)messages.push({role,text:body,time:event.time,seq:event.seq});
  }
  return messages;
}
export function sessionSummary(item) {
  const values=item.projections?.values??{};
  return {sessionId:item.sessionId,title:values.title??item.title??'Untitled chat',cwd:item.cwd??values.workingDirectory??'',
    running:item.running===true,updatedAt:item.updatedAt??null,agentAvailable:item.agentAvailable===true,seq:item.projections?.asOfSeq??-1};
}
function requestAllowed(request) {
  const site=request.headers.get('sec-fetch-site');
  if(site && !['same-origin','none'].includes(site))return false;
  const origin=request.headers.get('origin');
  if(origin) {
    try {
      const parsed=new URL(origin);
      if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)return false;
      // The DSH bridge intentionally uses http://dsh.internal for Request.url.
      // Its authenticated owner-only route retains the admitted Host header.
      const host=request.headers.get('host');
      const authority=host?new URL(`${parsed.protocol}//${host}`):new URL(request.url);
      if(authority.origin!==parsed.origin)return false;
    }catch{return false;}
  }
  return true;
}

export class RemoteController {
  constructor({home,sharing,tunnel,windowManager,connectionFactory=(d,options)=>new RemoteConnection(d,options),now=Date.now}={}) {
    this.store=new DeviceStore(home);this.sharing=sharing;this.connectionFactory=connectionFactory;
    this.now=now;this.lifetime=new AbortController();
    this.connections=new Map();this.connectionGenerations=new Map();this.mutations=new Map();this.created=new Set();this.disposed=false;
    this.tunnel=tunnel ?? new TunnelManager({home}); this.networkKind='automatic'; this.sharingQueue=Promise.resolve();this.sharingEpoch=0;
    this.windows=windowManager??new WindowManager({controller:this,now});this.currentCode=null;
  }
  sharingTask(fn) {
    const task=this.sharingQueue.then(()=>{if(this.disposed)throw new ConnectionError('plugin/reloading','Remote Control is reloading.');return fn();});
    this.sharingQueue=task.catch(()=>{}); return task;
  }
  async invite(args,epoch) {
    const current=()=>{if(this.disposed||epoch!==this.sharingEpoch)throw new ConnectionError('sharing/cancelled','Sharing setup was cancelled.');};
    current();
    await this.sharing.ready;
    current();
    if(typeof this.sharing.createInvitation!=='function')throw new ConnectionError('sharing/upgrade-required','Update Remote Control on this computer to create connection codes.');
    const before=this.sharing.status();
    const label=text(args.label ?? hostname(),'computer name',{max:80});
    const publicUrl=args.publicUrl ? connectionOrigin(args.publicUrl) : undefined;
    const useLimit=args.useLimit??'once';const expiresInMs=args.expiresInMs===undefined?30*60000:args.expiresInMs;
    if(!['once','unlimited'].includes(useLimit)|| (expiresInMs!==null&&(!Number.isSafeInteger(expiresInMs)||expiresInMs<=0||!Number.isSafeInteger(this.now()+expiresInMs)))) {
      throw new ConnectionError('request/policy','Choose one-time or unlimited use, and a positive expiry duration or no expiry.');
    }
    if(before.control?.owner==='remote')throw new ConnectionError('control/held','Take back control before generating a new connection code.');
    let started=false,networkTouched=false;
    try {
      if(!before.enabled || before.label!==label || before.desktopEnabled!==(args.desktopEnabled===true)) {
        await this.sharing.start({label,desktopEnabled:args.desktopEnabled===true,...(!before.enabled&&!publicUrl?{port:0}:{})}); started=!before.enabled;
      }
      current();
      let url=publicUrl;
      if(publicUrl) {await this.tunnel.stop();this.networkKind='custom';}
      else {
        this.networkKind='automatic';
        networkTouched=true;
        const network=await this.tunnel.start({port:this.sharing.status().port}); url=network.url;
      }
      current();
      const invitation=await this.sharing.createInvitation({publicUrl:url,useLimit,expiresInMs,networkKind:this.networkKind});
      current();
      this.currentCode={code:encodeConnectionCode(invitation),expiresAt:invitation.expiresAt,useLimit:invitation.useLimit};
      return {...this.currentCode,sharing:await this.sharingStatus(),network:this.networkStatus()};
    } catch(error) {
      if(error.code==='sharing/cancelled')await this.sharing.reclaim().catch(()=>{});
      if(networkTouched)await this.tunnel.stop().catch(()=>{});
      if(started)await this.sharing.stop().catch(()=>{});
      throw error;
    }
  }
  networkStatus() {const kind=this.sharing?.status?.().code?.networkKind??this.networkKind;return kind==='custom' ? {state:'configured',kind:'custom'} : this.tunnel.status();}
  async connectCode(args) {
    const invitation=decodeConnectionCode(args.code,this.now());
    const clientId=randomUUID();
    const requestedName=text(args.name,'device name',{max:80,optional:true});
    const connection=this.connectionFactory({name:requestedName??invitation.label,url:invitation.url,mode:'companion',token:'',clientId},{signal:this.lifetime.signal});
    const result=await connection.pair(invitation.secret,{clientId,label:hostname().slice(0,80)});
    try {
      if(this.disposed)throw new ConnectionError('plugin/reloading','Remote Control is reloading.');
      const existing=this.store.list().find(d=>d.url===invitation.url);
      const base=requestedName??result.deviceLabel??invitation.label;
      let name=base; let suffix=2;
      while(this.store.list().some(d=>d.id!==existing?.id&&d.name.toLowerCase()===name.toLowerCase())) name=`${base.slice(0,72)} (${suffix++})`;
      const device=this.store.save({id:existing?.id,name,url:invitation.url,mode:'companion',token:result.token,clientId});
      this.connectionGenerations.set(device.id,Symbol());this.connections.set(device.id,connection);
      return {device,connection:connection.connectionInfo(),control:result.control};
    }catch(error){await connection.control('release').catch(()=>{});throw error;}
  }
  connection(id) {
    const device=this.store.private(id);
    let connection=this.connections.get(device.id);
    if(!connection){connection=this.connectionFactory(device,{signal:this.lifetime.signal});this.connections.set(device.id,connection);}
    return {device,connection};
  }
  once(key,payload,execute) {
    const now=this.now();for(const [k,v]of this.mutations)if(now>v.expiresAt)this.mutations.delete(k);
    const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const existing=this.mutations.get(key);
    if(existing){if(existing.fingerprint!==fingerprint)throw new ConnectionError('request/conflict','That action ID was already used for different content.');return existing.promise;}
    if(this.mutations.size>=20000)throw new ConnectionError('request/busy','Too many recent actions. Wait briefly before sending more.');
    const ttl=key.startsWith('input:')?30000:300000;
    const entry={expiresAt:Infinity,fingerprint,promise:undefined};
    const promise=Promise.resolve().then(execute).then(value=>{entry.expiresAt=this.now()+ttl;return value;});
    entry.promise=promise;this.mutations.set(key,entry);promise.catch(()=>{});
    return promise;
  }
  async action(args={}) {
    if(this.disposed)throw new ConnectionError('plugin/reloading','Remote Control is reloading. Reopen the panel.');
    const action=text(args.action,'action',{max:80});
    if(action==='devices.list')return {items:this.store.list(),sharing:await this.sharingStatus()};
    if(action==='window.open'){
      const remoteId=text(args.remoteId,'paired computer',{max:200});
      try{return await this.windows.open(remoteId);}
      catch(error){await this.windows.releaseIfUnused(remoteId).catch(()=>{});throw error;}
    }
    if(action==='devices.connect') {
      const requestId=text(args.requestId??randomUUID(),'request ID',{max:200});
      return this.once(`pair:${requestId}`,{code:args.code,name:args.name},()=>this.connectCode(args));
    }
    if(action==='devices.save'){const device=this.store.save(args);this.connectionGenerations.set(device.id,Symbol());this.connections.delete(device.id);return device;}
    if(action==='devices.remove'){const d=this.store.private(args.remoteId);this.connectionGenerations.set(d.id,Symbol());this.connections.delete(d.id);return this.store.remove(d.id);}
    if(action.startsWith('sharing.')) {
      if(action==='sharing.status')return this.sharingStatus();
      if(!this.sharing)throw new ConnectionError('sharing/unavailable','The sharing companion is not loaded.');
      await this.sharing.ready;
      if(action==='sharing.code') {
        const code=this.sharing.status().code;
        return code?.exists&&!code.used&&!code.expired?this.currentCode:null;
      }
      if(action==='sharing.invite'){const epoch=++this.sharingEpoch;return this.sharingTask(()=>this.invite(args,epoch));}
      if(action==='sharing.reclaim') {
        // Reclaim must run immediately, even while a tunnel start is pending.
        this.sharingEpoch++;await this.sharing.reclaim();return this.sharingStatus();
      }
      if(action==='sharing.resume')return this.sharingTask(async()=>{
        const status=this.sharing.status();
        if(!status.enabled || (status.code?.networkKind==='automatic'&&this.tunnel.status().state!=='ready'))throw new ConnectionError('sharing/new-code','The temporary connection ended. Generate a replacement code to reconnect.');
        await this.sharing.resume();return this.sharingStatus();
      });
      if(action==='sharing.revoke'){this.sharingEpoch++;this.currentCode=null;await this.sharing.revokeInvitation();return this.sharingStatus();}
      if(action==='sharing.start') {
        if(args.port!==undefined && (!Number.isInteger(args.port)||args.port<1024||args.port>65535))throw new ConnectionError('request/port','Choose a port from 1024 to 65535.');
        await this.sharing.start({port:args.port,label:args.label,desktopEnabled:args.desktopEnabled===true});
        return this.sharingStatus();
      }
      if(action==='sharing.stop'){
        this.sharingEpoch++;this.currentCode=null;
        // End access even if a broken network helper cannot confirm cleanup.
        const outcomes=await Promise.allSettled([this.sharing.stop(),this.tunnel.stop()]);
        for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
        return this.sharingStatus();
      }
      if(action==='sharing.pairing')return {url:await this.sharing.pairingUrl(args.publicUrl)};
      throw new ConnectionError('request/action','Unknown sharing action.');
    }
    const {device,connection}=this.connection(args.remoteId);
    if(action==='devices.status')return connection.status?.() ?? connection.connect();
    if(action.startsWith('control.')) {
      const operation=action.slice('control.'.length);
      if(!['status','acquire','heartbeat','release'].includes(operation))throw new ConnectionError('request/action','Unknown control action.');
      return connection.control(operation,operation==='acquire'?{label:hostname().slice(0,80)}:{});
    }
    if(action==='devices.probe') {
      // An explicit reconnect must refresh health and auth; leave an in-flight
      // connection object unchanged so a probe cannot reroute an active action.
      const generation=Symbol();this.connectionGenerations.set(device.id,generation);
      const current=()=>!this.disposed&&this.connectionGenerations.get(device.id)===generation;
      const fresh=this.connectionFactory(device,{signal:this.lifetime.signal});
      try{const info=await fresh.connect();if(current())this.connections.set(device.id,fresh);return info;}
      catch(error){if(current())this.connections.delete(device.id);return {connected:false,error:this.store.redact(error.message),mode:device.mode,capabilities:{sessions:false,desktop:false}};}
    }
    if(action==='sessions.list')return {items:(await connection.listSessions()).map(sessionSummary)};
    if(action==='sessions.page') {
      const sessionId=text(args.sessionId,'chat',{max:200});
      const maxMessages=args.maxMessages??100;
      if(!Number.isInteger(maxMessages)||maxMessages<1||maxMessages>500)throw new ConnectionError('request/limit','Choose 1–500 messages.');
      if(args.beforeSeq!==undefined && !Number.isSafeInteger(args.beforeSeq))throw new ConnectionError('request/sequence','Invalid history offset.');
      const page=await connection.page(sessionId,{throughSeq:-1,maxMessages,beforeSeq:args.beforeSeq});
      return {messages:messagesFromRecords(page?.records),hasMore:page?.hasMore===true};
    }
    if(action==='sessions.create') {
      const title=text(args.title,'chat title',{max:160,optional:true});
      const cwd=text(args.cwd,'workspace path',{max:2000,optional:true});
      const value=await connection.create({cwd});
      if(!value?.sessionId)throw new ConnectionError('remote/protocol','The device did not return a new chat.');
      this.created.add(`${device.id}:${value.sessionId}`);
      if(title)await connection.rename(value.sessionId,title);
      return {sessionId:value.sessionId};
    }
    if(action==='sessions.prompt') {
      const sessionId=text(args.sessionId,'chat',{max:200});const prompt=text(args.text,'message',{max:50000});
      const requestId=text(args.requestId??randomUUID(),'request ID',{max:200});
      if(args.mode!==undefined && !['queue','steer'].includes(args.mode))throw new ConnectionError('request/mode','Choose queue or steer.');
      return this.once(`prompt:${device.id}:${sessionId}:${requestId}`,{prompt,mode:args.mode},async()=>{
        await connection.connect();
        if(connection.mode==='web' && !this.created.has(`${device.id}:${sessionId}`) && args.force!==true) {
          const item=(await connection.listSessions()).find(s=>s.sessionId===sessionId);
          if(!item?.agentAvailable)throw new ConnectionError('session/companion-required','This chat is owned by another DSH process. Connect to the desktop companion, or create a new remote chat.');
        }
        return connection.prompt(sessionId,prompt,{mode:args.mode??'queue',requestId});
      });
    }
    if(action==='sessions.cancel')return connection.cancel(text(args.sessionId,'chat',{max:200}));
    if(action==='desktop.monitors')return connection.desktop('monitors');
    if(action==='desktop.release')return connection.desktop('release');
    if(action==='desktop.input') {
      const eventId=text(args.eventId,'input event ID',{max:200});
      if(!args.input || typeof args.input!=='object')throw new ConnectionError('request/input','A desktop input action is required.');
      return this.once(`input:${device.id}:${eventId}`,args.input,()=>connection.desktop('input',{eventId,input:args.input}));
    }
    throw new ConnectionError('request/action','Unknown Remote Control action.');
  }
  async sharingStatus() {
    if(!this.sharing)return {enabled:false,desktopEnabled:false,port:8099,label:'This device',error:'Sharing companion is not loaded.'};
    await this.sharing.ready;return {...this.sharing.status(),network:this.networkStatus()};
  }
  errorResponse(error) {
    const code=error.code??'remote/error';
    const status=code.startsWith('request/')?400:code==='plugin/reloading'?503:502;
    return json({ok:false,error:{code,message:this.store.redact(error.message)}},status);
  }
  async handleApi(request) {
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({ok:false,error:{code:'request/content-type',message:'Use application/json.'}},415);
    if(!requestAllowed(request)||request.headers.get('x-dsh-remote-control')!=='1')return json({ok:false,error:{code:'request/origin',message:'This action must come from the Remote Control panel.'}},403);
    try {
      if(Number(request.headers.get('content-length'))>131072)throw new ConnectionError('request/size','The request is too large.');
      const raw=await request.text();if(Buffer.byteLength(raw)>131072)throw new ConnectionError('request/size','The request is too large.');
      let args;try{args=JSON.parse(raw);}catch{throw new ConnectionError('request/json','Invalid JSON request.');}
      if(!args||Array.isArray(args)||typeof args!=='object')throw new ConnectionError('request/json','Expected a JSON object.');
      return json({ok:true,value:await this.action(args)});
    }catch(error){return this.errorResponse(error);}
  }
  async handleFrame(request) {
    if(!requestAllowed(request))return json({ok:false,error:{code:'request/origin',message:'Cross-origin frame requests are refused.'}},403);
    try {
      const url=new URL(request.url);const {connection}=this.connection(url.searchParams.get('remoteId'));
      const monitorId=url.searchParams.get('monitorId')??undefined;
      const maxWidth=Number(url.searchParams.get('maxWidth')??1280);
      if(!Number.isInteger(maxWidth)||maxWidth<160||maxWidth>3840)throw new ConnectionError('request/frame-size','Choose a screen width from 160 to 3840.');
      const frame=await connection.frame({monitorId,maxWidth},request.signal);
      return new Response(frame.bytes,{headers:{...frame.headers,'x-content-type-options':'nosniff'}});
    }catch(error){return this.errorResponse(error);}
  }
  async dispose() {this.disposed=true;this.sharingEpoch++;this.currentCode=null;this.lifetime.abort();this.connections.clear();this.connectionGenerations.clear();this.mutations.clear();await Promise.allSettled([this.tunnel.dispose(),this.windows.dispose()]);await this.sharingQueue;}
}
