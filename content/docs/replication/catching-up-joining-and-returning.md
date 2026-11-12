---
title: "Catching up, joining and returning"
weight: 90
---

- **By sequence, per partition, of committed writes only.** A node behind a committed position (from a heartbeat, a write or
  the exchange at start) asks a node that has it for the changes after its own committed sequence; the owner is the
  preferred source, and any node is a safe source up to its own commit point because committed data is the same on every
  node that has it. Nobody ever serves a pending write as data. The stream is a frame per record, an end marker and the
  source's purge point. It is produced as it is sent (the sender holds a snapshot of its database, reads it a page at a time
  and writes nothing to disk; the snapshot is released when the stream ends or the receiver goes away) and applied as it
  arrives, a thousand records at a time, so memory is bounded by a batch whatever the size of the partition. **The committed
  position moves only when the end marker has been read**: a stream cut short leaves the position where it was, with the
  batches before the cut already stored (committed data of the source, each record carrying the sequence of the write that
  made it, which an export does not show above the position); the next catch-up asks for the same changes again and
  completes it. Until it has, the node serves no catch-up of that partition (its export would leave out the records the
  unfinished import replaced). A node serves at most four catch-ups at once (half its database's reader connections, on
  SQLite, at most): each holds a snapshot, and a connection, for its whole stream. A request it refuses fails, and the asker
  tries again. Before the position moves the node purges its tombstones to the source's purge point (or its own, if higher),
  whether it copied by sequence or whole: the stream carries records, not the purge writes, and a purge point is only ever
  one a purge write set (a whole copy does not take its own position as one), so every node at the same position holds the
  same tombstones.
- **Whole**, when the source purged the history needed (above), or for a node that has none.
- **At start** a node asks every node in view for its state; once a majority including itself has answered (a **majority
  of the other nodes** for a node whose data is not intact) it catches every partition up and, after the hold-down,
  becomes ready. A node with data serves catch-up whether or not it is ready, so a whole-cluster restart always proceeds.
- **A node whose data is not intact** (new, or its database was lost, replaced or restored) is in **resync mode**: it
  promises nothing, stores nothing and serves nothing until it has copied every partition from a majority of the other
  nodes and raised its promises to the highest they report: a node that forgot its promises could otherwise help a
  lower epoch win, and one that lost an acknowledged write could let it be overwritten. It also adopts the pending
  write of the highest epoch that the others hold. In a cluster of three both others must be reachable; of five, three
  of the four. When the resync completes, its database is intact from then on (`cluster-state.json`: `intact`), so its next
  restart needs none.
- **Intact** is decided at start from `cluster-state.json` (`intact`, and `self` naming this very database: a replaced or
  restored database is not): true for a node that has run, for the first node of a new cluster (`quisora bootstrap` and
  `quisora restore` seed its partitions: below), false for everything else. A database that holds records no partition
  write made (loaded by hand) is refused outright, not served and not copied from.
