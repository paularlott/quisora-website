---
title: "Node states"
weight: 110
---

| state | when | ready / tokens | replicated writes |
|---|---|---|---|
| **resyncing** | its data is not intact (new, lost, restored, forced) until it has copied from the others | no / no | none |
| **catching up** | every start, until caught up and the hold-down has passed | no / no | none |
| **ready** | caught up, a majority in view, every node agrees on the size and runs a compatible build | yes / yes | all |
| **cut off** | fewer than a majority in view | no / no | none |
| **partition diverged** | a partition diverged here | no / no | none |
| **partition unreadable** | a partition cannot be read here (no owner heard, catch-up failing, being copied whole); `partitions_unreadable` counts them, `partitions_importing` those being copied whole | yes / yes, except that partition's records | all |
| **misconfigured** | database shared with another gossip node, owned by another node id, mixed with non-gossip nodes, holding records no partition write made, set up apart from the cluster, prefix collision, **size or build disagreement**, clock off | no / no | none |

Only node-local records (`KindEphemeral`, and a node's own audit events and queued items) are written on a node that is
not ready. A refused write returns
`store.ErrUnavailable` (HTTP 503) and has no effect anywhere. A node never leads unless it is writable, so
housekeeping (key rotation, user end dates, orphan sweeps, purges) runs only where the data is current (see
"Housekeeping" below). The status
(`GET /api/cluster`) shows each node's state and why it is not ready, and every partition's owner, epoch, committed
position, lag, catch-up and divergence.

A change whose outcome is not known (`store.ErrUnconfirmed`, the service's `ErrOutcomeUnknown`) is audited as the change
would be, with outcome `unknown`: it may have been made, and the audit log must not miss a change that took effect.
