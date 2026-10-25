import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {ConnectionError} from './transport.js';
import {windowHeaders,remoteWindowHtml} from './window-page.js';

const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const ACTIONS=new Set(['devices.status','sessions.list','sessions.page','sessions.create','sessions.prompt','sessions.cancel',
  'desktop.monitors','desktop.release','desktop.input','control.status','control.acquire','control.heartbeat','control.release']);

/** Opens an app-style Edge window. Called only by the owner's Connect/Open click. */
export async function launchAppWindow(url,{spawnImpl=spawn,exists=async p=>{try{await access(p);return true;}catch{return false;}},env=process.env,platform=process.platform}={}) {
  if(platform!=='win32')throw new ConnectionError('window/platform','Separate app windows currently require Windows.');
  const candidates=[env['ProgramFiles(x86)'],env.ProgramFiles,env.LOCALAPPDATA].filter(Boolean).map(root=>join(root,'Microsoft','Edge','Application','msedge.exe'));
  let executable;
  for(const candidate of candidates)if(await exists(candidate)){executable=candidate;break;}
  if(!executable)throw new ConnectionError('window/browser-missing','Microsoft Edge is required for the separate DSH window. Install Edge, then choose Open remote window.');
  await new Promise((resolve,reject)=>{
    const child=spawnImpl(executable,[`--app=${url}`,'--new-window','--no-first-run'],{shell:false,windowsHide:true,stdio:'ignore'});
    child.once('error',()=>reject(new ConnectionError('window/launch','The remote DSH window could not open. Choose Open remote window to try again.')));
    child.once('spawn',()=>{child.unref?.();resolve();});
  });
}

async function jsonBody(req,max=131072){
  if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new ConnectionError('request/content-type','Use application/json.');
  let size=0;const parts=[];
  for await(const part of req){size+=part.length;if(size>max)throw new ConnectionError('request/size','The request is too large.');parts.push(part);}
  try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}
  catch{throw new ConnectionError('request/json','Invalid JSON request.');}
}

