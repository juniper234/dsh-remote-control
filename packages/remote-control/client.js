window.__ModuleLoader__.load({id:"dsh-remote-control",factory(require){var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/remote-control/client/source.jsx
var source_exports = {};
__export(source_exports, {
  ConnectCard: () => ConnectCard,
  DeviceWorkspace: () => DeviceWorkspace,
  Icon: () => Icon,
  RemoteControlPanel: () => RemoteControlPanel,
  RemoteWindow: () => RemoteWindow,
  ShareCard: () => ShareCard,
  apply: () => apply,
  desktopKey: () => desktopKey,
  draftKey: () => draftKey,
  filterSessions: () => filterSessions,
  frameUrl: () => frameUrl,
  inject: () => inject,
  pointerPosition: () => pointerPosition,
  requestRemote: () => requestRemote,
  safeMessage: () => safeMessage
});
module.exports = __toCommonJS(source_exports);
var import_react = __toESM(require("react"), 1);

// packages/remote-control/client/styles.mjs
var styles_default = `
.dsh-remote-control{--rc-bg:var(--dsw-alias-bg-layer-1,#fff);--rc-surface:var(--dsw-alias-bg-layer-2,#f7f8fa);--rc-raised:var(--dsw-alias-bg-layer-3,#fff);--rc-border:var(--dsw-alias-border-l2,#e2e5e9);--rc-text:var(--dsw-alias-label-primary,#20242b);--rc-muted:var(--dsw-alias-label-secondary,#606874);--rc-faint:var(--dsw-alias-label-tertiary,#717987);--rc-accent:var(--dsw-alias-brand-primary,#3566df);--rc-hover:var(--dsw-alias-interactive-bg-hover,#edf0f5);--rc-error:var(--dsw-alias-state-error-primary,#bf3546);--rc-success:var(--dsw-alias-state-success-primary,#25804f);--rc-warn:var(--dsw-alias-state-warn-primary,#9c650b);box-sizing:border-box;color:var(--rc-text);background:var(--rc-bg);font:13px/1.5 inherit;font-size:13px;line-height:1.5;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;overflow:hidden;text-align:left}
.dsh-remote-control *{box-sizing:border-box}.dsh-remote-control button,.dsh-remote-control input,.dsh-remote-control textarea,.dsh-remote-control select{font:inherit;color:inherit}.dsh-remote-control button{cursor:pointer;touch-action:manipulation}.dsh-remote-control button:disabled{cursor:not-allowed;opacity:.48}.dsh-remote-control :is(button,input,textarea,select,summary,[tabindex]):focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--rc-accent));outline-offset:3px}.dsh-remote-control h1,.dsh-remote-control h2,.dsh-remote-control h3,.dsh-remote-control p{margin:0}.dsh-remote-control h1{font-size:19px;font-weight:650;letter-spacing:-.4px}.dsh-remote-control h2{font-size:15px;font-weight:600;letter-spacing:-.15px}.dsh-remote-control h3{font-size:13px;font-weight:600}.dsh-remote-control svg{flex:none;vertical-align:middle}.dsh-remote-control .rc-muted{color:var(--rc-muted)}.dsh-remote-control .rc-tiny{font-size:12px;color:var(--rc-faint)}.dsh-remote-control .rc-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px 18px;border-bottom:1px solid var(--rc-border);flex:none}.dsh-remote-control .rc-topbar p{margin-top:3px;color:var(--rc-muted);font-size:12px}.dsh-remote-control .rc-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsh-remote-control .rc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--rc-border);border-radius:var(--dsw-radius-md,7px);min-height:36px;padding:7px 11px;line-height:20px;font-weight:500;background:var(--rc-bg);white-space:nowrap;transition:background-color 150ms,border-color 150ms,color 150ms}.dsh-remote-control .rc-btn:hover:not(:disabled){background:var(--rc-hover);border-color:var(--dsw-alias-border-l3,var(--rc-border))}.dsh-remote-control .rc-btn-primary{background:var(--rc-accent);border-color:var(--rc-accent);color:var(--dsw-alias-label-primary-foreground,#fff)}.dsh-remote-control .rc-btn-primary:hover:not(:disabled){background:var(--rc-accent);filter:brightness(1.08)}.dsh-remote-control .rc-btn-quiet{background:transparent;border-color:transparent;color:var(--rc-muted)}.dsh-remote-control .rc-btn-danger{color:var(--rc-error)}.dsh-remote-control .rc-icon-btn{width:36px;padding:0;flex:none}.dsh-remote-control .rc-body{display:flex;flex:1;min-height:0;min-width:0}.dsh-remote-control .rc-device-rail{width:238px;flex:none;padding:20px 14px;background:var(--rc-surface);border-right:1px solid var(--rc-border);overflow:auto}.dsh-remote-control .rc-section-label{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--rc-faint);padding:0 8px;margin-bottom:10px}.dsh-remote-control .rc-device-list{display:flex;flex-direction:column;gap:6px}.dsh-remote-control .rc-device{width:100%;display:flex;align-items:center;gap:10px;background:transparent;border:1px solid transparent;border-radius:var(--dsw-radius-lg,9px);padding:11px 10px;text-align:left;min-height:65px}.dsh-remote-control .rc-device:hover{background:var(--rc-hover)}.dsh-remote-control .rc-device[aria-pressed=true]{background:var(--rc-bg);border-color:var(--rc-border);box-shadow:0 1px 2px #00000005}.dsh-remote-control .rc-device-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border:1px solid var(--rc-border);background:var(--rc-raised);border-radius:8px;color:var(--rc-muted)}.dsh-remote-control .rc-device[aria-pressed=true] .rc-device-icon{color:var(--rc-accent)}.dsh-remote-control .rc-device-copy{min-width:0;display:flex;flex-direction:column;gap:2px;flex:1}.dsh-remote-control .rc-device-name{font-weight:600;overflow-wrap:anywhere}.dsh-remote-control .rc-device-address{font-size:11px;color:var(--rc-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-remote-control .rc-device-add{width:100%;justify-content:flex-start;margin-top:10px;font-size:12px}.dsh-remote-control .rc-rail-empty{padding:12px 8px;font-size:12px;color:var(--rc-muted)}.dsh-remote-control .rc-share{margin-top:24px;border-top:1px solid var(--rc-border);padding-top:15px}.dsh-remote-control .rc-share summary{display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:pointer;font-size:12px;font-weight:600;list-style:none;min-height:36px;padding:0 6px}.dsh-remote-control .rc-share summary::-webkit-details-marker{display:none}.dsh-remote-control .rc-share[open] .rc-share-chevron{transform:rotate(90deg)}.dsh-remote-control .rc-share-content{display:flex;flex-direction:column;gap:12px;padding:12px 6px 0}.dsh-remote-control .rc-switch-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsh-remote-control .rc-switch{width:32px;height:19px;min-height:19px;padding:2px;flex:none;border:0;border-radius:20px;background:var(--dsw-alias-border-l4,#c6cbd3)}.dsh-remote-control .rc-switch:before{content:'';display:block;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0002}.dsh-remote-control .rc-switch[aria-checked=true]{background:var(--rc-accent)}.dsh-remote-control .rc-switch[aria-checked=true]:before{transform:translateX(13px)}.dsh-remote-control .rc-share-meta{font-size:11px;color:var(--rc-muted);overflow-wrap:anywhere}.dsh-remote-control .rc-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsh-remote-control .rc-field label,.dsh-remote-control .rc-label{font-size:12px;font-weight:500}.dsh-remote-control :is(input:not([type=checkbox]),textarea,select){width:100%;min-width:0;background:var(--rc-bg);border:1px solid var(--rc-border);border-radius:var(--dsw-radius-md,7px);padding:8px 10px;min-height:36px;outline-offset:2px}.dsh-remote-control input::placeholder,.dsh-remote-control textarea::placeholder{color:var(--rc-faint)}.dsh-remote-control textarea{resize:vertical}.dsh-remote-control .rc-checkbox{display:flex;gap:8px;align-items:flex-start;font-size:12px}.dsh-remote-control input[type=checkbox]{accent-color:var(--rc-accent);margin:3px 0 0}.dsh-remote-control .rc-workspace{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}.dsh-remote-control .rc-workspace-head{padding:18px 22px 0;flex:none}.dsh-remote-control .rc-workspace-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.dsh-remote-control .rc-title-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dsh-remote-control .rc-address{margin-top:2px;font-size:12px;color:var(--rc-faint)}.dsh-remote-control .rc-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--rc-muted);white-space:nowrap}.dsh-remote-control .rc-status-dot{width:6px;height:6px;border-radius:50%;background:var(--rc-faint)}.dsh-remote-control .rc-status[data-state=online]{color:var(--rc-success)}.dsh-remote-control .rc-status[data-state=online] .rc-status-dot{background:var(--rc-success)}.dsh-remote-control .rc-status[data-state=error]{color:var(--rc-error)}.dsh-remote-control .rc-status[data-state=error] .rc-status-dot{background:var(--rc-error)}.dsh-remote-control .rc-tabs{display:flex;gap:22px;border-bottom:1px solid var(--rc-border)}.dsh-remote-control .rc-tab{display:flex;align-items:center;gap:7px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--rc-muted);padding:10px 1px 12px;font-weight:500}.dsh-remote-control .rc-tab[aria-selected=true]{border-bottom-color:var(--rc-accent);color:var(--rc-text)}.dsh-remote-control .rc-workspace-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}.dsh-remote-control .rc-banner{display:flex;align-items:flex-start;gap:8px;border:1px solid var(--rc-border);border-radius:8px;padding:10px 12px;font-size:12px;overflow-wrap:anywhere;background:var(--rc-surface);margin:12px 22px 0}.dsh-remote-control .rc-banner[data-kind=error]{color:var(--rc-error)}.dsh-remote-control .rc-banner svg{margin-top:2px}.dsh-remote-control .rc-banner p{flex:1}.dsh-remote-control .rc-banner .rc-dismiss{border:0;background:transparent;color:inherit;padding:0 2px;line-height:18px}.dsh-remote-control .rc-sessions{display:flex;flex:1;min-height:0;min-width:0}.dsh-remote-control .rc-session-rail{width:250px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--rc-border);padding:18px 12px 12px 22px;gap:12px;min-height:0}.dsh-remote-control .rc-search{position:relative}.dsh-remote-control .rc-search svg{position:absolute;left:10px;top:11px;color:var(--rc-faint);pointer-events:none}.dsh-remote-control .rc-search input{padding-left:32px;background:var(--rc-surface);font-size:12px}.dsh-remote-control .rc-sessions-caption{display:flex;align-items:center;justify-content:space-between;color:var(--rc-faint);font-size:11px}.dsh-remote-control .rc-session-list{overflow:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:4px}.dsh-remote-control .rc-session-item{width:100%;border:1px solid transparent;border-radius:8px;background:transparent;padding:10px 9px;text-align:left;display:flex;flex-direction:column;gap:6px}.dsh-remote-control .rc-session-item:hover{background:var(--rc-hover)}.dsh-remote-control .rc-session-item[aria-pressed=true]{border-color:var(--rc-border);background:var(--rc-surface)}.dsh-remote-control .rc-session-title{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;font-weight:500;font-size:12px;overflow-wrap:anywhere}.dsh-remote-control .rc-session-path{font-size:11px;color:var(--rc-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsh-remote-control .rc-running{color:var(--rc-accent);display:flex;align-items:center;gap:5px;flex:none;font-size:10px}.dsh-remote-control .rc-running-dot{height:5px;width:5px;border-radius:50%;background:currentColor}.dsh-remote-control .rc-chat{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}.dsh-remote-control .rc-chat-head{padding:15px 22px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--rc-border)}.dsh-remote-control .rc-chat-head h3{overflow-wrap:anywhere}.dsh-remote-control .rc-chat-head p{margin-top:3px;font-size:11px;color:var(--rc-faint);overflow-wrap:anywhere}.dsh-remote-control .rc-transcript{overflow:auto;flex:1;min-height:0;padding:22px;scrollbar-gutter:stable}.dsh-remote-control .rc-message{max-width:860px;margin:0 auto 24px;display:flex;gap:11px}.dsh-remote-control .rc-message-avatar{height:25px;width:25px;border:1px solid var(--rc-border);border-radius:7px;display:grid;place-items:center;font-size:10px;font-weight:600;color:var(--rc-muted);flex:none}.dsh-remote-control .rc-message[data-role=user] .rc-message-avatar{color:var(--rc-accent);background:var(--rc-surface)}.dsh-remote-control .rc-message-content{min-width:0;flex:1}.dsh-remote-control .rc-message-meta{display:flex;align-items:center;gap:9px;font-size:11px;margin:1px 0 7px;font-weight:600}.dsh-remote-control .rc-message-meta time{font-size:10px;font-weight:400;color:var(--rc-faint)}.dsh-remote-control .rc-message-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.7}.dsh-remote-control .rc-message[data-role=tool] .rc-message-text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;background:var(--rc-surface);border:1px solid var(--rc-border);padding:10px;border-radius:7px;max-height:300px;overflow:auto}.dsh-remote-control .rc-composer-area{padding:0 22px 16px;flex:none}.dsh-remote-control .rc-composer{border:1px solid var(--rc-border);border-radius:var(--dsw-radius-lg,10px);background:var(--rc-surface);overflow:hidden}.dsh-remote-control .rc-composer:focus-within{border-color:var(--rc-accent)}.dsh-remote-control .rc-composer textarea{border:0;outline:none!important;background:transparent;border-radius:0;min-height:86px;max-height:240px;padding:13px 14px;resize:vertical;display:block}.dsh-remote-control .rc-composer-bottom{display:flex;align-items:center;justify-content:space-between;padding:0 10px 10px;gap:10px}.dsh-remote-control .rc-composer-bottom select{width:auto;min-height:30px;font-size:11px;border:0;background:transparent;padding:4px}.dsh-remote-control .rc-composer-hint{display:flex;justify-content:space-between;gap:8px;color:var(--rc-faint);font-size:10px;margin:7px 2px 0}.dsh-remote-control .rc-empty{display:flex;flex:1;align-items:center;justify-content:center;text-align:center;padding:36px 24px;min-height:200px}.dsh-remote-control .rc-empty-inner{max-width:340px}.dsh-remote-control .rc-empty-symbol{display:grid;place-items:center;width:48px;height:48px;background:var(--rc-surface);border:1px solid var(--rc-border);border-radius:12px;color:var(--rc-faint);margin:0 auto 16px}.dsh-remote-control .rc-empty h2,.dsh-remote-control .rc-empty h3{margin-bottom:6px}.dsh-remote-control .rc-empty p{color:var(--rc-muted);font-size:12px;line-height:1.7;margin-bottom:16px}.dsh-remote-control .rc-list-empty{padding:20px 8px;text-align:center;font-size:12px;color:var(--rc-muted)}.dsh-remote-control .rc-desktop{padding:18px 22px;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;overflow:auto}.dsh-remote-control .rc-desktop-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.dsh-remote-control .rc-monitor-select{display:flex;align-items:center;gap:8px;min-width:0}.dsh-remote-control .rc-monitor-select select{width:auto;max-width:300px;font-size:12px}.dsh-remote-control .rc-control-toggle[aria-pressed=true]{background:var(--rc-accent);border-color:var(--rc-accent);color:var(--dsw-alias-label-primary-foreground,#fff)}.dsh-remote-control .rc-screen-stage{border:1px solid var(--rc-border);border-radius:9px;min-height:180px;flex:1;background:var(--dsw-alias-bg-module-platform,var(--rc-surface));display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:12px}.dsh-remote-control .rc-screen{position:relative;max-width:100%;width:100%;flex:none;background:var(--rc-surface);line-height:0;outline-offset:3px;max-height:100%;user-select:none}.dsh-remote-control .rc-screen[data-control=true]{cursor:crosshair;touch-action:none}.dsh-remote-control .rc-screen img{display:block;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none}.dsh-remote-control .rc-screen-placeholder{display:flex;align-items:center;justify-content:center;text-align:center;min-height:180px;line-height:1.5;color:var(--rc-muted);font-size:12px}.dsh-remote-control .rc-desktop-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--rc-faint)}.dsh-remote-control .rc-control-note{border:1px solid var(--rc-border);border-radius:7px;padding:9px 11px;background:var(--rc-surface);font-size:12px;color:var(--rc-muted)}.dsh-remote-control .rc-text-entry{display:flex;align-items:flex-end;gap:8px}.dsh-remote-control .rc-text-entry .rc-field{flex:1}.dsh-remote-control .rc-shortcuts{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.dsh-remote-control .rc-shortcuts .rc-btn{font-size:11px;min-height:30px;padding:4px 8px}.dsh-remote-control .rc-overlay{position:absolute;inset:0;background:#0005;z-index:10;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.dsh-remote-control .rc-dialog{background:var(--rc-bg);border:1px solid var(--rc-border);border-radius:var(--dsw-radius-lg,12px);box-shadow:0 16px 70px #0003;width:480px;max-width:100%;max-height:100%;overflow:auto}.dsh-remote-control .rc-dialog-head{padding:20px 22px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.dsh-remote-control .rc-dialog-body{display:flex;flex-direction:column;gap:15px;padding:0 22px 22px}.dsh-remote-control .rc-dialog-body>p{font-size:12px;color:var(--rc-muted)}.dsh-remote-control .rc-dialog-foot{border-top:1px solid var(--rc-border);padding:15px 22px;display:flex;align-items:center;justify-content:flex-end;gap:8px}.dsh-remote-control .rc-dialog-foot .rc-btn-danger{margin-right:auto}.dsh-remote-control .rc-input-with-button{display:flex;gap:6px}.dsh-remote-control .rc-input-with-button input{flex:1}.dsh-remote-control .rc-inline-error{color:var(--rc-error);font-size:12px;overflow-wrap:anywhere}.dsh-remote-control .rc-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dsh-remote-control .rc-skeleton{height:55px;border-radius:8px;background:var(--dsw-alias-bg-skeleton,var(--rc-surface));margin-bottom:7px}.dsh-remote-control .rc-load-more{display:flex;justify-content:center;margin-bottom:22px}.dsh-remote-control .rc-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:1100px){.dsh-remote-control .rc-device-rail{width:205px}.dsh-remote-control .rc-session-rail{width:210px;padding-left:16px}.dsh-remote-control .rc-topbar{padding:17px 20px}.dsh-remote-control .rc-workspace-head{padding:16px 18px 0}.dsh-remote-control .rc-chat-head,.dsh-remote-control .rc-transcript{padding:16px}.dsh-remote-control .rc-composer-area{padding:0 16px 14px}.dsh-remote-control .rc-desktop{padding:16px 18px}}
@media(max-width:800px){.dsh-remote-control .rc-device-rail{width:180px;padding:16px 10px}.dsh-remote-control .rc-session-rail{width:180px;padding:14px 10px}.dsh-remote-control .rc-device{padding:9px 7px;gap:7px}.dsh-remote-control .rc-device-icon{width:28px;height:28px}.dsh-remote-control .rc-device-name{font-size:12px}.dsh-remote-control .rc-workspace-title{gap:6px}.dsh-remote-control .rc-workspace-title>.rc-actions{gap:3px}.dsh-remote-control .rc-title-line{gap:6px}}
@media(max-width:650px){.dsh-remote-control{overflow:auto;min-height:100%;height:auto}.dsh-remote-control .rc-topbar{padding:16px;align-items:flex-start}.dsh-remote-control .rc-topbar h1{font-size:17px}.dsh-remote-control .rc-topbar .rc-top-refresh{display:none}.dsh-remote-control .rc-body{flex-direction:column;overflow:visible}.dsh-remote-control .rc-device-rail{width:100%;border-right:0;border-bottom:1px solid var(--rc-border);padding:12px 16px;overflow:visible}.dsh-remote-control .rc-section-label{margin-bottom:7px;padding:0}.dsh-remote-control .rc-device-list{flex-direction:row;overflow-x:auto;padding:2px 2px 5px}.dsh-remote-control .rc-device{width:190px;min-width:170px;min-height:58px}.dsh-remote-control .rc-device-add{width:auto;margin-top:4px;min-height:32px}.dsh-remote-control .rc-share{margin-top:9px;padding-top:6px}.dsh-remote-control .rc-share summary{padding:0}.dsh-remote-control .rc-share-content{padding:10px 0 4px;max-width:360px}.dsh-remote-control .rc-workspace-head{padding:16px 16px 0}.dsh-remote-control .rc-workspace-title{margin-bottom:9px}.dsh-remote-control .rc-workspace-title .rc-check-label{display:none}.dsh-remote-control .rc-workspace-content{min-height:440px}.dsh-remote-control .rc-sessions{flex-direction:column}.dsh-remote-control .rc-session-rail{width:100%;border-right:0;border-bottom:1px solid var(--rc-border);padding:12px 16px;gap:8px}.dsh-remote-control .rc-session-list{flex-direction:row;overflow-x:auto;max-height:100px;min-height:58px;flex:none}.dsh-remote-control .rc-session-item{min-width:170px;max-width:200px;padding:8px;flex:none}.dsh-remote-control .rc-session-rail>.rc-btn{min-height:34px}.dsh-remote-control .rc-chat{min-height:360px}.dsh-remote-control .rc-transcript{max-height:60dvh;min-height:150px}.dsh-remote-control .rc-chat-head{padding:13px 16px}.dsh-remote-control .rc-banner{margin:10px 16px 0}.dsh-remote-control .rc-desktop{padding:14px 16px;min-height:420px}.dsh-remote-control .rc-screen-stage{min-height:200px;flex:none;padding:6px}.dsh-remote-control .rc-monitor-select select{max-width:180px}.dsh-remote-control .rc-text-entry{align-items:stretch;flex-direction:column}.dsh-remote-control .rc-dialog{max-height:90dvh}.dsh-remote-control .rc-overlay{position:fixed;padding:14px}.dsh-remote-control :is(input:not([type=checkbox]),textarea,select){font-size:16px;min-height:42px}.dsh-remote-control .rc-btn{min-height:40px}.dsh-remote-control .rc-composer-bottom select{font-size:13px}.dsh-remote-control .rc-form-grid{grid-template-columns:1fr}}
.dsh-remote-control.rc-setup-page{position:relative;min-height:520px}.dsh-remote-control .rc-eyebrow{font-size:10px;letter-spacing:1.6px;font-weight:600;color:var(--rc-faint);margin-bottom:8px}.dsh-remote-control.rc-setup-page .rc-topbar{padding:30px 36px 24px}.dsh-remote-control.rc-setup-page .rc-topbar h1{font-size:27px;font-weight:600;letter-spacing:-.7px}.dsh-remote-control .rc-top-icon{display:grid;place-items:center;width:54px;height:54px;border:1px solid var(--rc-border);border-radius:15px;color:var(--rc-muted)}.dsh-remote-control .rc-setup-scroll{flex:1;min-height:0;overflow:auto;padding:26px 36px 30px}.dsh-remote-control .rc-pair-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;max-width:1160px;margin:auto}.dsh-remote-control .rc-pair-card{min-width:0;border:1px solid var(--rc-border);border-radius:16px;padding:26px;background:linear-gradient(145deg,var(--rc-surface),var(--rc-bg));display:flex;flex-direction:column;gap:16px;box-shadow:0 8px 24px #00000005}.dsh-remote-control .rc-card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px}.dsh-remote-control .rc-card-symbol{display:grid;place-items:center;width:45px;height:45px;border:1px solid var(--rc-border);border-radius:12px;background:var(--rc-raised);color:var(--rc-accent)}.dsh-remote-control .rc-pair-card>h2{font-size:19px;font-weight:600;letter-spacing:-.3px;margin:0}.dsh-remote-control .rc-card-intro{font-size:13px;color:var(--rc-muted);line-height:1.65;margin-top:-8px;min-height:43px;max-width:460px}.dsh-remote-control .rc-setup-form{display:flex;flex-direction:column;gap:16px;flex:1}.dsh-remote-control .rc-setup-form .rc-field{gap:7px}.dsh-remote-control .rc-setup-form input:not([type=checkbox]){min-height:43px;border-radius:9px}.dsh-remote-control .rc-access-option{display:flex;gap:10px;padding:13px;border:1px solid var(--rc-border);border-radius:9px;background:var(--rc-bg);cursor:pointer}.dsh-remote-control .rc-access-option span{display:flex;flex-direction:column;gap:3px}.dsh-remote-control .rc-access-option strong{font-size:12px;font-weight:500}.dsh-remote-control .rc-access-option small{font-size:11px;color:var(--rc-muted);line-height:1.5}.dsh-remote-control .rc-access-option input{margin-top:3px}.dsh-remote-control .rc-advanced summary{font-size:12px;color:var(--rc-muted);cursor:pointer;list-style:revert;min-height:26px}.dsh-remote-control .rc-advanced .rc-field{padding-top:10px}.dsh-remote-control .rc-privacy-note{font-size:11px;color:var(--rc-faint);line-height:1.65}.dsh-remote-control .rc-wide{width:100%;min-height:42px;justify-content:center}.dsh-remote-control .rc-step-label{font-size:11px;color:var(--rc-faint)}.dsh-remote-control .rc-code-box{border:1px solid var(--rc-border);border-radius:11px;padding:14px;display:flex;flex-direction:column;gap:11px;background:var(--rc-bg)}.dsh-remote-control .rc-code-label{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px}.dsh-remote-control .rc-code-label>span{color:var(--rc-muted)}.dsh-remote-control .rc-code-box textarea{font:11px/1.6 ui-monospace,Consolas,monospace;resize:none;word-break:break-all;min-height:76px;color:var(--rc-muted)}.dsh-remote-control .rc-paste-code{min-height:126px;font:12px/1.7 ui-monospace,Consolas,monospace;resize:vertical;overflow-wrap:anywhere}.dsh-remote-control .rc-card-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid var(--rc-border);padding-top:12px;margin-top:2px}.dsh-remote-control .rc-handoff-card{border:1px solid var(--rc-border);border-radius:11px;background:var(--rc-raised);padding:15px;display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px}.dsh-remote-control .rc-handoff-card>div{flex:1;min-width:180px}.dsh-remote-control .rc-handoff-card strong{font-size:13px}.dsh-remote-control .rc-handoff-card p{font-size:12px;color:var(--rc-muted);margin-top:4px}.dsh-remote-control .rc-handoff-card>.rc-btn{width:100%}.dsh-remote-control .rc-connected-result{display:flex;gap:12px;align-items:center;background:var(--rc-bg);border:1px solid var(--rc-border);padding:13px;border-radius:10px}.dsh-remote-control .rc-connected-result>svg{color:var(--rc-success);flex:none}.dsh-remote-control .rc-connected-result>span{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}.dsh-remote-control .rc-connected-result strong{font-size:12px;overflow-wrap:anywhere}.dsh-remote-control .rc-connected-result small{font-size:11px;color:var(--rc-muted)}.dsh-remote-control .rc-saved{max-width:1160px;margin:30px auto 0}.dsh-remote-control .rc-saved-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}.dsh-remote-control .rc-saved-heading h2{font-size:14px;font-weight:600}.dsh-remote-control .rc-saved-heading p{font-size:12px;color:var(--rc-muted);margin-top:3px}.dsh-remote-control .rc-saved-list{display:flex;flex-direction:column;gap:10px}.dsh-remote-control .rc-saved-device{display:flex;gap:13px;align-items:center;border:1px solid var(--rc-border);border-radius:11px;padding:14px 16px;background:var(--rc-surface)}.dsh-remote-control .rc-saved-copy{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.dsh-remote-control .rc-saved-copy strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.dsh-remote-control .rc-saved-copy small{font-size:11px;color:var(--rc-faint);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.dsh-remote-control .rc-saved-empty{display:flex;gap:10px;align-items:center;justify-content:center;padding:24px;border:1px dashed var(--rc-border);border-radius:11px;font-size:12px;color:var(--rc-faint)}.dsh-remote-control .rc-setup-footnote{font-size:11px;color:var(--rc-faint);text-align:center;margin:22px auto 0}.dsh-remote-control .rc-window-bar{padding:14px 20px;display:flex;align-items:center;gap:22px;border-bottom:1px solid var(--rc-border);background:var(--rc-surface);flex:none;min-height:66px}.dsh-remote-control .rc-window-brand{display:flex;align-items:center;gap:10px}.dsh-remote-control .rc-window-brand strong{font-size:19px;font-weight:650;letter-spacing:-.6px}.dsh-remote-control .rc-window-brand strong span{font:600 9px system-ui;letter-spacing:1px;border:1px solid var(--rc-border);border-radius:4px;padding:3px 5px;vertical-align:middle;margin-left:6px;color:var(--rc-muted)}.dsh-remote-control .rc-window-status{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--rc-muted);flex:1}.dsh-remote-control.rc-remote-window{height:100dvh;min-height:480px}.dsh-remote-control.rc-remote-window .rc-workspace-head{padding-top:22px}
@media(max-width:900px){.dsh-remote-control.rc-setup-page .rc-topbar{padding:24px}.dsh-remote-control .rc-setup-scroll{padding:22px 24px}.dsh-remote-control .rc-pair-card{padding:20px}.dsh-remote-control .rc-pair-grid{gap:16px}.dsh-remote-control .rc-card-heading{flex-wrap:wrap}.dsh-remote-control .rc-window-bar{gap:12px;flex-wrap:wrap}.dsh-remote-control .rc-window-status{min-width:100px}.dsh-remote-control .rc-window-brand strong{font-size:17px}}
@media(max-width:720px){.dsh-remote-control .rc-pair-grid{grid-template-columns:1fr}.dsh-remote-control .rc-setup-scroll{padding:18px}.dsh-remote-control.rc-setup-page .rc-topbar{padding:22px 18px}.dsh-remote-control.rc-setup-page .rc-topbar h1{font-size:24px}.dsh-remote-control .rc-card-intro{min-height:0}.dsh-remote-control .rc-saved-device{flex-wrap:wrap}.dsh-remote-control .rc-saved-device>.rc-btn-primary{order:2;flex:1;min-width:100%}.dsh-remote-control .rc-top-icon{display:none}.dsh-remote-control .rc-window-bar>.rc-actions{width:100%;justify-content:flex-end}.dsh-remote-control.rc-remote-window{height:auto;min-height:100dvh}.dsh-remote-control .rc-connected-result{flex-wrap:wrap}}
.dsh-remote-control .rc-mobile-sessions,.dsh-remote-control .rc-mobile-picker-head{display:none}
.dsh-remote-control .rc-chat-heading{min-width:0;flex:1}
@media(max-width:720px),(max-height:500px) and (pointer:coarse){
  .dsh-remote-control.rc-remote-window{height:var(--rc-viewport-height,100dvh);min-height:0;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0px)}
  .dsh-remote-control .rc-workspace,.dsh-remote-control .rc-workspace-content,.dsh-remote-control .rc-chat{min-height:0;overflow:hidden}
  .dsh-remote-control.rc-remote-window .rc-workspace-head,.dsh-remote-control .rc-workspace-head{padding:10px 12px 0;flex:none}
  .dsh-remote-control .rc-workspace-title{margin-bottom:6px}
  .dsh-remote-control .rc-sessions{flex-direction:column;overflow:hidden}
  .dsh-remote-control .rc-mobile-sessions{display:inline-flex;flex:none}
  .dsh-remote-control .rc-mobile-picker-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex:none}
  .dsh-remote-control .rc-session-rail{width:100%;border:0;padding:10px 12px;gap:8px;flex:1;overflow:hidden}
  .dsh-remote-control .rc-session-list{flex:1;flex-direction:column;overflow-y:auto;overflow-x:hidden;max-height:none;min-height:0;overscroll-behavior:contain}
  .dsh-remote-control .rc-session-item{width:100%;max-width:none;min-width:0;min-height:54px;padding:10px;flex:none}
  .dsh-remote-control .rc-sessions[data-mobile-view=chat]>.rc-session-rail{display:none}
  .dsh-remote-control .rc-sessions[data-mobile-view=sessions]>.rc-chat,.dsh-remote-control .rc-sessions[data-mobile-view=sessions]>.rc-empty{display:none}
  .dsh-remote-control .rc-chat-head{padding:8px 12px;gap:8px;align-items:center;flex:none}
  .dsh-remote-control .rc-chat-head p{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
  .dsh-remote-control .rc-chat-head .rc-actions{gap:4px}
  .dsh-remote-control .rc-chat-head .rc-running{display:none}
  .dsh-remote-control .rc-transcript{max-height:none;min-height:0;padding:14px 12px;overscroll-behavior:contain}
  .dsh-remote-control .rc-composer-area{padding:0 12px 8px}
  .dsh-remote-control .rc-composer textarea{min-height:54px;max-height:120px;font-size:16px;resize:none}
  .dsh-remote-control .rc-composer-hint>span:last-child{display:none}
  .dsh-remote-control .rc-btn{min-height:44px}
  .dsh-remote-control .rc-window-bar{padding:8px 12px;min-height:0;gap:6px 12px;flex:none}
  .dsh-remote-control .rc-window-bar>.rc-actions{gap:6px;justify-content:space-between}
  .dsh-remote-control .rc-banner{margin:6px 12px;max-height:84px;overflow:auto;flex:none}
  .dsh-remote-control .rc-desktop{min-height:0}
}
@media(max-width:720px) and (max-height:500px),(max-height:500px) and (pointer:coarse){
  .dsh-remote-control .rc-window-brand,.dsh-remote-control .rc-workspace-title,.dsh-remote-control .rc-chat-head p,.dsh-remote-control .rc-composer-hint{display:none}
  .dsh-remote-control .rc-window-bar{flex-wrap:nowrap}
  .dsh-remote-control .rc-window-status{font-size:11px;min-width:60px}
  .dsh-remote-control .rc-window-bar>.rc-actions{width:auto;flex-wrap:nowrap}
  .dsh-remote-control.rc-remote-window .rc-workspace-head,.dsh-remote-control .rc-workspace-head{padding-top:0}
  .dsh-remote-control .rc-composer textarea{min-height:44px;max-height:60px;padding:8px 12px}
  .dsh-remote-control .rc-composer-bottom{padding-bottom:4px}
}
@media(prefers-reduced-motion:reduce){.dsh-remote-control *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
`;

// packages/remote-control/client/helpers.mjs
var API_PATH = "/api/remote-control";
function safeMessage(error, fallback = "The request could not be completed. Try again when the device is connected.") {
  const raw = typeof error === "string" ? error : error?.message;
  if (!raw || error?.name === "AbortError") return fallback;
  return String(raw).replace(/\bDSH1\.[A-Za-z0-9._-]+/g, "[hidden connection code]").replace(/([?&](?:k|token)=)[^&\s"']+/gi, "$1[hidden]").replace(/(bearer\s+)[^\s"']+/gi, "$1[hidden]").replace(/((?:token|x-companion-token|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[hidden]").slice(0, 400);
}
async function requestRemote(action, args = {}, { signal, fetchImpl = globalThis.fetch, timeout = 15e3 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetchImpl(API_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-dsh-remote-control": "1" },
      body: JSON.stringify({ action, ...args }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      const error = new Error(safeMessage(data?.error, response.status === 401 ? "Your DSH sign-in has expired. Sign in again, then reconnect." : "The device did not complete the request. Check the connection and try again."));
      error.code = data?.error?.code || `HTTP_${response.status}`;
      throw error;
    }
    return data.value;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      const timeoutError = new Error("The request timed out. Its outcome may be unknown. Check the device before sending it again.");
      timeoutError.code = "TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() || `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function draftKey(remoteId, sessionId) {
  return JSON.stringify([remoteId || "", sessionId || ""]);
}
function frameUrl(remoteId, monitorId, maxWidth = 1280) {
  const query = new URLSearchParams({ remoteId, monitorId, maxWidth: String(maxWidth) });
  return `${API_PATH}/frame?${query}`;
}
function pointerPosition(rect, event, monitor) {
  if (!monitor || rect.width <= 0 || rect.height <= 0) return null;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  return {
    x: Math.round(monitor.x + clamp((event.clientX - rect.left) / rect.width) * Math.max(0, monitor.width - 1)),
    y: Math.round(monitor.y + clamp((event.clientY - rect.top) / rect.height) * Math.max(0, monitor.height - 1))
  };
}
var keys = /* @__PURE__ */ new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "Enter",
  "Escape",
  "Tab",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Pause",
  "PrintScreen",
  "ContextMenu",
  " ",
  "Space",
  ";",
  "=",
  ",",
  "-",
  ".",
  "/",
  "`",
  "[",
  "\\",
  "]",
  "'"
]);
var physicalPunctuation = {
  Semicolon: ";",
  Equal: "=",
  Comma: ",",
  Minus: "-",
  Period: ".",
  Slash: "/",
  Backquote: "`",
  BracketLeft: "[",
  Backslash: "\\",
  BracketRight: "]",
  Quote: "'",
  Space: " "
};
function desktopKey(key, code) {
  if (typeof key !== "string") return null;
  if (typeof code === "string") {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (Object.hasOwn(physicalPunctuation, code)) return physicalPunctuation[code];
  }
  return keys.has(key) || /^[a-zA-Z0-9]$/.test(key) || /^F(?:[1-9]|1[0-2])$/.test(key) ? key : null;
}
function deviceAddress(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return "Saved connection";
  }
}
function formatTime(value) {
  if (value == null) return "";
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1e3 : value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit" }).format(date);
}
function filterSessions(sessions, query) {
  const search = query.trim().toLocaleLowerCase();
  return search ? sessions.filter((item) => `${item.title || ""} ${item.cwd || ""}`.toLocaleLowerCase().includes(search)) : sessions;
}
function canPromptSession(connectionMode, agentAvailable) {
  return connectionMode !== "web" || agentAvailable !== false;
}
function createDesktopInputQueue({ remoteId, request = requestRemote, onFailure = () => {
} }) {
  let generation = 0, active = false, queue = Promise.resolve();
  const held = /* @__PURE__ */ new Set(), buttons = /* @__PURE__ */ new Set();
  function release(keepActive = false) {
    const hadControl = active || held.size || buttons.size;
    generation++;
    active = keepActive;
    held.clear();
    buttons.clear();
    if (!hadControl) return queue;
    queue = queue.catch(() => {
    }).then(() => request("desktop.release", { remoteId }, { timeout: 8e3 })).catch(() => {
    });
    return queue;
  }
  function send(input) {
    if (!active) return Promise.resolve(false);
    const currentGeneration = generation;
    if (input.type === "key") input.down ? held.add(input.key) : held.delete(input.key);
    if (input.type === "button") input.down ? buttons.add(input.button) : buttons.delete(input.button);
    const operation = queue.catch(() => {
    }).then(async () => {
      if (!active || generation !== currentGeneration) return false;
      try {
        await request("desktop.input", { remoteId, eventId: makeRequestId(), input }, { timeout: 8e3 });
        return true;
      } catch (error) {
        if (generation === currentGeneration) {
          release();
          onFailure(error);
        }
        return false;
      }
    });
    queue = operation;
    return operation;
  }
  return { enable: () => {
    active = true;
  }, send, release };
}

// packages/remote-control/client/pairing.mjs
async function openRemoteWindow(remoteId, request = requestRemote) {
  const result = await request("window.open", { remoteId }, { timeout: 2e4 });
  if (result?.opened !== true) throw new Error("The remote window could not be opened. Choose Open remote window to try again.");
  return result;
}
function invitationLifetime(preset, value, unit = "minutes") {
  if (preset === "never") return null;
  if (preset === "30min") return 30 * 60 * 1e3;
  if (preset === "1hr") return 60 * 60 * 1e3;
  const factors = { minutes: 6e4, hours: 36e5, days: 864e5 };
  const numeric = Number(value);
  const milliseconds = numeric * factors[unit];
  if (preset !== "custom" || String(value).trim() === "" || !Object.hasOwn(factors, unit) || !Number.isFinite(numeric) || numeric <= 0 || !Number.isSafeInteger(milliseconds) || milliseconds <= 0 || !Number.isSafeInteger(Date.now() + milliseconds)) throw new Error("Enter a positive custom duration in minutes, hours or days.");
  return milliseconds;
}
function expiryText(expiresAt, now = Date.now(), useLimit = "once") {
  const uses = useLimit === "unlimited" ? "unlimited uses" : "one use";
  if (expiresAt === null) return `No expiry \xB7 ${uses}`;
  const remaining = Math.max(0, Math.ceil((Number(expiresAt) - now) / 1e3));
  if (!Number.isFinite(remaining) || remaining === 0) return "Code expired. Generate a new one.";
  const duration = remaining >= 86400 ? `${Math.floor(remaining / 86400)}d ${Math.floor(remaining % 86400 / 3600)}h` : remaining >= 3600 ? `${Math.floor(remaining / 3600)}h ${Math.floor(remaining % 3600 / 60)}m` : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return `Expires in ${duration} \xB7 ${uses}`;
}
function watchControl({
  remoteId,
  request = requestRemote,
  onChange,
  schedule = setTimeout,
  unschedule = clearTimeout,
  interval = 8e3
}) {
  let stopped = false, timer, held = false, renewalFailed = false;
  const controller = new AbortController();
  const tick = async () => {
    try {
      const action = held && !renewalFailed ? "control.heartbeat" : "control.status";
      const value = await request(action, { remoteId }, { signal: controller.signal, timeout: 1e4 });
      if (stopped) return;
      held = value?.heldByYou === true && !renewalFailed;
      onChange({ value: { ...value, heldByYou: held }, error: "" });
    } catch (error) {
      if (stopped) return;
      held = false;
      renewalFailed = true;
      onChange({ value: { owner: "local", heldByYou: false }, error });
    } finally {
      if (!stopped) timer = schedule(tick, interval);
    }
  };
  tick();
  return () => {
    stopped = true;
    controller.abort();
    unschedule(timer);
  };
}
async function releaseRemote(remoteId, request = requestRemote) {
  try {
    await request("desktop.release", { remoteId }, { timeout: 4e3 });
  } catch {
  }
  return request("control.release", { remoteId }, { timeout: 8e3 });
}
function installLocalHandoffBanner({
  document: doc = globalThis.document,
  request = requestRemote,
  schedule = setTimeout,
  unschedule = clearTimeout
} = {}) {
  if (!doc?.body) return () => {
  };
  const banner = doc.createElement("aside");
  banner.setAttribute("aria-label", "Remote control handoff");
  banner.setAttribute("role", "status");
  banner.className = "dsh-remote-handoff";
  banner.hidden = true;
  banner.style.cssText = "position:fixed;z-index:2147483000;bottom:20px;left:50%;transform:translateX(-50%);width:min(620px,calc(100% - 32px));box-sizing:border-box;padding:14px 16px;border:1px solid #535a71;border-radius:14px;background:#1b1e29f5;box-shadow:0 14px 50px #0005;color:#f3f4f8;font:13px/1.5 system-ui;display:flex;align-items:center;gap:14px";
  banner.style.display = "none";
  const copy = doc.createElement("span");
  copy.style.flex = "1";
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Take back control";
  button.style.cssText = "border:0;border-radius:8px;background:#e5e9ff;color:#171a29;padding:10px 13px;font:600 13px system-ui;cursor:pointer;white-space:nowrap";
  banner.append(copy, button);
  doc.body.append(banner);
  let stopped = false, timer, busy = false, generation = 0;
  const controller = new AbortController();
  const render = (state) => {
    const remote = state?.control?.owner === "remote";
    banner.hidden = !remote;
    banner.style.display = remote ? "flex" : "none";
    if (remote) copy.textContent = `${state.control.label || "Another computer"} is controlling DSH. Local chat actions are paused.`;
  };
  const tick = async () => {
    const current = generation;
    try {
      const state = await request("sharing.status", {}, { signal: controller.signal });
      if (!stopped && current === generation) render(state);
    } catch {
    } finally {
      if (!stopped) timer = schedule(tick, 2e3);
    }
  };
  button.onclick = async () => {
    if (busy) return;
    busy = true;
    generation++;
    button.disabled = true;
    button.textContent = "Taking back\u2026";
    try {
      const state = await request("sharing.reclaim", {}, { signal: controller.signal });
      if (!stopped) render(state);
    } catch {
      if (!stopped) copy.textContent = "Could not confirm control was returned. Keep DSH open and try Take back control again.";
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "Take back control";
    }
  };
  tick();
  return () => {
    stopped = true;
    controller.abort();
    unschedule(timer);
    banner.remove();
  };
}

// packages/remote-control/client/source.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var paths = {
  monitor: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "13", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 21h8m-4-4v4" })
  ] }),
  sessions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 10h8m-8 4h5" })
  ] }),
  plus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" }),
  refresh: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 7v5h-5M4 17v-5h5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17" })
  ] }),
  chevron: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m9 5 7 7-7 7" }),
  close: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 6 12 12M6 18 18 6" }),
  search: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10.5", cy: "10.5", r: "6.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m16 16 4 4" })
  ] }),
  send: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 12 7-7 7 7M12 5v15" }) }),
  stop: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2" }),
  warning: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10.3 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-14a2 2 0 0 0-3.4 0Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 8v5m0 4h.01" })
  ] }),
  link: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10 13 4-4m-6 7-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0m2 10a4.2 4.2 0 0 0 6 0l4-4a4.2 4.2 0 0 0-6-6l-1 1" }) }),
  copy: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "8", y: "8", width: "12", height: "13", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" })
  ] }),
  edit: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m15 4 5 5M4 20l4-1 12-12a3.5 3.5 0 0 0-5-5L3 14l-1 6 6-1" }) }),
  cursor: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 3 7 18 3-7 7-3L4 3Z" }),
  eye: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3" })
  ] }),
  keyboard: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" })
  ] })
};
function Icon({ name = "monitor", size = 16, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props, children: paths[name] || paths.monitor });
}
function Button({ icon, children, primary, quiet, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: `rc-btn ${primary ? "rc-btn-primary" : ""} ${quiet ? "rc-btn-quiet" : ""} ${className}`, ...props, children: [
    icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: icon }),
    " ",
    children
  ] });
}
function Notice({ children, error, onDismiss }) {
  if (!children) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-banner", "data-kind": error ? "error" : "info", role: error ? "alert" : "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: error ? "warning" : "link" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children }),
    onDismiss && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "rc-dismiss", "aria-label": "Dismiss message", onClick: onDismiss, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "close", size: 14 }) })
  ] });
}
function Empty({ icon = "monitor", title, children, action }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-empty", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-empty-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-empty-symbol", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: icon, size: 23 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children }),
    action
  ] }) });
}
function useVisible(root) {
  const [visible, setVisible] = (0, import_react.useState)(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  (0, import_react.useEffect)(() => {
    let intersects = true;
    const update = () => setVisible(intersects && document.visibilityState !== "hidden");
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
      intersects = entries[0]?.isIntersecting !== false;
      update();
    }) : null;
    if (root.current) observer?.observe(root.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [root]);
  return visible;
}
function usePoll(action, args, active, interval, revision = 0) {
  const [state, setState] = (0, import_react.useState)({ value: null, error: "", loading: active });
  const key = JSON.stringify(args);
  const intervalRef = (0, import_react.useRef)(interval);
  const previousKey = (0, import_react.useRef)("");
  intervalRef.current = interval;
  (0, import_react.useEffect)(() => {
    if (!active) return;
    let alive = true;
    let timer;
    const controller = new AbortController();
    const identity = `${action}:${key}`;
    const same = previousKey.current === identity;
    previousKey.current = identity;
    setState((previous) => same ? { ...previous, error: "", loading: !previous.value } : { value: null, error: "", loading: true });
    const tick = async () => {
      try {
        const value = await requestRemote(action, JSON.parse(key), { signal: controller.signal });
        if (alive) setState({ value, error: "", loading: false });
      } catch (error) {
        if (alive && !controller.signal.aborted) setState((previous) => ({ ...previous, error: safeMessage(error), loading: false }));
      } finally {
        if (alive) timer = setTimeout(tick, intervalRef.current);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [action, key, active, revision]);
  return previousKey.current === `${action}:${key}` ? state : { value: null, error: "", loading: active };
}
function useTaskScope(identity) {
  const scope = (0, import_react.useRef)({ controllers: /* @__PURE__ */ new Set(), generation: 0 });
  (0, import_react.useEffect)(() => {
    const current = scope.current;
    current.generation++;
    return () => {
      current.generation++;
      for (const controller of current.controllers) controller.abort();
      current.controllers.clear();
    };
  }, [identity]);
  return (0, import_react.useCallback)(async (action, args, onSuccess, onError, onFinally) => {
    const current = scope.current;
    const generation = current.generation;
    const controller = new AbortController();
    current.controllers.add(controller);
    try {
      const value = await requestRemote(action, args, { signal: controller.signal });
      if (generation === current.generation && !controller.signal.aborted) onSuccess?.(value);
    } catch (error) {
      if (generation === current.generation && !controller.signal.aborted) onError?.(safeMessage(error));
    } finally {
      current.controllers.delete(controller);
      if (generation === current.generation && !controller.signal.aborted) onFinally?.();
    }
  }, []);
}
function DeviceDialog({ device, onClose, onSaved, onRemoved }) {
  const id = (0, import_react.useId)();
  const [name, setName] = (0, import_react.useState)(device?.name || "");
  const [url, setUrl] = (0, import_react.useState)(device?.url || "");
  const [token, setToken] = (0, import_react.useState)("");
  const [mode, setMode] = (0, import_react.useState)(device?.mode || "auto");
  const [show, setShow] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const formRef = (0, import_react.useRef)(null);
  const task = useTaskScope(device?.id || "new-device");
  (0, import_react.useEffect)(() => {
    const previousFocus = document.activeElement;
    formRef.current?.querySelector("input")?.focus();
    return () => previousFocus?.isConnected && previousFocus.focus?.();
  }, []);
  function save(event) {
    event.preventDefault();
    if (busy || !name.trim() || !url.trim()) return;
    setBusy(true);
    setError("");
    task("devices.save", { id: device?.id, name: name.trim(), url: url.trim(), mode, ...token ? { token } : {} }, onSaved, setError, () => setBusy(false));
  }
  function remove() {
    if (!window.confirm(`Remove ${device.name} from this device list? Its sessions will remain on the remote device.`)) return;
    setBusy(true);
    setError("");
    task("devices.remove", { remoteId: device.id }, () => onRemoved(device.id), setError, () => setBusy(false));
  }
  function trap(event) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...formRef.current.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),summary")];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-overlay", onMouseDown: (event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "rc-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-description`, onSubmit: save, onKeyDown: trap, ref: formRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-dialog-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: `${id}-title`, children: device ? "Device settings" : "Add a device" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, className: "rc-icon-btn", icon: "close", "aria-label": "Close device settings", disabled: busy, onClick: onClose })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-dialog-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${id}-description`, children: "Paste the pairing link from the device you want to access. Its private token is stored securely by DSH." }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-name`, children: "Device name" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-name`, value: name, onChange: (e) => setName(e.target.value), placeholder: "Home desktop", required: true, maxLength: 120, disabled: busy, autoComplete: "off" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-url`, children: "Pairing link or device URL" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-input-with-button", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-url`, type: show ? "text" : "password", value: url, onChange: (e) => setUrl(e.target.value), placeholder: "https://your-device.example", required: true, disabled: busy, autoComplete: "off", spellCheck: false }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, icon: "eye", "aria-label": show ? "Hide pairing link" : "Show pairing link", "aria-pressed": show, onClick: () => setShow(!show), disabled: busy })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: "Pairing tokens are hidden from the device list." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { className: "rc-label", children: "Connection options" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-mode`, children: "Connection type" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${id}-mode`, value: mode, onChange: (e) => setMode(e.target.value), disabled: busy, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: "Automatic" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "companion", children: "Companion \xB7 sessions and desktop" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "web", children: "Web \xB7 sessions only" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-token`, children: device?.hasToken ? "Replace token (optional)" : "Access token (optional)" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-token`, type: "password", value: token, onChange: (e) => setToken(e.target.value), autoComplete: "new-password", disabled: busy }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-tiny", children: [
              "Leave blank when the pairing link includes a token",
              device?.hasToken ? ", or to keep the saved token" : "",
              "."
            ] })
          ] })
        ] })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-inline-error", role: "alert", children: error })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-dialog-foot", children: [
      device && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { className: "rc-btn-danger", disabled: busy, onClick: remove, children: "Remove device" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { disabled: busy, onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "rc-btn rc-btn-primary", type: "submit", disabled: busy || !name.trim() || !url.trim(), children: busy ? "Saving\u2026" : device ? "Save changes" : "Add device" })
    ] })
  ] }) });
}
function Sessions({ device, connected, available, connectionMode, active, drafts, setDrafts, canControl = false }) {
  const id = (0, import_react.useId)();
  const [sessionId, setSessionId] = (0, import_react.useState)("");
  const [query, setQuery] = (0, import_react.useState)("");
  const [revision, setRevision] = (0, import_react.useState)(0);
  const [mode, setMode] = (0, import_react.useState)("queue");
  const [busy, setBusy] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const [older, setOlder] = (0, import_react.useState)([]);
  const [olderMore, setOlderMore] = (0, import_react.useState)(null);
  const [loadingOlder, setLoadingOlder] = (0, import_react.useState)(false);
  const [pending, setPending] = (0, import_react.useState)(false);
  const [showPicker, setShowPicker] = (0, import_react.useState)(true);
  const chatHeading = (0, import_react.useRef)(null);
  const search = (0, import_react.useRef)(null);
  const runningRef = (0, import_react.useRef)(false);
  const list = usePoll("sessions.list", { remoteId: device.id }, active && connected && available, runningRef.current ? 1e3 : 3e3, revision);
  const items = list.value?.items || [];
  const session = items.find((item) => item.sessionId === sessionId);
  const promptAvailable = canControl && canPromptSession(connectionMode, session?.agentAvailable);
  runningRef.current = items.some((item) => item.running);
  const page = usePoll("sessions.page", { remoteId: device.id, sessionId, maxMessages: 100 }, active && connected && available && !!sessionId, session?.running || pending ? 1e3 : 3e3, revision);
  const task = useTaskScope(`${device.id}:${sessionId}`);
  const transcript = (0, import_react.useRef)(null);
  const follow = (0, import_react.useRef)(true);
  const key = draftKey(device.id, sessionId);
  const draft = drafts[key] || "";
  (0, import_react.useEffect)(() => {
    if (!sessionId && items.length) setSessionId(items[0].sessionId);
  }, [items, sessionId]);
  (0, import_react.useEffect)(() => {
    setOlder([]);
    setOlderMore(null);
    setError("");
    setBusy("");
    setPending(false);
    setLoadingOlder(false);
    follow.current = true;
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    if (page.value && follow.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [page.value, sessionId]);
  (0, import_react.useEffect)(() => {
    if (session?.running) setPending(false);
  }, [session?.running]);
  (0, import_react.useEffect)(() => {
    if (pending) {
      const timer = setTimeout(() => setPending(false), 5e3);
      return () => clearTimeout(timer);
    }
  }, [pending]);
  const editDraft = (text) => setDrafts((previous) => ({ ...previous, [key]: text }));
  function navigateSession(nextId) {
    setSessionId(nextId);
    setShowPicker(false);
    if (window.matchMedia?.("(max-width:720px),(max-height:500px) and (pointer:coarse)").matches) {
      requestAnimationFrame(() => chatHeading.current?.focus());
    }
  }
  function openPicker() {
    setShowPicker(true);
    requestAnimationFrame(() => search.current?.focus());
  }
  function create() {
    if (busy || !canControl) return;
    setBusy("new");
    setError("");
    task("sessions.create", { remoteId: device.id }, (value) => {
      navigateSession(value.sessionId);
      setRevision((value2) => value2 + 1);
    }, setError, () => setBusy(""));
  }
  function send(event) {
    event?.preventDefault();
    if (busy || !draft.trim() || !connected || !sessionId || !promptAvailable) return;
    const text = draft;
    setBusy("send");
    setError("");
    task("sessions.prompt", { remoteId: device.id, sessionId, text, mode, requestId: makeRequestId() }, () => {
      setDrafts((previous) => previous[key] === text ? { ...previous, [key]: "" } : previous);
      setPending(true);
      setRevision((value) => value + 1);
    }, (message) => setError(`${message} Your draft is still here. A failed response may have reached the device; check the transcript before sending again.`), () => setBusy(""));
  }
  function stop() {
    if (busy || !canControl) return;
    setBusy("stop");
    setError("");
    task("sessions.cancel", { remoteId: device.id, sessionId }, () => {
      setPending(false);
      setRevision((value) => value + 1);
    }, setError, () => setBusy(""));
  }
  function loadOlder() {
    const beforeSeq = (older[0] || page.value?.messages?.[0])?.seq;
    if (beforeSeq == null || loadingOlder) return;
    setLoadingOlder(true);
    const scrollHeight = transcript.current?.scrollHeight || 0;
    const scrollTop = transcript.current?.scrollTop || 0;
    task("sessions.page", { remoteId: device.id, sessionId, beforeSeq, maxMessages: 100 }, (value) => {
      setOlder((previous) => [...value.messages, ...previous]);
      setOlderMore(value.hasMore);
      requestAnimationFrame(() => {
        if (transcript.current) transcript.current.scrollTop = scrollTop + transcript.current.scrollHeight - scrollHeight;
      });
    }, setError, () => setLoadingOlder(false));
  }
  const latest = page.value?.messages || [];
  const seen = new Set(latest.filter((message) => message.seq != null).map((message) => message.seq));
  const messages = [...older.filter((message) => message.seq == null || !seen.has(message.seq)), ...latest];
  const shown = filterSessions(items, query);
  const showMore = olderMore == null ? page.value?.hasMore : olderMore;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { error: true, children: error || list.error || page.error }),
    connected && available === false && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "This connection does not support sessions. Check the companion setup on the remote device." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-sessions", "data-mobile-view": showPicker || !sessionId ? "sessions" : "chat", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "rc-session-rail", id: `${id}-sessions`, "aria-label": "Sessions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-mobile-picker-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Sessions" }),
          sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, onClick: () => navigateSession(sessionId), children: "Back to chat" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { icon: "plus", onClick: create, disabled: !!busy || !connected || !available || !canControl, children: busy === "new" ? "Creating session\u2026" : "New session" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "search", size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-search`, className: "rc-sr-only", children: "Search sessions" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { ref: search, id: `${id}-search`, value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search sessions", type: "search" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-sessions-caption", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            items.length,
            " session",
            items.length !== 1 ? "s" : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: runningRef.current ? "Live updates" : "Recent first" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-session-list", children: list.loading && !items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "aria-label": "Loading sessions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-skeleton" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-skeleton" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-skeleton" })
        ] }) : shown.length ? shown.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "rc-session-item", "aria-pressed": item.sessionId === sessionId, onClick: () => navigateSession(item.sessionId), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-session-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.title || "Untitled session" }),
            item.running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-running", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-running-dot" }),
              "Running"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-session-path", title: item.cwd || "", children: item.cwd || (item.updatedAt ? `Updated ${formatTime(item.updatedAt)}` : "DSH session") })
        ] }, item.sessionId)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-list-empty", children: query ? "No matching sessions." : connected ? "No sessions yet." : "Connect to load sessions." }) })
      ] }),
      sessionId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-chat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-chat-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { className: "rc-mobile-sessions", quiet: true, icon: "sessions", "aria-controls": `${id}-sessions`, "aria-expanded": showPicker, onClick: openPicker, children: "Sessions" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-chat-heading", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { ref: chatHeading, tabIndex: -1, children: session?.title || "Session" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: session?.cwd || "Remote DSH session" })
          ] }),
          (session?.running || pending) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-running", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-running-dot" }),
              session?.running ? "Running" : "Prompt accepted"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { icon: "stop", onClick: stop, disabled: !!busy || !connected || !canControl, children: busy === "stop" ? "Stopping\u2026" : "Stop" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-transcript", ref: transcript, "aria-label": "Session transcript", "aria-busy": page.loading, onScroll: (event) => {
          const node = event.currentTarget;
          follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
        }, children: [
          showMore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-load-more", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, disabled: loadingOlder || !connected || (older[0] || latest[0])?.seq == null, onClick: loadOlder, children: loadingOlder ? "Loading\u2026" : "Load earlier messages" }) }),
          messages.length ? messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: "rc-message", "data-role": message.role, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-message-avatar", "aria-hidden": "true", children: message.role === "user" ? "You" : message.role === "assistant" ? "DS" : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: message.role === "tool" ? "keyboard" : "sessions", size: 13 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-message-content", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-message-meta", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : message.role === "tool" ? "Tool" : message.role || "Message" }),
                message.time && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { children: formatTime(message.time) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-message-text", children: message.text || "" })
            ] })
          ] }, message.seq == null ? `${message.role}-${index}` : message.seq)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-list-empty", children: page.loading ? "Loading transcript\u2026" : "This session is ready. Send a message to begin." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "rc-composer-area", onSubmit: send, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-draft`, className: "rc-sr-only", children: "Message this session" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-composer", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { id: `${id}-draft`, value: draft, onChange: (event) => editDraft(event.target.value), placeholder: connected ? "Message this session\u2026" : "Draft a message while the device is offline\u2026", onKeyDown: (event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            } }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-composer-bottom", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-mode`, className: "rc-sr-only", children: "Prompt delivery" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${id}-mode`, value: mode, onChange: (event) => setMode(event.target.value), disabled: !!busy, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "queue", children: "Queue message" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "steer", children: "Steer current run" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "rc-btn rc-btn-primary", type: "submit", disabled: !!busy || !connected || !available || !draft.trim() || !promptAvailable, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "send", size: 14 }),
                busy === "send" ? "Sending\u2026" : "Send"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-composer-hint", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: !connected ? "Draft preserved \xB7 reconnect to send" : !canControl ? "View only \xB7 take control to send" : !promptAvailable ? "Use a companion connection to resume this closed session" : "Ctrl / \u2318 + Enter to send" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Messages are sent once." })
          ] })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "sessions", title: connected ? "Choose a session" : "Sessions are offline", action: connected && available && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { icon: "plus", primary: true, onClick: create, disabled: !!busy || !canControl, children: "Start a new session" }), children: connected ? "Open a recent conversation or start a new one on this device." : "Check that the remote device and its sharing service are online, then check the connection." })
    ] })
  ] });
}
function useLiveFrame(remoteId, monitor, active) {
  const [frame, setFrame] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    setFrame(null);
    setError("");
    setLoading(!!active);
    if (!active || !monitor) return;
    let alive = true, timer, currentUrl;
    const controller = new AbortController();
    const tick = async () => {
      let nextUrl;
      try {
        const signal = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function" ? AbortSignal.any([controller.signal, AbortSignal.timeout(12e3)]) : controller.signal;
        const response = await fetch(frameUrl(remoteId, monitor.id), { credentials: "same-origin", headers: { "x-dsh-remote-control": "1" }, cache: "no-store", signal });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(safeMessage(data?.error, "The screen is unavailable. Check desktop access on the remote device."));
        }
        const blob = await response.blob();
        if (blob.type && !blob.type.startsWith("image/")) throw new Error("The device did not return a screen image.");
        nextUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.src = nextUrl;
        if (image.decode) await image.decode();
        if (!alive) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        const previous = currentUrl;
        currentUrl = nextUrl;
        setFrame({ url: nextUrl, width: Number(response.headers.get("x-desktop-width")) || monitor.width, height: Number(response.headers.get("x-desktop-height")) || monitor.height, capturedAt: Date.now() });
        setError("");
        setLoading(false);
        if (previous) URL.revokeObjectURL(previous);
      } catch (failure) {
        if (nextUrl && nextUrl !== currentUrl) URL.revokeObjectURL(nextUrl);
        if (alive && !controller.signal.aborted) {
          setError(safeMessage(failure));
          setLoading(false);
        }
      } finally {
        if (alive) timer = setTimeout(tick, 500);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [remoteId, monitor?.id, active]);
  return { frame, error, loading };
}
function useDesktopInput(remoteId, enabled, onFailure) {
  const errorHandler = (0, import_react.useRef)(onFailure);
  errorHandler.current = onFailure;
  const queue = (0, import_react.useMemo)(() => createDesktopInputQueue({ remoteId, onFailure: (error) => errorHandler.current?.(`${safeMessage(error)} Control has been turned off; the input will not be repeated.`) }), [remoteId]);
  const release = (0, import_react.useCallback)((keepActive) => queue.release(keepActive), [queue]);
  (0, import_react.useEffect)(() => {
    if (enabled) queue.enable();
    else release();
    const blur = () => {
      if (enabled) {
        release();
        errorHandler.current?.("", true);
      }
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      release();
    };
  }, [enabled, release, queue]);
  const send = (0, import_react.useCallback)((input) => queue.send(input), [queue]);
  const shortcut = (0, import_react.useCallback)(async (keys2) => {
    for (const key of keys2) if (!await send({ type: "key", key, down: true })) return;
    for (const key of [...keys2].reverse()) if (!await send({ type: "key", key, down: false })) return;
  }, [send]);
  return { send, release, shortcut };
}
function Desktop({ device, connected, available, active, canControl = false }) {
  const id = (0, import_react.useId)();
  const [monitorId, setMonitorId] = (0, import_react.useState)("");
  const [control, setControl] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [text, setText] = (0, import_react.useState)("");
  const [sending, setSending] = (0, import_react.useState)(false);
  const [focused, setFocused] = (0, import_react.useState)(false);
  const [revision, setRevision] = (0, import_react.useState)(0);
  const monitors = usePoll("desktop.monitors", { remoteId: device.id }, active && connected && available, 1e4, revision);
  const items = monitors.value?.monitors || [];
  const monitor = items.find((item) => item.id === monitorId) || items.find((item) => item.primary) || items[0];
  const canView = active && connected && available && monitors.value?.available !== false && !!monitor;
  const live = useLiveFrame(device.id, monitor, canView);
  const surface = (0, import_react.useRef)(null);
  const stage = (0, import_react.useRef)(null);
  const [stageSize, setStageSize] = (0, import_react.useState)({ width: 0, height: 0 });
  const pointer = (0, import_react.useRef)(null);
  const lastMove = (0, import_react.useRef)(0);
  const movePending = (0, import_react.useRef)(false);
  const wheelPending = (0, import_react.useRef)(false);
  const input = useDesktopInput(device.id, control && canControl && canView && !live.error, (message, blur) => {
    setControl(false);
    setFocused(false);
    pointer.current = null;
    if (!blur) setError(message);
  });
  (0, import_react.useEffect)(() => {
    if (!canControl) {
      setControl(false);
      setFocused(false);
      pointer.current = null;
    }
  }, [canControl]);
  (0, import_react.useEffect)(() => {
    if (!canView || live.error) {
      setControl(false);
      setFocused(false);
      pointer.current = null;
    }
  }, [canView, live.error]);
  (0, import_react.useEffect)(() => {
    setControl(false);
    setError("");
    setFocused(false);
    pointer.current = null;
  }, [monitor?.id]);
  (0, import_react.useEffect)(() => {
    if (control) surface.current?.focus();
  }, [control]);
  (0, import_react.useEffect)(() => {
    const node = stage.current;
    if (!node) return;
    const resize = () => {
      const computed = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
      const height = node.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
      setStageSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(node);
    resize();
    return () => observer?.disconnect();
  }, [canView, connected, available]);
  (0, import_react.useEffect)(() => {
    const node = surface.current;
    if (!control || !canView || !node) return;
    const wheel = (event) => {
      if (document.activeElement !== node) return;
      event.preventDefault();
      if (wheelPending.current) return;
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1;
      wheelPending.current = true;
      input.send({ type: "scroll", ...pointerPosition(node.getBoundingClientRect(), event, monitor), deltaX: Math.max(-3e3, Math.min(3e3, event.deltaX * factor)), deltaY: Math.max(-3e3, Math.min(3e3, event.deltaY * factor)) }).finally(() => {
        wheelPending.current = false;
      });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [control, canView, monitor?.id, monitor?.x, monitor?.y, monitor?.width, monitor?.height, input.send]);
  function toggleControl() {
    if (!canControl) return;
    if (control) input.release();
    setError("");
    setControl((value) => !value);
  }
  function position(event) {
    return pointerPosition(event.currentTarget.getBoundingClientRect(), event, monitor);
  }
  function pointerDown(event) {
    if (!control || !canView || pointer.current || ![0, 1, 2].includes(event.button)) return;
    event.preventDefault();
    event.currentTarget.focus();
    const button = ["left", "middle", "right"][event.button];
    pointer.current = { id: event.pointerId, button };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    input.send({ type: "button", button, down: true, ...position(event) });
  }
  function pointerMove(event) {
    if (!control || !canView || !focused || movePending.current || performance.now() - lastMove.current < 60) return;
    lastMove.current = performance.now();
    movePending.current = true;
    input.send({ type: "move", ...position(event) }).finally(() => {
      movePending.current = false;
    });
  }
  function pointerUp(event) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const button = pointer.current.button;
    pointer.current = null;
    if (control) {
      event.preventDefault();
      input.send({ type: "button", button, down: false, ...position(event) });
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyDown(event) {
    if (!control || event.nativeEvent.isComposing || event.repeat) return;
    if (event.key === "Escape") {
      event.preventDefault();
      input.release();
      setControl(false);
      return;
    }
    const key = desktopKey(event.key, event.code);
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      input.send({ type: "key", key, down: true });
    }
  }
  function keyUp(event) {
    if (!control || event.key === "Escape") return;
    const key = desktopKey(event.key, event.code);
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      input.send({ type: "key", key, down: false });
    }
  }
  async function sendText(event) {
    event.preventDefault();
    if (!control || !text || sending) return;
    setSending(true);
    setError("");
    const value = text;
    const accepted = await input.send({ type: "text", text: value });
    if (accepted) setText((previous) => previous === value ? "" : previous);
    setSending(false);
  }
  const screenWidth = monitor && stageSize.width > 0 && stageSize.height > 0 ? Math.max(1, Math.min(stageSize.width, stageSize.height * monitor.width / monitor.height)) : null;
  if (!available) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "monitor", title: "Desktop access is not enabled", children: "Enable desktop access in \u201CShare this device\u201D on the remote computer, then use a companion connection." });
  if (!connected) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "monitor", title: "Desktop is offline", children: "Bring the remote device online and check the connection. Control is off until you enable it again." });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-desktop", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-desktop-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-monitor-select", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-monitor`, className: "rc-sr-only", children: "Monitor" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { id: `${id}-monitor`, value: monitor?.id || "", disabled: !items.length || monitors.loading, onChange: (event) => {
          input.release();
          setControl(false);
          setMonitorId(event.target.value);
        }, children: items.length ? items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: item.id, children: [
          item.name || `Monitor ${item.id}`,
          item.primary ? " \xB7 Primary" : ""
        ] }, item.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: monitors.loading ? "Loading monitors\u2026" : "No monitor available" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, icon: "refresh", className: "rc-icon-btn", "aria-label": "Refresh monitors", onClick: () => setRevision((value) => value + 1), disabled: monitors.loading }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { icon: control ? "cursor" : "eye", className: "rc-control-toggle", "aria-pressed": control, disabled: !canControl || !canView || !live.frame || !!live.error, onClick: toggleControl, children: control ? "Control on" : "Enable control" })
      ] })
    ] }),
    (error || monitors.error || live.error || monitors.value?.reason) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-inline-error", role: "alert", children: error || monitors.error || live.error || safeMessage(monitors.value?.reason) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-screen-stage", ref: stage, children: monitor && live.frame ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-screen", ref: surface, style: { aspectRatio: `${monitor.width}/${monitor.height}`, ...screenWidth ? { width: screenWidth } : {} }, "data-control": control, tabIndex: control ? 0 : -1, role: "application", "aria-label": `Remote desktop, ${monitor.name || "selected monitor"}. ${control ? "Control enabled. Escape exits control." : "View only."}`, "aria-describedby": `${id}-help`, onFocus: () => setFocused(true), onBlur: () => {
      input.release(true);
      setFocused(false);
      pointer.current = null;
    }, onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: () => {
      input.release();
      setControl(false);
      pointer.current = null;
    }, onLostPointerCapture: () => {
      if (pointer.current) {
        input.release();
        setControl(false);
        pointer.current = null;
      }
    }, onContextMenu: (event) => {
      if (control) event.preventDefault();
    }, onKeyDown: keyDown, onKeyUp: keyUp, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { src: live.frame.url, alt: `Live desktop of ${device.name}, ${monitor.name || "selected monitor"}`, draggable: false }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-screen-placeholder", children: monitors.loading || live.loading ? "Connecting to the remote screen\u2026" : monitors.value?.reason || "No screen is available. Check that the remote Windows desktop is unlocked." }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-desktop-footer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        live.frame ? `${monitor.width} \xD7 ${monitor.height} \xB7 Live screen` : "Waiting for screen",
        monitor?.x < 0 || monitor?.y < 0 ? " \xB7 Extended display" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: control ? focused ? "Keyboard connected \xB7 Esc exits control" : "Control enabled \xB7 click screen to focus" : "View only \xB7 mouse and keyboard are local" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-control-note", id: `${id}-help`, children: control ? "Click the screen to use your keyboard. Drag, right-click and scroll work inside it. Escape turns control off; leaving the screen releases held keys." : "Enable control to use this device\u2019s mouse and keyboard. Each connection starts in view only." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "rc-text-entry", onSubmit: sendText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-text`, children: "Type text on the remote device" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-text`, value: text, onChange: (event) => setText(event.target.value), placeholder: "Text to insert into the remote focused field", maxLength: 4096, autoComplete: "off" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "rc-btn", type: "submit", disabled: !control || !text || sending, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "keyboard" }),
        sending ? "Sending\u2026" : "Send text"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-shortcuts", "aria-label": "Remote keyboard shortcuts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: "Send shortcut" }),
      [["Ctrl + C", ["Control", "c"]], ["Ctrl + V", ["Control", "v"]], ["Alt + Tab", ["Alt", "Tab"]], ["Windows", ["Meta"]], ["Escape", ["Escape"]]].map(([label, keys2]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { disabled: !control, onClick: () => input.shortcut(keys2), children: label }, label))
    ] })
  ] });
}
function DeviceWorkspace({ device, visible, drafts, setDrafts, onEdit, canControl = false }) {
  const [tab, setTab] = (0, import_react.useState)("sessions");
  const [revision, setRevision] = (0, import_react.useState)(0);
  const probe = usePoll("devices.status", { remoteId: device.id }, visible, 1e4, revision);
  const connected = !!probe.value?.connected && !probe.error;
  const capabilities = probe.value?.capabilities || {};
  const probeError = probe.error || (!connected && probe.value?.error ? safeMessage(probe.value.error) : "");
  function tabKey(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "sessions" : event.key === "End" ? "desktop" : tab === "sessions" ? "desktop" : "sessions";
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`rc-tab-${next}-${device.id}`)?.focus());
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "rc-workspace", "aria-label": `${device.name} workspace`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-workspace-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-workspace-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-title-line", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: device.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-status", "data-state": connected ? "online" : probe.loading ? "loading" : "error", role: "status", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-status-dot" }),
              probe.loading ? "Connecting\u2026" : connected ? probe.value?.mode === "web" ? "Online \xB7 Web" : "Online" : "Offline"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-address", children: deviceAddress(device.url) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, icon: "refresh", "aria-label": "Check device connection", disabled: probe.loading, onClick: () => setRevision((value) => value + 1), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-check-label", children: "Check connection" }) }),
          onEdit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, className: "rc-icon-btn", icon: "edit", "aria-label": `Edit ${device.name}`, onClick: onEdit })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-tabs", role: "tablist", "aria-label": "Device workspace", onKeyDown: tabKey, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { id: `rc-tab-sessions-${device.id}`, className: "rc-tab", role: "tab", tabIndex: tab === "sessions" ? 0 : -1, "aria-selected": tab === "sessions", "aria-controls": `rc-panel-${device.id}`, onClick: () => setTab("sessions"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "sessions", size: 15 }),
          "Sessions"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { id: `rc-tab-desktop-${device.id}`, className: "rc-tab", role: "tab", tabIndex: tab === "desktop" ? 0 : -1, "aria-selected": tab === "desktop", "aria-controls": `rc-panel-${device.id}`, onClick: () => setTab("desktop"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 15 }),
          "Desktop"
        ] })
      ] })
    ] }),
    probeError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { error: true, children: probeError }),
    connected && probe.value?.mode === "web" && tab === "sessions" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "Web connection \xB7 sessions only. If this DSH profile is already open elsewhere, close its other writer before starting a session. Use the companion for desktop access." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-workspace-content", id: `rc-panel-${device.id}`, role: "tabpanel", "aria-labelledby": `rc-tab-${tab}-${device.id}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-workspace-content", style: { display: tab === "sessions" ? "flex" : "none" }, hidden: tab !== "sessions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sessions, { device, connected, available: capabilities.sessions !== false, connectionMode: probe.value?.mode, active: visible && tab === "sessions", drafts, setDrafts, canControl }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-workspace-content", style: { display: tab === "desktop" ? "flex" : "none" }, hidden: tab !== "desktop", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desktop, { device, connected, available: !!capabilities.desktop, active: visible && tab === "desktop", canControl }) })
    ] })
  ] });
}
function ShareCard({ onChanged }) {
  const id = (0, import_react.useId)();
  const [revision, setRevision] = (0, import_react.useState)(0);
  const status = usePoll("sharing.status", {}, true, 2e3, revision);
  const sharing = status.value || {};
  const [label, setLabel] = (0, import_react.useState)("");
  const [desktop, setDesktop] = (0, import_react.useState)(false);
  const [publicUrl, setPublicUrl] = (0, import_react.useState)("");
  const [useLimit, setUseLimit] = (0, import_react.useState)("once");
  const [expiry, setExpiry] = (0, import_react.useState)("30min");
  const [customDuration, setCustomDuration] = (0, import_react.useState)("1");
  const [customUnit, setCustomUnit] = (0, import_react.useState)("hours");
  const [invitation, setInvitation] = (0, import_react.useState)(null);
  const [now, setNow] = (0, import_react.useState)(Date.now);
  const [busy, setBusy] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const [copied, setCopied] = (0, import_react.useState)(false);
  const [codeLoaded, setCodeLoaded] = (0, import_react.useState)(false);
  const mounted = (0, import_react.useRef)(true);
  const operation = (0, import_react.useRef)(0);
  const pendingInvite = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    setCodeLoaded(false);
    requestRemote("sharing.code", {}, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) {
        setInvitation(typeof value?.code === "string" ? value : null);
        setCodeLoaded(true);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setCodeLoaded(true);
    });
    return () => controller.abort();
  }, [revision]);
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, []);
  (0, import_react.useEffect)(() => {
    if (sharing.enabled === false || sharing.code?.exists === false || sharing.code?.useLimit !== "unlimited" && sharing.code?.used) {
      setInvitation(null);
      setCopied(false);
    }
  }, [sharing.enabled, sharing.code?.exists, sharing.code?.useLimit, sharing.code?.used]);
  const validCode = invitation && (invitation.expiresAt === null || Number(invitation.expiresAt) > now) && !sharing.code?.paused;
  const refresh = () => {
    setRevision((value) => value + 1);
    onChanged?.();
  };
  async function generate(event) {
    event?.preventDefault();
    if (busy) return;
    let expiresInMs;
    try {
      expiresInMs = invitationLifetime(expiry, customDuration, customUnit);
    } catch (failure) {
      setError(safeMessage(failure));
      return;
    }
    const generation = ++operation.current;
    const controller = new AbortController();
    pendingInvite.current = controller;
    setBusy("invite");
    setError("");
    setInvitation(null);
    setCopied(false);
    try {
      const value = await requestRemote("sharing.invite", { label: label.trim() || sharing.label || void 0, desktopEnabled: desktop, useLimit, expiresInMs, ...publicUrl.trim() ? { publicUrl: publicUrl.trim() } : {} }, { timeout: 12e4, signal: controller.signal });
      if (mounted.current && operation.current === generation) {
        setInvitation({ ...value, useLimit: value.useLimit || useLimit });
        setNow(Date.now());
        refresh();
      }
    } catch (failure) {
      if (mounted.current && operation.current === generation) setError(safeMessage(failure));
    } finally {
      if (mounted.current && operation.current === generation) {
        pendingInvite.current = null;
        setBusy("");
        refresh();
      }
    }
  }
  async function copy() {
    if (!validCode) return;
    try {
      await navigator.clipboard.writeText(invitation.code);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Select the connection code below and copy it.");
    }
  }
  async function change(action) {
    if (busy && !(action === "sharing.stop" && busy === "invite")) return;
    const generation = ++operation.current;
    pendingInvite.current?.abort();
    pendingInvite.current = null;
    setBusy(action);
    setError("");
    setCopied(false);
    if (action === "sharing.stop" || action === "sharing.revoke") setInvitation(null);
    try {
      await requestRemote(action);
      if (mounted.current && operation.current === generation) refresh();
    } catch (failure) {
      if (mounted.current && operation.current === generation) setError(safeMessage(failure));
    } finally {
      if (mounted.current && operation.current === generation) setBusy("");
    }
  }
  const remote = sharing.control?.owner === "remote";
  const unavailable = sharing.enabled && sharing.control?.supported === false;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "rc-pair-card", "aria-labelledby": `${id}-title`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-card-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-card-symbol", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 23 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-status", "data-state": sharing.enabled && !sharing.code?.paused ? "online" : "idle", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-status-dot" }),
        remote ? "Remote control active" : sharing.code?.paused ? "Remote access paused" : sharing.enabled ? "Ready to connect" : "Only you have access"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: `${id}-title`, children: "Share this computer" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-card-intro", children: "Continue this DSH from another computer. Create a code and paste it into Remote Control there." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: generate, className: "rc-setup-form", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-name`, children: "Computer name" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-name`, value: label, onChange: (event) => setLabel(event.target.value), placeholder: sharing.label || "My computer", maxLength: 80, disabled: !!busy || remote, autoComplete: "off" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "rc-access-option", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: desktop, onChange: (event) => setDesktop(event.target.checked), disabled: !!busy || remote }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Include desktop access" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Share your screen, mouse and keyboard. DSH chats are included by default." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-form-grid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-uses`, children: "Code uses" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${id}-uses`, value: useLimit, onChange: (event) => setUseLimit(event.target.value), disabled: !!busy || remote, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "once", children: "Once" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "unlimited", children: "Unlimited" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-expiry`, children: "Code expiry" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${id}-expiry`, value: expiry, onChange: (event) => setExpiry(event.target.value), disabled: !!busy || remote, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "never", children: "Never" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "30min", children: "30 minutes" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "1hr", children: "1 hour" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "custom", children: "Custom" })
          ] })
        ] })
      ] }),
      expiry === "custom" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-form-grid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-duration`, children: "Expires after" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-duration`, type: "number", min: "0.001", step: "any", value: customDuration, onChange: (event) => setCustomDuration(event.target.value), required: true, disabled: !!busy || remote })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-unit`, children: "Duration unit" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { id: `${id}-unit`, value: customUnit, onChange: (event) => setCustomUnit(event.target.value), disabled: !!busy || remote, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "minutes", children: "Minutes" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "hours", children: "Hours" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "days", children: "Days" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "rc-advanced", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Connection options" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { htmlFor: `${id}-address`, children: [
            "Existing HTTPS address ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: "(optional)" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-address`, value: publicUrl, onChange: (event) => setPublicUrl(event.target.value), type: "url", placeholder: "https://your-tunnel.example", disabled: !!busy || remote, autoComplete: "off", spellCheck: false }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: "Leave blank to create a temporary internet connection automatically." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-privacy-note", children: "Internet sharing uses Cloudflare unless you supply your own address. Keep DSH open. Temporary addresses change when sharing restarts." }),
      sharing.code?.paused && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-code-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "rc-tiny", children: [
          "Remote access is paused. ",
          sharing.code.useLimit === "once" && sharing.code.used ? "This code was used. Create a new one to connect again." : "Resume when you want this code to accept connections again."
        ] }),
        !(sharing.code.useLimit === "once" && sharing.code.used) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { onClick: () => change("sharing.resume"), disabled: !!busy, children: busy === "sharing.resume" ? "Resuming\u2026" : "Resume remote access" })
      ] }),
      remote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-handoff-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "link" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
            sharing.control.label || "Another computer",
            " has control"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Your sessions keep running here. You can return control at any time." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { primary: true, disabled: !!busy, onClick: () => change("sharing.reclaim"), children: busy === "sharing.reclaim" ? "Taking back\u2026" : "Take back control" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "rc-btn rc-btn-primary rc-wide", type: "submit", disabled: !!busy || unavailable, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: busy === "invite" ? "refresh" : "link" }),
          busy === "invite" ? "Preparing secure connection\u2026" : invitation || sharing.code?.exists ? "Generate replacement code" : "Create connection code"
        ] }),
        busy === "invite" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-card-footer", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-tiny", role: "status", children: "Setting up internet access. This can take about a minute." }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, onClick: () => change("sharing.stop"), children: "Cancel setup" })
        ] })
      ] }),
      invitation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-code-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-code-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-code`, children: "Your connection code" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { role: "status", children: expiryText(invitation.expiresAt, now, invitation.useLimit) })
        ] }),
        validCode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { id: `${id}-code`, value: invitation.code, readOnly: true, rows: 3, onFocus: (event) => event.target.select(), spellCheck: false, autoComplete: "off" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { icon: "copy", primary: true, className: "rc-wide", onClick: copy, children: copied ? "Copied to clipboard" : "Copy connection code" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-tiny", children: "Send this code privately to the person connecting." })
        ] })
      ] }),
      !invitation && codeLoaded && sharing.code?.exists && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-code-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "rc-tiny", children: [
          "Current code: ",
          expiryText(sharing.code.expiresAt, now, sharing.code.useLimit)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-tiny", children: "The existing code still follows these settings. To copy a code from this screen, generate a replacement." })
      ] })
    ] }),
    sharing.enabled && busy !== "invite" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-card-footer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: sharing.network?.state === "ready" ? "Internet connection ready" : "Sharing enabled" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-actions", children: [
        (sharing.code?.exists || invitation) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, disabled: !!busy, onClick: () => change("sharing.revoke"), children: busy === "sharing.revoke" ? "Revoking\u2026" : "Revoke code" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, disabled: !!busy, onClick: () => change("sharing.stop"), children: busy === "sharing.stop" ? "Stopping\u2026" : "Stop sharing" })
      ] })
    ] }),
    (error || status.error || sharing.error || sharing.network?.error || unavailable) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-inline-error", role: "alert", children: error || status.error || sharing.error || sharing.network?.error || "This DSH version cannot safely hand off local control. Sharing is unavailable." })
  ] });
}
function ConnectCard({ onConnected }) {
  const id = (0, import_react.useId)();
  const [code, setCode] = (0, import_react.useState)("");
  const [name, setName] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [connected, setConnected] = (0, import_react.useState)(null);
  const [opened, setOpened] = (0, import_react.useState)(false);
  const mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function connect(event) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    setConnected(null);
    setOpened(false);
    try {
      const value = await requestRemote("devices.connect", { code: code.trim(), ...name.trim() ? { name: name.trim() } : {}, requestId: makeRequestId() }, { timeout: 3e4 });
      if (!mounted.current) {
        await releaseRemote(value.device.id).catch(() => {
        });
        return;
      }
      setCode("");
      setConnected(value.device);
      onConnected?.(value.device);
      try {
        await openRemoteWindow(value.device.id);
        if (mounted.current) setOpened(true);
      } catch (failure) {
        if (mounted.current) setError(`${safeMessage(failure)} The computer is paired. Choose Open remote window below.`);
      }
    } catch (failure) {
      if (mounted.current) setError(`${safeMessage(failure)} If the connection timed out, create a fresh code on the other computer before trying again.`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function open() {
    if (!connected || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestRemote("control.acquire", { remoteId: connected.id });
      await openRemoteWindow(connected.id);
      setOpened(true);
    } catch (failure) {
      if (mounted.current) setError(safeMessage(failure));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "rc-pair-card rc-connect-card", "aria-labelledby": `${id}-title`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-card-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-card-symbol", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "link", size: 23 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-step-label", children: "On this computer" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: `${id}-title`, children: "Connect to another computer" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-card-intro", children: "Open Remote Control on the other computer, create a connection code, and paste it here." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "rc-setup-form", onSubmit: connect, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${id}-paste`, children: "Paste connection code here" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { id: `${id}-paste`, className: "rc-paste-code", value: code, onChange: (event) => setCode(event.target.value), placeholder: "DSH1.\u2026", rows: 5, required: true, maxLength: 12e3, autoComplete: "off", spellCheck: false, disabled: busy })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { htmlFor: `${id}-label`, children: [
          "Save as ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-tiny", children: "(optional)" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `${id}-label`, value: name, onChange: (event) => setName(event.target.value), placeholder: "Home computer", maxLength: 80, autoComplete: "off", disabled: busy })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "rc-btn rc-btn-primary rc-wide", type: "submit", disabled: busy || !code.trim(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "link" }),
        busy ? "Connecting\u2026" : "Connect and open DSH"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-privacy-note", children: "The remote DSH opens in its own window. The original computer can take back control with one click." })
    ] }),
    connected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-connected-result", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: connected.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: opened ? "Connected \xB7 remote window opened" : "Paired \xB7 ready to open" })
      ] }),
      !opened && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { onClick: open, disabled: busy, children: "Open remote window" })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-inline-error", role: "alert", children: error })
  ] });
}
function RemoteControlPanel() {
  const [revision, setRevision] = (0, import_react.useState)(0);
  const listing = usePoll("devices.list", {}, true, 1e4, revision);
  const devices = listing.value?.items || [];
  const [dialog, setDialog] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const refresh = () => setRevision((value) => value + 1);
  async function open(device) {
    if (busy) return;
    setBusy(device.id);
    setError("");
    try {
      await requestRemote("control.acquire", { remoteId: device.id }, { timeout: 2e4 });
      await openRemoteWindow(device.id);
    } catch (failure) {
      setError(safeMessage(failure));
    } finally {
      setBusy("");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-remote-control rc-setup-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "rc-topbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-eyebrow", children: "YOUR DSH, WHEREVER YOU ARE" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Remote Control" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Share a code. Pick up where you left off." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-top-icon", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 28 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-setup-scroll", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-pair-grid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShareCard, { onChanged: refresh }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectCard, { onConnected: refresh })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "rc-saved", "aria-label": "Paired computers", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-saved-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Paired computers" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Reopen an available connection, or pair again with a fresh code." })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, icon: "refresh", "aria-label": "Refresh paired computers", onClick: refresh, disabled: listing.loading })
        ] }),
        (error || listing.error) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-inline-error", role: "alert", children: error || listing.error }),
        devices.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "rc-saved-list", children: devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-saved-device", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-device-icon", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 20 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "rc-saved-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: device.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: deviceAddress(device.url) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { primary: true, icon: "link", onClick: () => open(device), disabled: !!busy, children: busy === device.id ? "Connecting\u2026" : "Open remote window" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, icon: "edit", className: "rc-icon-btn", "aria-label": `Edit ${device.name}`, onClick: () => setDialog(device) })
        ] }, device.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-saved-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: listing.loading ? "Loading paired computers\u2026" : "Your paired computers will appear here." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "rc-setup-footnote", children: "Each computer needs this plugin and must stay awake with DSH open." })
    ] }),
    dialog && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceDialog, { device: dialog, onClose: () => setDialog(null), onSaved: () => {
      setDialog(null);
      refresh();
    }, onRemoved: () => {
      setDialog(null);
      refresh();
    } })
  ] });
}
function RemoteWindow({ remoteId = new URLSearchParams(globalThis.location?.search || "").get("remoteId") }) {
  const root = (0, import_react.useRef)(null);
  const visible = useVisible(root);
  const [device, setDevice] = (0, import_react.useState)(null);
  const [drafts, setDrafts] = (0, import_react.useState)({});
  const [state, setState] = (0, import_react.useState)({ value: null, error: "" });
  const [error, setError] = (0, import_react.useState)("");
  const [revision, setRevision] = (0, import_react.useState)(0);
  const [busy, setBusy] = (0, import_react.useState)("");
  const [disconnected, setDisconnected] = (0, import_react.useState)(false);
  const [suspended, setSuspended] = (0, import_react.useState)(false);
  const task = useTaskScope(remoteId || "missing");
  (0, import_react.useEffect)(() => {
    if (!remoteId) {
      setError("No computer was selected. Open this window from Remote Control.");
      return;
    }
    task("devices.list", {}, (value) => {
      const found = value.items?.find((item) => item.id === remoteId);
      if (found) {
        setDevice(found);
        document.title = `${found.name} \xB7 DSH Remote`;
      } else setError("This computer is no longer paired. Open Remote Control and connect with a fresh code.");
    }, setError);
  }, [remoteId, task]);
  (0, import_react.useEffect)(() => {
    if (!device || disconnected || suspended || busy) return;
    return watchControl({ remoteId: device.id, onChange: setState });
  }, [device?.id, revision, disconnected, suspended, busy]);
  (0, import_react.useEffect)(() => {
    const lost = () => {
      setSuspended(true);
      setState({ value: { owner: "local", heldByYou: false }, error: "" });
    };
    window.addEventListener("dsh-remote-control-lost", lost);
    return () => window.removeEventListener("dsh-remote-control-lost", lost);
  }, []);
  (0, import_react.useEffect)(() => {
    if (!device) return;
    const close = () => {
      fetch("/api/remote-control", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "content-type": "application/json", "x-dsh-remote-control": "1" }, body: JSON.stringify({ action: "window.leave", remoteId: device.id }) }).catch(() => {
      });
    };
    window.addEventListener("pagehide", close);
    return () => window.removeEventListener("pagehide", close);
  }, [device?.id]);
  const canControl = !disconnected && !suspended && !busy && state.value?.heldByYou === true && !state.error;
  async function release(disconnect = false) {
    if (busy || !device) return;
    setBusy("release");
    setError("");
    setState({ value: { owner: "local", heldByYou: false }, error: "" });
    try {
      await releaseRemote(device.id);
      if (disconnect) setDisconnected(true);
      else setRevision((value) => value + 1);
    } catch (failure) {
      setError(`${safeMessage(failure)} Local control returns automatically when the connection lease expires.`);
      setDisconnected(true);
    } finally {
      setBusy("");
    }
  }
  async function acquire() {
    if (busy || !device) return;
    setBusy("acquire");
    setError("");
    try {
      await requestRemote("control.acquire", { remoteId: device.id });
      setDisconnected(false);
      setSuspended(false);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(safeMessage(failure));
    } finally {
      setBusy("");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-remote-control rc-remote-window", ref: root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "rc-window-bar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-window-brand", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 21 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
          "deepseek ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "REMOTE" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-window-status", role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rc-status-dot" }),
        disconnected ? "Disconnected" : canControl ? "You have control" : state.value ? "View only" : "Checking control\u2026"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "rc-actions", children: [
        canControl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, onClick: () => release(), disabled: !!busy, children: "Release control" }) : device && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { primary: true, onClick: acquire, disabled: !!busy, children: busy === "acquire" ? "Connecting\u2026" : disconnected ? "Reconnect" : "Take control" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { onClick: () => release(true), disabled: !!busy || disconnected || !device, children: "Disconnect" })
      ] })
    ] }),
    (error || state.error) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { error: true, children: error || safeMessage(state.error) }),
    !canControl && !disconnected && state.value && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "Local control is active or your connection ended. Your draft is preserved. If the owner took back control, ask them to resume remote access and connect again." }),
    device && !disconnected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceWorkspace, { device, visible, drafts, setDrafts, canControl }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { icon: "monitor", title: disconnected ? "Control returned" : error ? "Connection unavailable" : "Opening your remote DSH\u2026", children: disconnected ? "This computer has been disconnected. Its sessions continue running." : error || "Loading the paired computer and checking your connection." })
  ] });
}
var inject = ["slots"];
function apply(ctx) {
  const lifetimeBanner = typeof ctx.effect === "function";
  if (lifetimeBanner) ctx.effect(() => installLocalHandoffBanner(), "remote-control local handoff banner");
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: "remote-control", order: 15, label: "Remote Control" }, function RemoteControlIcon() {
    (0, import_react.useEffect)(() => lifetimeBanner ? void 0 : installLocalHandoffBanner(), []);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor", size: 18 });
  }));
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "remote-control" }, RemoteControlPanel));
}
return module.exports;}});
