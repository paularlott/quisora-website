---
title: "First start"
weight: 20
---

`quisora serve` never creates anything. Set a new server up once with `quisora bootstrap`:

```bash
quisora bootstrap --data-dir /var/lib/quisora --public-url https://id.example.com
quisora serve --data-dir /var/lib/quisora --public-url https://id.example.com
```

- `bootstrap` creates the `primary` organization (second factor required) and a super admin without a password,
  `server.bootstrap_admin` (default `admin@example.com`).
- It prints a single-use invitation link (7 days). Open it, set a password or create a passkey, then a second factor.
- A second run changes nothing. `quisora invite primary admin@example.com` issues a new link while the server runs
  (it asks the running server, signing the request with the master key). Locked out of the console:
  [break-glass](/docs/security/running-securely/#incident-response).
- Until the server is set up, `/readyz` reports not ready.