- **Formation.** Only nodes whose data is intact count, so a new cluster (one seeded node, the others empty) could not
  start by the rules above alone. A node *forms* (`cluster-state.json`: `formed`; set durably through the protocol's `Config.SetFormed` before its first promise is stored, or when it
  has synchronised with an intact majority); until then it is *unformed*, and says so in its answers. A node copying a data
  set counts only intact answers from formed nodes toward its quorum, except in formation: when it is unformed itself and
  every other node of the cluster answered unformed too (intact or not), at least one intact (the founder), it copies from
  the founder alone, because no write can have been committed without an unformed node (every commit needs a takeover,
  every takeover a majority of promises, and a promise forms its giver). One formed answer rules that out, and so does a
  node that does not answer (it may have formed with another): a new cluster forms once every node has started. The founder is the node seeded
  by `StartNewCluster` (bootstrap, restore, the load test's seed); it and every node that adopts its data set start
  unformed, and from then on every node is formed and the quorum applies again. A formed node holds a data set and is never
  made the first node of another (`CheckNewCluster`), nor is one that adopted a data set and is still copying it (not
  intact); a state `StartNewCluster` wrote for a node that has not run yet (unformed) does not count. A node whose state
  file is trusted keeps its flag across restarts. Losing the disks of a majority of the nodes loses the writes only they held;
  recovery is from backup. (If the only node left is one that never formed, it may form the data set again from its own
  copy without `ForceResync`.)
- **Never restore a gossip node in place from its own snapshot** (a VM or disk snapshot, a database restored to a point in
  time, a database file copied back): it keeps its node id and its database's identity, so it would pass as intact while
  it has forgotten the promises it gave and the writes it acknowledged since the snapshot. Replace it instead (an empty
  database: it copies everything), or restore a backup as a new data set. Quisora detects it where it can: every start is
  counted, durably, before the protocol starts, in `cluster-state.json` and in the database (`starts`); every node publishes
  its count (`quisora.starts`) and remembers, persisted, the highest count it has seen of each peer, and publishes that
  too. A database older than its state file (a database restored alone), or a peer of the data set remembering a start of
  this node at least as recent as this one (the whole node restored), makes the node not intact: it resyncs, and says
  why in its log. A peer that reveals it only after the protocol has started makes the node refuse to serve and leave the
  protocol until it is restarted (and then resyncs). A node restored while every peer that saw its later starts is down
  goes unnoticed.
- **Seeding.** `quisora bootstrap`, `quisora restore` and the load test's seed on a gossip node write the records they
  create or restore as writes of their partitions (`cluster.StartNewCluster`), a page of one kind at a time: the records of
  a page that belong to one partition are one write with the partition's next sequence number (so memory is bounded by a
  page, and a record written after an earlier run is stamped too), and create a new **data set** (below) whose data is this node's; the other nodes start with empty databases
  and copy everything from it. A restore needs an empty database (the first node of a new cluster), never over data. Until
  the node has run it can be run again (the data set stays the same); **it is refused on a node that already holds a data
  set** (its `cluster-state.json`, saved for this very database, says it took part in a cluster or adopted one's data set):
  its partitions share their sequence numbers with the cluster's.
- **The data set, and who may create one.** Every cluster's data has an identity, its *data set* (a random id, the
  *genesis*), kept in `cluster-state.json` and published in gossip metadata. **Only `quisora bootstrap --new-cluster` and a
  restore create one**; nothing else does, and nodes never invent one. The partition protocol carries it in every message
  (the library's `ClusterID`): **nodes of different data sets ignore each other completely** (no promises, writes,
  heartbeats, state or catch-up), however they come to meet, so a node bootstrapped or restored by mistake can never send
  its data to the cluster nor receive the cluster's, and two data sets are never merged by sequence number.
  - A node with **no data set** (it started with an empty database) does not start the partition protocol until it sees
    alive nodes publishing one. If all of them publish the same, it adopts it (and keeps it) and copies everything from them
    (it starts not intact, in resync mode); if they publish different ones, it joins none (not ready, logged) until they
    agree. Nodes that all have none (started before anyone bootstrapped) wait, saying so: "no data set: run quisora
    bootstrap --new-cluster on one node".
  - A data set is trusted only for the database it was saved for (`self` in `cluster-state.json`): a data directory kept
    while its database was wiped or replaced keeps no identity; the node joins as an empty node would, and a new bootstrap
    there makes a new data set.
  - A node that meets nodes of another data set says so: when fewer than a majority of the cluster share its own, it
    refuses to serve ("another data set is in view": it was set up apart; start it with an empty database and it adopts the
    cluster's); the nodes of the majority log the stranger and carry on. That check is for the operator: the protocol does
    not depend on it.
  - Housekeeping follows partition 0, whose owner is chosen among the nodes of one data set only (a node ignores the
    others'), and a node owns partitions only once it holds a data set: a node set up apart, or one still waiting for a
    data set, never runs the cluster's housekeeping.
