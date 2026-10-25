import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../../tools/reload-fix/index.mjs';

function fixture() {
  class Uploads {
    registerAgentResolver(resolve) {
      if(this.agentResolver)throw new Error('resolver already registered');
      this.agentResolver=resolve;
      return()=>{if(this.agentResolver===resolve)this.agentResolver=undefined;};
    }
  }
  const raw=new Uploads();let traced;
  traced=new Proxy(raw,{get(target,key){
    if(key===Symbol.for('cordis.original'))return target;
    const value=Reflect.get(target,key,target);
    return typeof value==='function'?function(...args){return Reflect.apply(value,traced,args);}:value;
  }});
  const cleanups=[],services=new Map();
  const ctx={get:()=>traced,effect:fn=>cleanups.push(fn()),provide:(key,value)=>services.set(key,value)};
  return {raw,traced,ctx,cleanups,services};
}

test('stock resolver disposal reproduces the Cordis traced callback identity bug',()=>{
  const {raw,traced}=fixture();traced.registerAgentResolver(()=>{})();
  assert.equal(typeof raw.agentResolver,'function');
  assert.throws(()=>traced.registerAgentResolver(()=>{}),/already registered/);
});
test('reload guard releases resolver across repeated controller reloads and retains duplicate detection',()=>{
  const {raw,traced,ctx,services}=fixture();apply(ctx);
  assert.equal(services.get('fileUploadResolverReloadSafe').version,1);
  for(let i=0;i<20;i++){
    const dispose=traced.registerAgentResolver(()=>{});
    assert.throws(()=>traced.registerAgentResolver(()=>{}),/already registered/);
    dispose();assert.equal(raw.agentResolver,undefined);
  }
});
test('guard cleanup restores the original registration method',()=>{
  const {raw,traced,ctx,cleanups}=fixture();const original=raw.registerAgentResolver;
  apply(ctx);const dispose=traced.registerAgentResolver(()=>{});dispose();cleanups[0]();
  assert.equal(raw.registerAgentResolver,original);
  assert.equal(Object.hasOwn(raw,'registerAgentResolver'),false);
});
test('obsolete guard cleanup preserves a newer registration wrapper',()=>{
  const {raw,ctx,cleanups}=fixture();apply(ctx);const newer=()=>{};
  raw.registerAgentResolver=newer;cleanups[0]();assert.equal(raw.registerAgentResolver,newer);
});
