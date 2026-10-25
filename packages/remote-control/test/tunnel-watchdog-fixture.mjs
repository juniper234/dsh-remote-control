// Offline process-lifetime proof. This fixture never starts Cloudflare or binds
// a network listener; it substitutes an owned Node process for the executable.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { serveTunnelWorker } from '../lib/tunnel-worker.mjs';

serveTunnelWorker({
  verify: async () => {},
  spawnImpl: () => {
    const child = spawn(process.execPath, ['-e',
      "console.log('https://offline-fixture.trycloudflare.com');console.log('Registered tunnel connection');setInterval(()=>{},1000);"], {
      shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.once('exit', () => writeFileSync(process.env.DSH_TUNNEL_TEST_EXIT_MARKER, 'owned-child-exited'));
    return child;
  },
});
