import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeConnectionCode,decodeConnectionCode,connectionOrigin} from '../lib/connection-code.js';

const invitation={url:'https://paired.example',secret:'fixture-secret-0123456789-abcdefghijklmnopqrstuvwxyz',label:'Home desktop',expiresAt:1000000};
test('connection codes round-trip complete invitation details and expire locally',()=>{
  const code=encodeConnectionCode(invitation);
  assert.match(code,/^DSH1\./);
  assert.deepEqual(decodeConnectionCode(`  ${code}\n`,1),{v:1,...invitation,useLimit:'once'});
  assert.throws(()=>decodeConnectionCode(code,1000000),{code:'pairing/expired'});
});
test('usage and expiry are independent, including unlimited use with no expiry',()=>{
  for(const useLimit of ['once','unlimited'])for(const expiresAt of [null,1000000]){
    const decoded=decodeConnectionCode(encodeConnectionCode({...invitation,useLimit,expiresAt}),1);
    assert.equal(decoded.useLimit,useLimit);assert.equal(decoded.expiresAt,expiresAt);
    if(expiresAt===null)assert.equal(decodeConnectionCode(encodeConnectionCode({...invitation,useLimit,expiresAt}),9e12).expiresAt,null);
  }
});
test('malformed or unsafe connection codes never echo input and cannot supply arbitrary URL schemes',()=>{
  for(const input of ['private-sensitive-input','DSH1.!!!!','DSH1.e30','DSH1.'+'a'.repeat(5000)]) {
    assert.throws(()=>decodeConnectionCode(input,0),error=>error.code==='pairing/invalid'&&!error.message.includes(input));
  }
  for(const url of ['file:///c:/private','javascript:alert(1)','http://internet.example','https://user:secret@host.example','https://host.example/?k=secret','https://host.example/#secret','https://host.example/other']) {
    assert.throws(()=>encodeConnectionCode({...invitation,url}),{code:'pairing/invalid'});
  }
  assert.equal(connectionOrigin('http://127.0.0.1:8099/'),'http://127.0.0.1:8099');
});
