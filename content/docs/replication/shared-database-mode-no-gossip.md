---
title: "Shared-database mode (no gossip)"
weight: 190
---

Several nodes on one PostgreSQL, MySQL or MariaDB database: the database is the only copy, nothing is replicated, and
compare-and-swap is the database's own. Tombstones are kept for one hour. The nodes must use the same master key (a check value of it
is kept in the database). Nothing in this document but the service-level rules (the last-administrator guard, groups, sign-in
stamps) applies to it.

A **lease** in the database picks the node that runs housekeeping (key rotation, purge, user end dates): TTL 30 s, renewed every 10 s,
and a holder counts itself leader only until 10 s before its lease ends. Every takeover creates the lease record anew, so its creation
version is a **fencing token** unique to that tenure: housekeeping runs with it, and each housekeeping write (and each purge) first
checks that the lease record still names this node with that token. A node that lost the lease (paused, cut off from the database, or
with a clock so far off that it believes an expired lease is still its own) has its housekeeping writes refused instead of racing the
new holder's. Between that check and the write itself two housekeepers are harmless: key rotation at worst publishes a spare key, end
dates are compare-and-swap updates and purging is idempotent. Keep clock skew between the nodes well under 10 s.

**Queued items** (emails, back-channel logout retries) are each node's own here too ([records](/docs/replication/records-versions-and-generations/)):
in the shared database, a node reads and delivers its own only, so the nodes never contend for an item, nothing is
claimed or locked, and no item is delivered by two nodes. The caps are per node, so the cluster holds up to that many
per node. A node gone for good leaves its items to expire: another node does not take them over, since that node may
come back and send them again. Queued items are not change notices (`cluster.notify`) either. What an operator sees:
[Queued work](/docs/running/settings/#queued-work).
