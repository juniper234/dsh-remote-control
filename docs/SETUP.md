# Setup

## Install on each computer

1. Use Windows with DeepSeek Harness `0.2.1-rc.2` and Microsoft Edge installed.
2. Extract the complete release ZIP. Keep `tools` beside `dist`.
3. Let active DSH work finish and close DSH normally using **Application → Exit**.
4. Double-click **tools → Install-Remote-Control.cmd**. It uses DSH's bundled runtime; separate Node installation is unnecessary.
5. Reopen DSH. **Remote Control** appears in the sidebar.

The installer backs up profile metadata under `DSH_HOME/remote-control/backups`, preserves other plugins and the upload-resolver guard, and installs a stable copy of the packed runtime. It verifies all runtime artifacts and the network helper hash. It does not start sharing or a tunnel.

## Share this computer

1. Open **Remote Control → Share this computer**.
2. Choose a computer name.
3. Choose **Once** or **Unlimited** code uses.
4. Choose **Never**, **30 minutes**, **1 hour**, or **Custom** expiry. Custom accepts a positive duration in minutes, hours or days.
5. Optionally enable **Include desktop access**. Otherwise the connection has DSH chats only.
6. Choose **Create connection code**. Automatic internet setup can take about a minute; **Cancel setup** remains available.
7. Choose **Copy connection code** and transfer it privately.

Once means one successful pairing. A saved paired computer may reconnect while its credential remains valid. Unlimited permits repeated pairing, with one remote computer controlling the harness at a time. Expiry governs new pairing; it does not interrupt already accepted agent work or automatically end a paired connection.

## Connect from the other computer

1. Open **Remote Control** in its DSH.
2. Paste the code into **Paste connection code here**.
3. Optionally name the saved device.
4. Choose **Connect and open DSH**.

An Edge app window opens with the remote session list, history and message composer. The original DSH process controls existing sessions; no second writer is created. If desktop access was included, the **Desktop** tab starts in view-only mode. **Enable control** enables keyboard and mouse input.

If connection or launch fails, follow the displayed message. Do not resend an uncertain prompt. A paired computer remains saved when a window launch fails; use **Open remote window** to retry explicitly.

## Android

Install the matching **DSH Remote 0.4.1** APK. Paste the same connection code
from the desktop plugin to open its chats and optional Desktop view. Select a
session to open the conversation full-width; **Sessions** returns to the list.
The Android app also preserves a separate **Full harness** link mode for
existing web-harness connections. That mode uses the harness's own login and
does not grant access using a companion code.

## Return control

- On the original PC, **Take back control** restores local chat actions, revokes paired credentials and pauses the code.
- **Resume remote access** locally reopens an unused/reusable code. A used one-time code requires replacement.
- On the remote PC, **Release control** leaves a read-only workspace. **Disconnect** ends its active connection.
- **Revoke code** invalidates the code and paired access. **Stop sharing** closes the listener and automatic tunnel and pauses the code.
- Closing the last remote window releases control. If release cannot be delivered, the 30-second control lease expires. This heartbeat is independent of the code's lifetime.

## Reusing codes

No-expiry means the code itself has no time limit. The shared computer must still be awake with DSH running and its address reachable.

Automatic Cloudflare addresses change after sharing restarts. Generate a replacement after that change. For the same reusable code across restarts, configure a stable HTTPS origin in **Connection options**, forwarding to the companion loopback port. The private code hash, use policy and spent/paused state survive restart. The full copyable code is kept only in host memory: keep the original privately or generate a replacement after restarting.

## Preflight and rollback

Read-only preflight from the extracted release:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\install.ps1" -PackagePath ".\dist\dsh-remote-control-0.4.1.tgz" -WhatIf
```

To restore a preserved older release, close DSH after work finishes and use its archive as the explicit `-PackagePath`. The installer supports 0.3 archives for rollback. Never delete session writer locks, overwrite account state, or edit the installed application archive.
