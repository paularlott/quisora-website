---
title: "Clustering"
weight: 100
---

Two modes. Do not mix them.

## Shared database

Several nodes on one PostgreSQL, MySQL or MariaDB database, which is the only copy. Leave `cluster.bind`
empty (that is the replicated mode below).

- Short-lived sign-in state (codes, sign-in steps, rate limits) lives in the database too: any node serves any
  request, and the load balancer needs no sticky sessions.
- A lease in the database picks the node that runs housekeeping (key rotation, purges, user end dates).
- **With `cluster.notify`** (recommended): the nodes form a small gossip network of their own that carries only change
  notices (what changed, never the data). A change made on one node clears the others' caches and updates their open
  admin console pages within moments. A lost notice only waits for a cache to expire.
- **Without it**, a node learns of another's change when its cache expires, within 5 seconds (a disabled user or a
  revoked client keeps working that long on the other nodes), and its pages do not follow other nodes' changes live.
- Every node has the same `server.master_key`. A node with a different key refuses to start.
- High availability is the database's: run it as your own HA cluster, with **one writer at a time**: every Quisora
  node writes to the same primary (PostgreSQL, MySQL or MariaDB, with a standby taking over on failure). A
  multi-primary cluster (MariaDB or MySQL **Galera**, or any setup that certifies only the rows a transaction writes)
  must be used the same way, with every Quisora node writing to one of its nodes (a proxy such as HAProxy or ProxySQL
  that sends all writes to one) and the others standing by. Quisora relies on a transaction's shared-locked read (it
  keeps an organization that is being deleted from gaining a user at the same moment): Galera certifies only a
  transaction's writes, so such a read does not stop a write on another node, and both commit. `wsrep_sync_wait` does
  not change that: it makes a read wait for the cluster, it locks nothing.

```bash
quisora serve --public-url https://id.example.com --master-key "$KEY" \
  --storage postgres --postgres-dsn 'postgres://quisora:secret@db:5432/quisora' \
  --cluster-notify-bind 0.0.0.0:7947 --cluster-notify-advertise node1:7947 \
  --cluster-notify-peers node1:7947 --cluster-notify-peers node2:7947 --cluster-notify-peers node3:7947 \
  --cluster-notify-key "$NOTIFY_KEY"
```

`cluster.notify` takes `bind`, `advertise` (required when `bind` is a wildcard), `peers` (every node; listing itself
is fine; on the command line repeat the flag, in `QUISORA_CLUSTER_NOTIFY_PEERS` separate them with commas) and `key` (`quisora genkey`, the same on every node, apart from `cluster.key`). Open its port (TCP and UDP)
between the nodes only. With `cluster.bind` set, `cluster.notify` is ignored with a warning: replication carries
every change already. It is refused with a node-local database (BadgerDB, SQLite).

Run `quisora bootstrap` once, against the database, before the first node starts.

## Replicated (gossip)

