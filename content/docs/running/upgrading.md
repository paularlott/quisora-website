---
title: "Upgrading"
description: "Upgrade one release at a time, back up first, and keep a cluster serving."
weight: 70
---

Upgrade a node like this. In a cluster, do one node at a time.

1. Take a [backup](/docs/running/backup-and-restore/).
2. Put the new `quisora` binary in place of the old one, or pull the new image.
3. Restart it: `sudo systemctl restart quisora`, or restart the container. Storage is migrated as it starts.
4. Wait until the node is ready: `curl -sk https://localhost:8443/readyz` answers `200`, or the log says it is
   serving. Then move on to the next node.

## What to know

- **Back up first.** Upgrades go forward only. A store written by a newer build is refused, so going back means
  restoring the backup.
- **One release at a time.** A cluster can be upgraded one node at a time while it keeps serving. A node more than one
  release apart is refused: the others log `refusing to serve ... upgrade one release at a time` until it is upgraded
  or gone.
- **Storage is migrated at the first start of the new build.** An interrupted upgrade resumes. Nodes sharing a database
  migrate it once. With gossip, each node migrates its own store.
- **Backups** made by the previous release restore into the new one.
- **Sign-in limits restart.** In a gossip cluster the sign-in rate-limit and lockout counters live in the memory of the
  node that owns them, and a stopping node hands them over empty. Keep upgrades short, and watch the audit log for
  `login.limited` and `login.lockout` events. To change a limit, reload instead, which keeps the counters.
