import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export function parseDevice(input, previous = {}) {
  if (!input || typeof input !== 'object') throw new Error('Device details are required.');
  const name = String(input.name ?? previous.name ?? '').trim();
  if (!name || name.length > 80) throw new Error('Give the device a name of 1–80 characters.');
  let url;
  try {
    const raw = String(input.url ?? previous.url ?? '').trim();
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch { throw new Error('Enter a valid HTTP or HTTPS pairing link.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP or HTTPS pairing links are supported.');
  if (url.username || url.password) throw new Error('Embedded URL credentials are not supported; use the pairing token field.');
  const mode = input.mode ?? previous.mode ?? 'auto';
  if (!['auto', 'web', 'companion'].includes(mode)) throw new Error('Connection mode must be auto, web, or companion.');
  const token = String(input.token || url.searchParams.get('k') || url.searchParams.get('token') || previous.token || '').trim();
  if (token.length > 4096) throw new Error('Pairing token is too long.');
  const publicUrl = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  const clientId = input.clientId ?? previous.clientId;
  if (clientId !== undefined && (typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(clientId))) throw new Error('Invalid paired client identity.');
  return {
    id: previous.id ?? randomUUID(), name, url: publicUrl, mode, token,
    ...(clientId ? {clientId} : {}),
    isDefault: input.isDefault ?? previous.isDefault ?? false,
    ...(previous.username !== undefined ? { username: previous.username, password: previous.password } : {}),
  };
}

function publicDevice(device) {
  return { id: device.id, name: device.name, url: device.url, mode: device.mode,
    isDefault: device.isDefault === true, hasToken: Boolean(device.token || device.password), paired: Boolean(device.clientId) };
}

export class DeviceStore {
  constructor(home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')) {
    this.directory = path.join(home, 'remote-control');
    this.filename = path.join(this.directory, 'devices.v2.json');
    this.devices = [];
    if (fs.existsSync(this.filename)) {
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync(this.filename, 'utf8')); }
      catch { throw new Error('The remote device settings could not be read. Restore devices.v2.json from your backup.'); }
      if (parsed.version !== 2 || !Array.isArray(parsed.devices)) throw new Error('Unsupported remote device settings format.');
      this.devices = parsed.devices.map(d => parseDevice(d, d));
    } else {
      const legacy = path.join(this.directory, 'remotes.json');
      if (fs.existsSync(legacy)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(legacy, 'utf8'));
          this.devices = (parsed.remotes ?? []).map(d => parseDevice({ ...d, isDefault: d.default }, d));
        } catch { throw new Error('Existing remote settings could not be migrated; the original file was preserved.'); }
        this.persist();
      }
    }
    if (this.devices.length && !this.devices.some(d => d.isDefault)) this.devices[0].isDefault = true;
  }
  list() { return this.devices.map(publicDevice); }
  private(id) {
    const d = id ? this.devices.find(d => d.id === id || d.name.toLowerCase() === String(id).toLowerCase())
      : this.devices.find(d => d.isDefault) ?? this.devices[0];
    if (!d) throw new Error('That remote device is not configured. Add its pairing link first.');
    return { ...d };
  }
  save(input) {
    const previous = input.id ? this.private(input.id) : {};
    const device = parseDevice(input, previous);
    if (this.devices.some(d => d.id !== device.id && d.name.toLowerCase() === device.name.toLowerCase())) {
      throw new Error('A device with that name already exists. Choose another name.');
    }
    const index = this.devices.findIndex(d => d.id === device.id);
    if (!this.devices.length) device.isDefault = true;
    if (device.isDefault) this.devices.forEach(d => { d.isDefault = false; });
    if (index < 0) this.devices.push(device); else this.devices[index] = device;
    this.persist();
    return publicDevice(device);
  }
  remove(id) {
    const device = this.private(id);
    this.devices = this.devices.filter(d => d.id !== device.id);
    if (this.devices.length && !this.devices.some(d => d.isDefault)) this.devices[0].isDefault = true;
    this.persist();
    return { removed: true };
  }
  redact(value) {
    let text = String(value ?? 'Remote request failed.');
    for (const d of this.devices) for (const secret of [d.token, d.password]) if (secret) text = text.split(secret).join('[redacted]');
    return text.replace(/([?&](?:k|token)=)[^\s&"']+/gi, '$1[redacted]').replace(/DSH1\.[a-zA-Z0-9_-]+/g, '[connection code]');
  }
  persist() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temp = `${this.filename}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify({version: 2, devices: this.devices}, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temp, this.filename);
  }
}
