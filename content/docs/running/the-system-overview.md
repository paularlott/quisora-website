---
title: "The system overview"
weight: 40
---

Super admins have **System overview** at the bottom of the console's menu: one page for the server as a whole. It
shows the counts of organizations, users and sessions; the cluster, when nodes replicate over gossip (every node with
its state and role, the quorum, and this node's own view, refreshed every 5 seconds); the signing keys (rotate, and
remove an old one); whether a master key rotation is in progress (with a link to where it stands); and the
server-wide [emergency sign-out](/docs/security/emergency-sign-out/). The menu keeps the organization you were last administering,
so it is one click back. `GET /api/system`, `GET /api/cluster` and `GET /api/keys` have the same figures. Each
organization has an **Overview** page too, for its administrators and super admins, with its own emergency sign-out.
