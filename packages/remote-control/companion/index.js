/**
 * dsh-remote-companion — Desktop-side companion host plugin.
 *
 * Runs inside a DSH host process (the Electron desktop app's embedded web host,
 * or a `dsh web` process). Sharing stays off until the owner starts it; enabled
 * settings survive host reloads in the user-private DSH_HOME configuration:
 *
 *   1. A token-gated HTTP server on `127.0.0.1:<config.port>` (loopback only).
 *   2. `/companion/*` — an in-process session API calling `ctx.sessionController`
 *      directly. This process owns the session write leases, so these calls can
 *      control live sessions that a second (tunnelled) DSH process is refused.
 *   3. Every other path — a transparent reverse proxy to the app's own embedded
 *      Web GUI (`ctx.webServer.getOrigin()`), including the `/api` unary bridge
 *      and the `/api/remote.mux` WebSocket upgrade.
 *
 * The critical trick is authenticating the proxied browser session to the
 * embedded host. The host mints a random per-process launch token and accepts it
 * only on `GET /?token=...`, where it writes an authority-bound signed cookie
 * (`dsh-auth-<sha256(host:port)>`, HttpOnly/SameSite=Strict) and redirects. A
 * reverse proxy cannot hand the browser that authority-bound cookie (the browser
 * reaches the companion origin, not the embedder origin), so the companion does
 * the exchange itself:
 *
 *     ctx.connection.authenticatedUrl(origin)  ->  origin/?token=<launchToken>
 *     fetch(..., { redirect: 'manual' })       ->  303 + Set-Cookie: dsh-auth-...=...
 *
 * It caches that cookie, sends it upstream with rewritten `Host`/`Origin`, and
 * refreshes it on a 401. WebSocket upgrades are raw TCP pipes that replay the
 * advertised handshake headers with the same rewritten authority and cookie.
 *
 * Contract only: node builtins. Nothing is imported from `@deepseek-ai/*`.
 * Everything registered here is effect-scoped through `ctx.effect`, so an HMR
 * reload, bundle disable, or removal closes the listener and every tunnel.
 *
 * Security posture:
 *   - binds 127.0.0.1 only and refuses non-loopback peers;
 *   - every request needs `x-companion-token: <token>`, `?k=<token>` (one-time
 *     cookie exchange, `companion_gate` for browsers), or the `companion_gate`
 *     cookie it minted;
 *   - the token is never logged or returned by any HTTP endpoint;
 *   - only the explicit owner-facing pairingUrl() method reveals the secret;
 *   - browser mutations and upgrades verify Host, Origin, and Sec-Fetch-Site;
 *   - desktop helpers are acquired lazily after explicit desktop opt-in;
 *   - the companion only proxies to the host's own embedder origin, never to an
 *     arbitrary target read from the request.
 *
 * @module dsh-remote-companion
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as netConnect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateInput, validateFrameRequest } from "./lib/desktop-input.mjs";
import { safeDesktopError } from "./lib/desktop-errors.mjs";
import { ControlAccess, ControlError, installSessionFence, validateControlState, describeInvitation } from "./lib/control-access.mjs";

/** Cordis loader identity (the row id in `cordis.patch.yml` is `remote-companion`). */
export const name = "remote-companion";

/**
 * Services the row waits for. `webServer` = embedded HTTP host origin,
 * `connection` = browser auth / launch-token helpers, `sessionController` =
 * the in-process Session API we call directly.
 */
export const inject = ["webServer", "connection", "sessionController"];

/** Companion package version reported by `/companion/health`. */
const PLUGIN_VERSION = "0.4.1";

/** Request header carrying the companion secret. */
const TOKEN_HEADER = "x-companion-token";
/** Query parameter accepted once for the browser gate cookie exchange. */
const TOKEN_QUERY = "k";
/** Cookie the companion mints for browsers after a successful `?k=` exchange. */
const GATE_COOKIE = "companion_gate";
/** Browser cookie lifetime for the gate (30 days, match the DSH browser cookie). */
const GATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Minimum companion token length. */
const MIN_TOKEN_LENGTH = 32;
/** Default companion port (design doc). */
const DEFAULT_PORT = 8099;

/** How long a minted embedded-host cookie is trusted before a proactive refresh. */
const HOST_COOKIE_TTL_MS = 10 * 60 * 1000;

/** Hop-by-hop headers never forwarded through the proxy (RFC 7230 §6.1). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

/** RFC6455 handshake headers replayed on the upstream WebSocket upgrade. */
const WEBSOCKET_HEADERS = [
  ["sec-websocket-version", "Sec-WebSocket-Version"],
  ["sec-websocket-key", "Sec-WebSocket-Key"],
  ["sec-websocket-protocol", "Sec-WebSocket-Protocol"],
  ["sec-websocket-extensions", "Sec-WebSocket-Extensions"]
];

const CRLFCRLF = Buffer.from("\r\n\r\n", "latin1");

/** A request-shape error answered as HTTP 400. */
class BadRequest extends Error {
  constructor(message, status = 400, code = "companion/bad-request") { super(message); this.status = status; this.code = code; }
}

/**
 * Mount the companion. Defensive by contract: any failure here is logged and
 * swallowed, because a companion problem must never take the host app down.
 *
 * @param ctx - Cordis context of the loaded profile row.
 * @param rawConfig - raw row config (`{ port, token, label }`).
 */
export async function apply(ctx, rawConfig = {}) {
  let manager;
  try {
    const previous = typeof ctx.get === "function" ? ctx.get("remoteCompanion") : ctx.remoteCompanion;
    if (previous?.dispose) await previous.dispose();
    manager = createCompanion(ctx, rawConfig);
  } catch {
    const message = "Remote companion could not initialize. Check its settings and reload the plugin.";
    const unavailable = async () => { throw new Error(message); };
    manager = { status: () => ({ enabled: false, desktopEnabled: false, control: { owner: 'local', supported: false }, code: { exists: false }, port: DEFAULT_PORT,
      label: "desktop-app", error: message }), start: unavailable, stop: async () => manager.status(),
      pairingUrl: unavailable, createInvitation: unavailable, reclaim: unavailable, resume: unavailable, revokeInvitation: unavailable, dispose: async () => {}, ready: Promise.resolve() };
    safeLog(ctx, "error", message);
  }
  try {
    if (typeof ctx.provide === "function") ctx.provide("remoteCompanion", manager);
    else if (typeof ctx.set === "function") ctx.set("remoteCompanion", manager);
    else ctx.remoteCompanion = manager;
    if (typeof ctx.effect === "function") ctx.effect(() => () => manager.dispose(), "remote companion lifecycle");
    else ctx.on?.("dispose", () => manager.dispose());
    await manager.ready;
  } catch {
    await manager.dispose();
    const message = "Remote companion service registration failed. Reload the plugin and check its dependencies.";
    safeLog(ctx, "error", message);
    // Let the plugin loader show a failed row instead of a healthy row with a missing service.
    throw new Error(message);
  }
}

