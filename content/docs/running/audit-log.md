---
title: "Audit log"
weight: 110
---

Every audit event is written to the structured log (`log.format = "json"` for log shippers). The admin console's audit
pages read it from one of two places:

|                           | Database (default)                                                                            | VictoriaLogs                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| For                       | Development, home labs, testing                                                               | Production; required for a retained audit trail |
| Kept                      | `audit.retention_days` (90)                                                                   | VictoriaLogs' `-retentionPeriod`                |
| One node, shared database | In the database                                                                               | Sent to VictoriaLogs; nothing in the database   |
| Gossip cluster            | Each node keeps its own events (never replicated, purged by that node); a page asks every node of the cluster and merges their answers, and says which did not answer | Every node sends; any node reads                |

Admins see their own organization's events, except those that name a super admin as actor or target user (a sign-in, a
change made to one, a super admin's work in the organization): super admins are invisible below them everywhere, so the
page, its count and its search leave those events out. Super admins also see every organization, and all of it
(`/admin/audit`, `GET /api/audit?org=<name>`). The same holds when the events are read from VictoriaLogs through
Quisora; reading them in VictoriaLogs itself is for the operators who run it.

Which events those are is decided when each is written: an event names its actor and its target user by id
(`actor_id`, `target_id`) as well as by name, and carries a `super_admin` mark when either was a super admin at the
time. An admin's page is the organization's events without the mark, one indexed filter: it reads no other
organization's data and no list of super admins, and costs what any page costs. So the mark follows the account, not
the name: a super admin renamed keeps their past hidden. It is never changed afterwards (the log is not rewritten): a
user's events from before they were made a super admin stay visible to the admins who could see them then, and a super
admin's from before a demotion stay hidden. An event whose target is known only by an id that cannot be read when it
is written is marked, not shown on a guess. An event that names a super admin only in its detail (such as a group
membership change) is not marked.

In a gossip cluster with the database trail, an event is on the node that recorded it only: a node that is down, or slow to
answer (3 s), is missing from a page (the page says how many nodes answered), and a node whose disk is lost takes its events
with it.

**Production, and any deployment whose compliance standard or security policy requires a retained audit trail, must
use VictoriaLogs.** The database audit trail keeps events for
days, not the year or more an audit period needs; it is per node in a gossip cluster; and it has no protection against
someone with write access to the database. With
VictoriaLogs:

- set its retention to cover the audit period (`-retentionPeriod=1y` or more);
- make it the protected copy: only Quisora may write to that VictoriaLogs, nobody may delete from or rewrite it during
  the retention period, and its storage is backed up to write-once (immutable) storage. [SOC 2 with Quisora and VictoriaLogs](/docs/security/soc2/) shows how
  (vmauth in front of it) and how to check that no event is missing (every event is numbered per node: `boot`,
  `seq`);
- give every node room for the spool (below) in its data directory;
- ship Quisora's structured log too, and alert on `audit.undelivered`: each such line is an event VictoriaLogs will
  never receive, logged in full so it can still be captured from the log.

## What is recorded

