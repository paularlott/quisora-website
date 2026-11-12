---
title: "Clocks"
weight: 150
---

Versions come from the owners' clocks and are always above the one they replace, and order comes from sequence numbers, so
clock skew cannot reorder or lose a write. Clocks still decide when a session, a grant, an invitation or an end date
expires, on each node by its own clock, and the age of a tombstone for its purge: keep every node's clock synchronised (NTP).

- A node **refuses to start** when its clock reads before 1 January 2025 (the version clock's epoch).
- A version read or received is witnessed into the node's clock only when it is at most `store.MaxSkew` (5 s) ahead of the
  machine's clock (`hlc.Clock.WitnessBounded`); one further ahead is applied but not followed (counted as `skew_refused`),
  so one bad clock cannot drag every node's versions into the future. Received versions more than 5 s ahead are logged
  (hourly per origin) and counted (`clock_skewed`). A new version of a record is `max(clock, old version + 1)`, so a
  record written under a clock that ran ahead can still be written.
- **Every node checks its clock against the others'** (`internal/cluster/clock.go`). Every 5 s a node asks each peer for its
  time (`UserMsg+14`); it reads the offset as NTP does (against the midpoint of the request) and keeps each peer's latest
  reading in memory, nothing on disk. The cluster's clock is the **median** of its own (offset 0) and the readings of the last
  30 s, taken only once it has heard from enough peers to make a majority with itself. If its clock is more than 5 s from that,
  the node refuses to serve (not ready, no writes, no tokens) and logs why; it serves again once it is within 2.5 s. A
  minority of bad clocks is outvoted: in three nodes, one with a bad clock stops only itself. `/readyz` reports the offset
  (`clock_offset_ms`).
- **Nodes sharing one database without gossip** have no peers to ask, and stamp expiries with their own clocks (a 60 s PAR
  `request_uri` or code, short-lived state, the lease), so one with a clock off would see them expire early or late
  depending on which node the load balancer picks. On every lease tick (10 s) such a node reads the database server's time
  (`sqlstore.Store.ServerTime`: PostgreSQL `clock_timestamp()`, MySQL and MariaDB `NOW(6)`, both as microseconds since the
  epoch so no time zone enters), takes the offset against the midpoint of the request, and ignores a reading whose round
  trip took longer than a second. It then applies the same rule as a gossip node (`judgeClock`): more than 5 s off, it is
  not ready and logs why; it is ready again within 2.5 s; `/readyz` reports `clock_offset_ms`. The database server's clock
  is the reference, so its own time synchronisation matters too. A node on its own file (SQLite, BadgerDB) has one clock
  and reads nothing.
- **A node whose clock is off owns no partition** (`partition.Manager.SetEligible(false)`): it steps down from every
  partition it owns at once (the others take them over without waiting for a timeout) and takes none over, so it never
  decides whether a record is live, or how long an owner has been silent, by a clock the cluster does not keep. It still
  follows the owners, stores their writes and serves catch-up. The same holds while a peer runs an incompatible build.
  It becomes eligible again when the clock agrees.
- In a two-node cluster each node has only the other to compare with, and the median lies halfway: if they disagree by more than
  10 s, both refuse. If every node's clock is wrong by the same amount they agree, and nothing notices.
