// Explicit shipped-runtime probe; does not start DSH, load a profile, or send a model prompt.
// DSH_RUNTIME_PACKAGES points to the installed node_modules/@deepseek-ai directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ControlAccess, installSessionFence } from '../lib/control-access.mjs';

const runtime = process.env.DSH_RUNTIME_PACKAGES;
if (!runtime) throw new Error('Set DSH_RUNTIME_PACKAGES to the installed @deepseek-ai package directory.');
const { Context, symbols } = await import(pathToFileURL(join(runtime, 'cordis/lib/index.js')).href);
const { SessionController } = await import(pathToFileURL(join(runtime, 'dsh-api-session-controller/lib/index.js')).href);
const { remoteErrorOf } = await import(pathToFileURL(join(runtime, 'dsh-typert-protocol/lib/index.js')).href);

test('shipped Cordis + SessionController preserve invocation context through the fence and repeated restore', async () => {
  const root = new Context(), controller = Object.create(SessionController.prototype);
  controller.ctx = root;
  Object.defineProperty(controller, symbols.tracker, { value: { associate: 'sessionController', property: 'ctx' } });
  const received = [];
  controller.commands = { prompt: async (request, source) => { received.push(source); return { accepted: true }; } };
  root.provide('sessionController', controller);
  const principal = { kind: 'fixture-remote', id: 'fixture-principal' };
  const invoked = root.extend({ invocation: { peer: { principal } } }).get('sessionController');
  const request = { requestId: 'fixture', sessionId: 'fixture', mode: 'queue', content: [{ type: 'text', text: 'fixture only' }] };
  const signal = new AbortController().signal;
  try {
    for (let i = 0; i < 3; i++) {
      const access = new ControlAccess({ label: 'fixture' });
      const restore = installSessionFence(root.get('sessionController'), access);
      assert.equal(access.fenceReady, true);
      const invitation = access.createInvitation('http://127.0.0.1:1234');
      const pair = access.pair({ secret: invitation.secret, clientId: 'fixture-client', label: 'fixture' });
      const client = access.authenticate(pair.token, 'fixture-client');
      assert.throws(() => invoked.prompt(request, signal), error => remoteErrorOf(error)?.code === 'control/remote-active');
      await access.permit(client, () => invoked.prompt(request, signal));
      assert.deepEqual(received.at(-1).principal, principal);
      access.reclaim(); await invoked.prompt(request, signal);
      restore(); access.dispose(); assert.equal(Object.hasOwn(controller, 'prompt'), false);
    }
    assert.equal(received.length, 6);
  } finally { await root.fiber.dispose(); }
});
