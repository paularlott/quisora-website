---
title: "Sizing"
weight: 170
---

One Apple M5 Pro (15 cores) with the load generator on the same machine; real deployments do better.

| One node, 64 concurrent clients | BadgerDB |   SQLite | PostgreSQL |
| ------------------------------- | -------: | -------: | ---------: |
| Refresh token                   | 55,900/s | 50,500/s |   30,400/s |
| Client credentials              | 59,400/s | 54,800/s |   55,000/s |
| Token introspection             | 48,800/s | 48,500/s |   48,100/s |
| Password sign-in                |    487/s |    473/s |      516/s |

- A gossip cluster of three BadgerDB nodes (all on that one machine with the load generator, every write committed on
  two of them before it is visible), at 5,000 organizations × 1,000 users with the load spread over its nodes: refresh
  token 51,500/s, client credentials 57,400/s, introspection 57,500/s, password sign-in 290/s (a sign-in's writes are
  committed on two nodes, and the three nodes share the machine's 15 cores).

- A password sign-in costs ~26 ms of CPU (argon2id, 19 MiB; m=19456, t=2, p=1). Stored hashes are sealed with the
  master key, and one made with other settings is re-hashed at the user's next sign-in; a stored hash naming settings
  far outside these (over 64 MiB, 10 passes or 16 threads) is refused without hashing. Plan ~30 cores for 1,000 password sign-ins/s. A
  passkey sign-in costs ~0.15 ms.
- Tested at 5,000 organizations × 1,000 users with 500,000 refresh grants (6.56M records, BadgerDB, 8.4 to 9.2 GB per
  node on disk);
  lookups and token traffic do not slow down at that size. Memory per node (measured at 100 organizations × 1,000
  users): about 150 to 250 MB of Go heap idle and at most
  about 400 MB under full load without password sign-ins (every other scenario at once, 64 concurrent clients each),
  plus 19 MiB for each password being hashed (at most `limits.password_workers`, one per CPU by default: about 900 MB
  in all with every scenario at once on 15 cores), plus the store's own caches (BadgerDB: about
  0.5 GB of block, index and memtable memory), plus `limits.ephemeral_mb` at most for short-lived sign-in state (1 GiB
  by default, a few MB in normal use). Plan 2 GB per node. BadgerDB also maps its files into memory: the operating
  system shows them as resident (several GB at this size), but they are file pages it can drop at any time, not
  allocations. Housekeeping never reads a whole collection: the end-date sweep and filtered queries on large kinds
  use indexes (`model.Due`, `model.Field.Index`).
- Profile pictures are stored in the database, one record each: a 256 × 256 JPEG or PNG, about 10 to 20 KB (a flat
  graphic less, a transparent photo more). Every node holds them all: at 5,000 organizations × 1,000 users with a
  picture each that is about 50 to 100 GB more per node, on disk and in backups, so size the disks for the share of users
  who will have one. Uploads are decoded one at a time per node; one at the largest allowed size (8192 × 8192 pixels)
  takes up to about 512 MB while it is, so leave that much room above the figures here where pictures are set.
- Set `GOMEMLIMIT` (read by the Go runtime, for example `GOMEMLIMIT=1536MiB` for a 2 GB node). Each password hash
  leaves 19 MiB of garbage, and without a limit the runtime lets the heap grow to twice what is live before collecting:
  a burst of password sign-ins (64 concurrent clients, 15 cores) took the process to about 1.2 GB resident, and with
  `GOMEMLIMIT=512MiB` to about 640 MB at the same rate. The runtime keeps freed pages until the system needs them, so
  resident memory after a burst stays near its peak; the Go heap returns to its idle size (`quisora_memory_heap_bytes`).
- At this size send audit events to VictoriaLogs ([Audit log](/docs/running/audit-log/)): the built-in trail's pages read through
  every event they search.
- A new gossip node catches up at about 16,800 records/s (all 6.56M records in 6.5 minutes, from the two others);
  two empty nodes at once, from the one that has the data, at about 12,700 records/s each. While it copies, a node's
  Go heap reaches about 1.7 GB, and settles at 150 to 250 MB. The operating system shows it with some 11 GB resident
  after: BadgerDB's files, mapped into memory, which it can drop at any time. `scripts/scale-cluster.sh` reproduces
  this (with `GRANTS=500000` for these figures).
- The load test tool reproduces these. It is a development tool, not part of the `quisora` binary: build it with
  `task loadtest` (or `go build -o bin/loadtest ./tools/loadtest`), then use `bin/loadtest seed` and
  `bin/loadtest run`. The seeder needs `QUISORA_LOADTEST=1`, as it writes test data straight into the store.
