---
title: "Known limits"
weight: 200
---

- **A partition without a majority is unavailable** for writes and fresh reads; a lost owner takes about 6.5 seconds to replace
  (writes to its partitions wait for it, up to the 5 s write timeout, then fail with 503). A node stopped with `SIGTERM` hands over
  at once.
- **One write at a time per partition**: an organization's sign-ins and token grants all go through its one owner (audit
  events do not: they are each node's own). Several hundred writes a second per partition with a fast disk; a very busy organization is bounded by that.
- **A node whose data is not intact needs enough of the other nodes that every majority includes one of them** (`size − majority +
  1`) to copy from: both others of three, the other one of two, two of the three others of four, three of the four others of five.
  Use three or five nodes.
- **A write's outcome can be unknown** (`store.ErrUnconfirmed`, HTTP 503): the owner was lost or a reply timed out after the write
  was sent. The next owner settles it, committed once or never; callers re-read before they retry what is not idempotent.
- **Local reads are a message behind a write** made on another node, a heartbeat at the worst; `Store.Put` waits for the writer's own
  node, and the checks that must see the latest state read through the owner.
- **A data set is chosen by the operator.** A node with no data set adopts the one the nodes it sees publish; one bootstrapped
  or restored by mistake while it is the only node up with a data set is the one the empty nodes adopt. Nodes of different data
  sets never exchange data, but an empty node that sees two of them joins neither until one is gone: bootstrap one node of a new
  cluster only.
- **A node of another data set is still a gossip member**: the clock check and the routing of short-lived state see it (it is
  never ready, so nothing is routed to it). It never runs housekeeping: it owns no partition of the
  cluster's (the protocol ignores nodes of other data sets), so partition 0's owner is always a node of the cluster's data
  set.
- **Losing the data of a majority at once** (two disks of three) loses what only they held; restore from a backup.
- **Membership comes from the gossip library's failure detector**; a node that is alive but cannot exchange data still counts as in
  view for gossip (the partition protocol then refuses its writes rather than losing them).
- The retention (7 days) is fixed; it only decides how far behind a node may be to catch up without copying a partition whole.
- Two super admins removing each other at the same moment on different nodes can leave none (see "Super admins are protected by
  rank"): `quisora invite --break-glass --super-admin` recovers.
- A group change's sequence fence rests on the removed membership record being kept: a writer stalled for longer than 7 days
  (`model.RemovedMemberRetention`) could re-create a membership removed since, as any write that old could undo a purged tombstone. A
  membership a stalled writer materializes for a group or user deleted meanwhile is inert (readers resolve the group and user) but
  stays until its removal expires.
