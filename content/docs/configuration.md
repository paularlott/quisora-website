---
title: Configuration basics
description: How settings work, the few every server needs, and what to check before going live.
weight: 20
---

## Three ways to set things

Every setting can be a command line flag, an environment variable or a key in a TOML file. They all mean the same thing. For example, the public address is any of these:

| Flag | Environment variable | Config file key |
| --- | --- | --- |
| `--public-url` | `QUISORA_PUBLIC_URL` | `server.public_url` |

If a setting is given more than once, the flag wins, then the environment, then the file.

Quisora looks for `quisora.toml` in the current folder, then `~/.config/quisora/`, then `/etc/quisora/`. Or point at a file with `--config`. To see every setting, run:

```bash
quisora serve --help
```

The repository has a [commented example file](https://github.com/paularlott/quisora/blob/main/quisora.toml.example) to start from.

## The settings every server needs

```toml
[server]
public_url = "https://id.example.com"   # the address people use
data_dir = "/var/lib/quisora"           # where this node keeps its files
tls_cert = "/etc/quisora/tls.crt"       # your certificate and key (PEM)
tls_key = "/etc/quisora/tls.key"
# master_key: better in QUISORA_MASTER_KEY, from a secret store
```

- **Public URL.** The address people reach. It must be https, and a host name rather than an IP address, or passkeys won't work.
- **Data directory.** Where the node keeps its database and other files. Keep it on lasting storage, readable only by Quisora's user.
- **Master key.** Made with `quisora genkey`. Keep it in a secret store or an environment variable, never as a flag.
- **Certificate.** Without one, Quisora makes a self-signed certificate. Quisora picks up a renewed certificate by itself, so certbot and friends just work.

Quisora only speaks HTTPS, on port 8443 by default (`--listen`).

## Choosing a database

The default is BadgerDB, built in and fast, kept in the data directory. You don't need to set anything.

| Backend | Good for |
| --- | --- |
| `badgerdb` (default) | One node, or each node of a replicated cluster |
| `sqlite` | The same, if you prefer SQLite |
| `postgres` | Several nodes sharing one database, or one node |
| `mysql`, `mariadb` | The same as PostgreSQL |

```bash
export QUISORA_POSTGRES_DSN='postgres://quisora:secret@db:5432/quisora?sslmode=verify-full'
quisora serve --storage postgres
```

Connection strings hold a password, so put them in the environment or the config file, not on the command line.

## Email

Without email, admins copy invitation links and pass them on. To send them by email instead, set up SMTP:

```toml
[mail]
smtp_host = "smtp.example.com"
from = "Identity <no-reply@example.com>"
tls = "starttls"
```

## Behind a load balancer

Tell Quisora which addresses your load balancer uses, so rate limits and the audit log see the real client:

```toml
[server]
trust_proxy = ["10.0.0.0/8"]
```

Use `/readyz` as the load balancer's health check.

## The look

The site name, theme and logo are under `[ui]`. Each organization can also pick a skin, a logo and a colour of its own in the admin console.

```toml
[ui]
site_name = "Identity"
default_theme = "system"   # light, dark or system
```

## Before you go live

A short list. The [security guide](https://github.com/paularlott/quisora/blob/main/docs/SECURITY.md#hardening-checklist) has the full one.

- Keep the master key in a secret store, away from the data and backups.
- Use a real certificate.
- Turn on TLS to your database, if it is a separate server.
- Send the audit log to VictoriaLogs (`audit.victorialogs_url`). The built-in audit log is for testing.
- Set `metrics.token` and watch `/metrics`.
- Take [backups](/docs/backups/) on a schedule, and test a restore.
- Keep the number of super admins small, and keep at least two.