Every node has its own database (BadgerDB is the usual choice). The data is split into 64 partitions; each partition has one
owner node that orders its writes and commits each on a majority of the nodes before it is visible, and every node keeps a copy
of everything and reads from it.
As in every mode, super admins are protected by rank: nobody removes their own access, only a super admin removes a super
admin, and the system never does (see [protecting administrators](/docs/sign-in/#protecting-administrators)). That is
not a guarantee that one always remains: two super admins removing each other at the same moment on different nodes can
leave none, and `quisora invite --break-glass --super-admin primary <email>` recovers. Keep a second super admin anyway,
so that losing one account never needs the break-glass procedure.

```toml
[server]
public_url = "https://id.example.com"
master_key = "…"          # identical on every node

[cluster]
bind = "0.0.0.0:7946"
advertise = "10.0.0.11:7946"
peers = ["10.0.0.11:7946", "10.0.0.12:7946", "10.0.0.13:7946"]   # every node lists every node
size = 3                  # required, identical on every node; a write needs size/2+1 nodes
key = "…"                 # quisora genkey, identical on every node
```

How the cluster behaves is in [Replication and data integrity](/docs/replication/); what an operator needs from it:

- **Run three or five nodes.** A write needs a majority of `cluster.size` (it never shrinks): three nodes tolerate one down,
  five tolerate two. Without a majority a node is not ready: it makes no replicated write and refuses everything but its health
  probes, the token endpoints included. ([Cluster size](/docs/replication/cluster-size/))
- **When a node is lost, its partitions move within a few seconds**: writes to them wait for that (up to 5 s) and then fail with
  503; reads of what the node already has go on. A node you stop with SIGTERM hands over at once.
- **A starting node** serves only `/healthz` and `/readyz` until it has caught up and been stable for a few seconds. Restart
  nodes one at a time; restarting all of them at once needs nothing special. ([Node states](/docs/replication/node-states/))
- **A node with a new or restored database copies everything** from a majority of the *other* nodes before it takes part (both
  others of three). While another node is down as well it waits, resynchronising; `quisora force-start` (see below) is the
  operator accepting that it copies from whichever nodes answer. (A cluster of two needs only the other node.)
- **BadgerDB needs `storage.badgerdb.sync_writes = true`** (the default): a node's promises and the writes it acknowledges must
  survive a power cut, and a gossip node refuses to start with it off.
- **Keep the data directory with the database**: it holds the node's id (or set `cluster.node_id`) and `cluster-state.json`
  (whether the database can be trusted), and a node that finds another node's database refuses to serve (it never wipes it).
- **Every node has its own id**: a data directory or machine image copied to a second node carries the first's `node_id`
  (so does one `cluster.node_id` in a configuration both read), and the two would each deliver every queued email and
  logout and share the per-organization caps. Delete `node_id` from the copy (a new one is made at its start) or set
  `cluster.node_id`. Nodes that share one database without gossip notice: each keeps a record of its id in the database,
  renewed every 10 seconds, and a node that finds its id held by another running node refuses to start (after waiting
  up to 40 seconds for the record of a node that was killed to run out) or, already running, reports itself not ready
  until that has passed. A node that shuts down cleanly releases its id at once. A gossip node does not use the record:
  each has its own database (queued items are in it), and a database two gossip nodes share is refused (above).
- **Clocks** must be in sync (NTP); more than 5 s apart is a broken node, and gossip refuses packets more than two minutes off
  the receiver's clock. ([Clocks](/docs/replication/clocks/))
  Nodes that share one database without gossip have no peers to compare with, but they stamp expiries (a 60 s
  `request_uri`, a 60 s code, short-lived state, the housekeeping lease) with their own clocks, so a node whose clock is
  off sees them expire early or late: sign-ins fail on one node and work on another. Each therefore reads the database
  server's clock every 10 seconds and, when its own is more than 5 s off, reports itself not ready (`/readyz` 503) and
  logs `refusing to serve` with the offset, until it is within 2.5 s again; `/readyz` shows `clock_offset_ms`. Fix the
  node's time synchronisation (NTP), and the database server's own.
- **Open the gossip port** (`cluster.bind`, TCP and UDP) between the nodes only: the partition protocol's messages (writes, promises,
  catch-up streams) use it, encrypted and authenticated by `cluster.key`.
- **`quisora invite` and `quisora sign-out` go through a running node** in a gossip cluster (they sign the
  request with the master key); `quisora bootstrap --new-cluster` and `quisora restore` are for the first node of a new cluster,
  with an empty database: they alone create a cluster's data set.

New cluster:

1. `quisora bootstrap --new-cluster` on one node, with an empty database.
2. Start every node. The others start with empty databases, adopt the first node's data set and copy from it (started before it,
   they wait: "no data set"). The data set forms once every node has started: until then a new node copies from the first
   node alone; after that, replacements copy from a majority of the others as above.

Replacing a node: start the replacement with an empty database and the same configuration. It copies everything.

After a lost disk with another node also down (`quisora force-start`), changing the size, and what each refusal means:
[Replication, operator procedures](/docs/replication/operator-procedures/).

## Rotating the cluster key

`cluster.key` encrypts and authenticates gossip between the nodes. Each node derives a fresh traffic key from it every
hour, so it does not wear out; rotate it on a schedule, and at once if it may have been exposed (anyone holding it on
the network path can read and inject gossip). The cluster keeps running throughout.

Three rounds, each on every node before the next round starts. Each round edits every node's config file and then
reloads them all at once (**Reload configuration**, as for the [master key](/docs/running/rotating-the-master-key/#changing-the-keys-reload-or-restart)),
reloads each with SIGHUP, or restarts the nodes:

1. `quisora genkey`, then on every node: `key = "<old>"`, `previous_keys = ["<new>"]`. Every node now also reads
   gossip encrypted with the new key.
2. Every node: `key = "<new>"`, `previous_keys = ["<old>"]`. Each node now encrypts with the new key; the others read
   it, and it still reads those that have not switched yet.
3. Every node: `key = "<new>"`, remove `previous_keys`.

```toml
[cluster]
key = "<new>"
previous_keys = ["<old>"]     # rounds 1 and 2 only
```

- The log says `cluster keys reloaded` (with the key ids: 8 characters derived from each key, revealing nothing), or
  `configuration not (fully) reloaded` with `error` `cluster keys: <the reason>`. The system overview (and `GET /api/cluster`) lists each node's key ids
  under `cluster_keys`, the one that encrypts first.
- A reload is refused when the new keys do not include the key in use: a typo cannot cut a node off. Keys given on the
  command line cannot be reloaded.
- A node started (or restarted) during a rotation must be given that round's keys; one that misses a round cannot
  talk to the others until it is given them, and comes back by itself once it is.
