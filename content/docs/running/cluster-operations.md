---
title: "Running a gossip cluster"
weight: 105
---

What a replicated (gossip) cluster does by itself when nodes fail, and the few things an operator does. Setting one up
is in [Clustering](/docs/running/clustering/). Its status and metrics are in
[Health and monitoring](/docs/running/health-and-monitoring/).

## What keeps working on its own

With 3 nodes (with 5, read "up to two"):

| Situation | What happens |
| --- | --- |
| One node down | The other two are a majority: they take over its work and keep writing and serving. For about 7 seconds, writes that went to it wait or answer 503; the other organizations are unaffected. |
| It returns with its data | It catches up and rejoins on its own. |
| It returns with its data lost (a new disk) | It copies from the other two and rejoins on its own. |
| It was away for more than 7 days | It copies what it cannot catch up on, on its own. |
| Every node restarts | They catch up among themselves. Nothing special is needed. |
| Two nodes impaired at once (one down, another lost its data) | The survivor cannot know whether it misses writes. You accept that with [`quisora force-start`](#quisora-force-start). |
| Losing the data of two nodes at once | What only they held is gone. Restore from a backup. |

## Node states

| State | When | Serves sign-ins and tokens |
| --- | --- | --- |
| **resyncing** | Its data is new, lost, restored or forced, until it has copied from the others | No |
| **catching up** | Every start, until it has caught up and been stable for a few seconds | No |
| **ready** | Caught up, a majority in view, every node agrees on the size and runs a compatible build | Yes |
| **cut off** | Fewer than a majority in view | No |
| **partition diverged** | Its copy of some data holds writes the others do not have | No |
| **partition unreadable** | Some data cannot be read here for now (no owner heard, catch-up failing, being copied whole) | Yes, except that data, which answers 503 |
| **misconfigured** | Its database belongs to another node, the nodes disagree on the size or build, its clock is off, and similar | No |

A node that is not ready makes no replicated writes. A refused write answers 503 and changes nothing anywhere. The
log, `GET /api/cluster` and the console's System page say why a node is not ready.

## Procedures

Every refusal says why and what to do.

**A node was down, or cut off, for any time.** Start it (or heal the network). It catches up and serves. Nothing else
is needed.

**Replacing a node** (lost disk, new machine). Start the replacement with an empty database and the same
`cluster.size` and `cluster.peers`. It copies everything from the others and serves once it has copied from a majority
of the other nodes (both others of a three-node cluster). While another node is down as well, it waits in the
resyncing state (see [`quisora force-start`](#quisora-force-start)).

**Whole-cluster outage.** Start every node. Each serves as soon as a majority is up and it has been stable for a few
seconds. No `force-start`.

**A database that lost its node id** (the data directory was not kept, the database was). The node refuses ("this
database belongs to node ..."). Set `cluster.node_id` to the owner, or keep its data directory. It wipes nothing.

**Restoring a backup.** Restore into one node with an empty database (`quisora serve --restore-from`, or
`quisora restore`). Start it, and start the others with empty databases, before or after it: they copy from it. A
restore never goes over existing data and is refused on a node that already holds data. A restored node that meets a
cluster holding other data exchanges nothing with it and refuses to serve ("another data set is in view"): start it
with an empty database instead.

**A new cluster.** Run `quisora bootstrap --new-cluster` on one node, with an empty database. Start the others with
empty databases, before or after it. They wait until the first node is up ("no data set"), then copy from it. A node
that joins a cluster needs no bootstrap. Bootstrap only one node.

**A partition diverged on a node** ("partition N diverged on this node"). Its copy holds writes the others do not
have, which only lost or wrongly restored data explains. The node is not ready. Resync it: stop it, empty its database
and start it again. It copies everything from the others. Then find out how its old data came back, such as a disk
snapshot restored in place.

**A node restored from its own snapshot** ("this node was restored from a snapshot of itself", or "its database is
older than its cluster state"). It resyncs by itself at that start. If it says it no longer takes part, restart it.

## Changing the cluster size

Change the size **one node at a time**: 3 → 4 → 5, or 5 → 4 → 3. A bigger change is a series of steps, each finished
before the next. Writes pause while the nodes disagree about the size, for as long as the reload takes on every node.

Each step edits every node's configuration, then has every node re-read it at once: **Reload configuration** on the
admin console's System page, or `POST /api/cluster/reload` (super admin, after a recent re-authentication; audited as
`cluster.reload`). Every node first checks its new configuration. Only if all of them can apply it, and all name the
same `cluster.size`, does each one apply it. Otherwise nothing changes, and the answer has each node's report. A node
that is down reads its configuration when it starts.

SIGHUP reloads a single node the same way, but then the nodes disagree on the size and none of them writes until the
last one has reloaded. If you use it, reload every node quickly, one after the other. Keys kept in Vault or 1Password
are read again by the same reload ([secret stores](/docs/security/secret-stores/)). Nodes sharing one database (no
gossip) reload together over `cluster.notify`; without it, each node reloads on its own (SIGHUP).

**Adding a node** (N → N+1):

1. Check that every node is ready (`/readyz`).
2. On every running node, set `cluster.size` to N+1 and add the new node to `cluster.peers`.
3. Reload. The running nodes still make a majority of the new size.
4. Start the new node with an empty database and the same `cluster.size` and `cluster.peers`. It copies from the
   others and serves once it has.

**Removing a node** (N → N−1):

1. Check that every node is ready (`/readyz`).
2. Stop the node that leaves. The others carry on with the old size.
3. On every remaining node, set `cluster.size` to N−1 and remove the node from `cluster.peers`.
4. Reload. A reload that shrinks the size is refused while more nodes than the new size are in view, so stop the
   leaving node first. Retire its data directory: it must not rejoin.

A step of more than one node, a `cluster.peers` that does not list `cluster.size` nodes, or nodes whose configurations
name different sizes are refused before anything changes. A reload changes nothing when the sizes already match, so
after a partial reload (a node that did not answer), reload again.

## `quisora force-start`

For a node whose data is not intact (a new disk, a restored database) when too few other nodes are up for it to copy
from safely: two of three nodes impaired at once. Running it means you accept that the node that is up may not hold
every write that was confirmed.

- It writes a marker file in the data directory. The **next start only** uses it, and removes it whatever the outcome.
  That start copies from **whichever other nodes answer, even one**. A write that only the unreachable nodes held is
  lost.
- It is logged at start, and written to the primary organization's audit log (`cluster.force_start`) as soon as the
  node can write.
- It is not needed after any restart, whole-cluster restarts included, nor to replace a node while the other nodes are
  up.

## Limits

- **Without a majority, nothing is written.** A lost node's work takes about 7 seconds to move. Writes that went to it
  wait up to 5 seconds, then fail with 503. A node stopped with SIGTERM hands over at once.
- **Each organization's writes go through one node at a time.** That is several hundred writes a second with a fast
  disk, so a very busy organization is bounded by it.
- **A node whose data is lost needs most of the others to copy from**: both others of three, three of the four others
  of five. Use three or five nodes.
- **A write's outcome can be unknown** (503) when a node is lost mid-write. It is then settled one way or the other,
  once. Re-read before you retry anything that should not happen twice. The audit log records such a change with
  outcome `unknown`.
- **Reads on one node can be a moment behind a write made on another.**
- **Losing the data of a majority at once** (two disks of three) loses what only they held. Restore from a backup.
- **Bootstrap or restore only one node of a cluster.** Nodes holding different data never exchange it, and an empty
  node that sees two of them joins neither.
- **Two super admins removing each other at the same moment** on different nodes can leave none.
  `quisora invite --break-glass --super-admin primary <email>` recovers. Keep a second super admin anyway.
