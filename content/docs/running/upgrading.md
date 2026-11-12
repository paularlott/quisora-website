---
title: "Upgrading"
weight: 140
---

- **Back up first.** Upgrades go forward only. A store or database written by a newer build is refused, so going
  back means restoring the backup.
- **One release at a time.** Each release works with the previous one: a cluster can be upgraded one node at a time
  while it keeps serving. Nodes publish their compatibility, and a node more than one release apart is refused: the
  others log `refusing to serve … upgrade one release at a time` and stop serving until it is upgraded or gone.
- **Storage is migrated at the first start of the new build**, step by step, each step recorded as it completes (an
  interrupted upgrade resumes). Nodes that share a database do it once, under a lock; with gossip, every
  node migrates its own store.
- **Backups** made by the previous release restore into the new one.
- **Brute-force windows restart.** With gossip, sign-in rate-limit and lockout counters live in the memory of the
  node that owns them; every node that stops during a rolling upgrade
  hands its counters' windows to a new owner, which starts them from nothing. An attacker who watched the upgrade
  could try again sooner than `limits.lockout_minutes` allows. Watch `login.limited` and `login.lockout` across an
  upgrade, and keep upgrades short. To change a limit, reload instead: that keeps every counter
  ([limits and denied addresses](/docs/running/limits-and-denied-addresses/#changing-them-without-a-restart)).
