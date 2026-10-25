import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { RemoteConnection } from '../lib/transport.js';

async function server(fn) {
  const server=http.createServer(fn); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};

test('auto connection detects a companion without exposing or putting token in API URL',async()=>{
  let seen;
  const s=await server((req,res)=>{
    assert.equal(req.url.includes('private-token'),false);
    assert.equal(req.headers['x-companion-token'],'private-token');
    if(req.url==='/companion/health')return json(res,{ok:true,mode:'companion',version:'0.3.0',capabilities:{sessions:true,desktop:true}});
    seen=req.url;json(res,{items:[{sessionId:'s1'}]});
  });
  try {const c=new RemoteConnection({name:'Home',url:s.url,token:'private-token',mode:'auto'});assert.equal((await c.connect()).mode,'companion');assert.equal((await c.listSessions())[0].sessionId,'s1');assert.equal(seen,'/companion/sessions');}finally{await s.close();}
});

test('a rejected mutating call is never automatically replayed',async()=>{
  let prompts=0;
  const s=await server((req,res)=>{
    if(req.url==='/companion/health')return json(res,{ok:true,mode:'companion',version:'test'});
    if(req.url.includes('/prompt')){prompts++;return json(res,{ok:false,error:{code:'auth',message:'Expired'}},401);}
    json(res,{});
  });
  try {const c=new RemoteConnection({name:'Home',url:s.url,token:'private-token',mode:'companion'});await c.connect();await assert.rejects(c.prompt('s1','hello',{requestId:'request-one'}));assert.equal(prompts,1);}finally{await s.close();}
});

test('redirects never forward owner credentials to another origin',async()=>{
  let reached=0;const other=await server((req,res)=>{reached++;json(res,{});});
  const s=await server((req,res)=>{res.writeHead(302,{location:other.url+'/capture'});res.end();});
  try {const c=new RemoteConnection({name:'Home',url:s.url,token:'private-token',mode:'companion'});await assert.rejects(c.connect());assert.equal(reached,0);}finally{await s.close();await other.close();}
});

test('web mode handles pairing gate and the shipped RPC envelope',async()=>{
  const s=await server((req,res)=>{
    if(req.url.startsWith('/?k=')){res.writeHead(302,{'set-cookie':'dsh_gate=test; HttpOnly',location:'/'});return res.end();}
    assert.equal(req.headers.cookie,'dsh_gate=test');
    let body='';req.on('data',x=>body+=x);req.on('end',()=>{const e=JSON.parse(body);assert.equal(e.method,'session/list');json(res,{type:'server-response',rpcId:e.rpcId,result:{ok:true,value:{items:[{sessionId:'web-one'}]}}});});
  });
  try {const c=new RemoteConnection({name:'Home',url:s.url,token:'private-token',mode:'web'});assert.equal((await c.connect()).mode,'web');assert.equal((await c.listSessions())[0].sessionId,'web-one');}finally{await s.close();}
});

test('companion history uses the current projection sequence and preserves older-page bounds',async()=>{
  let sequence=42,listRequests=0,pageRequests=0;
  const s=await server((req,res)=>{
    assert.equal(req.method,'GET','reading history must never mutate a session');
    const url=new URL(req.url,'http://fixture.local');
    if(url.pathname==='/companion/health')return json(res,{ok:true,mode:'companion',version:'test'});
    if(url.pathname==='/companion/sessions'){listRequests++;return json(res,{items:[{sessionId:'saved',projections:{asOfSeq:sequence}}]});}
    assert.equal(url.pathname,'/companion/session/saved/page');
    assert.equal(Number(url.searchParams.get('throughSeq')),sequence);
    if(++pageRequests===2){assert.equal(url.searchParams.get('beforeSeq'),'30');assert.equal(url.searchParams.get('maxMessages'),'10');}
    json(res,{records:[{type:'event',event:{type:'assistant/message',seq:sequence,data:{content:[{type:'text',text:'Saved reply'}]}}}],hasMore:true});
  });
  try {
    const c=new RemoteConnection({name:'Laptop',url:s.url,token:'fixture-only-token',mode:'companion'});
    assert.equal((await c.page('saved')).records[0].event.seq,42);
    sequence=84;
    assert.equal((await c.page('saved',{beforeSeq:30,maxMessages:10})).records[0].event.seq,84);
    assert.equal(listRequests,2,'each read must resolve a fresh upper bound');
    assert.equal(pageRequests,2);
  }finally{await s.close();}
});

test('web history resolves a saved session before issuing its read-only page RPC',async()=>{
  let paged=false;
  const s=await server((req,res)=>{
    if(req.url.startsWith('/?k=')){res.writeHead(302,{'set-cookie':'dsh_gate=fixture; HttpOnly',location:'/'});return res.end();}
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      const envelope=JSON.parse(body);
      assert(['session/list','session/page'].includes(envelope.method));
      let value;
      if(envelope.method==='session/list')value={items:[{sessionId:'saved-web',projections:{asOfSeq:7}}]};
      else{paged=true;assert.equal(envelope.payload.args.request.throughSeq,7);value={records:[{type:'event',event:{seq:7}}],hasMore:false};}
      json(res,{type:'server-response',rpcId:envelope.rpcId,result:{ok:true,value}});
    });
  });
  try{const c=new RemoteConnection({name:'Web',url:s.url,token:'fixture-only-token',mode:'web'});assert.equal((await c.page('saved-web')).records.length,1);assert.equal(paged,true);}finally{await s.close();}
});

test('explicit history bounds remain unchanged and missing projection positions fail visibly',async()=>{
  let listRequests=0;
  const s=await server((req,res)=>{
    const url=new URL(req.url,'http://fixture.local');
    if(url.pathname==='/companion/health')return json(res,{ok:true,mode:'companion',version:'test'});
    if(url.pathname==='/companion/sessions'){listRequests++;return json(res,{items:[{sessionId:'no-sequence',projections:{}}]});}
    assert.equal(url.searchParams.get('throughSeq'),'5');json(res,{records:[],hasMore:false});
  });
  try{
    const c=new RemoteConnection({name:'Laptop',url:s.url,token:'fixture-only-token',mode:'companion'});
    await c.page('known',{throughSeq:5});assert.equal(listRequests,0);
    await assert.rejects(c.page('no-sequence'),{code:'remote/protocol'});
    await assert.rejects(c.page('missing'),{code:'session/not-found'});
  }finally{await s.close();}
});
