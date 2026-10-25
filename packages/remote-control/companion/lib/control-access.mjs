import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes } from 'node:crypto';

const INVITATION_MS = 30 * 60_000;
const LEASE_MS = 30_000;
const REQUIRED_METHODS = ['create', 'prompt', 'cancel', 'rename', 'updateQueue', 'fork', 'selectModel'];
const digest = value => createHash('sha256').update(value).digest('hex');

export class ControlError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; this.isDSHRemoteError = true; this.details = {}; }
}

export function validateControlState(raw = { version: 1, engaged: false }) {
  if (!raw || raw.version !== 1 || typeof raw.engaged !== 'boolean') throw new ControlError('pairing/storage-invalid', 'Saved connection code settings are invalid.', 503);
  if (raw.invitation === undefined || raw.invitation === null) return { version: 1, engaged: raw.engaged };
  const value = raw.invitation;
  const networkKind = value.networkKind ?? 'custom';
  let url;
  try { url = new URL(value.url); } catch { /* rejected below */ }
  if (!raw.engaged || typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest)
    || !['once', 'unlimited'].includes(value.useLimit) || !['automatic', 'custom'].includes(networkKind) || !(value.expiresAt === null || Number.isSafeInteger(value.expiresAt) && value.expiresAt > 0)
    || typeof value.paused !== 'boolean' || typeof value.used !== 'boolean'
    || !url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin !== value.url)
    throw new ControlError('pairing/storage-invalid', 'Saved connection code settings are invalid.', 503);
  return { version: 1, engaged: true, invitation: { digest: value.digest, useLimit: value.useLimit, expiresAt: value.expiresAt, url: value.url, networkKind, paused: value.paused, used: value.used } };
}

export function describeInvitation(invitation, now = Date.now()) {
  if (!invitation) return { exists: false };
  return { exists: true, useLimit: invitation.useLimit, expiresAt: invitation.expiresAt, paused: invitation.paused,
    used: invitation.used, networkKind: invitation.networkKind, address: invitation.url, expired: invitation.expiresAt !== null && invitation.expiresAt <= now };
}

