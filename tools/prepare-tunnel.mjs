import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOUDFLARED_SHA256, CLOUDFLARED_VERSION } from '../packages/remote-control/lib/tunnel.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: node tools/prepare-tunnel.mjs "C:\\path\\to\\verified\\cloudflared.exe"');
const target = fileURLToPath(new URL('../packages/remote-control/vendor/cloudflared.exe', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
if (digest(await readFile(resolve(source))) !== CLOUDFLARED_SHA256) throw new Error('Cloudflare executable does not match the pinned release. Nothing was copied.');
await mkdir(dirname(target), { recursive: true });
await copyFile(resolve(source), target);
if (digest(await readFile(target)) !== CLOUDFLARED_SHA256) throw new Error('Copied executable failed its integrity check.');
console.log(`Prepared Cloudflare ${CLOUDFLARED_VERSION}; SHA-256 verified. No tunnel was started.`);
