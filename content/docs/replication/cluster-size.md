---
title: "Cluster size"
weight: 30
---

`cluster.size` is **required** with `cluster.bind` (flag `--size`, `QUISORA_CLUSTER_SIZE`, TOML `cluster.size`; no
default): the number of nodes the cluster is made of. It must equal the number of nodes `cluster.peers` names (this
node included, however the list names it), or the node refuses to start. A write needs **a majority of that number**,
`size/2+1`: 2 of 3, 3 of 4, 3 of 5. **Run an odd number of nodes**: three tolerate one failure, five tolerate two, and
a fourth node adds a node to lose without letting any more fail. A cluster of two tolerates no failure at all.

- The size is **authoritative**: it decides how many nodes must store a write, how many a node must see to be ready and
  writable, and when it is cut off. It **never shrinks** when nodes leave, stop or
  restart, so a minority can never form a majority on its own. It changes only when the operator changes it in the
  configuration and reloads it, **one node at a time** (see [Changing the cluster size](/docs/replication/operator-procedures/#changing-the-cluster-size)).
- **Every node must agree.** Each node publishes its size in gossip metadata (`quisora.size`) and the partition
  protocol carries it in every message, and ignores messages from a node configured differently. A node whose size
  fewer than a majority of that size share (itself included) while an alive member publishes another one is the node
  configured apart (a reload that reached it alone, a node started with an old configuration): it refuses to serve (not
  ready, not writable, no tokens) until they agree. The nodes of the majority carry on and log the stranger once. So a
  single node with a wrong size stops only itself, and during a size change made one node at a time the nodes that have
  not reloaded yet keep serving while they are a majority of their size.
