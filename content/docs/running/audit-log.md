---
title: "Audit log"
description: "Where audit events are kept, what is recorded, and how to send them to VictoriaLogs."
weight: 100
---

Every audit event is written to the structured log (`log.format = "json"` for log shippers). The console's audit pages
read it from one of two places. Administrators see **Audit log** in their organization, and super admins also see
**All audit logs** across every organization.

{{< screenshot name="run-audit" alt="An organization's audit log: search box, time range, filters and the list of events" >}}

|  | Database (default) | VictoriaLogs |
| --- | --- | --- |
| For | Development, home labs, testing | Production, and anywhere a retained audit trail is required |
| Kept | `audit.retention_days` (90) | VictoriaLogs' `-retentionPeriod` |
| Gossip cluster | Each node keeps its own events. A page asks every node and merges the answers, and says which did not answer. | Every node sends. Any node reads. |

{{< tip "warning" >}}
Production, and any deployment whose compliance standard or security policy requires a retained audit trail, must use
VictoriaLogs. The database trail keeps events for days, not a year or more, is per node in a cluster, and has no
protection against someone with write access to the database.
{{< /tip >}}

An organization's administrators share 120 audit pages a minute (the console, the API and the MCP server together),
and each of them may read 60. Each super admin has 120 of their own. Past that a page gets 429 for a minute. A page
that takes longer than 15 seconds is given up with 503: try a shorter time range.

Administrators see their own organization's events, except those that name a super admin as actor or target (super
admins are invisible below them everywhere). Super admins see everything. The mark is set when the event is written
and never changes afterwards.

## What is recorded

| Area | Events |
| --- | --- |
| Sign-in | `login.success` (`audit.logins = false` turns it off), `login.failure`, `login.lockout`, `login.limited`, `org.spray.start` and `org.spray.end`, `logout`, `login.session.evict`, `passkey.clone`, `login.recovery_code`, `mfa.import`, `login.email_code.sent`, `password.forgot`, `password.reset`, `invite.accept` |
| OAuth and OpenID Connect | `oauth.consent`, `oauth.grant`, `oauth.token_exchange`, `oauth.device.approve`, `oauth.revoke`, `oauth.grant.evict`, `oauth.code.replay`, `oauth.refresh.reuse`, `oauth.client_auth.limited`. With `audit.tokens = true` also `oauth.refresh`, `oauth.client_credentials` and `oauth.device.start`. |
| Administration | Users, groups, organizations, tenants, access, [access requests](/docs/access/access-requests/#records-and-audit) (`access_request.*`), [caller verification](/docs/access/verifying-callers/#records-and-audit) (`call_verify.*`), clients, providers, API tokens, service accounts, invitations, `user.locked_out`, signing keys (`keys.create`, `keys.rotate`, `keys.remove`), SSH certificate authorities (`ssh.*`), `backup.download`, `backup.restore`, `cluster.force_start`, `cluster.reload`, `config.reload` |
| API access | `api.request.refused` and `apitoken.refused`: a refused management API or SCIM request, and a token presented with a wrong secret or after it was ended. At most once a minute per token or caller and reason on each node. |
| Emergency sign-out | `org.signout` and `server.signout`, then `signout.sweep` |
| Account self-service | `account.*`: passkeys, authenticator app, recovery codes, sessions, applications, connected providers, email verification |

Failures anyone can repeat (wrong passwords and codes, refusals of a locked account, failed provider and passkey
sign-ins) are recorded at most once a minute per account, sign-in step and address on each node. The next event counts
the repeats held back in `detail.suppressed`. Every address that sends a wrong credential is still named in that
minute, up to 200 addresses a minute per organization on each node. `quisora_audit_events_total{action="login.failure"}`
counts every one.

Updates record what changed, field by field, as `changed.<field>` = `old → new`. Secrets never appear.

Every event has an `outcome` (`failure` for refusals, lockouts, limits, replays, reuse and clones, `success` otherwise), a
`request_id` (also the `X-Request-ID` response header), `user_agent`, `session_id` and `ip`. Changes made with a personal
API token carry `detail.token_id`. A service account's changes name it as actor, `service:<name>`.

Commands record who ran them. `quisora invite` and `quisora sign-out` carried out by a running node have the actor
`command:invite` or `command:sign-out`. Commands that run on their own against a store (`bootstrap`, `restore`) have the
actor `cli:<os user>@<host>`. The system's own work (housekeeping, key rotation) is `system`.

## With VictoriaLogs

```bash
docker run -d --name victorialogs -p 9428:9428 -v vldata:/victoria-logs-data \
  victoriametrics/victoria-logs -retentionPeriod=1y
```

```toml
[audit]
victorialogs_url = "http://victorialogs:9428"   # user:password@ in the URL is sent as basic authentication
```

- Set VictoriaLogs' retention to cover your audit period (`-retentionPeriod=1y` or more).
- Make it the protected copy: only Quisora may write to it, nobody may delete or rewrite during the retention period, and
  its storage is backed up to write-once storage. [SOC 2 with Quisora and VictoriaLogs](/docs/security/soc2/) shows how,
  and how to check that no event is missing (each node numbers its events with `boot` and `seq`).
- A sign-in never waits for VictoriaLogs. Events are sent in the background.
- Ship Quisora's structured log too, and alert on `audit.undelivered`: each such line is an event VictoriaLogs will never
  receive, logged in full so it can still be captured.

### When VictoriaLogs is down

Every event is first written to a spool on the node's disk, `<data-dir>/auditspool`, and sent about once a second. An
event leaves the spool only once VictoriaLogs has taken it. An outage or a node restart loses nothing while the spool has
room. Delivery is at least once, and the audit pages show each event once.

```toml
[audit]
victorialogs_spool_max_mb = 256          # default 256
```

- Past the limit the oldest events leave the spool first, each logged as `audit.undelivered`. Size it for the longest
  outage you must ride out. Each event takes roughly 300 to 500 bytes.
- Quisora refuses to start if it cannot write to the spool directory.
- The log says when spooling starts (`VictoriaLogs is not taking audit events: spooling them to disk`) and when the
  backlog has been sent.
- `audit.undelivered` is also logged when the spool disk does not answer or fails, or when VictoriaLogs refuses an event
  for what is in it.
- Commands (`bootstrap`, `invite`, offline `restore`) do not use the spool. They retry, then log `audit.undelivered`.

To query VictoriaLogs directly (events carry `app`, `org`, `action`, `outcome`, `actor`, `target`, `ip`, `node`, `id`
and `detail.<name>`):

```bash
curl http://victorialogs:9428/select/logsql/query \
  --data-urlencode 'query=app:="quisora" action:="user.delete" | sort by (_time desc) | limit 20'
```
