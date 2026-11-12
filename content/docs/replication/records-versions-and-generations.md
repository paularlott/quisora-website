---
title: "Records, versions and generations"
weight: 80
---

Every record carries a **version** (a hybrid logical clock timestamp: microseconds since 1 January 2025 plus a counter),
**Origin** (the node that wrote it), **Epoch** (the *generation* of a live record: 0 for one created once, or, for a
record created again after a deletion, the version of the tombstone it superseded), **Created** (the version of the write
that created the generation), **Deleted** (a tombstone) and its **partition key**. Versions are stamped by the owner and
are used for the compare-and-swap (the caller's expected version), tombstone age and display; **order comes from the
partition's (epoch, sequence), never from clocks**. A new version of a record is always above the one it replaces
(`max(clock, old+1)`), so a clock stepped back changes nothing.

- `Put` of a live record over a live one continues its generation; over a tombstone it is **refused with
  `store.ErrDeleted`**.
- `CompareAndPut` with `expect != 0` (an update) needs a live record at exactly that version (`ErrNotFound` / `ErrStale`
  otherwise) and continues its generation; with `expect == 0` (a create) over nothing it starts generation 0, over a
  tombstone a generation whose epoch is that tombstone's version, over an expired record it keeps the generation.
- A deletion (`Put` of a tombstone, or `DeleteIf` against a version) carries the partition key and scope of the record it
  deletes (the landing node looks it up, asking the owners if it does not hold the record). Deleting a record that is not
  live (missing, or already a tombstone) writes nothing.
- **The same contract on every store.** A record's id and scope are at most 191 characters, its partition key 512, a
  string field 255 (the tags field `model.MaxTagsText`); a longer one is refused (`store.ErrBadRecord`) before anything
  is written. Unique values have no limit (above). A write never moves a record to another partition (a tombstone keeps
  its record's). A call whose context has ended (a write: before it begins, and then it writes nothing) and any call to a closed store
  answer `store.ErrUnavailable`.
- Node-local state (`KindEphemeral`: leases, markers, short-lived sign-in state) is never replicated.
- **Queued items** (`KindQueue`: emails waiting for SMTP, back-channel logouts waiting to be retried) are each node's
  own, in every mode: an item's scope names the node that queued it (its `node_id`, made at its first start and kept in
  its data directory, or `cluster.node_id`), and only that node reads, re-seals or delivers it (it lists them once at
start, into an index in memory that its own writes keep from then on). With gossip they
  are local writes like audit events (always allowed, never part of a partition write, an export, an import, the
  seeding of a new cluster or a backup); a delivered or given-up item is expired at once rather than deleted, since a
  tombstone of a node-local kind is in no partition whose purge would remove it. Each expires at its queue's discard
  horizon, a day past its last retry, so the items of a node that is gone for good (or that no configured master key
  opens) are purged with the expired records.
- **Audit events** (`KindAudit`), in the database audit mode, are **never replicated**: every node writes the events it
  records to its own database, a local write that needs no owner, no majority and no readiness (a node cut off from the
  others still records its own). They are never part of a partition write, a catch-up export or import, or the seeding of
  a new cluster, and a full copy of a partition leaves a node's own events untouched. An audit page (`GET /api/audit`,
  the console) asks every alive node of the same data set for its newest matching events (`UserMsg+10`, at most 5,000
  per node, encrypted and authenticated with the cluster key like every message; a node's answer is cut to what fits one
  message, 3 MB, and asked for again from where it ended, so a page of large events is complete), merges them in the page's order and
  says how many nodes answered within 3 seconds: a node that is down or slow is missing from the page, not an error.
  Each node purges its own events after `audit.retention_days`. With VictoriaLogs configured (production), every node
  sends its events there instead, and the pages read them from it.

## Re-using an id

Most ids are random (model.NewID: a timestamp and random bits) and are never re-used. Deterministic ids (group memberships, tenant access, sign-in records, locks)
are re-created with a create, which the owner orders after the deletion. What `quisora bootstrap` writes (the primary
organization, its default tenant, the first administrator) has random ids too; the primary organization is the one
marked so in its record, which claims a unique value (`model.PrimaryOrgKey`) no second organization can hold. Every node
reads it from the data set it holds or copies, so a node knows the primary organization once it has that record, and is
not ready before.

## Housekeeping

Key rotation, user end dates, the orphan sweep and re-sealing run on **one node: the owner of partition 0**
(the global data), as long as it can read partition 0 and is writable (`Node.IsLeader`; `leader` in the status, and
`quisora_leader`, say which node that is). There is no separate election: partition 0's owner is the node every other node
already agrees on, and a hand-back (a restart, a resize, a clock that is off) or a crash moves housekeeping with it. A new
housekeeper runs a pass at once and then every interval; every task is idempotent, so a pass interrupted by a move is simply
run again by the next owner.

Housekeeping is **fenced** by the same tenure. A pass starts with a context carrying the epoch under which this node owns
partition 0 (`Node.fence`), and each write made with it first checks that this node still owns partition 0 at that epoch
(`Node.fenced`); a node that was deposed in the middle of a pass (paused, cut off, handed partition 0 back) has the rest of
that pass's writes refused (`store.ErrUnavailable`) instead of racing the new housekeeper's. What remains is the moment
between the check and the write, in which two housekeepers are harmless for the same reason as in the shared-database mode
(below). A node that becomes housekeeper again later starts a new pass under the new epoch.

There is no `cluster` setting for any of this: the timing is the partition protocol's (`HeartbeatInterval`, `OwnerTimeout`).
Earlier builds ran a separate gossip leader election for housekeeping; it is gone, with its tuning, and nothing needs
changing in a configuration for it.

## Tombstones and their purge

Tombstones are kept for the retention (7 days) so that a node that was away catches up by sequence number, which is cheap.
**A purge is a write of the partition**: the owner's housekeeping scans a partition for its tombstones about once an
hour (reading only the tombstones, from an index every backend keeps of them by sequence, and within the same limit on
long reads as a catch-up export: a node serves at most four at once, so a scan that finds none free waits for the next
round), chooses a sequence number below which every tombstone is older than the retention, and writes "purge below
sequence N"; every node purges the same tombstones at the same position, whatever its clock (`pstore.Commit`
purges first, then applies, so a crash between the two is repeated harmlessly). A node's database records the purge
point first and then removes the tombstones below it in batches, each a short transaction of its own (so a partition
with many never holds the database's writer, or its locks, for the whole purge); a crash part-way leaves some below the
point, which no export after the point shows and the next purge removes. A node whose committed position is
below a partition's purge point cannot catch up by sequence and **copies the partition whole**, which replaces its data
(a record deleted meanwhile does not come back). So the retention is a matter of cost, never of safety. Records that
expired are removed by every node from its own copy.
