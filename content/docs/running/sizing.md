---
title: "Sizing"
description: "How fast one node is, and how much memory and disk to plan."
weight: 120
---

Measured on one Apple M5 Pro (15 cores) with the load generator on the same machine. Real deployments do better.

| One node, 64 concurrent clients | BadgerDB | SQLite | PostgreSQL |
| --- | ---: | ---: | ---: |
| Refresh token | 55,900/s | 50,500/s | 30,400/s |
| Client credentials | 59,400/s | 54,800/s | 55,000/s |
| Token introspection | 48,800/s | 48,500/s | 48,100/s |
| Password sign-in | 487/s | 473/s | 516/s |

A gossip cluster of three BadgerDB nodes on that one machine managed 51,500 refresh tokens a second and 290 password
sign-ins a second.

- **Password sign-ins are the costly part.** One takes about 26 ms of CPU and 19 MiB of memory (argon2id). Plan about 30
  cores for 1,000 password sign-ins a second. A passkey sign-in costs about 0.15 ms.
- **Memory:** plan 2 GB per node. Set `GOMEMLIMIT` (for example `GOMEMLIMIT=1536MiB` for a 2 GB node) so a burst of
  password sign-ins does not let memory grow far past that.
- **Disk:** 5,000 organizations with 1,000 users each and 500,000 refresh grants (6.56 million records) took 8.4 to 9.2
  GB per node on BadgerDB. Token traffic does not slow down at that size.
- **Profile pictures** are stored in the database, about 10 to 20 KB each, and every node holds them all. Size the disks
  for the share of users who will have one.
- **At this size send audit events to VictoriaLogs** ([Audit log](/docs/running/audit-log/)).
- **A new gossip node** catches up at about 16,800 records a second: all 6.56 million records in about 6.5 minutes.
