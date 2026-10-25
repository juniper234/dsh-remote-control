import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtime = path.join(path.dirname(process.execPath), 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai');
const { Context, symbols } = await import(pathToFileURL(path.join(runtime, 'cordis/lib/index.js')).href);
const { FileUploads } = await import(pathToFileURL(path.join(runtime, 'dsh-client-file-upload/lib/index.js')).href);
const fix = process.env.DSH_RELOAD_FIX_STOCK === '1' ? undefined : await import('../index.mjs');
const marker = 'fileUploadResolverReloadSafe';

// Exercise the shipped upload methods and Cordis proxy/lifecycle without starting
// unrelated network, attachment storage, or UI services from its constructor.
async function harness() {
  const root = new Context();
  const uploads = Object.create(FileUploads.prototype);
  uploads.ctx = root;
  Object.defineProperty(uploads, symbols.tracker, { value: { associate: 'fileUploads', property: 'ctx' } });
  root.provide('fileUploads', uploads);
  const guard = fix ? root.plugin(fix) : undefined;
  await guard?.inertia;
  let generation = 0;
  function consumer(ctx) {
    const value = ++generation;
    ctx.effect(() => ctx.fileUploads.registerAgentResolver(async () => value));
  }
  consumer.inject = ['fileUploads', ...(fix ? [marker] : [])];
  return { root, uploads, guard, consumer, generation: () => generation };
}

test('disposing and reloading a consumer releases the shipped upload resolver', async () => {
  const h = await harness();
  try {
    for (let i = 1; i <= 10; i++) {
      const fiber = h.root.plugin(h.consumer);
      await fiber.inertia;
      assert.equal(fiber.state, 2, 'consumer must load');
      assert.equal(await h.uploads.agentResolver(), i);
      await fiber.dispose();
      assert.equal(h.uploads.agentResolver, undefined, 'consumer cleanup must release its resolver');
    }
  } finally { await h.root.fiber.dispose(); }
});

test('a second live resolver is still rejected', async () => {
  const h = await harness();
  try {
    const release = h.root.fileUploads.registerAgentResolver(async () => 'first');
    assert.throws(() => h.root.fileUploads.registerAgentResolver(async () => 'second'), /already registered/);
    assert.equal(await h.uploads.agentResolver(), 'first');
    release();
    assert.equal(h.uploads.agentResolver, undefined);
  } finally { await h.root.fiber.dispose(); }
});

test('an old disposer cannot clear a later registration', async () => {
  const h = await harness();
  try {
    const oldRelease = h.root.fileUploads.registerAgentResolver(async () => 'old');
    oldRelease();
    const newRelease = h.root.fileUploads.registerAgentResolver(async () => 'new');
    oldRelease();
    assert.equal(await h.uploads.agentResolver(), 'new');
    newRelease();
    newRelease();
    assert.equal(h.uploads.agentResolver, undefined);
  } finally { await h.root.fiber.dispose(); }
});

test('reloading the compatibility plugin remounts its dependent consumer safely', async () => {
  const h = await harness();
  try {
    const fiber = h.root.plugin(h.consumer);
    await fiber.inertia;
    for (let i = 0; i < 5; i++) {
      await h.guard?.restart();
      await fiber.inertia;
      assert.equal(fiber.state, 2, 'dependent consumer must remain available');
      assert.equal(typeof h.uploads.agentResolver, 'function');
    }
    if (fix) assert.ok(h.generation() > 1, 'consumer must actually reload with the compatibility plugin');
    await fiber.dispose();
    assert.equal(h.uploads.agentResolver, undefined);
    await h.guard?.dispose();
    assert.equal(Object.hasOwn(h.uploads, 'registerAgentResolver'), false, 'uninstall must restore the stock method');
  } finally { await h.root.fiber.dispose(); }
});