/** Private loopback companion lifecycle. No listener or native helper is acquired by default. */
export function createCompanion(ctx, options = {}) {
  const configPath = join(options.home ?? resolveHome(ctx), "remote-control", "companion.json");
  const invitationPath = join(options.home ?? resolveHome(ctx), 'remote-control', 'connection-code.json');
  let savedControl = validateControlState();
  let controlStorageError;
  try { savedControl = validateControlState(JSON.parse(readFileSync(invitationPath, 'utf8'))); }
  catch (failure) { if (failure?.code !== 'ENOENT') controlStorageError = 'Saved connection code settings could not be read. Sharing was not started.'; }
  let saved = {};
  let configError;
  try { saved = JSON.parse(readFileSync(configPath, "utf8")); if (!isRecord(saved)) throw new Error(); }
  catch (error) { if (error?.code !== "ENOENT") configError = "Saved companion settings could not be read."; }
  configError ??= controlStorageError;
  let settings = normalizeConfig({ ...options, ...saved });
  let error = configError;
  if (settings.problems.length) { settings = normalizeConfig({}); configError = "Saved companion settings are invalid."; error = configError; }
  let state;
  let disposed = false;
  let queue = Promise.resolve();
  const schedule = fn => { const task = queue.then(fn); queue = task.catch(() => {}); return task; };
  const save = enabled => {
    mkdirSync(join(configPath, ".."), { recursive: true, mode: 0o700 });
    const temporary = `${configPath}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({ enabled, port: settings.port, label: settings.label,
      token: settings.token, desktopEnabled: settings.desktopEnabled, publicOrigin: settings.publicOrigin }, null, 2), { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, configPath);
    chmodSync(configPath, 0o600);
  };
  const saveControl = next => {
    const validated = validateControlState(next);
    mkdirSync(join(invitationPath, '..'), { recursive: true, mode: 0o700 });
    const temporary = `${invitationPath}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(validated, null, 2), { mode: 0o600 });
    chmodSync(temporary, 0o600); renameSync(temporary, invitationPath); chmodSync(invitationPath, 0o600);
    savedControl = validated;
  };
  const status = () => ({ enabled: state?.listening === true, desktopEnabled: settings.desktopEnabled,
    control: state?.access.status() ?? { owner: 'local', supported: false },
    code: state?.access.codeStatus() ?? describeInvitation(savedControl.invitation, typeof options.now === 'function' ? options.now() : Date.now()),
    port: settings.port, label: settings.label,
    ...(state?.listening ? { localUrl: `http://127.0.0.1:${settings.port}` } : {}), ...(error ? { error } : {}) });
  const close = async () => {
    const old = state;
    state = undefined;
    if (!old) return;
    old.disposed = true;
    old.listening = false;
    old.access.dispose();
    old.restoreFence?.();
    old.lifecycle.abort();
    clearTimeout(old.heldInputTimer);
    for (const socket of old.tunnelSockets) socket.destroy();
    old.tunnelSockets.clear();
    old.server?.closeAllConnections?.();
    await new Promise(resolve => { if (!old.server?.listening) return resolve(); old.server.close(resolve); });
    await old.controlCleanup;
    if (old.backendResetting) { try { await old.backendResetting; } catch { /* cleanup below is best effort */ } }
    if (old.backendPending) {
      try { const backend = await old.backendPending; try { await backend.releaseAll(); } finally { await backend.dispose(); } } catch { /* cleanup is best effort */ }
    }
  };
  const start = args => schedule(async () => {
    if (disposed) throw new Error("Companion has been disposed.");
    if (controlStorageError) throw new ControlError('pairing/storage-invalid', controlStorageError, 503);
    const next = normalizeConfig({ ...settings, ...args });
    if (next.problems.length) throw new BadRequest(next.problems.join(" "));
    await close();
    settings = next;
    error = undefined;
    const get = name => typeof ctx.get === "function" ? ctx.get(name) : ctx[name];
    const current = { ctx, settings, label: settings.label, webServer: get("webServer"),
      connection: get("connection"), sessionController: get("sessionController"), listening: false, disposed: false,
      tunnelSockets: new Set(), proxySockets: new Set(), hostCookieAt: 0, mutations: new Map(), lifecycle: new AbortController(),
      backendFactory: options.desktopBackendFactory, now: typeof options.now === "function" ? options.now : Date.now };
    if (!current.webServer || !current.connection || !current.sessionController) {
      error = "Companion services are unavailable. Reload the plugin after its host dependencies are ready.";
      throw new Error(error);
    }
    current.controlCleanup = Promise.resolve();
    current.access = new ControlAccess({ now: current.now, label: settings.label, savedState: savedControl, persist: saveControl, onChange: () => {
      for (const socket of current.proxySockets) socket.destroy();
      current.proxySockets.clear();
      clearTimeout(current.heldInputTimer); current.heldInputTimer = undefined;
      current.controlCleanup = current.controlCleanup.then(async () => {
        if (current.backendPending) { try { await (await current.backendPending).releaseAll(); } catch { /* helper disposal also releases held input */ } }
      });
    } });
    current.restoreFence = installSessionFence(current.sessionController, current.access);
    const server = createServer((req, res) => {
      handleRequest(current, req, res).catch(() => { if (!res.headersSent) respondText(res, 500, "companion: internal error\n"); else res.destroy(); });
    });
    current.server = server;
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    server.on("connection", socket => { current.tunnelSockets.add(socket); socket.on("close", () => current.tunnelSockets.delete(socket)); });
    server.on("upgrade", (req, socket, head) => {
      try { handleUpgrade(current, req, socket, head); } catch { socket.destroy(); }
    });
    state = current;
    try {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(settings.port, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
      settings.port = server.address().port;
      current.listening = true;
      server.on("error", () => { error = "Companion listener failed."; current.listening = false; });
      save(true);
      return status();
    } catch {
      error = "Companion could not start. Check its port and private settings directory.";
      await close();
      throw new Error(error);
    }
  });
  const manager = {
    start: (args = {}) => start(args),
    stop: () => schedule(async () => {
      let failure;
      try { state?.access.reclaim(); } catch (error) { failure = error; }
      await close(); save(false);
      if (failure) throw failure;
      return status();
    }),
    status,
    createInvitation: ({ publicUrl, useLimit, expiresInMs, networkKind } = {}) => schedule(async () => {
      if (!state?.listening || disposed) throw new ControlError('sharing/disabled', 'Start sharing before copying a connection code.', 409);
      const url = new URL(publicUrl ?? settings.publicOrigin ?? `http://127.0.0.1:${settings.port}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new BadRequest('Use an HTTP(S) address without a path, query or credentials.');
      settings.publicOrigin = url.origin; save(true);
      return state.access.createInvitation(url.origin, { useLimit, expiresInMs, networkKind });
    }),
    reclaim: () => schedule(async () => {
      if (!state?.access) return status();
      state.access.reclaim(); await state.controlCleanup; return status();
    }),
    resume: () => schedule(async () => {
      if (!state?.listening || disposed) throw new ControlError('sharing/disabled', 'Start sharing before resuming connections.', 409);
      state.access.resume(); return status();
    }),
    revokeInvitation: () => schedule(async () => {
      if (disposed) throw new ControlError('sharing/disabled', 'The sharing companion is closed.', 409);
      if (state?.access) { state.access.revokeInvitation(); await state.controlCleanup; }
      else saveControl({ version: 1, engaged: savedControl.engaged });
      return status();
    }),
    pairingUrl: publicUrl => schedule(async () => {
      if (disposed) throw new Error("Companion has been disposed.");
      const url = new URL(publicUrl ?? settings.publicOrigin ?? `http://127.0.0.1:${settings.port}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) throw new BadRequest("Pairing URL must be an HTTP(S) origin without credentials or a path.");
      if (publicUrl !== undefined) settings.publicOrigin = url.origin;
      save(state?.listening === true);
      url.search = ""; url.hash = ""; url.searchParams.set(TOKEN_QUERY, settings.token);
      return url.href;
    }),
    dispose: () => schedule(async () => { disposed = true; await close(); }),
    ready: undefined
  };
  manager.ready = saved.enabled === true && !configError ? start({}).catch(() => {
    error ??= "Companion could not start. Check its settings and reload the plugin.";
    safeLog(ctx, "error", error);
  }) : Promise.resolve();
  return manager;
}

/**
 * Normalize/validate the row config. Problems are collected instead of thrown
 * so the row can log one actionable diagnostic and stay inert.
 *
 * @param rawConfig - raw row config.
 * @returns normalized settings plus human-readable problems.
 */
function normalizeConfig(rawConfig) {
  const raw = isRecord(rawConfig) ? rawConfig : {};
  const problems = [];
  const port = raw.port === undefined ? DEFAULT_PORT : Number(raw.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push("port must be an integer in 0..65535.");
  }
  const token = raw.token === undefined ? randomBytes(32).toString("hex") : raw.token;
  if (typeof token !== "string" || Buffer.byteLength(token, "utf8") < MIN_TOKEN_LENGTH || token.length > 512 || /[\s\x00-\x1f\x7f]/.test(token)) {
    problems.push(`token must be a string of at least ${MIN_TOKEN_LENGTH} characters`);
  }
  const label = typeof raw.label === "string" && raw.label.trim() !== "" ? raw.label.trim() : "desktop-app";
  if (label.length > 100 || /[\x00-\x1f\x7f]/.test(label)) problems.push("label must be at most 100 printable characters.");
  if (raw.desktopEnabled !== undefined && typeof raw.desktopEnabled !== "boolean") problems.push("desktopEnabled must be a boolean.");
  let publicOrigin;
  if (raw.publicOrigin) { try { const parsed = new URL(raw.publicOrigin); if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); publicOrigin = parsed.origin; } catch { problems.push("publicOrigin is invalid."); } }
  return { port, token, label, desktopEnabled: raw.desktopEnabled === true, publicOrigin, problems };
}

