---
title: "SOC 2 with Quisora and VictoriaLogs"
description: "How Quisora maps to the SOC 2 criteria for an identity provider, and where the evidence comes from."
weight: 50
---

This maps the SOC 2 criteria an identity provider is examined against to what Quisora does, what you must run around
it, and where the evidence comes from. It assumes audit events go to VictoriaLogs ([Audit log](/docs/running/audit-log/)).
The database audit trail is not meant for an audit: it is kept for days, and in a gossip cluster each node keeps only
its own events.

A Type 2 report examines whether controls **operated throughout the audit period** (usually 6 to 12 months). No code
supplies that: you need your records of reviews, changes, incidents and tests from the period.

## What Quisora provides, what you provide

| Area | Quisora | You |
| --- | --- | --- |
| Audit trail (CC7.2, CC7.3) | Every security-relevant action recorded with who, what, when, where from and outcome; written to disk on each node before it is sent; numbered per node so a missing event shows | Run VictoriaLogs as below, keep it for the period, review it |
| Logical access (CC6.1 to CC6.3) | Roles; MFA always on for managers and up; per-organization MFA policy; per-application access lists; end dates; [access for a limited time](/docs/applications/timed-access/) that ends, and signs people out, by itself; session limits; emergency sign-out; [service accounts](/docs/automation/service-accounts/) with least-privilege scopes; server access by short-lived [SSH certificates](/docs/ssh/) | Decide who gets which role and scope; review access and service accounts regularly; for SSH, the principals files and revocation-list timer on servers, and a break-glass login that does not depend on Quisora |
| Authentication (CC6.1) | Passkeys, TOTP, recovery codes, offline checks for common and guessable passwords, lockouts, rate limits | Set the organization policies |
| Change management (CC8.1) | Every configuration change in the console or API audited field by field; key rotations and cluster changes audited; operator commands recorded as `command:<name>` | Approve changes before they are made, and keep the approval |
| Encryption (CC6.1, CC6.7) | Secrets sealed with the master key; TLS for every connection it makes; key rotation without downtime | Keep the master key in a secret store and rotate it on schedule |
| Availability (A1.2) | Clustering, backups verified before restore | Run backups and test a restore each period |
| Monitoring (CC7.2) | Prometheus metrics for readiness, audit delivery, queues and failures | Alert on them and keep the alert history |
| Time (CC7.2) | Refuses to start with a clock before 2025; in a cluster, refuses to serve when a node's clock is off | Run NTP on every node |

## Setting up the audit log

- Set `audit.victorialogs_url`. Without it, every start logs a warning that the database trail is not an audit trail.
- Keep `audit.logins = true` (the default): successful sign-ins are the evidence of access reviews. Failures,
  lock-outs and refusals are always recorded.
- Set `audit.tokens = true` if you must show every refresh and client credentials token issued (off by default).

### Protecting it

Nothing but Quisora should write to VictoriaLogs, and nobody should be able to delete from it during the retention
period. VictoriaLogs has no users of its own, so put **vmauth** (VictoriaMetrics' authenticating proxy) in front of it
and let nothing else reach it:

```yaml
# vmauth.yml
users:
  - username: quisora          # the nodes: insert and the audit pages' reads, nothing else
    password: "%{QUISORA_VL_PASSWORD}"
    url_map:
      - src_paths: ["/insert/jsonline", "/select/logsql/query"]
        url_prefix: "http://victorialogs:9428"
  - username: auditor          # read-only, for reviews and the auditor
    password: "%{AUDITOR_VL_PASSWORD}"
    url_map:
      - src_paths: ["/select/.*"]
        url_prefix: "http://victorialogs:9428"
```

```bash
vmauth -auth.config=vmauth.yml -httpListenAddr=:8427
victoria-logs -retentionPeriod=400d -httpListenAddr=127.0.0.1:9428   # or a private network
```

```toml
[audit]
victorialogs_url = "op://Infra/Quisora VictoriaLogs/url"   # https://quisora:<password>@vmauth.internal:8427
```

- Use TLS between Quisora and vmauth, and keep the URL (which holds the password) in a
  [secret store](/docs/security/secret-stores/).
- Restrict the host and volume VictoriaLogs runs on to the people who operate it, and keep that list as evidence.
- Back up VictoriaLogs' data directory to storage that cannot be changed during the retention period (object storage
  with object lock, say).
- Events carry no signature. Their integrity rests on these access controls, and on node host access until the
  events leave each node's spool (`<data_dir>/auditspool`), so list node host access as a control too.
- Set `-retentionPeriod` to cover the audit period plus the time until the report is issued. 400 days covers a
  12-month period. The structured log needs the same retention.

Administrators see their own organization's events in the console, and super admins see every organization's.
Auditors read through the `auditor` user with LogsQL.

### Checking nothing is missing

