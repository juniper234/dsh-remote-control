import { randomUUID } from 'node:crypto';

export class ConnectionError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function bytesBounded(response, max = 16 * 1024 * 1024) {
  if (Number(response.headers.get('content-length')) > max) {
    await response.body?.cancel(); throw new ConnectionError('remote/response-too-large', 'The remote response is too large.');
  }
  const chunks = []; let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > max) throw new ConnectionError('remote/response-too-large', 'The remote response is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class RemoteConnection {
  constructor(device, { fetchImpl = fetch, timeoutMs = 12000, signal } = {}) {
    this.device = { ...device };
    this.base = new URL(device.url);
    this.origin = this.base.origin;
    this.basePath = this.base.pathname.replace(/\/+$/, '');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.signal = signal;
    this.cookies = '';
    this.mode = undefined;
    this.health = undefined;
    this.connecting = undefined;
  }
  safeMessage(error) {
    let text = String(error?.message ?? error ?? 'Connection failed.');
    for (const secret of [this.device.token, this.device.password, this.pairingSecret]) if (secret) text = text.split(secret).join('[redacted]');
    return text.replace(/DSH1\.[A-Za-z0-9_-]+/g,'[connection code]').slice(0, 500);
  }
  async raw(route, {method='GET',body,companion=false,query,signal,timeoutMs}={}) {
    const url = new URL(`${this.basePath}${route}`, this.origin);
    if (query) for (const [k,v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k,String(v));
    const headers = { origin:this.origin, accept:'application/json' };
    if (this.cookies) headers.cookie=this.cookies;
    if (companion && this.device.token) headers['x-companion-token']=this.device.token;
    if (companion && this.device.clientId) headers['x-dsh-client-id']=this.device.clientId;
    if (body !== undefined) headers['content-type']='application/json';
    if (this.device.username !== undefined && this.device.password !== undefined) {
      headers.authorization=`Basic ${Buffer.from(`${this.device.username}:${this.device.password}`).toString('base64')}`;
    }
    try {
      const timeout=AbortSignal.timeout(timeoutMs ?? this.timeoutMs);
      const signals=[timeout,...(signal?[signal]:[]),...(this.signal?[this.signal]:[])];
      return await this.fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
        redirect:'manual',signal:signals.length>1?AbortSignal.any(signals):timeout});
    } catch(error) {
      const code=error.cause?.code;
      const detail=code==='ENOTFOUND' ? 'The pairing address no longer exists. Start the remote tunnel and paste its new link.'
        : 'The device did not respond. Check that it is awake and its remote connection is running.';
      throw new ConnectionError('remote/offline',detail);
    }
  }
  async json(response) {
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new ConnectionError('remote/redirect', 'The remote redirected the request. Reconnect using its current pairing link.');
    }
    const bytes = await bytesBounded(response, 8*1024*1024);
    let value;
    try { value=JSON.parse(bytes.toString('utf8')); }
    catch {
      if([401,403].includes(response.status))throw new ConnectionError('remote/access-ended','Access ended. Generate a fresh connection code on the other computer.');
      throw new ConnectionError('remote/protocol', `The device returned HTTP ${response.status} instead of a DSH response.`);
    }
    if (!response.ok && value?.ok !== false) throw new ConnectionError(`remote/http-${response.status}`,
      response.status===401||response.status===403 ? 'Access ended. Generate a fresh connection code on the other computer.' : `Remote request failed (HTTP ${response.status}).`);
    if (value?.ok === false) {
      const code=value.error?.code ?? 'remote/error';
      const message=code==='session/writer-held' ? 'This chat belongs to another DSH process. Connect to the desktop companion to control its live chats.'
        : this.safeMessage(value.error?.message ?? 'The remote refused this operation.');
      throw new ConnectionError(code,message);
    }
    return value;
  }
  async pair(secret, {clientId, label}) {
    // A single-use invitation is exchanged once. Never fall back to the legacy
    // browser gate or put this secret in a URL, even after an ambiguous failure.
    this.pairingSecret=secret;
    try {
    const value = await this.json(await this.raw('/companion/pair', {
      method:'POST', body:{secret,clientId,label}, companion:false,
    }));
    if (typeof value?.token !== 'string' || value.token.length < 32 || value.token.length > 4096 ||
        typeof value.deviceLabel !== 'string' || !value.control || value.control.heldByYou !== true) {
      throw new ConnectionError('remote/protocol', 'The other computer did not complete the control handoff. Generate a new code and try again.');
    }
    this.device.token=value.token; this.device.clientId=clientId; this.device.mode='companion';
    this.mode='companion'; this.health={version:value.version ?? '0.4.0',capabilities:value.capabilities ?? {sessions:true,desktop:false,control:true}};
    return value;
    } finally {this.pairingSecret=undefined;}
  }
  async control(action='status', body={}) {
    await this.connect();
    if (this.mode !== 'companion' || !this.device.clientId) {
      throw new ConnectionError('control/upgrade-required', 'Generate a connection code on the other computer to use control handoff.');
    }
    if (!['status','acquire','heartbeat','release'].includes(action)) throw new ConnectionError('request/action','Unknown control action.');
    return action==='status' ? this.call('/companion/control')
      : this.call(`/companion/control/${action}`, {method:'POST',body});
  }
  captureCookies(response) {
    const values=response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
    const pairs=values.map(v=>v.split(';',1)[0]).filter(Boolean);
    if (pairs.length) this.cookies=pairs.join('; ');
    return pairs.length > 0;
  }
  async pairGate() {
    if (!this.device.token && this.device.username === undefined) throw new ConnectionError('remote/token-required','Paste this device’s pairing link or token.');
    for (const query of this.device.token ? [{k:this.device.token},{token:this.device.token}] : [{}]) {
      const response=await this.raw('/',{query});
      const found=this.captureCookies(response);
      await response.body?.cancel();
      if (found) return;
    }
    throw new ConnectionError('remote/auth','The device did not accept the pairing link. Copy a fresh link from that device.');
  }
  async companionHealth() {
    const response=await this.raw('/companion/health',{companion:true});
    const value=await this.json(response);
    if (!value || typeof value!=='object' || (!value.version && value.mode!=='companion' && value.app!=='desktop')) {
      throw new ConnectionError('remote/not-companion','The address does not serve the DSH desktop companion.');
    }
    return value;
  }
  async connect() {
    if (this.mode) return this.connectionInfo();
    if (this.connecting) return this.connecting;
    this.connecting=(async()=>{
      if (this.device.mode!=='web') {
        try {this.health=await this.companionHealth();this.mode='companion';return this.connectionInfo();}
        catch(error) {
          if (this.device.clientId) throw error;
          if (error.code==='remote/offline') throw error;
          if (this.device.mode==='companion') {
            // An existing outer pairing gate may front the companion. Gate GETs
            // are reads; no mutating request is ever retried.
            await this.pairGate();
            this.health=await this.companionHealth();this.mode='companion';return this.connectionInfo();
          }
        }
      }
      await this.pairGate();
      if (this.device.mode==='auto') {
        try {this.health=await this.companionHealth();this.mode='companion';return this.connectionInfo();} catch {}
      }
      this.mode='web';
      try {await this.rpc('session/list',{_request:{}});} catch(error){this.mode=undefined;throw error;}
      return this.connectionInfo();
    })();
    try {return await this.connecting;} finally {this.connecting=undefined;}
  }
  connectionInfo() {
    return {connected:true,mode:this.mode,version:this.health?.version,
      capabilities:{sessions:true,desktop:this.mode==='companion' && Boolean(this.health?.capabilities?.desktop ?? this.health?.desktopEnabled),control:Boolean(this.device.clientId)}};
  }
  async status() {
    await this.connect();
    if(this.mode==='companion')this.health=await this.companionHealth();
    return this.connectionInfo();
  }
  async rpc(endpoint,args) {
    const rpcId=randomUUID();
    const value=await this.json(await this.raw(`/api/${endpoint}`,{method:'POST',body:{type:'client-request',rpcId,method:endpoint,payload:{args}}}));
    if (value?.rpcId!==undefined && value.rpcId!==rpcId) throw new ConnectionError('remote/protocol','The remote returned a mismatched response.');
    if (value?.result?.ok!==true) {
      const error=value?.result?.error ?? {};
      throw new ConnectionError(error.code??'remote/protocol',this.safeMessage(error.message??'The remote returned an invalid response.'));
    }
    return value.result.value;
  }
  async call(route,{method='GET',body,query,signal}={}) {
    await this.connect();
    return this.json(await this.raw(route,{method,body,query,signal,companion:true}));
  }
  async listSessions() {
    await this.connect();
    const items=[];let cursor;
    for(let i=0;i<50;i++) {
      const page=this.mode==='companion' ? await this.call('/companion/sessions',{query:cursor?{cursor}:undefined})
        : await this.rpc('session/list',{_request:cursor?{cursor}:{}});
      items.push(...(page?.items??[]));
      cursor=page?.nextCursor??page?.cursor?.next;
      if(!cursor)break;
    }
    return items;
  }
  async page(sessionId,{throughSeq=-1,maxMessages=100,beforeSeq}={}) {
    await this.connect();
    if (throughSeq === -1) {
      // The shipped SessionController treats throughSeq as an upper bound;
      // -1 produces an empty page, rather than selecting the current tail.
      const session=(await this.listSessions()).find(item=>item.sessionId===sessionId);
      if(!session)throw new ConnectionError('session/not-found','The remote chat was not found. Refresh the session list.');
      throughSeq=session.projections?.asOfSeq;
      if(!Number.isSafeInteger(throughSeq)||throughSeq < -1)throw new ConnectionError('remote/protocol','The device did not return a valid chat history position.');
    }
    const request={address:{kind:'session',sessionId},throughSeq,maxMessages,...(beforeSeq===undefined?{}:{beforeSeq})};
    return this.mode==='companion' ? this.call(`/companion/session/${encodeURIComponent(sessionId)}/page`,{query:{throughSeq,maxMessages,beforeSeq}})
      : this.rpc('session/page',{request});
  }
  async create({cwd,workspaceId,agentPreset,sessionId}={}) {
    await this.connect();const request={cwd,workspaceId,agentPreset,sessionId};
    return this.mode==='companion' ? this.call('/companion/sessions',{method:'POST',body:request}) : this.rpc('session/create',{request});
  }
  async rename(sessionId,title) {
    await this.connect();
    return this.mode==='companion' ? this.call(`/companion/session/${encodeURIComponent(sessionId)}/rename`,{method:'POST',body:{title}})
      : this.rpc('session/rename',{request:{sessionId,title}});
  }
  async prompt(sessionId,text,{mode='queue',requestId=randomUUID()}={}) {
    await this.connect();
    const request={sessionId,text,mode,requestId};
    if(this.mode==='companion')await this.call(`/companion/session/${encodeURIComponent(sessionId)}/prompt`,{method:'POST',body:request});
    else await this.rpc('session/prompt',{request:{sessionId,mode,requestId,content:[{type:'text',text}]}});
    return {accepted:true,requestId};
  }
  async cancel(sessionId) {
    await this.connect();
    if(this.mode==='companion')await this.call(`/companion/session/${encodeURIComponent(sessionId)}/cancel`,{method:'POST',body:{}});
    else await this.rpc('session/cancel',{request:{sessionId}});
    return {accepted:true};
  }
  async desktop(action,body={}) {
    await this.connect();
    if(this.mode!=='companion')throw new ConnectionError('desktop/companion-required','Desktop control needs the companion in the remote desktop app.');
    if(action==='monitors')return this.call('/companion/desktop/monitors');
    if(action==='input')return this.call('/companion/desktop/input',{method:'POST',body});
    if(action==='release')return this.call('/companion/desktop/release',{method:'POST',body:{}});
    throw new ConnectionError('desktop/action','Unknown desktop action.');
  }
  async frame(query={},signal) {
    await this.connect();
    if(this.mode!=='companion')throw new ConnectionError('desktop/companion-required','Desktop viewing needs the remote companion.');
    const response=await this.raw('/companion/desktop/frame',{companion:true,query,signal});
    if(!response.ok)return this.json(response);
    const type=response.headers.get('content-type')?.split(';')[0];
    if(type!=='image/png')throw new ConnectionError('desktop/frame','The device returned an invalid screen frame.');
    const headers={'content-type':type,'cache-control':'no-store'};
    for(const name of ['width','height','x','y','monitor']){const k=`x-desktop-${name}`;const v=response.headers.get(k);if(v!==null)headers[k]=v;}
    return {bytes:await bytesBounded(response),headers};
  }
}
