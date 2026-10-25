import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installedDsh } from './dsh.mjs';

const { exe } = installedDsh();
const result = spawnSync(exe, ['--expose-internals', '--test', fileURLToPath(new URL('./reload-fix/test/reload.test.mjs', import.meta.url))], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
