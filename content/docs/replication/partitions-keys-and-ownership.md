---
title: "Partitions, keys and ownership"
weight: 40
---

## The partition key of a record

`model.Index.Partition` (carried by `store.Record.Partition`, stored by every backend, kept by tombstones):

| records | key | partition |
|---|---|---|
| everything scoped to an organization: users, groups, memberships, tenants, access, clients, providers, passkeys, identities, sessions, grants, API tokens, link tokens, sign-in records | the organization's id | one of 1 to 63, the same for all of an organization's records |
| organizations, signing keys, and a server-level audit event with no organization | none | 0 |
| locks, replay values, revoked SSH sign-ins, user pictures (`KindLock`, `KindReplay`, `KindSSHRevokedSignIn`, `KindUserPicture`) | the record's own id | spread over 1 to 63 |
| short-lived state (`KindEphemeral`), audit events (`KindAudit`) and queued items (`KindQueue`) | never replicated: each node's own | none |

An organization's records, and every unique value scoped to it, are therefore in one partition: the owner checks them
together. A record **never changes partition** (its organization never changes). A busy organization stays on one
owner; that is accepted: an owner commits several hundred writes a second per partition, and password hashing, the
real CPU cost of a sign-in, stays on the node that took the request.

## Ownership

The owner of a partition is the ready node with the highest rendezvous hash of (partition, node id), computed by every
node from its own view of the membership; when a node leaves or joins, only the partitions whose highest hash was or
becomes that node move. A node is a candidate once it has caught up and a hold-down has passed
(`ReadyHoldDown`, twice the owner timeout: 10 s, slept once, after the start-up catch-up and before the node publishes that it is ready,
so a node that crash-loops does not claim partitions between its starts; it does not apply when a running node loses and
regains a majority). Readiness gates
**ownership only**: a node that is not ready but holds its data still promises, stores writes and serves catch-up, or a
three-node cluster could not write while one node restarts.

Owners tell every node about once per `HeartbeatInterval` (500 ms) which partitions they own, at which epoch and
position. A node refuses to promise a partition to a challenger while it has heard from the current owner within the
owner timeout (5 s, as Galera's `evs.suspect_timeout`), and a node that thinks it should own a partition waits a random
backoff first: so two nodes that can each reach a majority but not each other do not take a partition back and forth. A
partition whose owner is lost is taken over after the owner timeout, the rank delay (1 s per rank) and the backoff (up
to 1.5 s) plus one promise round: **about 6.5 seconds** after an owner crashes (7.5 s measured under full load), during which writes to it fail with
`store.ErrUnavailable` (503, retry) once the 5 s write timeout has passed. The owner timeout is that long so that a node
that is busy, not gone, keeps its partitions: with the protocol's default (three heartbeats, 1.5 s), nodes on saturated
CPUs (a flood of password sign-ins) heard each other's heartbeats late, stopped serving reads and stopped being ready
although every node was up. The gossip failure detector waits as long: the partition protocol counts only the nodes
gossip holds alive, so gossip pings a peer only after 5 s without a message from it and suspects it when that ping goes
unanswered for a second (its defaults, 1.5 s and 500 ms, cost a busy node its quorum the same way). An owner that is
stopped (`SIGTERM`) hands its partitions back at once, and a partition handed back to a node that returns is taken
over at once (the claim's fast path), not after the timeouts. Views can disagree about who should own a partition;
that costs refused or delayed writes on the partitions involved, never a lost or
conflicting write.
