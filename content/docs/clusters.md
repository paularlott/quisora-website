---
title: Running a cluster
description: Run several Quisora nodes, on one shared database or each with its own copy.
weight: 70
---

One node is plenty for many setups. When you want more than one, Quisora has two ways to run a cluster. Pick one; don't mix them.

{{< screenshot name="system" alt="The system overview in the admin console, showing a cluster of three nodes" >}}

## Before you start

- **Sync the clocks.** Every node needs NTP (chrony, systemd-timesyncd or your cloud's time service). A node more than 5 seconds off stops serving until its clock is fixed.
- **Use the same master key** on every node.
- **Run `quisora bootstrap` once**, not on every node.

## Option 1: a shared database

Every node uses the same PostgreSQL, MySQL or MariaDB database. The database is the only copy of the data, so make it highly available in the usual way, with one writer at a time.

Add `cluster.notify` so the nodes tell each other about changes straight away. Without it, a node notices another's change within 5 seconds.

```bash
quisora serve --public-url https://id.example.com \
  --storage postgres \
  --cluster-notify-bind 0.0.0.0:7947 --cluster-notify-advertise node1:7947 \
  --cluster-notify-peers node1:7947 --cluster-notify-peers node2:7947 --cluster-notify-peers node3:7947
```

Put the master key, the database DSN and `cluster.notify.key` (from `quisora genkey`) in the environment or the config file. Open port 7947 (TCP and UDP) between the nodes only.

Any node can answer any request, so the load balancer needs no sticky sessions.

## Option 2: replicated

Every node has its own database, usually the built-in BadgerDB, and the nodes copy changes to each other. A write is saved on a majority of the nodes before it counts.

```toml
[server]
public_url = "https://id.example.com"

[cluster]
bind = "0.0.0.0:7946"
advertise = "10.0.0.11:7946"
peers = ["10.0.0.11:7946", "10.0.0.12:7946", "10.0.0.13:7946"]   # every node lists every node
size = 3                                                         # the same on every node
key = "..."                                                      # quisora genkey, the same on every node
```

Run `quisora bootstrap --new-cluster` on one node first, then start them all.

A few rules of thumb:

- **Run three or five nodes.** Three keep working with one down, five with two down.
- **Restart nodes one at a time.** A starting node catches up before it serves.
- **Keep each node's data directory with its database.** It holds the node's identity.
- **Open port 7946 between the nodes only.**

## Health checks

| Endpoint | Use it for |
| --- | --- |
| `/healthz` | Is the process alive? For container restarts. |
| `/readyz` | Should it get traffic? For load balancers. |

Don't restart a node just because it isn't ready. A node catching up is still alive.

## More

- [Clustering in depth](/docs/running/clustering/)
- [Running a gossip cluster](/docs/running/cluster-operations/), with what to do when nodes are lost
