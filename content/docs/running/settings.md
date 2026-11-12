---
title: "Settings"
weight: 10
---

Every setting is a flag, an `QUISORA_*` environment variable or a key in a TOML file; a flag beats the environment,
which beats the file. The public URL, for example, is `--public-url`, `QUISORA_PUBLIC_URL` or `server.public_url`.

- The file is `--config` (`QUISORA_CONFIG`), else `quisora.toml` in the current directory, `~/.config/quisora/` or
  `/etc/quisora/`. Unknown keys are refused.
- `quisora serve --help` lists every setting with its variable and key; [quisora.toml.example](https://github.com/paularlott/quisora/blob/main/quisora.toml.example) is
  an annotated file.
- The other commands take as flags only the settings they use (`quisora <command> --help`), and refuse the rest on the
  command line. `--config`, `--log-level` and `--log-format` are taken by every command. Every command reads the same
  config file and environment as serve, whole, and checks it the same way.
- `quisora genkey` prints a key for `server.master_key`, `cluster.key` and `storage.badgerdb.encryption_key`.
- Secrets (the master key and previous master keys, `cluster.key` and `cluster.previous_keys`, database DSNs and passwords, the SMTP password,
  `storage.badgerdb.encryption_key`, `server.restore_password`, a VictoriaLogs URL with credentials) belong in the config
  file or the environment. Given as flags they are accepted, but anyone on the machine can read them in the process
  list (`ps`), so every command prints a warning naming the variable and key to use instead. (The Taskfile's
  development tasks pass a development key as a flag on purpose.) Any of them can instead name a value in HashiCorp
  Vault or 1Password: [secret stores](/docs/security/secret-stores/).

Settings every deployment sets:

| Setting                             | Flag                      | Notes                                                                                                                                                              |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server.public_url`                 | `--public-url`            | The address users reach, and the base of every organization's issuer (`<public_url>/o/<org id>`). https only.                                                                                                                |
| `server.listen`                     | `--listen`                | Default `:8443`. HTTPS only; there is no plain-HTTP listener.                                                                                                      |
| `server.data_dir`                   | `--data-dir`              | Everything the node keeps on disk ([layout](/docs/running/settings/#the-data-directory)). Required; default `data`. One per node.                                                         |
| `server.master_key`                 | `--master-key`            | Seals secrets at rest. Required (identical on every node of a cluster); nothing is generated or kept in the data directory. Keep it safe, apart from the data and the backups. |
| `server.previous_master_keys`       | `--previous-master-keys`  | Earlier master keys, only while [rotating the master key](/docs/running/rotating-the-master-key/). Identical on every node.                                                     |
| `server.tls_cert`, `server.tls_key` | `--tls-cert`, `--tls-key` | PEM files. Without them a self-signed certificate is generated in `<data-dir>/tls`. A renewed certificate is used without a restart ([TLS certificates](/docs/running/settings/#tls-certificates)). |

## The data directory

`server.data_dir` is the one place a node keeps files; nothing is written anywhere else. Put it on persistent storage,
readable only by the user Quisora runs as (it is created with mode 0700). Each node of a cluster has its own: never
share one between nodes or processes.

| In `<data-dir>`      | What                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `badgerdb/`          | The store, with `storage.backend = "badgerdb"` (the default).                                          |
| `quisora.db`         | The store, with `storage.backend = "sqlite"`.                                                          |
| `tls/`               | The self-signed certificate, when `server.tls_cert` is not set.                                        |
| `auditspool/`        | Audit events VictoriaLogs has not taken yet, with `audit.victorialogs_url` set ([Spool](/docs/running/audit-log/#spool)).       |
| `node_id`, `cluster-state.json`, markers | The node's identity (made at its first start in every mode, unless `cluster.node_id` sets it: its queued emails and back-channel logouts are its own by it, [Queued work](/docs/running/settings/#queued-work)) and cluster bookkeeping: whether its database's partition state can be trusted, which data set it holds (its genesis: trusted only for the database it was saved for), whether it has formed in its cluster, a forced start not yet audited (`cluster-state.json`); the one-shot markers `force-start` and `restore-incomplete`; `restore-audit.json` (restores not yet in the audit log). |

Nothing else is written there. In particular a gossip node does not spool what it sends another node that is catching up:
the stream goes from the database to the other node's database with no file in between (an `export-*.tmp` file here is left by an older build
that crashed during a catch-up: nothing reads or deletes it, and it can be removed by hand).

Backups do not need the data directory (they come from the store: [Backup and restore](/docs/running/backup-and-restore/)), but
restoring a node without it gives it a new identity, and audit events still spooled in it are lost; so are the emails
and back-channel logouts its store holds queued for it (they are its own by its id: no other node, nor the node under
its new id, sends them).

## Queued work

Email ([Email](/docs/running/email/)) and the back-channel logouts an application did not take are queued in the store, as records of
the node that queued them: sealed with the master key, written before the request answers, and kept across restarts
and crashes. Only that node sends them; nothing else reads them. They are never backed up or replicated: with gossip
each node's are in its own database, and on a shared database every node holds its own there, apart from the others'.
A node that is gone for good leaves its items unsent: each is discarded (it expires, and the purge removes it) a day
after its last retry would have been, by when it is worth nothing (its retries are over, and an invitation it carries
lasts 7 days). Each node's caps (10,000 emails and 10,000 logouts, 2,500 of each of one organization) and gauges count
its own items only. Being the only node that writes its items, a node keeps an index of them in memory, read from the
store once at start: choosing what to send next and checking the caps cost no reads of the store, however many sent
items it still holds until its purge. A message or logout that was sent but whose end the store did not record (a
full disk, a database turned read-only) is not sent again: the node records its end again every minute until the
store takes it (only a restart before then sends it once more).

## TLS certificates

With `server.tls_cert` and `server.tls_key` set, Quisora looks at the two files every hour and switches to a renewed
certificate (certbot, cert-manager or a script replacing them): new connections get the new certificate, open ones
carry on. `kill -HUP` loads it at once; make it the renewal hook to switch straight away. A pair that does not load, such as a certificate
written before its key, or a key that does not match, leaves the current certificate in use, is logged
(`TLS certificate not reloaded`) and is tried again at the next check. Without them, the self-signed certificate in
`<data-dir>/tls` is replaced before it expires.

## Stopping

On SIGTERM or SIGINT a node stops taking new requests, lets those in flight finish, then closes. When something has
been polling `/readyz` in the last two minutes (a load balancer, an orchestrator), `/readyz` first answers 503
(`"status": "draining"`) for `server.shutdown_drain` seconds (default 10) while the node still serves, so traffic
moves to other nodes before it goes. Then requests in flight get `server.shutdown_timeout` seconds (default 30). Make
the orchestrator's stop timeout longer than the two together. A node nobody polls stops without the wait.
