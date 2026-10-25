import path from 'node:path';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function installedDsh() {
  const exe=process.env.DSH_DESKTOP_EXE??path.join(process.env.LOCALAPPDATA??'','Programs/DeepSeek Harness/DeepSeek Harness.exe');
  if(!fs.existsSync(exe))throw new Error('DeepSeek Harness desktop is not installed at the expected location. Set DSH_DESKTOP_EXE.');
  return {exe,cli:path.join(path.dirname(exe),'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js')};
}
export function runDsh(args,{env={},stdio='inherit',cwd}={}) {
  const {exe,cli}=installedDsh();
  return spawn(exe,['--expose-internals',cli,...args],{cwd,windowsHide:true,stdio,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',...env}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const child=runDsh(process.argv.slice(2));
  child.once('error',error=>{console.error(error.message);process.exitCode=1;});
  child.once('exit',code=>{process.exitCode=code??1;});
}
