# Remote Control design — 24 October 2026

The requested flow combines native copy/paste setup, an independent remote DSH window, exclusive interactive control and one-click local reclaim. Code use count and expiry are independently configurable.

## Pairing and window

The host enables its loopback companion, opens an automatic tunnel or uses a configured HTTPS origin, then issues a code containing the origin and invitation secret. Each permitted use exchanges the secret for a distinct client credential. Only invitation hash and policy are persisted. One-time use is committed before access is granted, so restart cannot restore a spent code.

The connecting plugin stores its credential in the existing private device store. It opens a scoped loopback viewer in Microsoft Edge app mode. The shipped DSH Electron main denies browser popups and uses dsh-app://app, so ordinary window.open cannot supply this experience. The viewer uses a short-lived, one-use launch ticket in a fragment, removes the fragment and exchanges it for an HttpOnly SameSite cookie. No DSH account token, invitation secret or complete owner browser session is passed to Edge.

The viewer permits only the selected remote's session/control/optional desktop operations. It cannot manage sharing, reveal codes, access other devices or proxy arbitrary URLs. Loopback Host, Origin, authentication and action scope are checked. Cookie names are unique across windows because cookies are not port-scoped. A viewer is bound to its pairing credential generation and cannot inherit later credentials stored under the same device ID. Closing one viewer preserves other active viewers; the last viewer releases control. A short unload grace allows page reload.

## Single writer and control

The original DSH process owns all session files. Its companion calls the in-process SessionController. A command lease controls admission; storage locks are never transferred or deleted.

Reversible wrappers cover create, prompt, cancel, rename, updateQueue, fork and selectModel. They preserve the traced SDK invocation receiver. An AsyncLocalStorage permit identifies the current lease; other new commands are refused while remote control is held. Already admitted commands and running agent work continue.

One paired client owns the 30-second lease. The remote window renews every eight seconds, including when hidden. Renewal failure disables remote input and does not automatically acquire a new lease. Reclaim revokes client credentials, releases held desktop input and pauses code admission. Resume is local. Revoke deletes the code and revokes access.

After entering code mode, transparent legacy HTTP/WebSocket proxies are disabled and existing proxy sockets close. Owner management routes are always blocked through the companion proxy, preventing bypass of handoff or local reclaim.

## Policies and persistence

Use count is once or unlimited. Expiry is a positive safe duration or null for never. The UI offers 30 minutes, one hour, never and custom minutes/hours/days. These govern new pairing; established paired credentials remain valid until revoked, retired or companion restart. Explicit reconnect cannot steal another client's lease.

Private atomic state holds only the code hash, policy, origin/network kind, expiry, paused and spent flags. Stop pauses admission; normal reload preserves policy. A replacement invalidates the prior invitation. Full code text stays in host memory, exposed only through the authenticated local owner API.

## Network lifecycle

The package includes a SHA-256-pinned Cloudflare helper. Start is explicit. No account, download at sharing time, firewall change or shell command is needed. The watchdog owns its exact child and shuts it down on parent IPC loss. Cancelling setup blocks late starts; disposal drains invitation cleanup before replacement. Unconfirmed cleanup produces an error.

No-expiry does not imply a permanent internet address. Quick Tunnel addresses change after restart. A stable custom HTTPS origin is required for the same code across such restarts. No paid hosting, external relay or persistent provider account was added.

## Verification boundary

Tests exercise actual loopback HTTP, persistence, code policies, contention, revocation, SDK fences, viewer authentication, React UI flows and exact-child subprocess cleanup. Installed Cordis/SessionController tests verify context preservation. No public tunnel, physical remote PC, model prompt, physical desktop input, live activation or host UI automation was used. The live linked 0.3 source remains untouched.
