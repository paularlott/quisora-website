---
title: "Health and monitoring"
description: "Health endpoints, the metrics Quisora exports, and the alerts worth setting."
weight: 110
---

## What you need to do

1. Point your load balancer at `/readyz`, and your container or process checks at `/healthz`.
2. Set `metrics.token` and have Prometheus scrape `/metrics` on every node.
3. Start with these alerts, and add more from the [list below](#alerts-worth-having) as you need them:
   - a node not ready: `quisora_ready == 0` for more than a few minutes;
   - audit events at risk: `increase(quisora_audit_undelivered_total[5m]) > 0`;
   - email failing: `increase(quisora_mail_failed_total[1h]) > 0`;
   - an application whose users cannot sign in:
     `increase(quisora_authorize_refused_total{error=~"invalid_scope|unauthorized_client"}[15m]) > 0`.

## Health endpoints

- `/healthz` is liveness. Use it for container and process checks.
- `/readyz` is readiness and is cluster-aware. Route load balancers on it. It reports cluster size, quorum, the
  partitions the node owns and counts of unknown-outcome writes, refusals and clock skew.
- The System page shows the same cluster status for super admins.

Probes, metrics, discovery and JWKS are never shed under load.

## Access log

The access log is on by default (`log.access`, `QUISORA_LOG_ACCESS`; set false to turn it off). It records each request's
method, path, status, duration, size, client address and request id. The query string is never logged. Probes, scrapes
and static files are not logged.

## Reference

### Metrics

`GET /metrics` serves Prometheus metrics when `metrics.token` is set (`QUISORA_METRICS_TOKEN`). Prometheus sends the
token as a bearer token. Without a token there is no such endpoint. Every node serves its own.

| Metric | What |
| --- | --- |
| `quisora_http_requests_total{code}`, `quisora_http_request_duration_seconds` | Requests by status class, and time to answer |
| `quisora_http_shed_total` | Requests refused because too many were in progress |
| `quisora_http_shed_address_total` | Requests refused with 429 because their address had its share in progress (`limits.max_in_flight_per_ip`) |
| `quisora_http_denied_total` | Requests refused because the address is in `server.deny_networks` |
| `quisora_audit_events_total{action,outcome}` | Every audit event |
| `quisora_audit_undelivered_total`, `quisora_audit_spool_bytes` | Audit events logged in full as `audit.undelivered` (VictoriaLogs will never receive them, or the spool disk was slow and they reach it later too), and the spool's size |
| `quisora_mail_queued`, `quisora_mail_failed_total{reason}` | Emails waiting, and emails that never reached the mail server |
| `quisora_backchannel_logout_queued`, `quisora_backchannel_logout_failed_total` | Logouts waiting to be retried, and given up |
| `quisora_authorize_refused_total{error}` | Authorization requests from a known application refused before sign-in (`invalid_scope`, `unauthorized_client`, ...). Each is also logged as a warning naming the application. |
| `quisora_ephemeral_bytes`, `quisora_ephemeral_budget_bytes`, `quisora_ephemeral_entries` | The node's short-lived sign-in state against `limits.ephemeral_mb` |
| `quisora_ephemeral_refused_total{reason}` | Requests refused for it: `full` (503), `flows_per_ip` and `held_bytes` (429: an address or user at its limit), and `counters`, `contended`, `guard` and `cache` (the node's own caps) |
| `quisora_ready`, `quisora_writable`, `quisora_leader` | This node serves, accepts changes, runs housekeeping |
| `quisora_cluster_alive_nodes`, `quisora_cluster_size`, `quisora_cluster_quorum` | Cluster membership |
| `quisora_partitions_owned` | Partitions this node owns (64 in all, shared by the ready nodes) |
| `quisora_partition_writes_*`, `quisora_partition_reads_*`, `quisora_partition_takeovers_total` | Replicated writes (committed, refused, unknown, unavailable), reads and takeovers |
| `quisora_partitions_unreadable`, `quisora_partitions_importing`, `quisora_partitions_diverged` | Partitions this node cannot serve now, is being copied whole, or holds diverged data for |
| `quisora_partition_lag_seconds{partition}` | How long this node has trailed a partition's owner |
| `quisora_master_key_rotation` | 1 while previous master keys are configured |
| `quisora_build_info`, `quisora_uptime_seconds`, `quisora_goroutines`, `quisora_memory_heap_bytes` | The process |

### Alerts worth having

- `increase(quisora_authorize_refused_total{error=~"invalid_scope|unauthorized_client"}[15m]) > 0`: an application asks
  for what its settings do not allow, so its users cannot sign in.
- `quisora_ready == 0` or `quisora_writable == 0` for more than a few minutes. `quisora_cluster_alive_nodes <
  quisora_cluster_quorum`. `sum(quisora_partitions_owned) != 64` across the nodes, or a steady
  `rate(quisora_partition_takeovers_total[10m])` (ownership flapping).
- `quisora_partitions_unreadable > 0` for more than a few minutes (some organizations get 503), `quisora_partitions_diverged
  > 0` (resync the node), or a `quisora_partition_lag_seconds` that keeps growing.
- `increase(quisora_audit_undelivered_total[5m]) > 0`, or `quisora_audit_spool_bytes` growing: audit events at risk.
- Bursts of `quisora_audit_events_total{outcome="failure"}`: password guessing (`login.failure`, `login.lockout`), floods
  (`login.limited`, `oauth.client_auth.limited`), stolen tokens (`oauth.refresh.reuse`, `oauth.code.replay`), a cloned
  passkey (`passkey.clone`).
- Any `quisora_audit_events_total{action=~"keys.rotate|cluster.force_start|backup.download|backup.restore"}`: rare,
  privileged events someone should know about.
- `increase(quisora_mail_failed_total[1h]) > 0`, or `quisora_mail_queued` growing: invitations, resets and sign-in codes
  are being lost. Likewise `increase(quisora_backchannel_logout_failed_total[1h]) > 0`.
- `rate(quisora_http_shed_total[5m]) > 0`: the node is overloaded ([under attack](/docs/running/settings/#under-attack)).
- `quisora_ephemeral_bytes / quisora_ephemeral_budget_bytes > 0.8` for 5 minutes, or any
  `increase(quisora_ephemeral_refused_total{reason="full"}[5m]) > 0`: new sign-ins get 503. Either a flood of unfinished
  sign-ins or `limits.ephemeral_mb` is too small. A steady `flows_per_ip` or `held_bytes` rate is addresses starting
  sign-ins they do not finish, or many users behind one address (set `server.trust_proxy`, or raise `limits.held_kb`).
  A few addresses refused is an attack held off. Many at once with `full` rising is one with enough addresses to fill
  the node.
- For tenants that use SSH certificates: the log line `oidc: making an SSH revocation list` at error level, and on each
  server the fetch failing or the revocation list file older than 5 minutes
  ([SSH monitoring](/docs/ssh/setting-up-a-server/#watch-it)).
