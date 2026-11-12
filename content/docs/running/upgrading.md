---
title: "Upgrading"
weight: 140
---

Settings removed: `storage.badgerdb.path`, `storage.sqlite.path` and `audit.victorialogs_spool_dir` (the store and
the spool are always in `server.data_dir`, [The data directory](/docs/running/settings/#the-data-directory)). A configuration that still has
them is refused at start-up; take them out, and move an existing store or spool into the data directory first.

**Before the first release** there is no upgrade path: a store written by an older pre-release build is refused at
start-up. Wipe it and start clean (or restore a backup made by the new build). What has to happen before that
release: [Releasing](/docs/internals/releasing/).

**From the first release:**

- **Back up first.** Upgrades go forward only. A store or database written by a newer build is refused, so going
  back means restoring the backup.
- **One release at a time.** Each release works with the previous one: a cluster can be upgraded one node at a time
  while it keeps serving. Nodes publish their compatibility, and a node more than one release apart is refused: the
  others log `refusing to serve … upgrade one release at a time` and stop serving until it is upgraded or gone.
- **Storage is migrated at the first start of the new build**, step by step, each step recorded as it completes (an
  interrupted upgrade resumes). Nodes that share a database do it once, under a lock; with gossip, every
  node migrates its own store.
- **Backups** made by the previous release restore into the new one.
- **Brute-force windows restart.** With gossip, sign-in rate-limit and lockout counters live in the memory of the
  node that owns them ([Deletion](/docs/replication/deletion/#short-lived-state)); every node that stops during a rolling upgrade
  hands its counters' windows to a new owner, which starts them from nothing. An attacker who watched the upgrade
  could try again sooner than `limits.lockout_minutes` allows. Watch `login.limited` and `login.lockout` across an
  upgrade, and keep upgrades short. To change a limit, reload instead: that keeps every counter
  ([limits and denied addresses](/docs/running/limits-and-denied-addresses/#changing-them-without-a-restart)).

## Changing a stored format (for developers)

Until the first release, formats change in place. From then on:

- A record field that can be added with a sensible zero value needs nothing: older records read as the zero value.
  Renaming, removing or re-interpreting one needs a migration, on every backend:
  - BadgerDB: append to `formatMigrations` (`internal/store/kvstore/kvstore.go`);
  - SQL: append to `migrations()` (`internal/store/sqlstore/migrate.go`): statements, and Go code for data.
- **Making an existing field a column or an index (something a list can filter or sort by) needs a data migration that
  backfills it.** The SQL stores add a new column to existing tables with its zero value and never fill it in from the
  stored records (`reconcile` in `internal/store/sqlstore/reconcile.go`; the real value stays in the record's data
  until the record is next written), so a SQL listing that filters on it silently misses every old record. BadgerDB
  misses them too: it keeps each record's index fields as they were computed when the record was written, and filters
  and indexes by those, so an old record has neither the field nor its index entries until it is written again. Nothing
  reports an error. Put the backfill in the same migration as the change, in both places above: on SQL a `data` step
  of `migrations()` that reads each record and writes the column (and, for a unique value, its row in the unique
  table); on BadgerDB a `formatMigrations` step that calls `rewriteRecords` for the kind, which recomputes the stored
  index fields and entries from each record's data. Test it by creating records with the old build's schema, opening the store with the new one,
  and listing by the new field on every backend.
- A backup format change: raise `version`, add `upgrades[old]`, and keep `minVersion` at the previous release's
  version (`internal/backup/backup.go`).
- What nodes send each other changes (a change or a write's data in `internal/cluster/partition.go`, the record encoding in
  `wire.go`, an ephemeral operation): raise `compat`; raise `minCompat` only when this build stops understanding the previous
  release (`internal/cluster/node.go`). A node that does not speak the same version is refused, so a change that the previous
  release cannot read means every node changes at once.
- **The partition layout is a data format.** The number of partitions (64), a kind's partition key (`model.Index.Partition`),
  the partition numbering (`partition.PartitionOf`), the encoding of what `Prepare` and `Commit` exchange and the protocol state
  kept in the databases move records between partitions or change what a stored write means: a running cluster cannot do that
  in place. Changing any of them is a migration with the cluster stopped (backup, restore into a new cluster).
- Never edit or remove a released migration or upgrade: append.