Every event a node accepts is written to its spool on disk before the request goes on, and leaves the spool only
once VictoriaLogs has taken it. An event VictoriaLogs will never accept is written in full to the structured log as
`audit.undelivered`. Alert on those lines and keep them as long as the audit log.

Every event carries `node`, `boot` (new at each start) and `seq` (1, 2, 3 within that boot). Delivery is at least
once, so a `seq` may appear twice. For each node and boot, every number from 1 up to the highest held should be
there. Run this over a window that covers whole boots, monthly:

```
app:quisora | stats by (node, boot) count_uniq(seq) as held, min(seq) as first, max(seq) as last
            | math (last - held) as missing
            | filter missing:>0 or first:>1
```

Each missing event should be in the structured log as `audit.undelivered`, or was removed from VictoriaLogs. The
query cannot see two things on its own:

- **Events after the last one held.** A node logs `audit writer stopped` with its `boot` and `last_seq` when it stops
  cleanly: compare that with the boot's `last`. After a crash, check again once the node is back, since its spool is
  sent after the restart.
- **A boot none of whose events arrived.** Every start logs `audit events from this start are numbered` with its
  `boot`. Every boot in the structured log should have a row in VictoriaLogs (`app:quisora | uniq by (node, boot)`).

If VictoriaLogs refuses events for credentials (401 or 403), nothing is dropped: events wait in the spool until you
fix them. Alert on `quisora_audit_spool_bytes` growing, because past `audit.victorialogs_spool_max_mb` the oldest
events leave the spool as `audit.undelivered`. Keep the queries and their results for the period.

## Evidence, and how to get it

| Control | Evidence | How |
| --- | --- | --- |
| Access reviews (CC6.2, CC6.3) | Each organization's administrators, managers and their last sign-in, reviewed and signed off each quarter | The Users page filtered by role, saved with the reviewer's sign-off; changes show as `user.update` events |
| Joiners and leavers (CC6.2) | Accounts created, invited, disabled, locked out, ended and deleted, matched to HR records | `action:user.create OR action:user.provision OR action:user.invite OR action:user.update OR action:user.password OR action:user.locked_out OR action:user.expire OR action:user.delete` |
| Tenant access (CC6.2, CC6.3) | Who was given access to a tenant's applications, until when and why (the `reason` an approving tool sends, such as its ticket), changes to it, its removal, and access that ended by itself | `action:tenant.access.*` (`detail.expires` in UTC, `detail.reason`) |
| Privileged changes (CC6.3) | Role changes | `detail.changed.role:*` |
| Authentication policy (CC6.1) | MFA required where the policy says | `action:org.update AND detail.changed.settings.require_mfa:*` |
| Change management (CC8.1) | Configuration changes matched to approved change requests | `action:org.update OR action:tenant.* OR action:client.* OR action:provider.* OR action:cluster.reload OR action:cluster.force_start OR action:keys.*`, plus your change tickets |
| Operator commands (CC6.1, CC8.1) | Each command an operator ran against a running node, matched to an approved change or break-glass ticket | `actor:command:* OR action:user.invite.break_glass OR action:server.signout OR action:org.signout OR action:cluster.force_start` |
| Security events (CC7.2, CC7.3) | Alerts raised and how each was handled | Alerts on `login.lockout`, `login.limited`, `oauth.refresh.reuse`, `oauth.code.replay`, `passkey.clone`, `apitoken.refused`, `api.request.refused` ([alerts](/docs/running/monitoring/#metrics)), plus your incident tickets |
| Incident response (CC7.4) | Emergency sign-outs and what followed | `action:org.signout OR action:server.signout OR action:signout.sweep`; [Emergency sign-out](/docs/security/emergency-sign-out/) |
| Audit completeness (CC7.2) | The sequence check above, each month; no `audit.undelivered` lines, or each one explained | The queries above and your log pipeline |
| Backups and recovery (A1.2, A1.3) | Backups made on schedule; a restore tested each period | `action:backup.download`, `action:backup.restore`, and the record of the restore test |
| Key management (CC6.1) | Master key and signing key rotations | `action:keys.rotate OR action:keys.create`; the `quisora_master_key_rotation` metric |
| SSH access (CC6.1 to CC6.3) | Which tenants issue certificates, to whom, revocations and CA key changes | `action:ssh.*`; sshd's log on the servers; the fetch timer's status ([SSH certificates](/docs/ssh/revoking-and-rotating/#in-the-audit-log)) |
| Time (CC7.2) | Clocks synchronised | NTP monitoring; `clock_skewed` and `skew_refused` in `/readyz` stay at 0 |
| Monitoring (CC7.2) | Alerts configured and their history | Your alerting system |

## Not covered by Quisora

Physical security, HR processes, vendor management, risk assessment, the security of the hosts and networks it runs on,
and the policies themselves (access control, change management, incident response, backup) are yours. Quisora's own
development (code review, tests, dependency scanning) is evidence only when you build and run a reviewed release from
source.
