import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTunnelExecutable } from './tunnel.js';

export function parseQuickTunnelOutput(text) {
  const match = /https:\/\/([a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com)(?![a-z0-9.:/-])/i.exec(text);
  return { url: match ? `https://${match[1].toLowerCase()}` : undefined,
    registered: text.includes('Registered tunnel connection') };
}

/** A separate watchdog keeps ownership when the DSH process exits abruptly. */
export function serveTunnelWorker({ channel = process, spawnImpl = spawn, verify = verifyTunnelExecutable } = {}) {
  let child; let starting = false; let closing = false; let timer; let ready = false;
  let output = ''; let url; let registered = false;
  const send = message => { if (channel.connected) { try { channel.send(message, () => {}); } catch {} } };
  const disconnect = () => { try { if (channel.connected) channel.disconnect(); } catch {} };
  const close = () => {
    if (closing) return;
    closing = true; clearTimeout(timer);
    if (!child || child.exitCode !== null || child.signalCode !== null) { disconnect(); return; }
    // Never address a PID from disk or a process name. This is the exact child
    // object created below. Windows terminates it via its retained handle.
    try { child.kill(); } catch { /* preserve watchdog until child exit */ }
  };
  const fatal = code => { send({ type: 'fatal', code }); close(); };
  const consume = chunk => {
    if (closing || ready) return;
    output = (output + String(chunk)).slice(-65536);
    const parsed = parseQuickTunnelOutput(output);
    url ||= parsed.url; registered ||= parsed.registered;
    if (url && registered) {
      ready = true; clearTimeout(timer); output = '';
      send({ type: 'ready', url });
    }
  };
  const start = async message => {
    if (starting || closing) return;
    starting = true;
    if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65535
      || typeof message.executable !== 'string' || typeof message.config !== 'string'
      || !/^[a-f0-9]{64}$/.test(message.expectedSha256)
      || !Number.isInteger(message.timeoutMs) || message.timeoutMs < 1 || message.timeoutMs > 120000) return fatal('network/config');
    try {
      await verify(message.executable, message.expectedSha256);
      if (closing || !channel.connected) return close();
      child = spawnImpl(message.executable, ['tunnel', '--config', message.config, '--no-autoupdate',
        '--protocol', 'http2', '--url', `http://127.0.0.1:${message.port}`], {
        shell: false, windowsHide: true, detached: false, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', consume); child.stderr?.on('data', consume);
      child.on('error', () => {
        fatal('network/unavailable');
        // Failed spawn emits error/close without exit on Node. No PID means
        // there is no operating-system child to supervise or terminate.
        if (!child.pid) disconnect();
      });
      child.once('exit', () => {
        clearTimeout(timer);
        if (!closing) send({ type: 'fatal', code: 'network/closed' });
        closing = true; output = ''; disconnect();
      });
      timer = setTimeout(() => fatal('network/timeout'), message.timeoutMs);
    } catch { fatal('network/unavailable'); }
  };
  channel.on('message', message => { if (message?.type === 'start') start(message); else if (message?.type === 'stop') close(); });
  channel.once('disconnect', close);
  channel.once('SIGTERM', close);
  channel.once('SIGINT', close);
  return { close };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serveTunnelWorker();
