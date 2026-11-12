---
title: "Upgrading"
description: "Upgrade one release at a time, back up first, and keep a cluster serving."
weight: 70
---

- **Back up first.** Upgrades go forward only. A store written by a newer build is refused, so going back means
  restoring the backup.
- **One release at a time.** A cluster can be upgraded one node at a time while it keeps serving. A node more than one
  release apart is refused: the others log `refusing to serve ... upgrade one release at a time` until it is upgraded
  or gone.
- **Storage is migrated at the first start of the new build.** An interrupted upgrade resumes. Nodes sharing a database
  migrate it once. With gossip, each node migrates its own store.
- **Backups** made by the previous release restore into the new one.
- **Sign-in limits restart.** In a gossip cluster the sign-in rate-limit and lockout counters live in the memory of the
  node that owns them, and a stopping node hands them over empty. Keep upgrades short and watch `login.limited` and
  `login.lockout`. To change a limit, reload instead, which keeps the counters.
