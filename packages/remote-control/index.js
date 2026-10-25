import { RemoteController } from './lib/controller.js';
import { registerTools } from './lib/tools.js';
import { readFile } from 'node:fs/promises';
import {windowHeaders,remoteWindowHtml} from './lib/window-page.js';
export {remoteWindowHtml} from './lib/window-page.js';

export const name='remote-control';
export const inject=['tools','connection','remoteCompanion'];
export function apply(ctx) {
  const controller=new RemoteController({sharing:ctx.get('remoteCompanion')});
  ctx.provide('remoteControl',controller);
  ctx.effect(()=>()=>controller.dispose(),'remote-control lifetime');
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/remote-control',methods:['POST'],requestBody:'buffered',fetch:request=>controller.handleApi(request)}),'remote-control panel API');
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/remote-control/frame',methods:['GET'],requestBody:'buffered',fetch:request=>controller.handleFrame(request)}),'remote-control screen API');
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/remote-control/window',methods:['GET'],requestBody:'buffered',fetch:()=>new Response(remoteWindowHtml(),{headers:{...windowHeaders,'content-type':'text/html; charset=utf-8'}})}),'remote-control independent window');
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/remote-control/window.js',methods:['GET'],requestBody:'buffered',fetch:async()=>new Response(await readFile(new URL('./window.js',import.meta.url)),{headers:{...windowHeaders,'content-type':'text/javascript; charset=utf-8'}})}),'remote-control window bundle');
  registerTools(ctx,controller);
}