/**
 * Route one HTTP request: loopback guard, token gate, companion API or proxy.
 *
 * @param state - companion state.
 * @param req - node request.
 * @param res - node response (owned to completion).
 */
async function handleRequest(state, req, res) {
  if (state.disposed) {
    respondText(res, 503, "companion: shutting down\n");
    return;
  }
  if (!isLoopbackPeer(req.socket.remoteAddress)) {
    respondText(res, 403, "forbidden: the companion server accepts loopback peers only\n");
    return;
  }
  let url;
  try {
    url = new URL(req.url ?? "/", "http://companion.invalid");
  } catch {
    respondText(res, 400, "bad request\n");
    return;
  }

  if (!requestOrigins(state, req).length) {
    respondText(res, 403, "forbidden: unrecognized companion host\n");
    return;
  }

  if (url.pathname === '/companion/pair') {
    if (req.method !== 'POST') return respondMethodNotAllowed(res, 'POST');
    // Pairing is a capability exchange. It must never be reachable by a cross-site browser form.
    if (!safeBrowserRequest(state, req, { kind: 'header' })) return respondText(res, 403, 'forbidden: pairing origin does not match companion\n');
    try { return respondJson(res, 200, { ...state.access.pair(await readJsonBody(req, 4096)),
      capabilities: { sessions: true, desktop: state.settings.desktopEnabled, pairing: true, control: true }, version: PLUGIN_VERSION }); }
    catch (error) { return respondJson(res, error.status ?? 500, { ok: false, error: { code: error.code ?? 'pairing/failed', message: error instanceof ControlError || error instanceof BadRequest ? error.message : 'Pairing could not complete.' } }); }
  }

  const auth = authenticate(state, req, url);
  if (!auth.ok) {
    respondText(res, 401, "401 unauthorized: send ?k=<token> once or the x-companion-token header\n", {
      "www-authenticate": 'Companion realm="dsh-remote-companion"'
    });
    return;
  }
  if (auth.exchange) {
    if (req.method !== "GET") return respondText(res, 403, "forbidden: pairing requires a navigation\n");
    const next = new URL(url.href);
    next.searchParams.delete(TOKEN_QUERY);
    const location = `${next.pathname}${next.search}`;
    res.writeHead(303, {
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      location,
      "set-cookie": gateCookie(state.settings.token, requestOrigins(state, req).some(origin => origin.startsWith("https:")))
    });
    res.end();
    return;
  }

  if (!isReadOnly(req.method) && !safeBrowserRequest(state, req, auth)) {
    return respondText(res, 403, "forbidden: request origin does not match companion\n");
  }

  if (url.pathname.startsWith("/companion/")) {
    await handleCompanionApi(state, req, res, url, auth);
    return;
  }
  if (ownerOnlyProxyPath(url.pathname)) return respondText(res, 403, 'forbidden: Remote Control settings are available only on the original PC\n');
  if (auth.client || state.access.engaged) return respondText(res, 403, 'forbidden: use the Remote Control window\n');
  await proxyHttp(state, req, res);
}

/**
 * Authenticate a request: token header, one-time `?k=` query, or the gate cookie.
 *
 * @param state - companion state.
 * @param req - node request.
 * @param url - parsed request URL.
 * @returns ok flag, and `exchange` when the answer is a cookie redirect.
 */
function authenticate(state, req, url) {
  const header = req.headers[TOKEN_HEADER];
  if (header !== undefined) {
    const client = state.access.authenticate(header, req.headers['x-dsh-client-id']);
    if (client) return { ok: true, kind: 'header', client };
    return { ok: typeof header === "string" && tokenMatches(header, state.settings.token), kind: "header" };
  }
  const query = url.searchParams.get(TOKEN_QUERY);
  if (query !== null) return { ok: tokenMatches(query, state.settings.token), exchange: true, kind: "query" };
  const cookie = readCookie(req.headers.cookie, GATE_COOKIE);
  if (cookie !== undefined && tokenMatches(cookie, state.settings.token)) return { ok: true, kind: "cookie" };
  return { ok: false };
}

function isReadOnly(method) { return method === "GET" || method === "HEAD" || method === "OPTIONS"; }

function ownerOnlyProxyPath(path) {
  // Never lend the companion's owner authority to sharing/credential management.
  let decoded = path;
  for (let i = 0; i < 3; i++) {
    if (decoded.toLowerCase().startsWith('/api/remote-control')) return true;
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { return true; }
  }
  return decoded.toLowerCase().startsWith('/api/remote-control');
}

