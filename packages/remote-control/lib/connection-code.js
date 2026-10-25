import { ConnectionError } from './transport.js';

const PREFIX = 'DSH1.';
const invalid = () => new ConnectionError('pairing/invalid', 'Paste the complete connection code from Remote Control on the other computer.');

export function connectionOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password ||
      url.search || url.hash || !['', '/'].includes(url.pathname)) throw invalid();
  return url.origin;
}

function validate(value) {
  if (!value || Array.isArray(value) || value.v !== 1 || typeof value.secret !== 'string' ||
      !/^[a-zA-Z0-9_-]{32,128}$/.test(value.secret) || (value.expiresAt!==null&&!Number.isSafeInteger(value.expiresAt)) ||
      typeof value.label !== 'string' || !value.label.trim() || value.label.length > 80) throw invalid();
  const useLimit=value.useLimit??'once';if(!['once','unlimited'].includes(useLimit))throw invalid();
  return {v:1, url:connectionOrigin(value.url), secret:value.secret, expiresAt:value.expiresAt, label:value.label,useLimit};
}

export function encodeConnectionCode(invitation) {
  const value = validate({v:1, ...invitation});
  return PREFIX + Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeConnectionCode(input, now = Date.now()) {
  if (typeof input !== 'string' || input.length > 4096) throw invalid();
  const code = input.trim();
  if (!code.startsWith(PREFIX) || !/^[A-Za-z0-9_-]+$/.test(code.slice(PREFIX.length))) throw invalid();
  let value;
  try {
    const encoded = code.slice(PREFIX.length);
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) throw invalid();
    value = validate(JSON.parse(bytes.toString('utf8')));
  } catch { throw invalid(); }
  if (value.expiresAt!==null&&value.expiresAt <= now) throw new ConnectionError('pairing/expired', 'This connection code has expired. Generate a new code on the other computer.');
  return value;
}
