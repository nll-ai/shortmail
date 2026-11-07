# Sender verification

Status: approved for implementation on 2026-11-07. Eric accepted both a Convex record of hashes and a browser-held secret. A globally verified address is not permission to send.

## What is stored

Convex stores hashes only: normalized address, one-time verification token, per-browser challenge secret, and per-browser session secret. The letter body stays in the browser until a normal send. There is no pending-message row.

The confirmation link is `https://<SHORTMAIL_PUBLIC_ORIGIN>/verify#t=<token>`. The token is in the URL fragment, so it is not sent as a query string or a Referer. Opening the link does not change server state. The page only displays the code and tells the visitor to paste it into the original form.

The original form posts the code together with the challenge secret that never left that browser. A click on another device, or by a mail-link scanner, cannot authorize the browser that requested the code. After a match, that browser may send as that address for 30 days. Another browser, another site, or cleared storage must confirm again.

Sessions last 30 days from confirmation, then expire. They are not forever. Changing the address on the form stops using the previous proof. Host-page JavaScript can read an embedded widget's stored secret. Embed only on sites you trust. This design does not use third-party cookies.

## Limits

Verification mail: 1 per address per 10 minutes, 5 per address per UTC day, 300 total per UTC day. Over the limit, the response is still the same `{ status: "accepted" }` and no mail is sent. Polling and confirm attempts are capped per challenge. Sender addresses that already proved possession are also limited to 20 letters per page per UTC day, and the existing 200-letter owner cap, honeypot, and disposable-address check stay. Forwarded IP headers are not a hard block.

Missing, mismatched, expired, or replayed proof fails closed, including a direct API call and a cached widget that does not send a session secret.

## Configuration

Convex environment `SHORTMAIL_PUBLIC_ORIGIN` is the public site origin with no path, for example `https://shortmail-gamma.vercel.app`. It is not a secret. If it is unset, no confirmation mail is sent.
