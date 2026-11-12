---
title: "Storage backends"
weight: 90
---

Pick one with `storage.backend` (`--storage`). The tables or keys are created on first start; the database itself
must exist.

| Backend            | Use                                                            | Settings                                                                                         |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `badgerdb` (default) | One node, or each node of a gossip cluster. Embedded, in `<data-dir>/badgerdb`. | `storage.badgerdb.sync_writes` (default true), `sync_interval_ms`, `encryption_key` |
| `sqlite`           | One node, or each node of a gossip cluster. Embedded, pure Go, in `<data-dir>/quisora.db`. | none                                                                   |
| `postgres`         | A shared database for several nodes, or one node.              | `storage.postgres.dsn`, `max_open_conns`, `max_idle_conns`                                       |
| `mysql`, `mariadb` | As PostgreSQL. MySQL 8.0.17 or later (its binary NO PAD collation `utf8mb4_0900_bin`). | `storage.mysql.dsn` / `storage.mariadb.dsn`, connection limits                                   |

Every backend keeps to the same contract, so what one accepts every other accepts. A record's id and scope are at most
191 characters (the width of a server database's key columns), a string field 255 (the tags field `model.MaxTagsText`);
a longer one is refused before anything is written, and unique values (a resource address, a provider's subject) may be
any length. Deleting a record that is not live writes nothing. A write never moves a record to another partition. A call
whose context has ended, or on a store that is closed, answers "unavailable" (HTTP 503 where a request met it).

**Durability and write speed (one BadgerDB node).** With `sync_writes = true` (the default) every acknowledged write is
on disk; concurrent writes share one sync, so a fast disk (an NVMe drive with power-loss protection) loses little to
it. On a disk whose sync is slow (most cloud volumes, around a millisecond or more), `sync_writes = false` with
`sync_interval_ms = 100` acknowledges writes from memory and syncs every 100 ms: measured at 6 to 25 times the write
throughput at 16 to 64 writers on such a disk, and around 1.2 to 1.9 times on a fast local SSD. A crash of the process
loses nothing; a power cut or a kernel panic loses up to the interval of acknowledged writes. A gossip node refuses it
(its acknowledged writes must survive a power cut). For PostgreSQL and MySQL the same trade is the server's own setting
(`synchronous_commit = off`, `innodb_flush_log_at_trx_commit = 2`), not Quisora's.

```bash
# PostgreSQL (connection strings carry the password: environment or config file, not flags)
export QUISORA_POSTGRES_DSN='postgres://quisora:secret@db:5432/quisora?sslmode=verify-full'
quisora serve --storage postgres

# MySQL / MariaDB (the collation is set by Quisora)
export QUISORA_MYSQL_DSN='quisora:secret@tcp(db:3306)/quisora?tls=true'
quisora serve --storage mysql

# SQLite (in <data-dir>/quisora.db)
quisora serve --storage sqlite --data-dir /var/lib/quisora
```

Every backend behaves the same. BadgerDB is the fastest; see [Sizing](/docs/running/sizing/).

**Bounds on a statement (SQL backends).** Every connection Quisora opens limits how long one statement may run and how
long it may wait for a lock:

| Database   | Statement                                     | Lock wait                      |
| ---------- | ----------------------------------------------- | ------------------------------ |
| PostgreSQL | `statement_timeout` 10 s                      | `lock_timeout` 5 s             |
| MySQL      | `max_execution_time` 10 s (bounds SELECTs only) | `innodb_lock_wait_timeout` 5 s |
| MariaDB    | `max_statement_time` 10 s                     | `innodb_lock_wait_timeout` 5 s |
| SQLite     | none (a cancelled request interrupts its reads) | `busy_timeout` 5 s           |

Every statement Quisora runs is short: a read of a record or a page, the writes of one change, a batch of 500 rows of a
purge, of a partition's export or of the reset before a partition is copied whole, take milliseconds, and a count or a
search over a large organization well under a second. Locks are held by transactions of milliseconds. So the bounds
only stop a runaway query, or a lock held by a stuck client, from holding a connection (on SQLite, the one writer every
change waits for) indefinitely: the statement fails, and the request that met it answers 503 (try again), without
retrying a lock wait that has already run out. A server's bounds can be changed in its DSN, which Quisora then leaves
as they are (PostgreSQL: `?statement_timeout=30000&lock_timeout=10000`, in milliseconds; MySQL:
`?max_execution_time=30000&innodb_lock_wait_timeout=10`; MariaDB: `?max_statement_time=30&innodb_lock_wait_timeout=10`,
in seconds). The PostgreSQL bounds are sent when a connection starts: a pooler between Quisora and PostgreSQL must
accept them (PgBouncer refuses startup parameters it does not track; with them in its `ignore_startup_parameters`, set
them on the role instead: `ALTER ROLE quisora SET statement_timeout = '10s'`). The schema migration at start-up runs
without the bounds: building an index over a large table may take longer.

## TLS to the database

Off this machine, use TLS that verifies the server: the connection carries the database password and every sealed
record. Nothing is refused (local and development set-ups work as they are), but `serve` logs a warning at start-up
for each connection that leaves the machine unencrypted or unverified, and for an SMTP password sent without TLS.
Connections to `localhost`, a loopback address or a Unix socket are never warned about.

| Backend            | Verified TLS                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| PostgreSQL         | `sslmode=verify-full` in the DSN; a private CA in `storage.postgres.ca_file` (or `sslrootcert` in the DSN)   |
| MySQL / MariaDB    | `tls=true` in the DSN; a private CA in `storage.mysql.ca_file` / `storage.mariadb.ca_file` (which also turns TLS on) |

## Encryption at rest

Sealed secrets (TOTP secrets, password hashes, provider and signing keys, upstream tokens) are encrypted with the
master key on every backend. The rest of the data (names, email addresses, sessions, the audit log in the database) is
protected at rest by the storage:

- **BadgerDB** encrypts its files when `storage.badgerdb.encryption_key` is set (`quisora genkey`; AES-256; not the
  master key, and kept apart from the data like it). It is chosen when the store is created: a store made without it
  cannot be opened with it, and the reverse. To encrypt an existing store, back it up, then restore into a new store
  with the key set. Every node of a gossip cluster has its own store and may have its own key.
  To change the key: in a gossip cluster, one node at a time, stop it, set its new key, empty its data directory's
  `badgerdb` and start it: it copies everything back from the others, encrypted with the new key; wait until it is
  ready before the next. A single node: back up, then restore into a new store with the new key.
- **SQLite**: put the data directory on an encrypted volume (LUKS, FileVault, BitLocker, an encrypted cloud disk), or
  accept plain files for local use.
- **PostgreSQL, MySQL, MariaDB**: encryption at rest is the database's, set up by its administrator: encrypted
  tablespaces or tables (MySQL and MariaDB InnoDB encryption), the provider's encrypted storage, or an encrypted
  volume.
