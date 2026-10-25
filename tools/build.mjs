import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'packages/remote-control');
await build({entryPoints:[path.join(target,'client/source.jsx')],bundle:true,format:'cjs',platform:'browser',target:'chrome130',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],write:true,outfile:path.join(target,'client.js'),banner:{js:'window.__ModuleLoader__.load({id:"dsh-remote-control",factory(require){var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'},minify:false});
await build({entryPoints:[path.join(target,'client/window.jsx')],bundle:true,format:'iife',platform:'browser',target:'chrome130',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},write:true,outfile:path.join(target,'window.js'),minify:true});
console.log('Built DSH browser module and standalone remote window.');
