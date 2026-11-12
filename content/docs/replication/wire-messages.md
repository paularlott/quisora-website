---
title: "Wire messages"
weight: 140
---

Every message is authenticated and encrypted by the cluster key (gossip's AES-GCM, with a packet-age check); nothing
here is an unauthenticated surface. The gossip transport carries them; the cluster runs with 32 incoming and 16
sending workers (`NumIncomingWorkers`, `NumSendWorkers`), and the partition protocol answers on goroutines of its own,
so a request waiting for a disk or a majority never holds a worker.

**The partition protocol** (the library's: `gossip.PartHeartbeatMsg` to `PartReadMsg`, `ReservedMsgsStart+30..39`; every
message carries the sender's `ClusterSize`, and a receiver configured differently answers "size mismatch"):

| message | kind | content |
|---|---|---|
| Heartbeat | request | the partitions the sender owns with epoch and committed position → which it accepts, which it fences |
| Promise | request | partition, proposed epoch → OK, the responder's promise, committed position and pending write |
| Write | request | the write (epoch, sequence, previous position, data) and the owner's committed position → OK, promise, committed, "need catch-up" |
| Change | request | partition, the change → committed (position, reply), refused (code), unknown, not the owner (the owner it believes in), unavailable, busy |
| Read | request | partition, request → the owner's answer after it confirmed with a majority that it owns the partition |
| State | request | → committed, promised and pending of every partition |
| CatchUp | stream | partition, after → header, then the changed records (a frame each) and an end marker |
| Commit | one way | partition, epoch, committed position (the owner's commit notice) |
| Claim, Relinquish | request, one way | a higher-ranked node asks the owner to hand a partition back; an owner says it stepped down |

**Quisora's own** (`UserMsg+n`): `+5` an ephemeral operation on the node that owns the state; `+11` a change notice
(shared-database `cluster.notify` gossip only); `+12` a configuration reload (check, or apply); `+14` this node's clock
(the peer clock check); `+10` an audit page (this node's own events, answered only to a node of the same data set).
`+1` to `+4`, `+6` to `+9` and `+13` were the earlier gossip mode's (record broadcast, push, change feed, quorum
compare-and-swap, quorum read) and are not reused. The compatibility version published in gossip
metadata (`quisora.compat`) is 2: a node of the earlier mode, which publishes 1, and this one refuse each other.

The **change** a node sends is `change{Op, Mode, Expect, Rec, Before, Ops, Base, Replay}` (msgpack): a record write, a
transaction (its ops writes, or assertions: mode 3, the record named and the version expected) or a purge point; the **write's data** is `writeData{Recs, Purge}`: the stamped records every
node applies, and the purge point to apply first. Both stay under the cluster's packet limit (4 MB by default), so a
record must too; a fresh read's reply is asked again in halves when it would not fit.
