---
title: "Running a gossip cluster"
description: "What a gossip cluster does when nodes fail, and the few procedures an operator needs."
weight: 90
---

Setting up a cluster is in [Clustering](/docs/running/clustering/). Status and metrics are in
[Health and monitoring](/docs/running/monitoring/). The System page shows each node's state.

## What keeps working on its own

With 3 nodes (with 5, read "up to two"):

| Situation | What happens |
| --- | --- |
| One node down | The other two take over its work and keep serving. For about 7 seconds, writes that went to it wait or answer 503. |
| It returns with its data | It catches up and rejoins on its own. |
| It returns with its data lost (a new disk) | It copies from the other two and rejoins. |
| It was away for more than 7 days | It copies what it cannot catch up on. |
| Every node restarts | They catch up among themselves. Nothing special is needed. |
| One node down and another lost its data | The survivor cannot know whether it misses writes. You accept that with [`quisora force-start`](#quisora-force-start). |
| Two nodes of three lose their data | What only they held is gone. Restore from a backup. |

## Node states

| State | When | Serves sign-ins and tokens |
| --- | --- | --- |
| **resyncing** | Its data is new, lost, restored or forced, until it has copied from the others | No |
| **catching up** | Every start, until it has caught up and been stable for a few seconds | No |
| **ready** | Caught up, a majority in view, same size and compatible build everywhere | Yes |
| **cut off** | Fewer than a majority in view | No |
| **partition diverged** | Its copy of some data holds writes the others do not have | No |
| **partition unreadable** | Some data cannot be read here for now | Yes, except that data (503) |
| **misconfigured** | Its database belongs to another node, the nodes disagree on size or build, its clock is off | No |

The log, the System page and `GET /api/cluster` say why a node is not ready. A refused write answers 503 and changes
nothing anywhere.

## Procedures

**A node was down or cut off.** Start it, or heal the network. It catches up. Nothing else is needed.

**Replacing a node.** Start the replacement with an empty database and the same `cluster.size` and `cluster.peers`. It
serves once it has copied from a majority of the other nodes. If another node is down too, it waits in the resyncing
state (see `force-start`).

**Whole-cluster outage.** Start every node. Each serves as soon as a majority is up. No `force-start`.

**A database that lost its node id.** The node refuses ("this database belongs to node ..."). Set `cluster.node_id` to
the owner, or keep its data directory. Nothing is wiped.

**Restoring a backup, or a new cluster.** See [Clustering](/docs/running/clustering/#replicated-gossip) and
[Backup and restore](/docs/running/backup-and-restore/#clusters). Bootstrap or restore only one node.

**A partition diverged on a node.** Its copy holds writes the others do not have, which only lost or wrongly restored
data explains. The node is not ready. Stop it, empty its database and start it again: it copies everything from the
others. Then find out how its old data came back, such as a disk snapshot restored in place.

**A node restored from its own snapshot.** It resyncs by itself at that start. If it says it no longer takes part,
restart it.

## Changing the cluster size

Change the size **one node at a time** (3 to 4 to 5, or 5 to 4 to 3), finishing each step before the next. Writes pause
while nodes disagree about the size, for as long as the reload takes.

Each step edits every node's configuration, then reloads every node at once with **Reload configuration** on the System
page (audited as `cluster.reload`; it needs a recent re-authentication). Every node first checks its new configuration.
Only if all can apply it, and all name the same `cluster.size`, does each one apply it. Otherwise nothing changes and the
page shows each node's report. A node that is down reads its configuration when it starts. SIGHUP also works, but then
the nodes disagree on the size until the last has reloaded, so reload them quickly one after another.

**Adding a node (N to N+1):**

1. Check that every node is ready.
2. On every running node, set `cluster.size` to N+1 and add the new node to `cluster.peers`.
3. Reload.
4. Start the new node with an empty database and the same `cluster.size` and `cluster.peers`.

**Removing a node (N to N-1):**

1. Check that every node is ready.
2. Stop the node that leaves.
3. On every remaining node, set `cluster.size` to N-1 and remove the node from `cluster.peers`.
4. Reload. Retire the leaving node's data directory: it must not rejoin.

A step of more than one node, a `cluster.peers` that does not list `cluster.size` nodes, or nodes that name different
sizes are refused before anything changes. After a partial reload, reload again.

## `quisora force-start`

For a node whose data is not intact (a new disk, a restored database) when too few other nodes are up for it to copy
from safely, such as two of three nodes impaired at once. Running it means you accept that the node that is up may not
hold every write that was confirmed.

- It writes a marker file in the data directory. The **next start only** uses it, and removes it. That start copies from
  whichever other nodes answer, even one. A write that only the unreachable nodes held is lost.
- It is logged at start, and written to the primary organization's audit log (`cluster.force_start`).
- You do not need it after any restart, whole-cluster restarts included, nor to replace a node while the others are up.

## Limits

- Without a majority, nothing is written.
- Each organization's writes go through one node at a time, which is several hundred writes a second on a fast disk.
- A node whose data is lost needs most of the others to copy from. Use three or five nodes.
- A write whose node is lost mid-write can have an unknown outcome (503). Re-read before you retry anything that should
  not happen twice. The audit log records such a change with outcome `unknown`.
- Reads on one node can be a moment behind a write made on another.