| Area | Events |
| --- | --- |
| Sign-in | `login.success` (default on; `audit.logins = false` turns it off), `login.failure`, `login.lockout`, `login.limited` (a sign-in rate limit started refusing: once per limit and minute), `org.spray.start` and `org.spray.end` (an organization's sign-in came under a password spray, and when it was over: [lockout](/docs/security/running-securely/#lockout-and-password-spraying)), `logout`, `passkey.clone` (a copied authenticator, at sign-in or while confirming it is the user), `login.recovery_code`, `mfa.import` (an authenticator secret imported with a new user: [Personal API tokens](/docs/automation/api-tokens/#importing-users-with-their-passwords-authenticator-apps-and-provider-links-import)), `login.email_code.sent`, `password.forgot`, `password.reset`, `invite.accept` |
| OAuth / OpenID Connect | `oauth.consent` (allow or deny), `oauth.grant` (every code exchange), `oauth.token_exchange` (every token exchange), `oauth.device.approve` (a device sign-in approved), `oauth.revoke`, `oauth.grant.evict` (a grant ended because its user held too many: [how many](/docs/applications/sign-in/#refreshing)), `oauth.code.replay` and `oauth.refresh.reuse` (a code or refresh token presented again: its grant is revoked), `oauth.client_auth.limited` (a client's failed authentications reached the limit); with `audit.tokens = true` also `oauth.refresh` and `oauth.client_credentials` for every token issued, and `oauth.device.start` for every device sign-in started |
| Administration | users, groups, organizations, tenants, access, clients, providers, API tokens, service accounts (`service_account.create`, `.update`, `.secret.rotate`, `.delete`), invitations, `user.locked_out`, `keys.rotate`, `keys.create` (every signing key made, scheduled ones too), `keys.remove`, tenants' SSH certificate authorities (`ssh.settings.update`, `ssh.ca.create`, `ssh.ca.rotate`, `ssh.ca.remove`, `ssh.cert.issue`, `ssh.cert.revoke`, `ssh.cert.refused`, `ssh.host.issue`, `ssh.host.refused`: [SSH certificates](/docs/ssh/revoking-and-rotating/#in-the-audit-log)), `backup.download`, `backup.restore`, `cluster.force_start`, `cluster.reload` (and `cluster.reload.failure`, with each node's report), `config.reload` (and `config.reload.failure`: one node's SIGHUP reload, with the node and what changed; compare nodes after an incident) |
| API access | `api.request.refused` (a management API or SCIM request refused for an authenticated caller: a token without the scope, a request without the CSRF header, a console session without a second factor, a SCIM token whose owner lost the role; with the method, path and reason), `apitoken.refused` (a token that exists presented with a wrong secret, or after an emergency sign-out, or after its owner was disabled or demoted). Both at most once a minute per token or caller and reason on each node, with `detail.suppressed` counting the repeats held back: anyone can repeat a refusal, and the audit log must not be the thing they flood |
| Emergency sign-out | `org.signout` and `server.signout` (with the reason, and whether API tokens ended too), then `signout.sweep` (how many sessions, grants and API tokens were deleted) |
| Account self-service | `account.*`: passkeys, authenticator app, recovery codes, sessions, applications, connected providers, email verification |

Updates record what changed, field by field, as `changed.<field>` = `old → new` (`changed.role`, `changed.email`,
`changed.email_verified`, `changed.settings.require_mfa`, …). Fields that hold secrets never appear; a replaced
provider secret shows as `client_secret` = `replaced`.

Every event has:

- `outcome`: `failure` for refusals (`*.failure`, `*.refused`, `*.lockout`, `*.limited`, `*.replay`, `*.reuse`,
  `*.clone`) and a password spray (`org.spray.*`), `success` otherwise;
- `request_id`: the request's id, also sent as the `X-Request-ID` response header (a trusted proxy's
  `X-Request-ID` is kept, so its logs and the audit log name a request alike);
- `user_agent` and `session_id` (the browser session the request was made in, or the one a sign-in created);
- `detail.token_id` when a personal API token made the change (or was refused); a service account's changes name it as the
  actor, `service:<name>` ([Service accounts](/docs/automation/service-accounts/#auditing));
- `ip`;
- with VictoriaLogs, `node`, `boot` and `seq`: the node that recorded it, that process start's random id, and the
  event's number in that start's sequence (1, 2, 3…), so a gap is an event VictoriaLogs does not hold
  ([SOC 2 with Quisora and VictoriaLogs](/docs/security/soc2/#completeness)).

`quisora invite` and `quisora sign-out` carried out by a running node (a gossip cluster, or a node-local
store that a server holds) are recorded with the actor `command:invite` or `command:sign-out`, the address the request came from in `ip`, and
`detail.command` and `detail.authenticated` (a request signed with the master key); the forced start `cluster.force_start` is
`command:force-start`. The system's own work (housekeeping, key rotation) keeps the actor `system`. Commands that run in
their own process against a store (`bootstrap`, `restore`, and `invite` or `sign-out` against a shared database or
a stopped node that does not replicate) record who ran them: the actor is
`cli:<os user>@<host>`, with `detail.os_user`, `detail.host`, `detail.pid` and `detail.command`. A restore (offline,
or `server.restore_from` at start-up) is written to the primary organization's log as `backup.restore` once the
node can write.

## With VictoriaLogs

```bash
docker run -d --name victorialogs -p 9428:9428 -v vldata:/victoria-logs-data \
  victoriametrics/victoria-logs -retentionPeriod=1y
```

```toml
[audit]
victorialogs_url = "http://victorialogs:9428"   # user:password@ in the URL is sent as basic authentication
```

- Every node sends events in batches, and so do `bootstrap` and `invite`. A sign-in never waits for VictoriaLogs:
  events are sent in the background (on a node, from the spool below; a sign-in waits only for its event to reach the
  local disk).
- An event that finds the queue full, because the node writes faster than the spool's disk keeps up, is given up.
- An event VictoriaLogs will never receive is written to the structured log in full, at error level, with the message
  `audit.undelivered`, a `reason`, and the event under `event` (the same fields VictoriaLogs would have stored). That
  is the last place it goes: ship the structured log, or such events are lost.

## Spool

```toml
[audit]
victorialogs_spool_max_mb = 256          # default 256
```

With VictoriaLogs, every event is written to the spool, `<data-dir>/auditspool`, and synced to disk before the action
that recorded it goes on (events recorded at the same moment share one sync). A separate sender posts the spool to
VictoriaLogs about once a second, and an event leaves the spool only once VictoriaLogs has taken it; what VictoriaLogs
does not take (unreachable, a server error, or refused credentials: 401, 403) stays there and is sent when
VictoriaLogs answers again, oldest first. A shutdown does not wait for VictoriaLogs, and the next start sends what is
spooled.

What is guaranteed: **an event whose write to the spool succeeded is on disk, complete, and is sent to
VictoriaLogs**, through an outage of VictoriaLogs and through a restart or crash of the node, while the spool has
room. The spool is append-only segment files of JSON lines, and only ever appends after its last complete line: a
write that fails part-way (a full or failing disk) is cut back off the segment and the batch reported failed; a
write a crash cut short, or that was written but not yet synced, stays as the last line of its segment, which is
never appended to again after a restart. Replay keeps every complete line (terminated and valid JSON) and leaves a
torn one out by itself, so a torn line can never take a complete event with it.

When the structured log is the fallback (`audit.undelivered`, the event in full: ship the log and alert on it):

- The spool disk did not answer within 2 seconds. The action goes on, the event is logged, and it is still spooled
  once the disk answers, so it then reaches VictoriaLogs as well (a duplicate, by `id`; never a loss).
- The spool could not be written (a full or failing disk, a failed sync of the file or of the directory). The failed
  write is undone, so the log is that event's only copy; a crash before the log is shipped loses it from VictoriaLogs.
- The spool had to make room (below), or the spool queue was full.
- VictoriaLogs refused a batch for what is in it (400, 413, 422): it would never take it, so it leaves the spool
  (logged with VictoriaLogs' answer) rather than hold back everything after it.
- A line in a spool segment is complete but not JSON (the disk changed it): it can never be sent.

Delivery is at least once: a batch VictoriaLogs took is sent again if the node crashed before the batch left the
spool. Every event has a unique `id`; the audit pages show and count each once.

- The directory is created (mode 0700) if missing, and Quisora refuses to start if it cannot write there.
- It is part of the node's data directory, so it is one per node, on that node's own disk.
- Past `victorialogs_spool_max_mb` the oldest events leave the spool first, each logged as `audit.undelivered` (a
  segment being sent at that moment may also reach VictoriaLogs). Size it for the longest outage you must ride out;
  each event takes roughly 300 to 500 bytes.
- The log says when spooling starts (`VictoriaLogs is not taking audit events: spooling them to disk`) and when the
  backlog has been sent (`spooled audit events sent to VictoriaLogs`).
- Commands (`bootstrap`, `invite`, offline `restore`) do not use the spool: they retry, then log `audit.undelivered`,
  as without one.
- Each event has the stream fields `app` (`quisora`) and `org` (organization id), and the fields `action`, `outcome`,
  `actor`, `actor_id`, `target`, `target_id` (a target user's id), `super_admin` (`true` for an event of a super admin,
  [above](/docs/running/audit-log/)), `ip`, `node`, `id`, `request_id`, `user_agent`, `session_id` and `detail.<name>`.

```bash
curl http://victorialogs:9428/select/logsql/query \
  --data-urlencode 'query=app:="quisora" action:="user.delete" | sort by (_time desc) | limit 20'
```
