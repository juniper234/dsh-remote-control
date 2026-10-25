# DSH Remote Control 0.4.1

The mobile remote window now opens sessions in a full-width chat view. Use
**Sessions** to return to the searchable list. Drafts stay with each chat, and
the transcript scrolls independently above the composer when the keyboard opens.

Continue your DSH chats from another Windows computer using a connection code.

1. Install this plugin on both computers and open **Remote Control**.
2. On the shared computer, choose **Once** or **Unlimited** code uses and **Never**, **30 minutes**, **1 hour**, or a **Custom** expiry. Desktop access is optional.
3. Choose **Create connection code**, then **Copy connection code**.
4. Paste it into **Connect to another computer** on the other DSH. Choose **Connect and open DSH**.

The connected DSH opens in an Edge app window. The original DSH continues to own its sessions; local chat actions pause while the remote computer controls them. **Take back control** returns control and pauses the code. **Resume remote access** reopens an unused or reusable code. **Revoke code** invalidates it and ends paired access.

Automatic internet access uses a bundled, verified Cloudflare helper. A stable HTTPS address can also be supplied. Temporary addresses change after sharing restarts, so automatic connections then need a replacement code even when the code itself has no expiry. Code expiry controls new pairing, not an established connection's duration.

Requires Windows, Microsoft Edge, and DSH `>=0.2.1-rc.2 <0.3.0`. No installed application files are patched. Sharing starts only when requested. Share the code privately. Windows lock screens, UAC and some elevated windows require local interaction. Desktop streaming uses scaled PNG updates.
