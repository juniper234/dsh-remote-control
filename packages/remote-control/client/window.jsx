import React from 'react'
import {createRoot} from 'react-dom/client'
import {RemoteWindow} from './source.jsx'
import {claimRemoteWindow} from './pairing.mjs'

const theme = document.createElement('style')
theme.textContent = `html,body,#dsh-remote-root{margin:0;min-height:100%;height:100%;font-family:Inter,Segoe UI,system-ui,sans-serif;background:#101113;color:#eceef3}body{--dsw-alias-bg-layer-1:#101113;--dsw-alias-bg-layer-2:#181a1f;--dsw-alias-bg-layer-3:#20232b;--dsw-alias-border-l2:#30343f;--dsw-alias-label-primary:#eceef3;--dsw-alias-label-secondary:#b4bac9;--dsw-alias-label-tertiary:#8b93a7;--dsw-alias-brand-primary:#668dff;--dsw-alias-interactive-bg-hover:#262a35;--dsw-alias-state-error-primary:#ff8a98;--dsw-alias-state-success-primary:#80d4a3;color-scheme:dark}*{box-sizing:border-box}`
document.head.append(theme)
// Keep the transcript and composer inside the visible area when a phone's
// keyboard shrinks the viewport. Desktop and WebViews without this API use dvh.
if (window.visualViewport) {
  const resize = () => document.documentElement.style.setProperty('--rc-viewport-height', `${window.visualViewport.height}px`)
  window.visualViewport.addEventListener('resize', resize)
  resize()
}
const root = document.getElementById('dsh-remote-root')
root.textContent = 'Opening your remote DSH…'
claimRemoteWindow().then(() => {
  createRoot(root).render(<RemoteWindow/>)
}).catch(() => {
  root.style.cssText = 'display:grid;place-items:center;min-height:100vh;padding:32px;text-align:center'
  root.textContent = 'This remote window link has expired or could not be opened. Open it again from Remote Control in DSH.'
})