/** One host still owns every session. This fences new commands, not running turns. */
export class ControlAccess {
  constructor({ now = Date.now, label, onChange = () => {}, savedState, persist = () => {} } = {}) {
    this.now = now; this.label = label; this.onChange = onChange;
    const saved = validateControlState(savedState);
    this.persist = persist; this.clients = new Map(); this.invitation = saved.invitation; this.lease = undefined;
    this.context = new AsyncLocalStorage(); this.fenceReady = false; this.engaged = saved.engaged; this.disposed = false;
  }
  expire() {
    if (this.lease?.expiresAt <= this.now()) this.end();
  }
  snapshot() { return { version: 1, engaged: this.engaged, ...(this.invitation ? { invitation: { ...this.invitation } } : {}) }; }
  commitInvitation(invitation, engaged = this.engaged) {
    const next = { version: 1, engaged, ...(invitation ? { invitation: { ...invitation } } : {}) };
    try { this.persist(next); } catch { throw new ControlError('pairing/storage', 'The connection code change could not be saved. Check the private settings folder.', 503); }
    this.invitation = invitation; this.engaged = engaged;
  }
  codeStatus() { return describeInvitation(this.invitation, this.now()); }
  end() {
    clearTimeout(this.timer); this.timer = undefined;
    const previous = this.lease; this.lease = undefined;
    if (previous) this.onChange();
  }
  arm() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.expire(), Math.max(1, this.lease.expiresAt - this.now()));
    this.timer.unref?.();
  }
  status(client) {
    this.expire();
    return { owner: this.lease ? 'remote' : 'local', ...(client ? { heldByYou: this.lease?.client === client } : {}),
      ...(this.lease ? { label: this.lease.client.label, expiresAt: this.lease.expiresAt } : {}), supported: this.fenceReady };
  }
  createInvitation(url, { useLimit = 'once', expiresInMs = INVITATION_MS, networkKind = 'custom' } = {}) {
    this.expire();
    if (!this.fenceReady || this.disposed) throw new ControlError('control/unavailable', 'This DSH version cannot safely hand off control. Update the plugin on both devices.', 503);
    if (this.lease) throw new ControlError('control/busy', 'Take back control before creating another connection code.');
    if (!['once', 'unlimited'].includes(useLimit)) throw new ControlError('pairing/use-limit', 'Choose once or unlimited for code use.', 400);
    if (!['automatic', 'custom'].includes(networkKind)) throw new ControlError('pairing/network', 'Choose automatic or custom networking.', 400);
    const expiresAt = expiresInMs === null ? null : this.now() + expiresInMs;
    if (expiresInMs !== null && (!Number.isSafeInteger(expiresInMs) || expiresInMs < 1 || !Number.isSafeInteger(expiresAt) || expiresAt <= 0))
      throw new ControlError('pairing/expiration', 'Choose a positive expiry duration, or never.', 400);
    const secret = randomBytes(32).toString('base64url');
    const engaged = this.engaged;
    this.commitInvitation({ digest: digest(secret), expiresAt,
      useLimit, url, networkKind, paused: false, used: false }, true);
    if (!engaged) this.onChange();
    return { secret, useLimit, networkKind, expiresAt: this.invitation.expiresAt, label: this.label, url };
  }
  pair({ secret, clientId, label }) {
    this.expire();
    if (typeof secret !== 'string' || secret.length > 128 || !this.invitation || digest(secret) !== this.invitation.digest
      || this.invitation.used || this.codeStatus().expired)
      throw new ControlError('pairing/expired', 'This connection code expired or was already used. Copy a new code from the other PC.', 401);
    if (this.invitation.paused) throw new ControlError('pairing/paused', 'The original PC paused connections. Resume the code there before connecting.', 403);
    if (typeof clientId !== 'string' || !/^[a-zA-Z0-9._:-]{8,128}$/.test(clientId)) throw new ControlError('pairing/client', 'The connecting device identity is invalid.', 400);
    if (typeof label !== 'string' || !label.trim() || label.length > 100 || /[\x00-\x1f\x7f]/.test(label)) throw new ControlError('pairing/label', 'Enter a device name of 1–100 characters.', 400);
    if (!this.fenceReady || this.disposed) throw new ControlError('control/unavailable', 'Safe control handoff is unavailable.', 503);
    if (this.lease) throw new ControlError('control/busy', 'Another device controls this harness. Take back control on its PC first.');
    const token = randomBytes(32).toString('base64url');
    const client = { clientId, label: label.trim(), key: digest(token) };
    // Persist consumption before granting access, so a restart cannot resurrect a one-use code.
    if (this.invitation.useLimit === 'once') this.commitInvitation({ ...this.invitation, used: true });
    // Code use is unlimited; keep only a bounded set of the newest inactive credentials.
    // No lease exists here, so retiring an old reader cannot interrupt another controller.
    for (const [key, previous] of this.clients) if (previous.clientId === clientId) this.clients.delete(key);
    while (this.clients.size >= 32) this.clients.delete(this.clients.keys().next().value);
    this.clients.set(client.key, client);
    this.acquire(client);
    return { token, deviceLabel: this.label, control: this.status(client) };
  }
  authenticate(token, clientId) {
    this.expire();
    if (typeof token !== 'string' || token.length > 512 || typeof clientId !== 'string') return undefined;
    const client = this.clients.get(digest(token));
    return client?.clientId === clientId ? client : undefined;
  }
  valid(client) { return !!client && this.clients.get(client.key) === client && !this.disposed; }
  acquire(client) {
    this.expire();
    if (!this.valid(client)) throw new ControlError('control/revoked', 'The original PC took back control. Paste a new connection code to reconnect.', 401);
    if (!this.fenceReady) throw new ControlError('control/unavailable', 'Safe control handoff is unavailable.', 503);
    if (this.lease && this.lease.client !== client) throw new ControlError('control/busy', 'Another device currently controls this harness.');
    if (!this.lease) { this.lease = { client, expiresAt: this.now() + LEASE_MS }; this.onChange(); }
    else this.lease.expiresAt = this.now() + LEASE_MS;
    this.arm(); return this.status(client);
  }
  requireControl(client) {
    this.expire();
    if (!this.valid(client)) throw new ControlError('control/revoked', 'The original PC took back control. Paste a new connection code to reconnect.', 401);
    if (this.lease?.client !== client) throw new ControlError('control/not-owner', 'Control is on the other PC. Choose Take control to continue.');
    return this.lease;
  }
  heartbeat(client) { this.requireControl(client); return this.acquire(client); }
  release(client) { this.requireControl(client); this.end(); return this.status(client); }
  reclaim() {
    let failure;
    if (this.invitation && !this.invitation.paused) {
      const paused = { ...this.invitation, paused: true };
      try { this.commitInvitation(paused); } catch (error) { this.invitation = paused; failure = error; }
    }
    const active = !!this.lease; this.end(); this.clients.clear();
    if (!active && this.engaged) this.onChange();
    if (failure) throw failure;
    return this.status();
  }
  resume() {
    if (this.disposed || !this.fenceReady) throw new ControlError('control/unavailable', 'Safe control handoff is unavailable.', 503);
    if (!this.invitation || this.invitation.used || this.codeStatus().expired) throw new ControlError('pairing/expired', 'This connection code expired or was already used. Create a new code.', 409);
    this.commitInvitation({ ...this.invitation, paused: false }); return this.codeStatus();
  }
  revokeInvitation() {
    let failure;
    try { this.commitInvitation(undefined); } catch (error) { this.invitation = undefined; failure = error; }
    const active = !!this.lease; this.end(); this.clients.clear(); if (!active && this.engaged) this.onChange();
    if (failure) throw failure;
    return this.codeStatus();
  }
  permit(client, fn) { const lease = this.requireControl(client); return this.context.run(lease, fn); }
  checkHostMutation() {
    this.expire();
    const permit = this.context.getStore();
    if (permit && permit !== this.lease) throw new ControlError('control/revoked', 'Remote control ended before this action could be accepted.');
    if (this.lease && permit !== this.lease) throw new ControlError('control/remote-active', 'Another device controls this harness. Open Remote Control and choose Take back control.');
  }
  dispose() { this.disposed = true; this.end(); this.clients.clear(); this.context.disable(); }
}

/** Resolve the original instance, but preserve the traced receiver on invocation. */
export function installSessionFence(traced, access) {
  const controller = traced?.[Symbol.for('cordis.original')] ?? traced;
  if (!controller || REQUIRED_METHODS.some(name => typeof controller[name] !== 'function')) return () => {};
  const entries = REQUIRED_METHODS.map(name => ({ name, descriptor: Object.getOwnPropertyDescriptor(controller, name), original: controller[name] }));
  if (entries.some(entry => entry.descriptor?.configurable === false)) return () => {};
  const restore = () => {
    access.fenceReady = false;
    for (const entry of entries) if (Object.getOwnPropertyDescriptor(controller, entry.name)?.value === entry.wrapper) {
      if (entry.descriptor) Object.defineProperty(controller, entry.name, entry.descriptor);
      else delete controller[entry.name];
    }
  };
  try {
    for (const entry of entries) {
      entry.wrapper = function (...args) { access.checkHostMutation(); return Reflect.apply(entry.original, this, args); };
      Object.defineProperty(controller, entry.name, { configurable: true, writable: true, value: entry.wrapper });
    }
    access.fenceReady = true;
  } catch { restore(); }
  return restore;
}
