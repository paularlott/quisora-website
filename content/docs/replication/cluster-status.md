---
title: "Cluster status"
weight: 160
---

`/readyz` (unauthenticated) reports, ready or not, `{"status": "ready" | "unavailable", "cluster": {"size", "quorum",
"alive", "partitions_owned", "unconfirmed", "refused", "clock_skewed", "skew_refused", "clock_offset_ms",
"partitions_unreadable", "partitions_diverged", "partitions_importing"}}`: counts only; the reason for not being ready stays in the log and in
`GET /api/cluster`. `GET /api/cluster` (super administrators) returns the full status: node id, members, leader, ready
and why not (`reason`), writable, catching up / resyncing, the forced start, the counters (changes committed, refused,
unknown, unavailable; fresh reads and failed ones; partitions taken over; divergences found), the number of partitions
this node owns and of those it cannot read or that diverged, and for each of the 64 partitions its owner as this node
believes it, the owner's epoch counter, this node's committed sequence and promised epoch counter, whether this node can
read it (`readable`), how long it has trailed the owner (`lag_ms`), whether a catch-up runs (`catching_up`), whether it is
being copied whole and has not finished (`importing`: none of it is served, and a backup is refused, until it has) and
whether it diverged here. The console's System page shows it to super administrators. **Metrics** (`/metrics`, with the metrics
token): `quisora_partitions_owned`, `quisora_partition_writes_total`, `_writes_refused_total`, `_writes_unknown_total`,
`_writes_unavailable_total`, `_reads_total`, `_reads_failed_total`, `_takeovers_total` (since the node started),
`quisora_partitions_unreadable`, `quisora_partitions_importing`, `quisora_partitions_diverged`,
`quisora_partition_divergences_total`, and per partition
(label `partition`) `quisora_partition_lag_seconds`, `quisora_partition_catching_up`, `quisora_partition_diverged`, next to
`quisora_ready`, `quisora_writable`, `quisora_leader`, `quisora_cluster_alive_nodes`, `quisora_cluster_size`.
The Docker `HEALTHCHECK` (`quisora healthcheck`) is a **liveness** probe (`/healthz`): a node that is catching up or cut off is
alive and must not be restarted for it. Point load balancers at `/readyz` (`quisora healthcheck --ready` checks it from the
host). The load shedder (`limits.max_in_flight`) never refuses `/healthz`, `/readyz`, discovery or JWKS.
