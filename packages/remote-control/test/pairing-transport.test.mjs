import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {RemoteConnection} from '../lib/transport.js';

const secret='fixture-invitation-012345678901234567890123456789';
const token='fixture-client-token-012345678901234567890123456789';
const clientId='fixture-client-id-0123456789';
async function fixture(t, handler){
  const seen=[];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=raw?JSON.parse(raw):undefined;seen.push({path:req.url,headers:req.headers,body});
    const result=handler(req,body);res.writeHead(result.status??200,{'content-type':'application/json',...result.headers});res.end(JSON.stringify(result.value));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  return {seen,connection:new RemoteConnection({url:`http://127.0.0.1:${server.address().port}`,mode:'companion',clientId})};
}
test('single-use pairing sends secret only in JSON and subsequent calls bind a distinct client credential',async t=>{
  const {connection,seen}=await fixture(t,req=>({value:req.url==='/companion/pair'?{token,deviceLabel:'Host',control:{owner:'remote',heldByYou:true}}:{owner:'remote',heldByYou:true}}));
  await connection.pair(secret,{clientId,label:'Laptop'});
  await connection.control('heartbeat');
  assert.equal(seen.length,2);assert.equal(seen[0].body.secret,secret);
  assert.equal(seen[0].headers['x-companion-token'],undefined);
  assert.equal(seen[1].headers['x-companion-token'],token);
  assert.equal(seen[1].headers['x-dsh-client-id'],clientId);
  assert(seen.every(x=>!x.path.includes(secret)&&!x.path.includes(token)));
});
test('an ambiguous pairing failure never retries or falls back to a token-in-URL gate',async t=>{
  const {connection,seen}=await fixture(t,()=>({status:409,value:{ok:false,error:{code:'pairing/used',message:`Already consumed ${secret}`}}}));
  await assert.rejects(connection.pair(secret,{clientId,label:'Laptop'}),e=>e.code==='pairing/used'&&!e.message.includes(secret));
  assert.equal(seen.length,1);
});
test('paired credential rejection does not fall back to legacy browser authentication',async t=>{
  const {connection,seen}=await fixture(t,()=>({status:401,value:{ok:false,error:{code:'control/revoked',message:'Take back control ended this connection.'}}}));
  connection.device.token=token;
  await assert.rejects(connection.connect(),{code:'control/revoked'});
  assert.equal(seen.length,1);assert.equal(seen[0].path,'/companion/health');
});
