import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DeviceStore, parseDevice } from '../lib/store.js';

test('pairing URLs extract secrets while preserving a mounted base path', () => {
  const d = parseDevice({ name:'Home', url:'https://home.example/dsh/?k=synthetic-secret#private', mode:'auto' });
  assert.equal(d.url, 'https://home.example/dsh');
  assert.equal(d.token, 'synthetic-secret');
  assert.equal(d.mode, 'auto');
  assert.throws(() => parseDevice({name:'Home',url:'file:///C:/secret'}), /HTTP/);
  assert.throws(() => parseDevice({name:'Home',url:'https://user:password@home.example'}), /credentials/);
});

test('device persistence never exposes a token in public records or errors', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(),'dsh-device-store-'));
  try {
    const store = new DeviceStore(home);
    const saved = store.save({name:'Home',url:'https://home.example/?k=synthetic-private-token'});
    assert.equal(saved.hasToken,true);
    assert.equal(JSON.stringify(saved).includes('synthetic-private-token'),false);
    assert.equal(JSON.stringify(store.list()).includes('synthetic-private-token'),false);
    const second = new DeviceStore(home);
    assert.equal(second.private(saved.id).token,'synthetic-private-token');
    second.save({id:saved.id,name:'Home renamed',url:'https://home.example',mode:'companion'});
    assert.equal(second.private(saved.id).token,'synthetic-private-token');
    assert.equal(second.list()[0].id,saved.id);
    second.remove(saved.id);
    assert.deepEqual(second.list(),[]);
    assert.throws(() => second.private(saved.id), /not configured/);
  } finally { fs.rmSync(home,{recursive:true,force:true}); }
});

test('legacy device migration is non-destructive and public lists stay redacted', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(),'dsh-device-migration-'));
  try {
    fs.mkdirSync(path.join(home,'remote-control'));
    const legacy = JSON.stringify({remotes:[{name:'desktop',url:'https://home.example',token:'old-synthetic-token',mode:'web',default:true}]});
    fs.writeFileSync(path.join(home,'remote-control/remotes.json'),legacy);
    const store = new DeviceStore(home);
    assert.equal(store.list().length,1);
    assert.equal(store.list()[0].isDefault,true);
    assert.equal(store.private(store.list()[0].id).token,'old-synthetic-token');
    assert.equal(fs.readFileSync(path.join(home,'remote-control/remotes.json'),'utf8'),legacy);
    assert.equal(JSON.stringify(store.list()).includes('old-synthetic-token'),false);
  } finally { fs.rmSync(home,{recursive:true,force:true}); }
});
