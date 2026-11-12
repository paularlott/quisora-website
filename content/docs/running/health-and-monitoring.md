---
title: "Health and monitoring"
weight: 160
---

- `/healthz`: liveness.
- `/readyz`: readiness, cluster-aware. Route load balancers on it. It reports size, quorum, the partitions this node owns and
  counts of writes whose outcome is unknown, refusals and clock skew.
- `GET /api/cluster` (super admins) and the console's settings page: the node's cluster status.
- The probes, metrics, discovery and JWKS are never shed under load (`limits.max_in_flight`, default 4096 per node).
- Short-lived sign-in state (flows, codes, challenges) is held in each node's memory up to
  `limits.ephemeral_mb` (default 1024 MiB); past it, requests that would add to it get 503 with `Retry-After` (a
  page, or `temporarily_unavailable` from the OAuth endpoints) until expiries make room, and the node logs a warning
  (`this node's short-lived state is full`) at most once a minute. Rate-limit counters are never refused. With a
  shared database this state lives in the database instead. A pushed authorization request (PAR) holds nothing: its
  request_uri carries the request, sealed ([PAR](/docs/applications/par/)).
- A sign-in started at an authorization endpoint (or a device code's verification page) holds a flow for up to 20
  minutes, until it finishes. One client address holds at most `limits.flows_per_ip` (default 50; an IPv6 /64 counts
  as one address, 0 turns it off) at once; past it new ones get 429 until one finishes or the address's count starts
  again (20 minutes after its first flow), so a few addresses cannot fill `limits.ephemeral_mb` with sign-ins they
  never finish. Starting them is limited too, to 300 a minute per address. Like the other limits it is approximate (an
  address may hold up to about twice it as its count starts again). Behind a proxy set `server.trust_proxy`, or every
  user shares the proxy's address and its flows.

## Metrics

`GET /metrics` serves Prometheus metrics when `metrics.token` is set (`QUISORA_METRICS_TOKEN`); Prometheus sends it
as a bearer token (`authorization: { credentials: … }` in the scrape config). Without a token there is no such
endpoint. Every node serves its own.

| Metric | What |
| --- | --- |
| `quisora_http_requests_total{code}` | Requests by status class (`2xx` … `5xx`) |
| `quisora_http_request_duration_seconds` | Time to answer (histogram) |
| `quisora_http_shed_total` | Requests refused because too many were in progress |
| `quisora_http_denied_total` | Requests refused with 403 because the client's address is in `server.deny_networks` ([denied addresses](/docs/running/limits-and-denied-addresses/)); not counted in `quisora_http_requests_total` |
| `quisora_audit_events_total{action,outcome}` | Every audit event: `login.failure`, `login.lockout`, `login.limited`, `oauth.refresh.reuse`, `oauth.code.replay`, `oauth.client_auth.limited`, `passkey.clone` and the rest ([what is recorded](/docs/running/audit-log/#what-is-recorded)) |
| `quisora_audit_undelivered_total` | Audit events VictoriaLogs will never receive |
| `quisora_audit_spool_bytes` | Disk the VictoriaLogs spool uses (growing: VictoriaLogs is not taking events) |
| `quisora_mail_queued` | Emails this node has waiting to be sent |
| `quisora_mail_failed_total{reason}` | Emails that never reached the mail server: `given_up` (every retry failed; the log names the recipient), `dropped` (kept past the queue's discard horizon, or unreadable) and `expired` (the sign-in code or link in it had expired while it waited) |
| `quisora_authorize_refused_total{error}` | Authorization requests from a known application sent back with an error before anyone signed in, by error: `invalid_scope` (it asked for a scope its settings do not allow), `unauthorized_client` (a grant type it may not use), `invalid_request` and the others. Each is also logged as a warning (`oidc: authorization request refused`) naming the application, the error and why; not an audit event, as nobody has signed in and anyone who knows a client ID can cause one. A rise after an application's settings were changed is usually that change (its `client.update` audit event shows what changed) |
| `quisora_ephemeral_bytes`, `quisora_ephemeral_budget_bytes`, `quisora_ephemeral_entries` | This node's short-lived state (sign-in flows, codes, challenges, rate-limit counters): the memory it takes, by the estimate checked against `limits.ephemeral_mb`; that limit in bytes; how many entries it holds. With a shared database the state is in the database, and these stay near 0 |
| `quisora_ephemeral_refused_total{reason}` | Requests refused for short-lived state, by reason: `full` (this node's short-lived state at `limits.ephemeral_mb`: 503) and `flows_per_ip` (an address holding `limits.flows_per_ip` sign-ins in progress: 429) |
| `quisora_backchannel_logout_queued` | Back-channel logouts this node has waiting to be retried (growing: an application is not taking them) |
| `quisora_backchannel_logout_failed_total` | Back-channel logouts given up on after every retry, dropped because the queue was full (an organization holds at most 2,500 of a node's 10,000 retries, so only its own are dropped), or dropped unsent past the queue's discard horizon |
| `quisora_ready`, `quisora_writable`, `quisora_leader` | This node serves; accepts changes; runs housekeeping |
| `quisora_cluster_alive_nodes`, `quisora_cluster_size`, `quisora_cluster_quorum` | Cluster membership |
| `quisora_partitions_owned` | Partitions this node owns (the 64 are shared by the ready nodes) |
| `quisora_partition_writes_total`, `quisora_partition_writes_refused_total`, `quisora_partition_writes_unknown_total`, `quisora_partition_writes_unavailable_total` | Changes this node made since it started: committed; refused by an owner (a version had moved, a unique value was in use); outcome not known (an owner lost mid-write); no owner or majority found |
| `quisora_partition_reads_total`, `quisora_partition_reads_failed_total`, `quisora_partition_takeovers_total` | Fresh reads asked of owners and those that failed; partitions this node became the owner of |
| `quisora_partitions_unreadable` | Partitions this node cannot serve from its copy now (no owner heard, trailing it, diverged): their records answer 503 |
| `quisora_partitions_importing` | Partitions being copied whole to this node (none of such a partition is served, and a backup is refused, until the copy finishes) |
| `quisora_partitions_diverged`, `quisora_partition_divergences_total` | Partitions whose copy here holds writes their owner does not have (the node is not ready: resync it); divergences found since the node started |
| `quisora_partition_lag_seconds{partition}`, `quisora_partition_catching_up{partition}`, `quisora_partition_diverged{partition}` | Per partition: how long this node has trailed a position its owner reported committed (0: not behind); 1 while it catches up; 1 if it diverged |
| `quisora_master_key_rotation` | 1 while previous master keys are configured |
| `quisora_build_info{version}`, `quisora_uptime_seconds`, `quisora_goroutines`, `quisora_memory_heap_bytes` | The process |

Alerts worth having:

- `increase(quisora_authorize_refused_total{error=~"invalid_scope|unauthorized_client"}[15m]) > 0`: an application asks
  for what its settings do not allow, so its users cannot sign in (the log names the application).
- `quisora_ready == 0` or `quisora_writable == 0` for more than a few minutes; `quisora_cluster_alive_nodes <
  quisora_cluster_quorum`; `sum(quisora_partitions_owned) != 64` across the nodes (a partition nobody owns), or a steady
  `rate(quisora_partition_takeovers_total[10m])` (ownership flapping).
- `quisora_partitions_unreadable > 0` for more than a few minutes (some organizations get 503: a node does not leave the
  load balancer for it), `quisora_partitions_diverged > 0` (resync the node), or a `quisora_partition_lag_seconds` that
  keeps growing (a catch-up that keeps failing).
- `increase(quisora_audit_undelivered_total[5m]) > 0`, or `quisora_audit_spool_bytes` growing: audit events at risk.
- Bursts of `quisora_audit_events_total{outcome="failure"}`, by action: password guessing (`login.failure`,
  `login.lockout`), floods (`login.limited`, `oauth.client_auth.limited`), stolen tokens (`oauth.refresh.reuse`,
  `oauth.code.replay`), a cloned passkey (`passkey.clone`).
- Any `quisora_audit_events_total{action=~"keys.rotate|cluster.force_start|backup.download|backup.restore"}`:
  rare, privileged events someone should know about.
- `increase(quisora_mail_failed_total[1h]) > 0`: mail is being lost (invitations, password resets, sign-in codes): the mail
  server is down or refusing it, or the queue is not keeping up. `quisora_mail_queued` growing says the same earlier.
  Likewise `increase(quisora_backchannel_logout_failed_total[1h]) > 0` for applications that are not told of a sign-out.
- `rate(quisora_http_shed_total[5m]) > 0`: the node is overloaded ([under attack](/docs/running/limits-and-denied-addresses/#under-attack)).
- `quisora_ephemeral_bytes / quisora_ephemeral_budget_bytes > 0.8` for 5 minutes, or any
  `increase(quisora_ephemeral_refused_total{reason="full"}[5m]) > 0`: the node's short-lived state is (nearly) full and
  new sign-ins get 503: a flood of unfinished sign-ins, or `limits.ephemeral_mb` too small for the load. A steady
  `rate(quisora_ephemeral_refused_total{reason="flows_per_ip"}[5m])` is addresses starting sign-ins they do not finish
  (or many users behind one address: see `server.trust_proxy`). Refusals for `flows_per_ip` are counted only: no audit
  event or log line is written for each, so a flood of them cannot fill the audit log; the request log (`log.access`)
  shows the address of each 429.
- For tenants that use SSH certificates: a log line `oidc: making an SSH revocation list` at error level (the tenant's
  revocation list could not be made; its address answers 503 and servers keep their old list), and, on every server that
  fetches it, the fetch unit failing or the revocation list file older than 5 minutes ([SSH monitoring](/docs/ssh/monitoring/)).

## Access log

The access log is on by default (`log.access`, `QUISORA_LOG_ACCESS`; set it to false to turn it off). It logs every
request: method, path, status, duration, size, client address
and request id (the `X-Request-ID` response header, also in the audit events the request made). The query string is
never logged: it carries authorization codes, states and link tokens. Probes, scrapes and static files are not
logged.