/** A private viewer gateway, scoped to one saved remote. It never exposes host authority. */
export class WindowManager {
  constructor({controller,launch=launchAppWindow,now=Date.now,idleMs=120000,claimMs=60000,leaveMs=3000,readBundle=()=>readFile(new URL('../window.js',import.meta.url))}={}){
    this.controller=controller;this.launch=launch;this.now=now;this.idleMs=idleMs;this.claimMs=claimMs;this.readBundle=readBundle;
    this.entries=new Set();this.disposed=false;this.leaveMs=leaveMs;
  }
  identity(remoteId){const {url,token,clientId}=this.controller.store.private(remoteId);return createHash('sha256').update(JSON.stringify({url,token,clientId})).digest('hex');}
  isCurrent(entry){try{return this.identity(entry.remoteId)===entry.identity;}catch{return false;}}
  async releaseIfUnused(remoteId,identity=this.identity(remoteId),connection){
    if([...this.entries].some(entry=>!entry.closed&&entry.active&&entry.remoteId===remoteId&&entry.identity===identity))return {released:false};
    if(this.identity(remoteId)!==identity)return {released:false};
    if(connection)await connection.control('release');
    else await this.controller.action({action:'control.release',remoteId});
    return {released:true};
  }
  async open(remoteId){
    if(this.disposed)throw new ConnectionError('window/closed','Remote Control is reloading.');
    const device=this.controller.store.list().find(d=>d.id===remoteId);
    if(!device)throw new ConnectionError('request/device','Choose a paired computer first.');
    const control=await this.controller.action({action:'control.status',remoteId});
    if(control?.heldByYou!==true)throw new ConnectionError('control/not-owner','Take control before opening this remote window.');
    if(this.disposed)throw new ConnectionError('window/closed','Remote Control is reloading.');
    if(this.entries.size>=8)throw new ConnectionError('window/limit','Close an unused remote window and wait a moment before opening another.');
    const entry={remoteId,identity:this.identity(remoteId),ticket:randomBytes(32).toString('base64url'),cookie:randomBytes(32).toString('base64url'),cookieName:`dsh_remote_${randomBytes(12).toString('hex')}`,claimed:false,active:true,
      lastSeen:this.now(),deadline:this.now()+this.claimMs,closed:false};
    this.entries.add(entry);
    entry.server=createServer((req,res)=>this.handle(entry,req,res).catch(error=>{
      if(res.headersSent)return res.destroy();
      this.send(res,400,{ok:false,error:{code:error.code??'window/error',message:this.controller.store.redact(error.code?error.message:'The remote window request failed.')}});
    }));
    entry.server.requestTimeout=30000;entry.server.headersTimeout=10000;
    try{
      await new Promise((resolve,reject)=>{entry.server.once('error',reject);entry.server.listen(0,'127.0.0.1',()=>{entry.server.off('error',reject);resolve();});});
      if(this.disposed||entry.closed)throw new ConnectionError('window/closed','Remote Control is reloading.');
      entry.origin=`http://127.0.0.1:${entry.server.address().port}`;
      entry.server.on('error',()=>this.close(entry));
      entry.timer=setInterval(()=>{if(this.now()-entry.lastSeen>this.idleMs)this.close(entry).then(()=>this.releaseIfUnused(entry.remoteId,entry.identity)).catch(()=>{});},Math.min(this.idleMs,30000));entry.timer.unref?.();
      const url=new URL('/api/remote-control/window',entry.origin);url.searchParams.set('remoteId',remoteId);url.hash=new URLSearchParams({ticket:entry.ticket}).toString();
      await this.launch(url.href);
      return {opened:true,mode:'app'};
    }catch(error){await this.close(entry);throw error;}
  }
  send(res,status,value,headers={}){res.writeHead(status,{...windowHeaders,'content-type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(value));}
  async handle(entry,req,res){
    const denied=()=>this.send(res,403,{ok:false,error:{code:'window/access',message:'Open this window from Remote Control in DSH.'}});
    if(entry.closed||req.headers.host!==new URL(entry.origin).host||!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress))return denied();
    if(req.headers.origin&&req.headers.origin!==entry.origin)return denied();
    if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return denied();
    const url=new URL(req.url,entry.origin);
    if(req.method==='GET'&&['/','/api/remote-control/window'].includes(url.pathname)){
      res.writeHead(200,{...windowHeaders,'content-type':'text/html; charset=utf-8'});return res.end(remoteWindowHtml());
    }
    if(req.method==='GET'&&url.pathname==='/api/remote-control/window.js'){
      res.writeHead(200,{...windowHeaders,'content-type':'text/javascript; charset=utf-8'});return res.end(await this.readBundle());
    }
    if(req.method==='POST'&&url.pathname==='/window/claim'){
      if(req.headers.origin!==entry.origin)return denied();
      const body=await jsonBody(req,1024);
      if(entry.claimed||this.now()>entry.deadline||!equal(body.ticket,entry.ticket))return denied();
      entry.claimed=true;entry.ticket='';entry.lastSeen=this.now();
      return this.send(res,200,{ok:true},{'set-cookie':`${entry.cookieName}=${entry.cookie}; HttpOnly; SameSite=Strict; Path=/`});
    }
    const cookiePrefix=`${entry.cookieName}=`;
    const cookie=String(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookiePrefix))?.slice(cookiePrefix.length);
    if(!entry.claimed||!equal(cookie,entry.cookie)||!this.isCurrent(entry))return denied();
    entry.lastSeen=this.now();entry.active=true;clearTimeout(entry.leaveTimer);
    if(req.method==='POST'&&url.pathname==='/api/remote-control'){
      if(req.headers.origin!==entry.origin||req.headers['x-dsh-remote-control']!=='1')return denied();
      const args=await jsonBody(req);
      if(args.action==='devices.list')return this.send(res,200,{ok:true,value:{items:this.controller.store.list().filter(d=>d.id===entry.remoteId)}});
      if(args.action==='window.leave'&&args.remoteId===entry.remoteId){
        entry.active=false;
        entry.leaveTimer=setTimeout(()=>this.close(entry).then(()=>this.releaseIfUnused(entry.remoteId,entry.identity)).catch(()=>{}),this.leaveMs);entry.leaveTimer.unref?.();
        return this.send(res,200,{ok:true,value:{accepted:true}});
      }
      if(!ACTIONS.has(args.action)||args.remoteId!==entry.remoteId)return denied();
      const value=await this.controller.action(args);return this.send(res,200,{ok:true,value});
    }
    if(req.method==='GET'&&url.pathname==='/api/remote-control/frame'){
      if(url.searchParams.get('remoteId')!==entry.remoteId)return denied();
      const response=await this.controller.handleFrame(new Request(url,{headers:{host:req.headers.host,'sec-fetch-site':'same-origin'}}));
      res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    return this.send(res,404,{ok:false,error:{code:'window/not-found',message:'This route is unavailable in the remote window.'}});
  }
  async close(entry){
    if(entry.closed)return;entry.closed=true;clearInterval(entry.timer);clearTimeout(entry.leaveTimer);this.entries.delete(entry);
    entry.server?.closeAllConnections?.();await new Promise(resolve=>{if(!entry.server?.listening)return resolve();entry.server.close(resolve);});
  }
  async dispose(){this.disposed=true;await Promise.all([...this.entries].map(entry=>this.close(entry)));}
}
