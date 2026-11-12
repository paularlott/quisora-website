---
title: "Limits and denied addresses"
weight: 60
---

| Setting                       | Default | What                                                                                                   | On a reload          |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `limits.max_in_flight`        | 4096    | Requests in progress on a node before it answers 503 (never the probes, metrics, discovery, JWKS or the console's event stream) | Next request         |
| `limits.login_per_ip_min`     | 300     | Sign-in attempts per organization and address per minute (three times it per address across organizations; a browser that signed in to the account before counts against the account's own) | Next attempt         |
| `limits.lockout_attempts`     | 10      | Failed passwords before an account is locked (0: never)                                                | Next attempt         |
| `limits.lockout_minutes`      | 15      | How long the lock lasts                                                                                | Next attempt         |
| `limits.flows_per_ip`         | 50      | Sign-ins (authorization and device flows) one address may hold unfinished at once (0: no cap)           | Next sign-in         |
| `limits.org_failures_per_minute` | 100  | Failed passwords per organization per minute before it counts as [under a spray](/docs/security/running-securely/#lockout-and-password-spraying) and limits failures per address too (0: never) | Next attempt         |
| `limits.password_min_length`  | 15      | Shortest password accepted (8 to 64)                                                                   | Next password set    |
| `limits.grants_per_user`      | 1000    | Refresh grants one user may hold                                                                       | Next grant           |
| `limits.password_workers`     | CPUs    | Passwords hashed at once                                                                               | Restart only         |
| `limits.ephemeral_mb`         | 1024    | Memory for short-lived sign-in state                                                                   | Restart only         |
| `server.deny_networks`        | none    | Client addresses refused, below                                                                        | Next request         |

`server.deny_networks` lists IP addresses and CIDR ranges (`["203.0.113.7", "198.51.100.0/24", "2001:db8:bad::/48"]`)
whose requests get a bare 403 before anything else is done: no session or store read, no body read, no access log line
and no audit event, so a flood from them costs the node little and fills no log. The address is the client's as the
rest of the server sees it: behind `server.trust_proxy`, the one the proxies name in `X-Forwarded-For`; anyone else's
`X-Forwarded-For` is ignored. `/healthz`, `/readyz` and `/metrics` (which has its own token) answer every address, so a
load balancer or Prometheus in a denied network still sees the node. Each refusal counts in `quisora_http_denied_total`
(and not in `quisora_http_requests_total`); the counter has no address label (an address per label value would let an
attacker fill the metrics), and a refusal writes no log line, so a flood stays cheap. To find the addresses to deny, read
the client addresses (`ip`) in the request log (`log.access`) of the 429s and the other refusals, and in the audit log's
`login.failure`, `login.lockout` and `login.limited` entries. A range of every address (`0.0.0.0/0`, `::/0`) is refused as a mistake. The
list is checked one entry after another: it is for a handful of networks. A request is refused only after its TLS
handshake, so for many addresses (a botnet), or to save the handshakes, block them in a firewall or the proxy in front.

## Changing them without a restart

A reload reads the limits and `server.deny_networks` again from the config file and applies them to the running node:
SIGHUP (`kill -HUP <pid>`, see [reload or restart](/docs/running/rotating-the-master-key/#changing-the-keys-reload-or-restart)), or, on a gossip cluster or
nodes linked by `cluster.notify`, **Reload configuration** on the System page or `POST /api/cluster/reload`, which
reloads every node at once. **Each node reads its own file**: edit every node's file, then SIGHUP every node (or reload
them all at once).

- Nothing counted so far is reset: sign-in attempts in the current minute, an account's failed passwords, requests in
  flight. Tightening a limit applies to the next request against what has been counted already. A restart, by contrast,
  starts counters again: with gossip they live in the memory of the node that owns them
  ([Deletion](/docs/replication/deletion/#short-lived-state)), so restarting nodes mid-attack hands the attacker fresh budgets.
- The file is checked first: one that does not parse, or a bad network or limit, fails the reload and nothing changes.
  The log says `configuration not (fully) reloaded` with `error` (such as `server.deny_networks: …` or `limits: …`).
  A reload that applies logs `configuration reloaded` with `changed`, for example `limits.login_per_ip_min 300 to 60`
  and `server.deny_networks [203.0.113.0/24]`; the console's report lists the same.
- `limits.password_workers` and `limits.ephemeral_mb` size the node when it starts: a reload that changes them keeps
  the old value, says so (`changed limits apply only after a restart`), and the new one applies at the next restart.
- As for the keys, values given on the command line or in `QUISORA_*` environment variables cannot change while the
  server runs: set limits and `server.deny_networks` in the config file to change them with a reload.

## Under attack

1. Find the source: the audit events (`login.limited`, `login.failure`, `oauth.client_auth.limited`,
   `api.request.refused`) and the access log name the address (`ip`); `quisora_audit_events_total` and
   `quisora_http_shed_total` show the rate.
2. Deny it: add the address or its network to `server.deny_networks` in every node's file and reload every node.
   `quisora_http_denied_total` should start counting on each.
3. If it moves around, tighten the limits the same way: a lower `limits.login_per_ip_min`, `limits.lockout_attempts`
   or `limits.max_in_flight`. Reload rather than restart, so the counters keep what they have.
4. For more addresses than a short list, block them upstream (a firewall, the proxy or CDN in front).
5. Once it is over, take the entries out and reload again. The account steps (locking, signing out) are in
   [Running Quisora securely](/docs/security/running-securely/).
