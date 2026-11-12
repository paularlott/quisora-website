---
title: "Replication and data integrity"
linkTitle: "Replication"
description: "How a gossip cluster replicates, its rules, and what to do when nodes are lost."
weight: 110
---

This document describes how a gossip cluster (`cluster.bind` set: every node has its own database) keeps its data
consistent, what each node does, and what an operator does after failures. The code that implements it is
`internal/cluster` (the cluster store `store.go`, the node's side of the protocol `partition.go`, node states
`node.go`, `state.go`, gossip handlers) on top of the gossip library's `partition` package
(`github.com/paularlott/gossip/partition`: its `README.md` is the user's guide and its `DESIGN.md` the protocol and the
argument for its safety), `internal/store` (the per-partition operations every node-local backend implements,
`partition.go`) and the storage backends. The design and the reasons for it are in
[Partitioned replication for gossip mode (design draft)](/docs/internals/partitioned-replication/). The shared-database mode (no gossip) is
covered at the end.

**Pre-release data format.** Quisora has not been released: there is no migration from, and no compatibility with,
data written by earlier builds, and an earlier build's gossip mode (a leaderless quorum compare-and-swap with change
feeds) cannot take part in this one (the compatibility version differs: a node of either refuses the other). A store
written by an earlier build is refused when it is opened (a gossip node whose database holds records that no partition
write made says so and serves nothing), backups must be format version 1 (as this build writes them), and a
`cluster-state.json` must name its store (`self`). **Wipe and start clean** (restore from a backup made by this build if needed).

## In this guide

- [The model in one paragraph](/docs/replication/the-model-in-one-paragraph/)
- [Guarantees](/docs/replication/guarantees/)
- [Cluster size](/docs/replication/cluster-size/)
- [Partitions, keys and ownership](/docs/replication/partitions-keys-and-ownership/)
- [The write path](/docs/replication/the-write-path/)
- [Reads](/docs/replication/reads/)
- [Unique values](/docs/replication/unique-values/)
- [Records, versions and generations](/docs/replication/records-versions-and-generations/)
- [Catching up, joining and returning](/docs/replication/catching-up-joining-and-returning/)
- [What keeps working, without an operator](/docs/replication/what-keeps-working-without-an-operator/)
- [Node states](/docs/replication/node-states/)
- [What the service builds on this](/docs/replication/what-the-service-builds-on-this/)
- [Deletion](/docs/replication/deletion/)
- [Wire messages](/docs/replication/wire-messages/)
- [Clocks](/docs/replication/clocks/)
- [Cluster status](/docs/replication/cluster-status/)
- [Operator procedures](/docs/replication/operator-procedures/)
- [Backups](/docs/replication/backups/)
- [Shared-database mode (no gossip)](/docs/replication/shared-database-mode-no-gossip/)
- [Known limits](/docs/replication/known-limits/)
