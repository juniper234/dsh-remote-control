# DSH Remote Control

Remote Control for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): copy/paste pairing, a separate remote window, Windows desktop control and one-click return to the local computer. Current source version: **0.4.1**.

## Features

- Native Remote Control panel with share and connect actions.
- One-use or reusable codes; expiry is independent: never, 30 minutes, 1 hour or a custom duration.
- Shared session controller with exclusive local/remote admission and a visible Take back control action.
- Sessions and optional Windows screen/mouse/keyboard; phone-friendly list/chat navigation and retained drafts.
- Bundled-helper runtime with digest checks; tunnel creation is an explicit user action.

## Build from source

Requires Node 24, the supported DSH 0.2.1-rc.2 runtime for native integration tests, and Windows for desktop control.

```powershell
npm ci
node tools/prepare-tunnel.mjs "C:\path\to\cloudflared.exe"
npm run build
npm test
npm run test:reload
```

The Git checkout omits the 55 MB Cloudflare executable. Obtain the Windows helper from the [Cloudflare 2026.10.1 release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.1). Preparation requires SHA256 `4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6`; a different file is refused. Preparation does not start a tunnel. Full installation/artifact tests require this helper.

Wait for all DSH work to finish and close the app normally before installing. Start with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/install.ps1 -WhatIf`, review the result, then install and reopen normally. See [setup](docs/SETUP.md), [control design](docs/DESIGN-0.4.md) and [tunnel lifecycle](docs/TUNNEL.md).

## References and credits

- [DeepSeek Harness — DeepSeek AI](https://github.com/deepseek-ai/deepseek-harness): host platform and SDK.
- [cloudflared — Cloudflare](https://github.com/cloudflare/cloudflared): optional connection helper, Apache-2.0.
- [React/React DOM — Meta and contributors](https://github.com/facebook/react): independent remote window UI, MIT.

Full third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). These credits describe verified platform/dependency usage; a separate community upstream is not inferred from a similar repository name.

## Verification and limits

Source tests cover pairing policies, leases, stale responses, ambiguous mutations, session ownership, tunnel lifecycle and desktop boundaries. Native capture is opt-in; simulation does not prove physical remote input or a public two-PC connection. Quick Tunnel addresses can change, even when a code has no expiry. The original DSH process continues to own session files. See [verification](docs/VERIFICATION.md).

MIT for this plugin's own code; upstream components retain their own licenses.
