---
title: "Operator procedures"
weight: 170
---

Every refusal says why and what to do.

**A node was down, or cut off, for any time.** Start it (or heal the network). It catches up (by sequence, or by copying the
partitions whose history was purged meanwhile) and serves. Nothing else is needed.

**Replacing a node** (lost disk, new machine). Start the replacement with an empty database and the same `cluster.size` and
`cluster.peers`. It copies everything from the others and serves once it has copied from a majority of the other nodes
(both others of a three-node cluster); while another node is down as well, it waits in the resyncing state (see
`quisora force-start`). The old node's id is dead in gossip and is forgotten.

**Whole-cluster outage.** Start every node. They promise and catch up among themselves and each serves as soon as a majority is
up and it has been stable for a few seconds. No `force-start`.

**A database that lost its node id** (the data directory was not kept, the database was): the node refuses ("this database belongs
to node ..."): set `cluster.node_id` to the owner or keep its data directory. It wipes nothing.

**Two nodes impaired at once** (one down and another with a new disk, or two new nodes): the node that needs to hear from enough of
the others cannot: run `quisora force-start` on it and start it (below).

**Restoring a backup.** Restore into one node with an empty database (`quisora serve --restore-from`, or `quisora restore`):
its records become the first writes of their partitions, of a new data set. Start it, and start the others with empty databases
(before or after it): they adopt its data set and copy from it. A restore never goes over data, and never on a node that already
holds a data set (refused before anything is written). A restored (or bootstrapped) node that meets a cluster of another data set
exchanges nothing with it and refuses to serve ("another data set is in view"): start it with an empty database instead.

**Bootstrapping.** `quisora bootstrap --new-cluster` on one node of a new cluster, with an empty database. The others start with
empty databases, before or after it: until a node publishes a data set they wait ("no data set"), then they adopt it and copy from
it. A node that joins a cluster needs no bootstrap.

## Changing the cluster size

The size changes **one node at a time**: 3 → 4 → 5, or 7 → 6 → 5. Any majority of the old size and any majority of the new
one then share a node, and a new node can only join once the old nodes make a majority of the new size. A larger change is a
series of steps, each completed before the next. **Writes pause while the nodes disagree about the size** (a node ignores
messages from one configured differently), for as long as the reload takes on every node: seconds if every node reloads at
once; the partition protocol stops and starts again with the new size on each node (the data stays).

Each step edits every node's configuration, then has every node re-read it at once: **Reload configuration** on the admin
console's System page (Cluster), or `POST /api/cluster/reload` (super admin, after a recent re-authentication; audited as
`cluster.reload`). Every node in view first reads and checks its configuration; only if all of them can apply it and all name the
same `cluster.size` does each one apply it. Otherwise nothing changes, and the answer has each node's report. A node that is down
is not asked: it reads its configuration when it starts. SIGHUP reloads a single node the same way, but the nodes then disagree
on the size, and none of them writes until the last one has reloaded: reload every node, one after the other, quickly. Keys kept
in Vault or 1Password are read again by the same reload ([secret stores](/docs/security/secret-stores/)). Nodes sharing a database (no gossip)
run the same two-phase reload over `cluster.notify`; without it each node reloads on its own (SIGHUP).

**Adding a node** (N → N+1):

1. Check that every node reports ready (`/readyz`).
2. On every running node set `cluster.size` to N+1 and add the new node to `cluster.peers`.
3. Reload. Every node now needs a majority of N+1 (3 of 4, 3 of 5); the N running nodes still make one. A reload is refused while
   too few nodes are in view for that.
4. Start the new node with an empty database and the same `cluster.size` and `cluster.peers`. It copies from the others (it needs
   enough of them that every majority includes one: `size − majority + 1`, so two of the three others in a 4-node cluster,
   three of the four in a 5-node one) and serves once it has.

**Removing a node** (N → N−1):

1. Check that every node reports ready (`/readyz`).
2. Stop the node that leaves. The others carry on with the old size, on their majority (N−1 is at least a majority of N for any N
   of 2 or more).
3. On every remaining node set `cluster.size` to N−1 and remove the node from `cluster.peers`.
4. Reload. A reload that would shrink the size is refused while more nodes than the new size are in view: stop the leaving node
   first. Retire its data directory; it must not rejoin (with its old configuration it would refuse anyway: its size disagrees).

A step of more than one node, a `cluster.peers` that does not name `cluster.size` nodes, or nodes whose configurations name
different sizes are refused before anything changes. A reload changes nothing when the sizes already match, so after a partial
reload (a node that did not answer) reload again.

**A partition diverged on a node** ("partition N diverged on this node": its copy holds writes the partition's owner does
not have, which only lost or wrongly restored data explains, here or on a majority elsewhere). The node serves nothing of
that partition and is not ready. Resync it: stop it, empty its database and start it again; it copies everything from the
others. Look for how its data came back (a snapshot restored in place, above).

**A node restored from its own snapshot** ("this node was restored from a snapshot of itself", or "its database is older
than its cluster state"): it resyncs by itself at that start; if it says it no longer takes part, restart it.

## `quisora force-start`

For a node whose data is not intact (a new disk, a restored database) when too few other nodes are up for it to copy from enough
of them that every majority includes one (both others of three): two of three impaired at once. It is the operator accepting that the cluster cannot tell
whether the node that is up holds every acknowledged write.

- Writes a marker file in the data directory; the **next start only** consumes it (the file is removed at start, whatever the
  outcome). That start treats the node's data as not intact whatever its state says, and resyncs from **whichever other nodes
  answer, even one**. A write that only the nodes it could not reach held is lost.
- It is **logged** at start, and written to the primary organization's **audit log** (`cluster.force_start`) as soon as the node
  is writable; until then it stays pending in the node's cluster state, across restarts.
- It is not needed after any restart, whole-cluster restarts included, nor to replace a node while the other nodes are up.