function requestOrigins(state, req) {
  const host = req.headers.host;
  if (typeof host !== "string" || /[\s/@\\?#]/.test(host)) return [];
  const localHosts = [`127.0.0.1:${state.settings.port}`, `localhost:${state.settings.port}`, `[::1]:${state.settings.port}`];
  if (localHosts.includes(host.toLowerCase())) return [`http://${host.toLowerCase()}`];
  try { const publicUrl = new URL(state.settings.publicOrigin); if (host.toLowerCase() === publicUrl.host.toLowerCase()) return [publicUrl.origin]; } catch { /* no advertised origin */ }
  return [];
}

function safeBrowserRequest(state, req, auth) {
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.origin;
  if (origin === undefined) return auth.kind === "header";
  if (typeof origin !== "string") return false;
  return requestOrigins(state, req).includes(origin);
}

/**
 * Constant-time token comparison over fixed-length digests (length-independent).
 *
 * @param actual - supplied value.
 * @param expected - configured secret.
 * @returns whether they match.
 */
function tokenMatches(actual, expected) {
  const actualDigest = createHash("sha256").update(String(actual), "utf8").digest();
  const expectedDigest = createHash("sha256").update(String(expected), "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Serialize the browser gate cookie. The token is the cookie value: it never
 * leaves this loopback origin, and browsers only ever see it HttpOnly.
 *
 * @param token - companion secret.
 * @returns Set-Cookie header value.
 */
function gateCookie(token, secure = false) {
  return `${GATE_COOKIE}=${encodeURIComponent(token)}; Max-Age=${GATE_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

/**
 * Read one cookie value from a Cookie header without implementing a full parser.
 *
 * @param header - raw Cookie header.
 * @param cookieName - exact cookie name to find.
 * @returns decoded value, or undefined.
 */
function readCookie(header, cookieName) {
  if (typeof header !== "string") return undefined;
  for (const segment of header.split(";")) {
    const at = segment.indexOf("=");
    if (at === -1 || segment.slice(0, at).trim() !== cookieName) continue;
    const raw = segment.slice(at + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// /companion/* — in-process session API (no leases, no HTTP bridge)
// ---------------------------------------------------------------------------

/**
 * Serve the companion control API, calling `ctx.sessionController` directly.
 * Business failures (RemoteError) are answered HTTP 200 with an `{ok:false}`
 * envelope, matching the DSH wire convention; malformed requests answer 400.
 *
 * @param state - companion state.
 * @param req - node request.
 * @param res - node response.
 * @param url - parsed request URL.
 */
async function handleCompanionApi(state, req, res, url, auth) {
  const method = req.method ?? "GET";
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("companion client disconnected"));
  res.on("close", abort);
  const signal = controller.signal;
  try {
    if (url.pathname === '/companion/control') {
      if (method !== 'GET') return respondMethodNotAllowed(res, 'GET');
      return respondJson(res, 200, state.access.status(auth.client));
    }
    const controlAction = /^\/companion\/control\/(acquire|heartbeat|release)$/.exec(url.pathname)?.[1];
    if (controlAction) {
      if (method !== 'POST') return respondMethodNotAllowed(res, 'POST');
      await readJsonBody(req, 1024);
      if (!auth.client) throw new ControlError('control/pair-required', 'Connect using a new connection code first.', 403);
      return respondJson(res, 200, state.access[controlAction](auth.client));
    }
    // Recheck after parsing each mutating body, immediately before admission.
    const mutate = fn => {
      if (auth.client) return state.access.permit(auth.client, fn);
      if (state.access.engaged) throw new ControlError('control/pair-required', 'Connect using a new connection code to control this harness.', 403);
      return fn();
    };
    if (url.pathname.startsWith("/companion/desktop/")) {
      await handleDesktopApi(state, req, res, url, mutate, auth.client?.key ?? 'legacy');
      return;
    }
    if (url.pathname === "/companion/health") {
      if (method !== "GET") return respondMethodNotAllowed(res, "GET");
      respondJson(res, 200, healthPayload(state));
      return;
    }
    if (url.pathname === "/companion/sessions") {
      if (method === "GET") {
        const value = await state.sessionController.list({}, signal);
        respondJson(res, 200, value ?? { items: [] });
        return;
      }
      if (method === "POST") {
        const body = await readJsonBody(req);
        const request = pickFields(body, ["cwd", "workspaceId", "agentPreset", "sessionId"]);
        const value = await mutate(() => state.sessionController.create(request));
        respondJson(res, 200, value);
        return;
      }
      return respondMethodNotAllowed(res, "GET, POST");
    }

    const matched = /^\/companion\/session\/([^/]+)\/(page|projections|prompt|cancel|rename)$/.exec(url.pathname);
    if (matched !== null) {
      let sessionId;
      try {
        sessionId = decodeURIComponent(matched[1] ?? "");
      } catch {
        throw new BadRequest("session id is not valid URL encoding");
      }
      if (sessionId === "") throw new BadRequest("session id must not be empty");
      const action = matched[2];

      if (action === "page") {
        if (method !== "GET") return respondMethodNotAllowed(res, "GET");
        const throughRaw = url.searchParams.get("throughSeq");
        if (throughRaw === null) throw new BadRequest("throughSeq is required (pass -1 to page from the tail)");
        const throughSeq = Number(throughRaw);
        if (!Number.isInteger(throughSeq)) throw new BadRequest("throughSeq must be an integer");
        const request = { address: { kind: "session", sessionId }, throughSeq };
        const beforeRaw = url.searchParams.get("beforeSeq");
        if (beforeRaw !== null) {
          const beforeSeq = Number(beforeRaw);
          if (!Number.isInteger(beforeSeq)) throw new BadRequest("beforeSeq must be an integer");
          request.beforeSeq = beforeSeq;
        }
        const maxRaw = url.searchParams.get("maxMessages");
        if (maxRaw !== null) {
          const maxMessages = Number(maxRaw);
          if (!Number.isInteger(maxMessages) || maxMessages < 1) {
            throw new BadRequest("maxMessages must be a positive integer");
          }
          request.maxMessages = maxMessages;
        }
        respondJson(res, 200, await state.sessionController.page(request, signal));
        return;
      }

      if (action === "projections") {
        if (method !== "GET") return respondMethodNotAllowed(res, "GET");
        respondJson(res, 200, await state.sessionController.projections({ sessionId }, signal));
        return;
      }

      if (action === "prompt") {
        if (method !== "POST") return respondMethodNotAllowed(res, "POST");
        const body = await readJsonBody(req);
        if (typeof body.text !== "string" || body.text.trim() === "") {
          throw new BadRequest("text must be a non-empty string");
        }
        const requestId = mutationId(body.requestId, "requestId");
        if (body.text.length > 256_000) throw new BadRequest("text is too long");
        if (body.mode !== undefined && body.mode !== "queue" && body.mode !== "steer") throw new BadRequest("mode must be queue or steer");
        const mode = body.mode ?? "queue";
        const request = {
          requestId,
          sessionId,
          mode,
          content: [{ type: "text", text: body.text }]
        };
        if (typeof body.clientTimeZone === "string" && body.clientTimeZone !== "") {
          request.clientTimeZone = body.clientTimeZone;
        }
        const value = await mutate(() => onceMutation(state, `prompt:${auth.client?.key ?? 'legacy'}:${requestId}`, request, async () => {
          await mutate(() => state.sessionController.prompt(request, signal));
          return { accepted: true, requestId };
        }));
        respondJson(res, 200, value);
        return;
      }

      if (action === "cancel") {
        if (method !== "POST") return respondMethodNotAllowed(res, "POST");
        await readJsonBody(req, 1024);
        const value = await mutate(() => state.sessionController.cancel({ sessionId }));
        respondJson(res, 200, value ?? { accepted: true });
        return;
      }

      if (action === "rename") {
        if (method !== "POST") return respondMethodNotAllowed(res, "POST");
        const body = await readJsonBody(req);
        if (typeof body.title !== "string" || body.title.trim() === "") {
          throw new BadRequest("title must be a non-empty string");
        }
        const value = await mutate(() => state.sessionController.rename({ sessionId, title: body.title }));
        respondJson(res, 200, value);
        return;
      }
    }

    respondText(res, 404, "not found: unknown companion endpoint\n");
  } catch (error) {
    if (error instanceof ControlError) return respondJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
    if (url.pathname.startsWith("/companion/desktop/") && typeof error?.code === "string" && !error.code.startsWith("companion/") && !(error instanceof BadRequest)) {
      const safe = safeDesktopError(error);
      respondJson(res, safe.code === "INVALID_INPUT" || safe.code === "MONITOR_NOT_FOUND" ? 400 : 503, { ok: false, error: safe });
      return;
    }
    if (error instanceof BadRequest) {
      respondJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (isRemoteError(error)) {
      respondJson(res, 200, {
        ok: false,
        error: {
          code: /^[a-z][a-z0-9-]{0,40}\/[a-z][a-z0-9-]{0,60}$/.test(error.code) && !error.code.includes(state.settings.token) ? error.code : "companion/remote-error",
          message: "The host could not complete the operation."
        }
      });
      return;
    }
    safeLog(state.ctx, "warn", `dsh-remote-companion: session API failed: ${errorText(error)}`);
    if (!res.headersSent) {
      respondJson(res, 500, {
        ok: false,
        error: { code: "companion/internal", message: "The companion could not complete the operation." }
      });
    } else {
      res.destroy();
    }
  } finally {
    res.off("close", abort);
  }
}

/**
 * Build the `/companion/health` payload.
 *
 * @param state - companion state.
 * @returns JSON-serializable health object (never contains the token).
 */
function healthPayload(state) {
  return {
    ok: true,
    app: "desktop",
    mode: "companion",
    label: state.label,
    home: resolveHome(state.ctx),
    origin: safeOrigin(state),
    port: state.settings.port,
    listening: state.listening === true,
    capabilities: { sessions: true, desktop: state.settings.desktopEnabled, pairing: state.access.fenceReady, control: state.access.fenceReady },
    control: state.access.status(),
    version: detectRuntimeVersion(),
    plugin: { name: "dsh-remote-companion", version: PLUGIN_VERSION },
    auth: {
      proxyCookie: state.hostCookieName ?? "not minted yet",
      tokenConfigured: state.settings.token.length >= MIN_TOKEN_LENGTH
    },
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    at: new Date().toISOString()
  };
}

function mutationId(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(value)) throw new BadRequest(`${field} must be 1..128 letters, digits, or ._:- characters`);
  return value;
}

/** Cache success AND failure before invoking effects. Reusing an ID with a new payload is a conflict. */
function onceMutation(state, key, request, effect) {
  const now = state.now();
  for (const [id, entry] of state.mutations) if (entry.expiresAt <= now) state.mutations.delete(id);
  const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const existing = state.mutations.get(key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new BadRequest("This mutation ID was already used with different content.", 409, "companion/id-conflict");
    return existing.result;
  }
  // Successful high-frequency input expires after 30s; prompts keep five minutes of replay protection.
  // Pending effects and ambiguous failures remain protected for this sharing lifetime.
  if (state.mutations.size >= 50_000) throw new BadRequest("The mutation limit was reached. Restart sharing before sending more input.", 429, "companion/mutation-limit");
  const entry = { fingerprint, expiresAt: Infinity, result: undefined };
  const result = Promise.resolve().then(() => { if (state.disposed) throw new Error("Companion stopped."); return effect(); }).then(value => {
    entry.expiresAt = state.now() + (key.startsWith("input:") ? 30_000 : 300_000);
    return value;
  });
  entry.result = result;
  state.mutations.set(key, entry);
  result.catch(() => {});
  return result;
}

async function desktopBackend(state, { recoverFailed = false } = {}) {
  if (!state.settings.desktopEnabled) throw new BadRequest("Desktop access is disabled on this device.", 403, "desktop/disabled");
  if (state.disposed) throw new BadRequest("Companion is stopping.", 503, "companion/stopping");
  if (state.backendResetting) {
    if (!recoverFailed) throw new BadRequest("Desktop sharing is reconnecting. Wait for the screen before enabling control.", 503, "desktop/reconnecting");
    await state.backendResetting;
    if (state.disposed) throw new BadRequest("Companion is stopping.", 503, "companion/stopping");
  }
  if (!state.backendPending) {
    state.backendPending = Promise.resolve().then(async () => {
      const factory = state.backendFactory ?? (await import("./lib/desktop-backend.mjs")).createDesktopBackend;
      return factory();
    });
    state.backendPending.catch(() => {});
  }
  const backend = await state.backendPending;
  if (state.disposed) throw new BadRequest("Companion is stopping.", 503, "companion/stopping");
  if (recoverFailed && backend.failed === true) {
    if (!state.backendResetting) {
      const previous = state.backendPending;
      // Only monitor discovery can recover viewing. Input/frame failures never
      // recreate a helper, and the mutation tombstones survive this replacement.
      const reset = Promise.resolve().then(async () => {
        clearTimeout(state.heldInputTimer);
        state.heldInputTimer = undefined;
        try { await backend.releaseAll(); } catch { /* disposal also releases held inputs */ }
        await backend.dispose();
        if (state.backendPending === previous) state.backendPending = undefined;
      });
      state.backendResetting = reset;
      reset.finally(() => { if (state.backendResetting === reset) state.backendResetting = undefined; }).catch(() => {});
    }
    await state.backendResetting;
    return desktopBackend(state);
  }
  return backend;
}

function validateDesktopInput(input) {
  try { return validateInput(input); }
  catch { throw new BadRequest("The desktop input is invalid."); }
}

async function handleDesktopApi(state, req, res, url, mutate, clientKey) {
  if (!isReadOnly(req.method)) mutate(() => {});
  const monitorRequest = url.pathname === "/companion/desktop/monitors" && req.method === "GET";
  const backend = await desktopBackend(state, { recoverFailed: monitorRequest });
  if (url.pathname === "/companion/desktop/monitors") {
    if (req.method !== "GET") return respondMethodNotAllowed(res, "GET");
    const value = await backend.monitors();
    return respondJson(res, 200, Array.isArray(value) ? { available: true, monitors: value } : value);
  }
  if (url.pathname === "/companion/desktop/frame") {
    if (req.method !== "GET") return respondMethodNotAllowed(res, "GET");
    const rawWidth = url.searchParams.get("maxWidth");
    const maxWidth = rawWidth === null ? 1280 : Number(rawWidth);
    const monitorId = url.searchParams.get("monitorId") ?? undefined;
    let frameOptions;
    try { frameOptions = validateFrameRequest({ ...(monitorId === undefined ? {} : { monitorId }), maxWidth }); }
    catch { throw new BadRequest("The desktop frame request is invalid."); }
    const frame = await backend.frame(frameOptions);
    if (!Buffer.isBuffer(frame.bytes) || frame.contentType !== "image/png" || ![frame.width, frame.height, frame.x, frame.y].every(Number.isFinite) || !Number.isInteger(frame.width) || frame.width < 1 || !Number.isInteger(frame.height) || frame.height < 1) throw new Error("Invalid desktop frame.");
    res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store", "content-length": frame.bytes.length,
      "x-desktop-width": String(frame.width), "x-desktop-height": String(frame.height), "x-desktop-x": String(frame.x),
      "x-desktop-y": String(frame.y), "x-desktop-monitor": encodeURIComponent(String(frame.monitorId)) });
    res.end(frame.bytes);
    return;
  }
  if (url.pathname === "/companion/desktop/input") {
    if (req.method !== "POST") return respondMethodNotAllowed(res, "POST");
    const body = await readJsonBody(req, 32 * 1024);
    const eventId = mutationId(body.eventId, "eventId");
    const input = validateDesktopInput(body.input);
    const value = await mutate(() => onceMutation(state, `input:${clientKey}:${eventId}`, input, async () => {
      await state.controlCleanup;
      mutate(() => {});
      // A disconnected browser cannot retain pressed keys forever. Capture/view traffic never extends this timer.
      clearTimeout(state.heldInputTimer);
      state.heldInputTimer = setTimeout(() => { state.heldInputTimer = undefined; backend.releaseAll().catch(() => {}); }, 15_000);
      state.heldInputTimer.unref?.();
      await backend.input(input);
      return { accepted: true };
    }));
    return respondJson(res, 200, value);
  }
  if (url.pathname === "/companion/desktop/release") {
    if (req.method !== "POST") return respondMethodNotAllowed(res, "POST");
    await readJsonBody(req, 1024);
    await state.controlCleanup;
    mutate(() => {});
    clearTimeout(state.heldInputTimer);
    state.heldInputTimer = undefined;
    await backend.releaseAll();
    return respondJson(res, 200, { accepted: true });
  }
  respondText(res, 404, "not found: unknown desktop endpoint\n");
}

// ---------------------------------------------------------------------------
// Reverse proxy — HTTP
// ---------------------------------------------------------------------------

/**
 * Proxy one HTTP request/response to the embedded web host.
 *
 * @param state - companion state.
 * @param req - client request.
 * @param res - client response.
 */
async function proxyHttp(state, req, res) {
  let cookie;
  try {
    cookie = await hostCookie(state);
  } catch (error) {
    respondText(res, 503, "companion: embedded-host authentication is unavailable\n");
    return;
  }
  await forwardHttp(state, req, res, cookie, false);
}

/**
 * Perform one proxied HTTP exchange; retry a body-less request once after a 401
 * with a freshly minted cookie (the DSH cookie can expire or be revoked by a
 * host restart, which changes the launch token).
 *
 * @param state - companion state.
 * @param req - client request.
 * @param res - client response.
 * @param cookie - minted Cookie header value.
 * @param retried - whether this request already refreshed its cookie once.
 */
async function forwardHttp(state, req, res, cookie, retried) {
  if (ownerOnlyProxyPath(new URL(req.url ?? '/', 'http://companion.invalid').pathname)) return respondText(res, 403, 'forbidden: owner-only route\n');
  if (state.access.engaged) return respondText(res, 403, 'forbidden: use the Remote Control window\n');
  const origin = safeOrigin(state);
  if (origin === null) {
    respondText(res, 503, "companion: the embedded web host origin is not available yet\n");
    return;
  }
  const target = new URL(origin);
  const mod = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = buildUpstreamHeaders(req, target, cookie);
  const upstream = mod({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port === "" ? undefined : Number(target.port),
    method: req.method,
    path: req.url ?? "/",
    headers,
    // The target is the host's own loopback listener, never a public endpoint.
    rejectUnauthorized: false
  });
  state.proxySockets.add(req.socket);
  upstream.on('socket', socket => { state.proxySockets.add(socket); socket.on('close', () => state.proxySockets.delete(socket)); });
  res.once('close', () => state.proxySockets.delete(req.socket));

  let settled = false;
  const dispose = () => {
    if (settled) return;
    settled = true;
    try {
      upstream.destroy();
    } catch {
      /* ignore */
    }
  };
  res.on("close", dispose);

  upstream.on("response", (upstreamRes) => {
    if (upstreamRes.statusCode === 401 && !retried) {
      state.hostCookie = undefined;
      state.hostCookieAt = 0;
      if ((req.method === "GET" || req.method === "HEAD") && !res.headersSent) {
        upstreamRes.resume();
        hostCookie(state)
          .then((refreshed) => forwardHttp(state, req, res, refreshed, true))
          .catch((error) => {
            safeLog(state.ctx, "warn", `dsh-remote-companion: cookie refresh failed: ${errorText(error)}`);
            if (!res.headersSent) respondText(res, 502, "companion: embedded-host authentication failed\n");
          });
        return;
      }
    }
    pipeUpstreamResponse(upstreamRes, res);
  });
  upstream.on("error", (error) => {
    settled = true;
    if (res.headersSent) {
      res.destroy();
      return;
    }
    safeLog(state.ctx, "warn", `dsh-remote-companion: proxy upstream error: ${errorText(error)}`);
    respondText(res, 502, "companion: embedded-host request failed\n");
  });
  if (retried && req.readableEnded) upstream.end();
  else req.pipe(upstream);
}

/**
 * Copy an upstream response to the client, preserving status, headers, streaming
 * and chunked boundaries.
 *
 * @param upstreamRes - embedded-host response.
 * @param res - client response.
 */
function pipeUpstreamResponse(upstreamRes, res) {
  const headers = {};
  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    headers[lower] = value;
  }
  try {
    res.writeHead(upstreamRes.statusCode ?? 502, headers);
  } catch (error) {
    upstreamRes.destroy();
    res.destroy();
    return;
  }
  upstreamRes.on("error", () => res.destroy());
  upstreamRes.pipe(res);
}

/**
 * Build the upstream header set: drop hop-by-hop and browser-authority headers,
 * then rewrite authority (`Host`, `Origin`) to the embedded host and attach the
 * minted cookie.
 *
 * @param req - client request.
 * @param target - parsed embedded-host origin.
 * @param cookie - minted Cookie header value.
 * @returns header object for `http.request`.
 */
function buildUpstreamHeaders(req, target, cookie) {
  const headers = {};
  const authority = `${target.protocol}//${target.host}`;
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (
      lower === "host" ||
      lower === TOKEN_HEADER ||
      lower === "origin" ||
      lower === "referer" ||
      lower === "cookie" ||
      lower === "forwarded" ||
      lower === "x-forwarded-for" ||
      lower === "x-forwarded-host" ||
      lower === "x-forwarded-proto"
    ) {
      continue;
    }
    headers[lower] = value;
  }
  headers.host = target.host;
  headers.origin = authority;
  headers.cookie = cookie;
  if (headers["user-agent"] === undefined) headers["user-agent"] = "dsh-remote-companion";
  return headers;
}

// ---------------------------------------------------------------------------
// Reverse proxy — WebSocket upgrade (raw TCP pipe)
// ---------------------------------------------------------------------------

/**
 * Authenticate and start one proxied WebSocket upgrade.
 *
 * @param state - companion state.
 * @param req - client upgrade request.
 * @param socket - client raw socket (owned until the tunnel closes).
 * @param head - bytes already read after the client request headers.
 */
function handleUpgrade(state, req, socket, head) {
  socket.on("error", () => socket.destroy());
  if (state.disposed) {
    rejectUpgrade(socket, 503, "companion is shutting down");
    return;
  }
  if (!isLoopbackPeer(req.socket.remoteAddress)) {
    rejectUpgrade(socket, 403, "the companion server accepts loopback peers only");
    return;
  }
  let url;
  try {
    url = new URL(req.url ?? "/", "http://companion.invalid");
  } catch {
    rejectUpgrade(socket, 400, "bad request");
    return;
  }
  const auth = authenticate(state, req, url);
  if (!auth.ok || auth.exchange) {
    rejectUpgrade(socket, 401, "unauthorized: authenticate the companion gate first");
    return;
  }
  if (auth.client || state.access.engaged) return rejectUpgrade(socket, 403, 'use the Remote Control window');
  if (ownerOnlyProxyPath(url.pathname)) return rejectUpgrade(socket, 403, 'owner-only route');
  if (!requestOrigins(state, req).length || !safeBrowserRequest(state, req, auth)) {
    rejectUpgrade(socket, 403, "forbidden: request origin does not match companion");
    return;
  }
  if (url.pathname.startsWith("/companion/")) {
    rejectUpgrade(socket, 404, "not a proxy path");
    return;
  }
  socket.pause();
  hostCookie(state)
    .then((cookie) => { if (state.disposed || socket.destroyed || state.access.engaged) return socket.destroy(); tunnelUpgrade(state, req, socket, head, cookie); })
    .catch((error) => {
      safeLog(state.ctx, "warn", `dsh-remote-companion: cannot open the websocket tunnel: ${errorText(error)}`);
      rejectUpgrade(socket, 502, "companion: cannot authenticate to the embedded host");
    });
}

/**
 * Open the raw TCP tunnel and replay the upgrade handshake against the embedded
 * host with rewritten `Host`/`Origin` and the minted cookie. After a `101` the
 * two sockets are piped verbatim in both directions (frames, pings, close).
 *
 * @param state - companion state.
 * @param req - client upgrade request.
 * @param socket - client raw socket.
 * @param clientHead - bytes buffered from the client after its request headers.
 * @param cookie - minted Cookie header value.
 */
function tunnelUpgrade(state, req, socket, clientHead, cookie) {
  const origin = safeOrigin(state);
  if (origin === null) {
    rejectUpgrade(socket, 503, "companion: the embedded web host origin is not available yet");
    return;
  }
  const target = new URL(origin);
  if (target.protocol !== "http:") {
    rejectUpgrade(socket, 502, "companion: websocket proxying currently supports a plain-HTTP embedded host");
    return;
  }
  const upstream = netConnect({
    host: target.hostname,
    port: target.port === "" ? 80 : Number(target.port)
  });
  state.tunnelSockets.add(upstream);
  state.tunnelSockets.add(socket);
  state.proxySockets.add(upstream);
  state.proxySockets.add(socket);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    state.tunnelSockets.delete(upstream);
    state.tunnelSockets.delete(socket);
    state.proxySockets.delete(upstream);
    state.proxySockets.delete(socket);
    try {
      upstream.destroy();
    } catch {
      /* ignore */
    }
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  };
  upstream.on("error", (error) => {
    safeLog(state.ctx, "warn", `dsh-remote-companion: websocket upstream error: ${errorText(error)}`);
    cleanup();
  });
  upstream.on("close", cleanup);
  socket.on("error", cleanup);
  socket.on("close", cleanup);
  upstream.setTimeout(15_000, cleanup);
  upstream.setNoDelay(true);
  socket.setNoDelay(true);

  let handshake = Buffer.alloc(0);
  const onData = (chunk) => {
    handshake = Buffer.concat([handshake, chunk]);
    const headerEnd = handshake.indexOf(CRLFCRLF);
    if (headerEnd === -1) {
      if (handshake.length > 64 * 1024) cleanup();
      return;
    }
    upstream.removeListener("data", onData);
    upstream.setTimeout(0);
    const headerBytes = handshake.subarray(0, headerEnd + 4);
    const remainder = handshake.subarray(headerEnd + 4);
    handshake = Buffer.alloc(0);
    const statusLine = headerBytes.toString("latin1").split("\r\n")[0] ?? "";
    if (!/^HTTP\/1\.[01] 101\b/.test(statusLine)) {
      // Not an upgrade: forward the failure response (401/403/...) to the client.
      socket.write(headerBytes);
      if (remainder.length > 0) socket.write(remainder);
      socket.end();
      cleanup();
      return;
    }
    socket.write(headerBytes);
    if (remainder.length > 0) socket.write(remainder);
    if (clientHead.length > 0) upstream.write(clientHead);
    upstream.pipe(socket);
    socket.pipe(upstream);
    socket.resume();
  };
  upstream.on("data", onData);

  upstream.on("connect", () => {
    const lines = [
      `GET ${req.url ?? "/api/remote.mux"} HTTP/1.1`,
      `Host: ${target.host}`,
      `Connection: Upgrade`,
      `Upgrade: ${typeof req.headers.upgrade === "string" ? req.headers.upgrade : "websocket"}`
    ];
    for (const [lower, canonical] of WEBSOCKET_HEADERS) {
      const value = req.headers[lower];
      if (typeof value === "string" && value !== "") lines.push(`${canonical}: ${value}`);
    }
    lines.push(`Origin: ${target.protocol}//${target.host}`);
    lines.push(`Cookie: ${cookie}`);
    const userAgent = req.headers["user-agent"];
    if (typeof userAgent === "string" && userAgent !== "") lines.push(`User-Agent: ${userAgent}`);
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
  });
}

/**
 * Answer a refused upgrade with a minimal HTTP/1.1 response on the raw socket.
 *
 * @param socket - client socket.
 * @param status - HTTP status code.
 * @param message - plain-text reason.
 */
function rejectUpgrade(socket, status, message) {
  const body = `${message}\n`;
  const head =
    `HTTP/1.1 ${status} ${statusText(status)}\r\n` +
    "Connection: close\r\n" +
    "Content-Type: text/plain; charset=utf-8\r\n" +
    "Cache-Control: no-store\r\n" +
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  try {
    socket.write(head + body);
    socket.end();
  } catch {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Minted embedded-host cookie
// ---------------------------------------------------------------------------

/**
 * Return the cached embedded-host Cookie header, minting it when absent, stale,
 * or explicitly invalidated.
 *
 * @param state - companion state.
 * @returns Cookie header value (`name=value`).
 */
function hostCookie(state) {
  const now = Date.now();
  if (state.hostCookie !== undefined && now - state.hostCookieAt < HOST_COOKIE_TTL_MS) {
    return Promise.resolve(state.hostCookie);
  }
  if (state.hostCookiePending !== undefined) return state.hostCookiePending;
  state.hostCookiePending = mintHostCookie(state)
    .then((cookie) => {
      state.hostCookie = cookie;
      state.hostCookieAt = Date.now();
      safeLog(state.ctx, "info", "dsh-remote-companion: minted the embedded-host authentication cookie");
      return cookie;
    })
    .finally(() => {
      state.hostCookiePending = undefined;
    });
  return state.hostCookiePending;
}

/**
 * Mint the DSH browser-session cookie for the embedded host:
 *
 *   1. `connection.authenticatedUrl(origin)` -> `origin/?token=<launchToken>`
 *   2. fetch with `redirect: 'manual'` -> the is 303 carrying the signed cookie
 *   3. keep every Set-Cookie pair except the companion's own gate cookie.
 *
 * Why the fetch Host matters: the signed cookie is bound to the authority in the
 * request `Host` header, so fetching the loopback origin directly mints a cookie
 * for exactly the authority the proxy later rewrites to.
 *
 * @param state - companion state.
 * @returns Cookie header value.
 */
async function mintHostCookie(state) {
  const origin = safeOrigin(state);
  if (origin === null) throw new Error("the embedded web host origin is not available yet");
  const launchUrl = state.connection.authenticatedUrl(`${origin}/`);
  const response = await fetch(launchUrl, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "text/html", "user-agent": "dsh-remote-companion" },
    signal: state.lifecycle ? AbortSignal.any([state.lifecycle.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000)
  });
  const status = response.status;
  const setCookies = collectSetCookies(response);
  try {
    await response.arrayBuffer();
  } catch {
    /* response body is irrelevant */
  }
  if (status !== 303) {
    throw new Error(`launch-token exchange returned HTTP ${status}, expected a 303 redirect`);
  }
  const pairs = [];
  for (const header of setCookies) {
    const at = header.indexOf(";");
    const pair = (at === -1 ? header : header.slice(0, at)).trim();
    if (pair === "" || !pair.includes("=")) continue;
    const cookieName = pair.slice(0, pair.indexOf("="));
    if (cookieName === GATE_COOKIE) continue;
    pairs.push(pair);
    state.hostCookieName = cookieName;
  }
  if (pairs.length === 0) throw new Error("launch-token exchange set no authentication cookie");
  return pairs.join("; ");
}

/**
 * Read all Set-Cookie header values from a fetch Response (Node >= 20 exposes
 * `getSetCookie()`; fall back to the combined header on older runtimes).
 *
 * @param response - fetch Response.
 * @returns Set-Cookie header values.
 */
function collectSetCookies(response) {
  const headers = response.headers;
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined === null ? [] : [combined];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the embedded-host origin, or null before its listener binds.
 *
 * @param state - companion state.
 * @returns `http://127.0.0.1:<port>` or null.
 */
function safeOrigin(state) {
  try {
    const origin = state.webServer.getOrigin();
    return typeof origin === "string" ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the running DSH home without importing @deepseek-ai packages: the
 * app-boot supplied `dshHomePath` helper when present, else $DSH_HOME, else
 * the default `~/.dsh`.
 *
 * @param ctx - Cordis context.
 * @returns absolute home path.
 */
function resolveHome(ctx) {
  try {
    const helper = ctx.get("dshHomePath");
    if (typeof helper === "function") {
      const home = helper();
      if (typeof home === "string" && home !== "") return home;
    }
  } catch {
    /* fall through */
  }
  const configured = process.env.DSH_HOME;
  if (typeof configured === "string" && configured.trim() !== "") return configured;
  return join(homedir(), ".dsh");
}

/**
 * Report the running DSH version by resolving a shipped package manifest, with a
 * plain fallback. Purely informational metadata for `/companion/health`; the
 * result is cached for the process lifetime.
 *
 * @returns version string or "unknown".
 */
function detectRuntimeVersion() {
  if (runtimeVersionCache !== undefined) return runtimeVersionCache;
  runtimeVersionCache = "unknown";
  for (const candidate of [
    "@deepseek-ai/dsh-app-boot/package.json",
    "@deepseek-ai/dsh-base/package.json",
    "@deepseek-ai/dsh-desktop-host/package.json"
  ]) {
    try {
      const resolved = import.meta.resolve(candidate);
      const parsed = JSON.parse(readFileSync(new URL(resolved), "utf8"));
      if (typeof parsed.version === "string" && parsed.version !== "") {
        runtimeVersionCache = parsed.version;
        break;
      }
    } catch {
      /* try the next candidate */
    }
  }
  return runtimeVersionCache;
}

/** Cached DSH runtime version for the health payload. */
let runtimeVersionCache;

/**
 * Whether a socket peer address is the local loopback authority.
 *
 * @param address - socket remote address.
 * @returns true for 127/8 and ::1 forms.
 */
function isLoopbackPeer(address) {
  if (typeof address !== "string") return false;
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized === "::ffff:127.0.0.1") return true;
  return normalized.startsWith("127.");
}

/**
 * Read and parse a JSON object body (bounded, so a hostile loopback caller
 * cannot exhaust memory).
 *
 * @param req - node request.
 * @param limitBytes - maximum accepted body size.
 * @returns parsed JSON object.
 */
function readJsonBody(req, limitBytes = 1024 * 1024) {
  const contentType = req.headers["content-type"];
  if (typeof contentType !== "string" || !/^application\/json(?:\s*;|\s*$)/i.test(contentType)) return Promise.reject(new BadRequest("Content-Type must be application/json", 415, "companion/content-type"));
  if (Number(req.headers["content-length"]) > limitBytes) { req.resume(); return Promise.reject(new BadRequest("request body is too large", 413, "companion/body-limit")); }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limitBytes) {
        failed = true;
        reject(new BadRequest("request body is too large", 413, "companion/body-limit"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim() === "") {
        resolve({});
        return;
      }
      try {
        const value = JSON.parse(text);
        if (!isRecord(value)) throw new Error("not an object");
        resolve(value);
      } catch {
        reject(new BadRequest("request body must be a JSON object"));
      }
    });
    req.on("error", (error) => {
      if (!failed) reject(error);
    });
  });
}

/**
 * Copy only the named fields of a JSON body into a fresh object.
 *
 * @param body - parsed JSON body.
 * @param fields - allowed field names.
 * @returns filtered object.
 */
function pickFields(body, fields) {
  const out = {};
  for (const field of fields) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

/**
 * Write a JSON response.
 *
 * @param res - node response.
 * @param status - HTTP status.
 * @param value - JSON-serializable value.
 */
function respondJson(res, status, value) {
  if (res.headersSent) {
    res.end();
    return;
  }
  let body;
  try {
    body = JSON.stringify(value);
  } catch {
    body = JSON.stringify({ ok: false, error: { code: "companion/internal", message: "result is not JSON-serializable" } });
  }
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

/**
 * Write a plain-text response.
 *
 * @param res - node response.
 * @param status - HTTP status.
 * @param body - text body.
 * @param extraHeaders - additional response headers.
 */
function respondText(res, status, body, extraHeaders = {}) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

/**
 * Write a 405 response.
 *
 * @param res - node response.
 * @param allow - allowed methods.
 */
function respondMethodNotAllowed(res, allow) {
  respondText(res, 405, "method not allowed\n", { allow });
}

/**
 * Structural RemoteError detection (cross-realm safe; the class lives in the
 * shipped typert-protocol package, which this plugin does not import).
 *
 * @param error - caught value.
 * @returns true for a DSH RemoteError.
 */
function isRemoteError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    error.isDSHRemoteError === true &&
    typeof error.code === "string"
  );
}

/**
 * Whether a value is a plain JSON object.
 *
 * @param value - candidate.
 * @returns true for `{}`-like values.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Human-readable error text (never includes the token: callers pass messages
 * that do not contain it).
 *
 * @param error - caught value.
 * @returns message or string form.
 */
function errorText(error) {
  return "operation unavailable";
}

/**
 * Standard HTTP status text for the small set used on raw sockets.
 *
 * @param status - status code.
 * @returns status text.
 */
function statusText(status) {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 405:
      return "Method Not Allowed";
    case 502:
      return "Bad Gateway";
    case 503:
      return "Service Unavailable";
    default:
      return "Error";
  }
}

/**
 * Resolve the Cordis logger for this row, falling back to the console. Never let
 * logging itself throw, and never emit the token (messages here do not carry it).
 *
 * @param ctx - Cordis context.
 * @returns logger object with info/warn/error.
 */
function safeLogger(ctx) {
  try {
    const logger = typeof ctx?.logger === "function" ? ctx.logger("remote-companion") : ctx?.logger;
    if (logger !== undefined && logger !== null) return logger;
  } catch {
    /* fall back to console */
  }
  return console;
}

/**
 * Log one line through the Cordis logger, swallowing logger failures.
 *
 * @param ctx - Cordis context.
 * @param level - info | warn | error.
 * @param message - message.
 */
function safeLog(ctx, level, message) {
  try {
    const logger = safeLogger(ctx);
    const method = typeof logger?.[level] === "function" ? logger[level] : logger?.info;
    if (typeof method === "function") method.call(logger, message);
  } catch {
    /* logging must never take the host down */
  }
}

/**
 * @typedef {object} CompanionState
 * @property {object} ctx - Cordis context.
 * @property {{port: number, token: string, label: string, problems: string[]}} settings - normalized config.
 * @property {{getOrigin: () => string}} webServer - embedded web host service.
 * @property {{authenticatedUrl: (baseUrl: string) => string}} connection - browser-auth service.
 * @property {object} sessionController - in-process Session API.
 * @property {string} label - deployment label.
 * @property {import("node:http").Server | undefined} server - loopback listener.
 * @property {boolean} listening - whether the listener bound.
 * @property {boolean} disposed - whether the row was disposed.
 * @property {string | undefined} hostCookie - cached Cookie header value.
 * @property {number} hostCookieAt - cache timestamp.
 * @property {string | undefined} hostCookieName - cookie name (health diagnostics).
 * @property {Promise<string> | undefined} hostCookiePending - in-flight mint.
 * @property {Set<import("node:net").Socket>} tunnelSockets - live tunnel sockets.
 */
