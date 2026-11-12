---
title: "Guarantees"
weight: 20
---

1. **A confirmed write is never lost, and never lost to a concurrent or stale write.** A write returns once a majority
   of the configured cluster has stored it durably; any later owner's promise round meets one of those nodes, finds the
   write and settles it, so a confirmed write survives the loss of any minority, the owner included. A write based on a
   copy that is no longer the newest (every `Update`, `Create` and `DeleteIf` is a compare-and-swap on the version the
   caller read) is refused by the owner, which compares it with its committed data: of two concurrent writes from the
   same copy at most one takes effect, on every kind of record.
2. **A deletion is never undone by a write that had not seen it.** A deletion is a tombstone, a write like any other:
   a live write over one is refused (`store.ErrDeleted`, which matches `store.ErrNotFound`); an id comes back only by
   an explicit create (`CompareAndPut` with expected version 0) that the owner orders after the deletion.
3. **Of two records claiming one unique value, one claim is refused.** The owner checks unique values against its
   committed data, within the partition, as part of the write: the second claim fails with `store.ErrConflict`. Every
   unique value is scoped to one organization (below), so one partition's owner decides each. Nothing is created,
   flagged or stripped afterwards.
4. **A node that cannot know its data is current does not act on it.** A node that is copying the cluster's data
   (a new node, a lost disk), catching up after a start, cut off from the majority or misconfigured serves nothing but
   its health probes (`/readyz` answers 503), makes no replicated write and owns no rate-limit counter. Readiness is the
   single gate: the token, userinfo and introspection endpoints refuse too (503 `temporarily_unavailable`), and clients
   retry on another node.
5. **Every automatic recovery is safe by construction; every operator override is explicit**, one-shot, logged and
   audited (`quisora force-start`). Nothing is ever wiped or emptied automatically.
6. **A write whose outcome is not known says so.** When the owner is lost or a reply times out after the write was sent,
   the caller gets `store.ErrUnconfirmed` (HTTP 503): the write may or may not be in effect; the next owner settles it,
   committed once or never. The service layer treats it as it treats a lost reply from a database server. The store
   settles what it can first: it submits the write again, and the owner recognises one that landed by its request id on
   the record. A record another write has changed since no longer carries that id, so a refusal of the resubmission
   (stale, conflict, deleted, not found), which the write's own landing may have caused, is reported as unknown too,
   never as a refusal: as a SQL store does when it reads the record back after a lost connection.
7. These rules are enforced by tests that model the failures, run with `-race`. The partition protocol itself (ownership,
   failover and hand-over, majority commit, pending writes and their settlement, catch-up and resync, splits and
   minorities, cluster ids and sizes) is tested in the gossip library (`partition/`, with its fault-injection tests).
   Quisora's own tests in `internal/cluster/*_test.go` cover what it builds on it: the scenarios in which the cluster
   drives a backend's durable state run on every backend (replication of writes, the store's errors, whole-cluster
   restart, the lost-disk resync and unique values on BadgerDB, SQLite, and PostgreSQL, MySQL and MariaDB when
   their test DSNs are set: `scripts/test-dbs.sh`; purges, a node restored from its own snapshot and seeding on BadgerDB
   and SQLite); the others (one end-to-end owner loss, concurrent updates and claims, force-start, lagging and diverged
   partitions, unconfirmed and slow writes, resizes, membership, clocks, key rotation and compatibility) each run on
   one of BadgerDB and SQLite, the two about evenly. The store conformance suite, with the partition operations every
   backend implements, runs on every backend (`internal/store/storetest`; the cluster's own suite is `internal/cluster/conformance_test.go`).
