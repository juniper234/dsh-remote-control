# Automatic secure connection

Choosing **Generate connection code** starts one temporary Cloudflare Quick Tunnel
to the plugin's loopback companion. No Cloudflare account or router configuration
is required. The code is issued after the helper reports its HTTPS address and a
registered tunnel connection. An existing HTTPS address remains available in
Connection settings.

The Windows release includes `vendor/cloudflared.exe` (Cloudflare 2026.10.1,
55,325,120 bytes). Both the parent and the watchdog verify the complete file against
SHA-256 `4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6` before
launch. No executable is downloaded during sharing. To prepare a source release:

```powershell
node tools/prepare-tunnel.mjs "C:\path\to\verified\cloudflared.exe"
```

Include `vendor/` in the installable package, including the unmodified upstream
`CLOUDFLARED-LICENSE.txt` from the [2026.10.1 source release](https://github.com/cloudflare/cloudflared/blob/2026.10.1/LICENSE).
The executable is
launched without a shell, without a visible terminal, and with an empty dedicated
configuration so it does not inherit a named tunnel. Only `127.0.0.1:<port>` is
accepted as the forwarding target. Raw helper logs are discarded; addresses or
authentication material are never written to logs by this module.

`TunnelManager.start({port})` coalesces calls for the same port and returns
`{url,kind:'automatic',state:'ready'}`. `status()` returns state and a safe error.
`stop()`/`dispose()` disconnect the private IPC channel. The independent watchdog
then terminates only the exact Cloudflare process it created and exits after that
process exits. The same cleanup happens when the DSH parent crashes. It never
kills by process name or uses a PID loaded from disk. If cleanup cannot be
confirmed, stopping reports failure instead of claiming the tunnel is closed.

Quick Tunnel addresses change after restart and depend on Cloudflare availability.
They are temporary development connections, not a guaranteed hosting service.
The host computer must remain awake with DSH running. Pairing and control leases
are enforced by the companion; the tunnel itself does not grant access.

Verification here includes sixteen offline lifecycle tests and a real IPC
disconnect test with an owned harmless Node child standing in for Cloudflare.
No public tunnel or remote device was used during implementation.
