export const windowHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};

export function remoteWindowHtml() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Remote DSH</title><style>html,body,#dsh-remote-root{margin:0;width:100%;height:100%;background:#161719;color:#eee;font-family:system-ui,sans-serif}*{box-sizing:border-box}</style><script src="/api/remote-control/window.js" defer></script></head><body><div id="dsh-remote-root"></div></body></html>';
}
