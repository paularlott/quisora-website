---
title: "Settings"
description: "Where settings live, the ones every server needs, limits, TLS, email and reloading without a restart."
weight: 20
aliases: ["/docs/configuration/"]
---

## What you need to do

1. Set the public address, the data directory and the master key ([below](#settings-every-server-needs)).
2. Give Quisora a real TLS certificate, and keep secrets out of flags.
3. Set up email if you want invitations and password resets sent for you.

Everything else has a sensible default. Check the list in [Before you go live](#before-you-go-live) before real
users arrive.

## Where settings live

Every setting is a flag, a `QUISORA_*` environment variable or a key in a TOML file. A flag beats the environment, which
beats the file. The public URL, for example, is `--public-url`, `QUISORA_PUBLIC_URL` or `server.public_url`.

- The file is `--config` (`QUISORA_CONFIG`), else `quisora.toml` in the current directory, `~/.config/quisora/` or
  `/etc/quisora/`. Unknown keys are refused.
- `quisora serve --help` lists every setting with its variable and key.
  [quisora.toml.example](https://github.com/paularlott/quisora/blob/main/quisora.toml.example) is an annotated file.
- Other commands take only the settings they use (`quisora <command> --help`). They all read the same config file and
  environment as `serve`.
- `quisora genkey` prints a key for `server.master_key`, `cluster.key` and `storage.badgerdb.encryption_key`.

{{< tip "warning" >}}
Put secrets in the config file or the environment, not in flags. Anyone on the machine can read flags in the process
list. Secrets are the master keys, `cluster.key`, database passwords, the SMTP password, `storage.badgerdb.encryption_key`
and `server.restore_password`. Any of them can instead name a value in Vault or 1Password
([secret stores](/docs/security/secret-stores/)).
{{< /tip >}}

## Settings every server needs

| Setting | Flag | Notes |
| --- | --- | --- |
| `server.public_url` | `--public-url` | The address users reach. Every organization's issuer is `<public_url>/o/<org id>`. https only. |
| `server.listen` | `--listen` | Default `:8443`. HTTPS only. |
| `server.data_dir` | `--data-dir` | Where the node keeps its files. Default `data`. One per node. |
| `server.master_key` | `--master-key` | Seals secrets at rest. Required, and identical on every node. Keep it safe, apart from the data and backups. |
| `server.previous_master_keys` | `--previous-master-keys` | Earlier keys, only while [rotating the master key](/docs/running/rotating-the-master-key/). |
| `server.tls_cert`, `server.tls_key` | `--tls-cert`, `--tls-key` | PEM files. Without them a self-signed certificate is made in `<data-dir>/tls`. |

```toml
[server]
public_url = "https://id.example.com"   # the address people use
data_dir = "/var/lib/quisora"           # where this node keeps its files
tls_cert = "/etc/quisora/tls.crt"       # your certificate and key (PEM)
tls_key = "/etc/quisora/tls.key"
# master_key: better in QUISORA_MASTER_KEY, or from a secret store
```

The public URL must be https, and a host name rather than an IP address, or passkeys won't work.

Sessions, tokens and sign-in settings are described in their own guides ([sign-in](/docs/sign-in/),
[applications](/docs/applications/)). A few are only server defaults that an organization can override in the console
(**Organizations**, edit): `limits.password_min_length`, `limits.lockout_attempts`, `limits.lockout_minutes`,
`limits.grants_per_user`, `tokens.api_token_max_days`, `session.privileged_ttl` and `session.privileged_idle`.

## TLS certificates

With `server.tls_cert` and `server.tls_key` set, Quisora checks the two files every hour and switches to a renewed
certificate without a restart. New connections get the new certificate and open ones carry on. `kill -HUP` loads it at
once, so make that your renewal hook. If a pair does not load (a certificate written before its key, a key that does
not match), the current certificate stays in use and the next check tries again.

## Email

With `mail.smtp_host` set, Quisora emails invitations, password resets and address confirmations. Without it nothing is
emailed: administrators share invitation links themselves and there is no self-service password reset. What the emails
say is set per organization ([Email templates](/docs/branding/emails/)).

```toml
[mail]
smtp_host = "smtp.example.com"
from = "Identity <no-reply@example.com>"
tls = "starttls"                        # starttls, tls or none
```

## Behind a load balancer

Tell Quisora which addresses your load balancer uses, so rate limits and the audit log see the real client:

```toml
[server]
trust_proxy = ["10.0.0.0/8"]
```

Use `/readyz` as the load balancer's health check.

## Choosing a database

The default is BadgerDB, built in and kept in the data directory. You don't need to set anything. For several nodes
on one database, use PostgreSQL, MySQL or MariaDB. See [storage](/docs/running/storage/).

## The look

The site name and default theme are under `[ui]`. Each organization can also pick a skin, a logo and a colour of its own
in the console ([branding](/docs/branding/)).

```toml
[ui]
site_name = "Identity"
default_theme = "system"   # light, dark or system
```

## Before you go live

A short list. The [hardening checklist](/docs/security/running-securely/#hardening-checklist) has the full one.

- Keep the master key in a secret store, away from the data and the backups.
- Use a real certificate.
- Turn on verified TLS to your database, if it is a separate server.
- Send the audit log to VictoriaLogs (`audit.victorialogs_url`). The built-in audit log is for testing.
- Set `metrics.token` and watch `/metrics` ([monitoring](/docs/running/monitoring/)).
- Take [backups](/docs/running/backup-and-restore/) on a schedule, and test a restore.
- Keep the number of super admins small, and keep at least two.

## Reference

### The data directory

`server.data_dir` is the only place a node writes files. Put it on persistent storage that only the Quisora user can
read (it is created with mode 0700). Each node of a cluster has its own. Never share one between nodes.

| In the data directory | What |
| --- | --- |
| `badgerdb/` or `quisora.db` | The store, for the BadgerDB (default) or SQLite backend. |
| `tls/` | The self-signed certificate, when you set none. |
| `auditspool/` | Audit events VictoriaLogs has not taken yet ([Audit log](/docs/running/audit-log/#when-victorialogs-is-down)). |
| `node_id`, `cluster-state.json` and small marker files | The node's identity and cluster bookkeeping. |

Backups do not need the data directory, but restoring a node without it gives it a new identity. Audit events still
waiting in `auditspool/`, and the emails and back-channel logouts the node had queued, are lost with it.

### Stopping

On SIGTERM or SIGINT a node stops taking new requests, lets those in flight finish, then closes. If a load balancer or
orchestrator has polled `/readyz` in the last two minutes, `/readyz` first answers 503 (`draining`) for
`server.shutdown_drain` seconds (default 10) so traffic moves away. Requests in flight then get
`server.shutdown_timeout` seconds (default 30). Make your orchestrator's stop timeout longer than the two together.

### Email queue

- Mail is queued on the node before the request answers, and survives a restart. A message the mail server does not
  take is retried after 1, 5, 30 and 120 minutes, then given up and logged.
- A message whose code or link has expired by its turn is dropped, not sent.
- A node holds at most 10,000 messages, and one organization at most 2,500. Past that, new ones are refused.
- Mail and back-channel logouts are queued per node. A node that is gone for good leaves its queue unsent.
- Watch `quisora_mail_queued`: growing means the mail server is not taking mail.

### Limits and denied addresses

| Setting | Default | What | Applies |
| --- | --- | --- | --- |
| `limits.max_in_flight` | 4096 | Requests in progress on a node before it answers 503 (never probes, metrics, discovery or JWKS) | Next request |
| `limits.max_in_flight_per_ip` | 0 | How many of those one address may have before it gets 429 (0: a sixteenth of `limits.max_in_flight`) | Next request |
| `limits.login_per_ip_min` | 300 | Sign-in attempts per organization and address per minute | Next attempt |
| `limits.lockout_attempts` | 10 | Failed passwords before an account is locked (0: never) | Next attempt |
| `limits.lockout_minutes` | 15 | How long the lock lasts | Next attempt |
| `limits.flows_per_ip` | 50 | Unfinished sign-ins one address may hold (0: no cap) | Next sign-in |
| `limits.held_kb` | 2048 | Short-lived sign-in state, in KiB, one address or one signed-in user may have the server hold (0: no cap). A sign-in in progress is about 1 KiB. | Next request |
| `limits.org_failures_per_minute` | 100 | Failed passwords per organization per minute before it counts as [under a spray](/docs/security/running-securely/#lockout-and-password-spraying) (0: never) | Next attempt |
| `limits.password_min_length` | 15 | Shortest password accepted (8 to 64) | Next password |
| `limits.grants_per_user` | 1000 | Refresh grants one user may hold | Next grant |
| `limits.sessions_per_user` | 100 | Browser sessions one user may hold (1 to 10000). Past it the least recently used end. | Next sign-in |
| `limits.access_requests_waiting` | 10 | [Access requests](/docs/applications/access-requests/) one person may have waiting for a decision at once (1 to 10000) | Next request |
| `limits.access_requests_kept_days` | 90 | Days a closed access request is kept (1 to 3650). The audit log keeps the history. | Requests that close from then on |
| `limits.password_workers` | CPUs | Passwords hashed at once | Restart |
| `limits.ephemeral_mb` | 1024 | Memory for short-lived sign-in state (with a shared database, what each node writes there) | Restart |
| `server.deny_networks` | none | Client addresses refused | Next request |

The limits per address count an IPv6 address by its /64. People behind one address (an office, a mobile network)
share its budgets, so raise `limits.held_kb` where many of them sign in from one address. Past it, new sign-ins from
that address get 429 for up to 20 minutes, and nobody elsewhere is refused.

`server.deny_networks` lists IP addresses and CIDR ranges, such as `["203.0.113.7", "198.51.100.0/24"]`. Their requests
get a bare 403 before anything else happens, with no log line or audit event, so a flood costs the node little.
Probes and `/metrics` still answer every address. Behind a proxy, set `server.trust_proxy` so the real client address
is used. The list is for a handful of networks: for a botnet, block upstream in a firewall or proxy.

### Changing settings without a restart

A reload re-reads the master keys, the cluster keys and size, the limits and `server.deny_networks` from the config
file. Nothing else is reloaded, and values given as flags or environment variables cannot change while the server runs.

- **One node:** `kill -HUP <pid>` (systemd: `systemctl reload quisora`; Docker: `docker kill --signal HUP quisora`).
- **A cluster, or nodes using `cluster.notify`:** edit every node's file, then use **Reload configuration** on the
  System page ([The System page](/docs/running/system-page/)). Each node reads its own file.
- A file that does not parse, or has a bad value, fails the reload and nothing changes. The log says
  `configuration not (fully) reloaded` with the reason.
- Counters are kept, so tightening a limit mid-attack works at once. A restart resets them, which hands an attacker
  fresh budgets.

### Under attack

1. Find the source. The audit events (`login.limited`, `login.failure`, `oauth.client_auth.limited`,
   `api.request.refused`) and the access log show the address (`ip`).
2. Add the address or network to `server.deny_networks` in every node's file and reload. `quisora_http_denied_total`
   should start counting.
3. If it moves around, lower `limits.login_per_ip_min`, `limits.lockout_attempts` or `limits.max_in_flight` the same
   way, or `limits.held_kb` and `limits.flows_per_ip` when unfinished sign-ins are filling the node
   (`quisora_ephemeral_refused_total`). Reload rather than restart.
4. For many addresses, block them upstream.
5. When it is over, take the entries out and reload again. The account steps are in
   [Running Quisora securely](/docs/security/running-securely/).
