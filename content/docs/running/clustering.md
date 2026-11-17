---
title: "Clustering"
description: "Run several nodes on a shared database or as a replicated gossip cluster, and rotate the cluster key."
weight: 80
aliases: ["/docs/clusters/"]
---

One node is plenty for many setups. For more than one, there are two modes. Do not mix them.

- **Shared database:** every node uses one PostgreSQL, MySQL or MariaDB database.
- **Replicated (gossip):** every node keeps its own copy, and the nodes copy changes to each other directly.

{{< screenshot name="system" alt="The system overview in the admin console, showing a cluster of three nodes" >}}

## Quick start

1. Pick a mode, below.
2. Keep every node's clock in sync with NTP. A node more than 5 seconds off stops serving until it is fixed.
3. Give every node the same master key.
4. Set the server up once, not on every node: `quisora bootstrap` against the shared database, or
   `quisora bootstrap --new-cluster` on one node of a replicated cluster.
5. Start every node, and open the cluster port (7947 for change notices, 7946 for gossip) between the nodes only.
6. Point the load balancer at `/readyz`. It needs no sticky sessions.

| Endpoint | Use it for |
| --- | --- |
| `/healthz` | Is the process alive? For container and process restarts. |
| `/readyz` | Should it get traffic? For load balancers. |

Don't restart a node just because it isn't ready. A node catching up is still alive.

## Shared database

Several nodes use one PostgreSQL, MySQL or MariaDB database, which holds the only copy. Leave `cluster.bind` empty.

- Short-lived sign-in state lives in the database too, so any node serves any request and the load balancer needs no
  sticky sessions.
- A lease in the database picks the node that runs housekeeping (key rotation, purges, user end dates).
- Every node has the same `server.master_key`. A node with a different key refuses to start.
- Run `quisora bootstrap` once, against the database, before the first node starts.
- High availability is the database's. Run it with **one writer at a time**: every node writes to the same primary,
  with a standby taking over on failure. Multi-primary setups such as Galera must also be used this way, with all
  writes going to one node (for example through HAProxy or ProxySQL).

**Change notices (recommended).** With `cluster.notify`, the nodes form a small gossip network that carries only change
notices, never data. A change on one node clears the others' caches and updates open console pages within moments.
Without it, a node sees another's change when its cache expires, within 5 seconds: a disabled user or revoked client
keeps working that long on the other nodes.

```bash
quisora serve --public-url https://id.example.com --master-key "$KEY" \
  --storage postgres --postgres-dsn 'postgres://quisora:secret@db:5432/quisora' \
  --cluster-notify-bind 0.0.0.0:7947 --cluster-notify-advertise node1:7947 \
  --cluster-notify-peers node1:7947 --cluster-notify-peers node2:7947 --cluster-notify-peers node3:7947 \
  --cluster-notify-key "$NOTIFY_KEY"
```

`cluster.notify` takes `bind`, `advertise` (required when `bind` is a wildcard), `peers` (every node; listing itself is
fine) and `key` (`quisora genkey`, the same on every node, and different from `cluster.key`). Open its port (TCP and
UDP) between the nodes only. It is refused with a node-local database (BadgerDB, SQLite), and ignored when
`cluster.bind` is set.

## Replicated (gossip)

Every node has its own database (BadgerDB is the usual choice). The data is split into 64 partitions. Each partition
has one owner node that orders its writes and commits each on a majority of the nodes before it is visible. Every node
keeps a copy of everything and reads from it.

```toml
[server]
public_url = "https://id.example.com"
master_key = "..."          # identical on every node

[cluster]
bind = "0.0.0.0:7946"
advertise = "10.0.0.11:7946"
peers = ["10.0.0.11:7946", "10.0.0.12:7946", "10.0.0.13:7946"]   # every node lists every node
size = 3                  # required, identical on every node
key = "..."               # quisora genkey, identical on every node
```

Before you run one:

- **Run three or five nodes.** A write needs a majority of `cluster.size`. Three nodes tolerate one down, five tolerate
  two. Without a majority a node is not ready and refuses everything but its health probes.
- **When a node is lost, its partitions move within a few seconds.** Writes to them wait up to 5 seconds, then answer 503.
  A node stopped with SIGTERM hands over at once.
- **A starting node** serves only `/healthz` and `/readyz` until it has caught up. Restart nodes one at a time.
- **A node with a new or restored database copies everything** from a majority of the other nodes before it takes part.
- **BadgerDB needs `storage.badgerdb.sync_writes = true`** (the default). A gossip node refuses to start without it.
- **Keep the data directory with the database.** It holds the node's id and `cluster-state.json`. A node that finds
  another node's database refuses to serve, and never wipes it.
- **Every node needs its own id.** If you copy a data directory or machine image to a second node, delete `node_id` from
  the copy (a new one is made at start) or set `cluster.node_id`.
- **Keep clocks in sync (NTP).** Nodes more than 5 seconds apart are treated as broken.
- **Open the gossip port** (`cluster.bind`, TCP and UDP) between the nodes only. Its traffic is encrypted and
  authenticated by `cluster.key`.
- **`quisora invite` and `quisora sign-out` go through a running node.** `quisora bootstrap --new-cluster` and
  `quisora restore` are for the first node of a new cluster, with an empty database.
- **Keep a second super admin.** Two super admins removing each other at the same moment on different nodes can leave
  none. `quisora invite --break-glass --super-admin primary <email>` recovers.

**New cluster:**

1. Run `quisora bootstrap --new-cluster` on one node, with an empty database.
2. Start every node. The others start with empty databases, adopt the first node's data and copy from it. Started
   before it, they wait ("no data set").

A node that has not formed the cluster logs `cluster peers not in view` a minute after starting, and every minute
after, naming the peers it cannot see. Each is not started, not reachable on its cluster address, or has another
`cluster.key`. Compare the key ids each node lists under `cluster_keys` on the System page.

**Replacing a node:** start the replacement with an empty database and the same configuration. It copies everything.

What the cluster does when nodes fail, changing its size and `quisora force-start` are in
[Running a gossip cluster](/docs/running/cluster-operations/).

## Rotating the cluster key

`cluster.key` encrypts and authenticates gossip. Rotate it on a schedule, and at once if it may have been exposed. The
cluster keeps running throughout. Do three rounds, each on every node before the next. Each round edits every node's
config file, then reloads them all (**Reload configuration** on the System page, SIGHUP, or a restart):

1. `quisora genkey`, then on every node: `key = "<old>"`, `previous_keys = ["<new>"]`.
2. Every node: `key = "<new>"`, `previous_keys = ["<old>"]`.
3. Every node: `key = "<new>"`, remove `previous_keys`.

- The log says `cluster keys reloaded`, or `configuration not (fully) reloaded` with the reason. The System page lists
  each node's key ids.
- A reload is refused when the new keys do not include the key in use. Keys given on the command line cannot be reloaded.
- A node started during a rotation must be given that round's keys. One that misses a round cannot talk to the others
  until it has them.
