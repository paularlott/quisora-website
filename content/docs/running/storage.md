---
title: "Storage"
description: "Pick a storage backend, secure the connection to it and encrypt it at rest."
weight: 30
---

Choose a backend with `storage.backend` (`--storage`). Tables and keys are created on first start, but a SQL database
itself must already exist.

| Backend | Use | Settings |
| --- | --- | --- |
| `badgerdb` (default) | One node, or each node of a gossip cluster. Embedded, in `<data-dir>/badgerdb`. The fastest. | `storage.badgerdb.sync_writes` (default true), `sync_interval_ms`, `encryption_key` |
| `sqlite` | One node, or each node of a gossip cluster. Embedded, in `<data-dir>/quisora.db`. | none |
| `postgres` | A shared database for several nodes, or one node. | `storage.postgres.dsn`, `max_open_conns`, `max_idle_conns` |
| `mysql`, `mariadb` | As PostgreSQL. MySQL 8.0.17 or later. | `storage.mysql.dsn` or `storage.mariadb.dsn`, connection limits |

```bash
# Connection strings carry the password: use the environment or config file, not flags
export QUISORA_POSTGRES_DSN='postgres://quisora:secret@db:5432/quisora?sslmode=verify-full'
quisora serve --storage postgres

export QUISORA_MYSQL_DSN='quisora:secret@tcp(db:3306)/quisora?tls=true'
quisora serve --storage mysql

quisora serve --storage sqlite --data-dir /var/lib/quisora
```

All backends behave the same. A BadgerDB backup can be restored into PostgreSQL, for example.

## Write speed on BadgerDB

With `sync_writes = true` (the default) every acknowledged write is on disk. On a disk where syncing is slow (most cloud
volumes), `sync_writes = false` with `sync_interval_ms = 100` gives several times the write speed. A crash of the
process loses nothing, but a power cut can lose up to 100 ms of acknowledged writes. A gossip node refuses this
setting. For PostgreSQL and MySQL the same trade is the database's own setting.

## Time limits on SQL backends

Quisora limits each statement to 10 seconds and a lock wait to 5 seconds, so a stuck query cannot hold a connection
forever. You can change them in the DSN (for PostgreSQL, `?statement_timeout=30000&lock_timeout=10000`, in
milliseconds). If you use PgBouncer, add those parameters to its `ignore_startup_parameters` and set them on the role
instead (`ALTER ROLE quisora SET statement_timeout = '10s'`).

## TLS to the database

Off this machine, use TLS that verifies the server, because the connection carries the database password and every
sealed record. Nothing is refused, but `serve` logs a warning at start for each unencrypted or unverified connection
that leaves the machine.

| Backend | Verified TLS |
| --- | --- |
| PostgreSQL | `sslmode=verify-full` in the DSN. A private CA goes in `storage.postgres.ca_file`. |
| MySQL, MariaDB | `tls=true` in the DSN. A private CA goes in `storage.mysql.ca_file` or `storage.mariadb.ca_file`. |

## Encryption at rest

Sealed secrets (authenticator secrets, password hashes, provider and signing keys, upstream tokens) are encrypted with
the master key on every backend. The rest of the data is protected by the storage:

- **BadgerDB** encrypts its files when `storage.badgerdb.encryption_key` is set (`quisora genkey`; not the master key,
  and kept apart from the data). It is chosen when the store is created. To encrypt an existing store, back it up and
  restore into a new store with the key set. To change the key on a gossip cluster, do one node at a time: stop it, set
  its new key, empty its `badgerdb` directory and start it. It copies everything back, encrypted with the new key. Wait
  until it is ready before the next. A single node: back up, then restore into a new store.
- **SQLite:** put the data directory on an encrypted volume (LUKS, FileVault, BitLocker, an encrypted cloud disk).
- **PostgreSQL, MySQL, MariaDB:** use the database's own encryption, or an encrypted volume.
