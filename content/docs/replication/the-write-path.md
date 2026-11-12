---
title: "The write path"
weight: 50
---

`cluster.Store.Put` and `CompareAndPut` (every kind but `KindEphemeral`) send one **change** to the owner of the
record's partition (`partition.Manager.Write`) and return when it has committed:

1. **The landing node** (the one that took the request) does the work that does not need the owner: it parses the
   request, checks the password (argon2) and builds the record. It sends the change to the owner it believes in; a node
   that is not the owner answers with the one it believes in and the landing node tries that once. The change is the
   encoded record, how to check it (**match**: the live version it must have, 0 for a create; **upsert**: whole-record
   put, refused over a tombstone; **blind**: a deletion that needs no particular version) and nothing else.
2. **The owner's `Prepare`** (`pstore.Prepare`), serialised per partition and against the committed data only:
   compares the version (`store.ErrStale`, `ErrNotFound`, `ErrDeleted`), checks the unique values the record lists
   within the partition (`store.ErrConflict`), stamps the new version (the owner's hybrid logical clock, and always above
   the version it replaces, whatever the clocks say) and the generation (`store.StampLocal`), and returns the stamped
   record as the write's data and its version as the reply. Refusals travel back as codes (`stale`, `conflict`,
   `deleted`, `not-found`) that the cluster store turns into the store's own errors.
3. **Replication**: the owner assigns the next sequence number and sends the write to every node, storing it as its
   own *pending* write at the same time (durable); a follower stores it as its pending write (durable) and
   acknowledges. The write is **committed** once a majority of the configured size, the owner included, has
   acknowledged. The owner then applies it to its records (`pstore.Commit`: the records and the partition's committed
   position in one transaction) and answers; followers apply it when the owner's commit notice arrives (one message
   after the commit) or at the latest with the next write or heartbeat.
4. **The writer reads its own write**: `Store.Put` waits until this node has applied the write (bounded, 5 s) before it
   returns, so `Get` after `Put` sees it on the same node. Other nodes see it a message later.
5. **A refusal is read after what caused it.** When the owner refuses a change (a stale version, a unique value in use,
   a record gone), its refusal carries the owner's committed position; the landing node waits (bounded by the
   partition's staleness bound, `StaleAfter`: the owner timeout, 5 s) until it has applied that position before it returns `store.ErrStale`
   (or the other refusal), so the caller's re-read sees what made the change stale instead of the same old copy. A node
   that cannot catch up in that time fails closed: it returns `store.ErrUnavailable` (503, retry), never a refusal the
   caller would judge by a copy it cannot trust. A refresh token presented again after its rotation, on a node
   whose copy of the grant is a message behind, is therefore detected as reuse (the grant ends and it is audited), while
   a client retrying, within the grace, the token whose answer it lost is given the token it missed.

**The transport's deadline.** A node that is not the owner sends the change to the owner and waits for the answer for up
to the protocol's write timeout (5 s). The gossip transport must let it: Quisora sets gossip's `TCPDeadline` to the write
timeout plus a heartbeat and a second to spare (6.5 s), and a node whose configuration would make it shorter than the
protocol needs (`partition.Manager.MinTransportDeadline`) refuses to start. With a shorter deadline a change that takes
longer (an owner waiting for its partition, a slow follower) would be reported unknown while the owner commits it. Quisora's
own requests over the cluster bound themselves with shorter contexts: an ephemeral operation 2 s, a clock reading 3 s, an
audit page `auditWait`, a configuration reload the transport's deadline per phase, and fresh reads the protocol's write timeout.

One write at a time is in flight per partition (several hundred a second on a LAN with a fast disk, times 64
partitions); an owner holds at most 32 forwarded changes of one partition at once and 256 in all, and answers more
"busy" (the landing node sends them again after a pause of a few milliseconds: nothing was run). A node runs at most 4
catch-ups at once in the background, matching the exports a node serves at once. These are the library's defaults,
which Quisora keeps. A write is not abandoned when its caller goes away: it is seen through, within the library's write
timeout. Writes are checked on the owner against committed data, so **every check that must not run on a stale copy
runs there**: the compare-and-swap on the version the caller read, and the unique values.

**A lost owner costs its own partitions' writes, not the node.** A write to a partition whose owner is gone waits on the
landing node: for the owner timeout (5 s) the owner cannot be told from a slow one, and then the partition is between
owners until the takeover (a second or two more), each write waiting up to the write timeout (and a write whose outcome
became unknown is settled for up to 10 s more). At thousands of requests a second those waits, for the third of the
partitions a lost node of three owned, would fill the HTTP layer's in-flight limit (`limits.max_in_flight`) and shed
every organization's requests. So a node has at most 64 writes of one partition under way at once (sent, waiting for an
owner, or being settled): one past them is refused at once with `store.ErrUnavailable` (503, retry; nothing was sent, so
it is not an unknown outcome), the lost owner's partitions hold at most about 1,400 of a node's requests, and the other
partitions go on. Those 64 still wait, and succeed when the takeover completes within their timeout. A partition that is
only busy meets the same cap: 64 writes waiting on one node already queue behind an owner that runs them one at a time
and takes 32 at once, and further ones are refused promptly instead of each holding a request for seconds. Writes are not
refused on a guess at the owner's state: during the owner timeout there is nothing to tell a lost owner by, and a write
that arrives while the partition is between owners succeeds once it has one.

The owner's `Commit` applies exactly what `Prepare` decided, deterministically, on every node; the change hooks
(`Node.OnChange`: cache eviction, live admin pages) run for every applied record, local or replicated, on every node.

## Durability

`partition.Store` is implemented over the node's own database (BadgerDB, SQLite, PostgreSQL, MySQL, MariaDB) with a
row per partition for the protocol state (`promised`, `committed`, `pending`) next to the data. The library's `Store`
contract is that `Commit`, `Import`, `SetPromised` and `SetPending` are all durable before they return. Deferring the
durability of `Commit` and `Import` is an optional optimisation, allowed only for a store that guarantees the ordering
rule (a durable promise or pending write also makes everything committed or imported before it durable); it works
because a commit that a crash loses is redone from the pending write. Which contract each backend meets:
**BadgerDB** and **MySQL/MariaDB** meet the simple one (a synced Badger commit; a transaction commit that flushes the redo log),
and **SQLite** and **PostgreSQL** use the optimisation for commits and imports (an unsynced transaction) and rely on the ordering
rule, which their write-ahead log gives: a later synced commit (a promise or a pending write) flushes the log up to itself,
the earlier unsynced ones included. The protocol's safety rests on this, so **BadgerDB must be opened
with `storage.badgerdb.sync_writes = true`** (the default; a gossip node refuses to start with it off): Badger syncs every
commit, the commits that need not be durable included (an option to leave those unsynced was built and removed). The same holds for the servers: **PostgreSQL must run with `synchronous_commit = on`** (its
default; `remote_write` and `remote_apply` are stronger; with `off` a crash can lose a promise or a pending write, and
nothing checks the setting): the promise and the pending write are ordinary commits that rely on it, while the commits and imports,
which need not be durable, set `synchronous_commit = off` for their own transaction only (a later synchronous commit
flushes the log up to itself, theirs included). MySQL and MariaDB need `innodb_flush_log_at_trx_commit = 1` (the default),
and SQLite's writer runs with `synchronous = FULL`. A node whose database cannot be written steps down from its
partitions.
