import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const installer=join(root,'tools/install.ps1');
const psQuote=value=>`'${String(value).replaceAll("'","''")}'`;
const loadFunctions=`$ErrorActionPreference='Stop'; $tokens=$null; $parseErrors=$null; $ast=[Management.Automation.Language.Parser]::ParseFile(${psQuote(installer)},[ref]$tokens,[ref]$parseErrors); if($parseErrors.Count){throw 'Installer syntax failed.'}; $definitions=$ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$false); foreach($definition in $definitions){Invoke-Expression $definition.Extent.Text};`;
function powershell(script){
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(loadFunctions+script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr || result.stdout || result.error?.message);
  return result.stdout.trim();
}
const baseline=['index.js','client.js','cordis.patch.yml','lib/controller.js','lib/store.js','lib/transport.js','lib/tools.js','companion/index.js','companion/lib/desktop-backend.mjs'];
const additions=['window.js','lib/connection-code.js','lib/tunnel.js','lib/tunnel-worker.mjs','lib/window-manager.js','lib/window-page.js','companion/lib/control-access.mjs','companion/lib/desktop-input.mjs','companion/lib/desktop-errors.mjs','companion/lib/desktop-helper.mjs','companion/lib/desktop-service.mjs','companion/lib/desktop-win32.mjs','companion/lib/desktop-png.mjs','vendor/cloudflared.exe','vendor/CLOUDFLARED-LICENSE.txt'];
async function layout(directory,files){for(const file of files){const target=join(directory,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,'fixture');}}

test('installer validates every 0.4 runtime artifact, preserves 0.3 rollback, and refuses a changed executable',{skip:process.platform!=='win32'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'dsh-installer-artifacts-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const files=[...baseline,...additions],complete=join(directory,'complete');
  await layout(complete,files);
  await copyFile(join(root,'packages/remote-control/vendor/cloudflared.exe'),join(complete,'vendor/cloudflared.exe'));
  const legacy=join(directory,'legacy');await layout(legacy,baseline);
  let script=`Assert-RemoteRuntimeArtifacts ${psQuote(complete)} '0.4.0'; Assert-RemoteRuntimeArtifacts ${psQuote(legacy)} '0.3.0';`;
  for(let index=0;index<additions.length;index++){
    const missing=join(directory,`missing-${index}`);await layout(missing,files.filter(file=>file!==additions[index]));
    script+=`$caught=$false;try{Assert-RemoteRuntimeArtifacts ${psQuote(missing)} '0.4.0'}catch{$caught=$_.Exception.Message.Contains(${psQuote(additions[index].split('/').join(String.fromCharCode(92)))})};if(-not $caught){throw 'Incomplete 0.4 package was accepted.'};`;
  }
  script+=`'complete-and-incomplete-layouts-verified'`;
  assert.match(powershell(script),/complete-and-incomplete-layouts-verified/);
  await writeFile(join(complete,'vendor/cloudflared.exe'),'modified fixture');
  assert.match(powershell(`$caught=$false;try{Assert-RemoteRuntimeArtifacts ${psQuote(complete)} '0.4.0'}catch{$caught=$_.Exception.Message.Contains('integrity check')};if(-not $caught){throw 'Changed helper was accepted.'};'integrity-verified'`),/integrity-verified/);
});

test('packed binary integrity check hashes raw tar output without changing the package or profile',{skip:process.platform!=='win32'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'dsh-installer-stream-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const relative='package/vendor/cloudflared.exe',binary=Buffer.from([0,255,13,10,128,0,192,200,10]);
  await mkdir(join(directory,'package/vendor'),{recursive:true});await writeFile(join(directory,relative),binary);
  const archive=join(directory,'fixture.tgz'),tar=join(process.env.SystemRoot,'System32/tar.exe');
  const packed=spawnSync(tar,['-czf',archive,'-C',directory,'package'],{encoding:'utf8',windowsHide:true});
  assert.equal(packed.status,0,packed.stderr);
  assert.equal(powershell(`Get-PackedArtifactSha256 ${psQuote(tar)} ${psQuote(archive)} ${psQuote(relative)}`),createHash('sha256').update(binary).digest('hex'));
});
