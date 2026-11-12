---
title: "The System page"
description: "Server-wide counts, cluster status, signing keys and the emergency sign-out, for super admins."
weight: 40
---

Super admins have **System overview** at the bottom of the console menu: one page for the server as a whole. The menu
keeps the organization you were last administering, so it is one click back. Each organization also has its own
**Overview** page for its administrators, with its own emergency sign-out.

{{< screenshot name="run-system" alt="The System overview page: totals, the cluster with three nodes, this node's status and the signing keys" >}}

The page shows:

- **At a glance:** the number of organizations, users and browser sessions, and the server version.
- **Cluster** (when nodes replicate over gossip): each node with its state and role, and whether a majority is in
  view. It refreshes every 5 seconds. **This node** shows its own view: whether it is ready, accepts changes, how many of
  the 64 partitions it owns, and the cluster key ids. **Reload configuration** re-reads the config file on every node
  ([Settings](/docs/running/settings/#changing-settings-without-a-restart)).
- **Signing keys:** see below.
- Whether a [master key rotation](/docs/running/rotating-the-master-key/) is in progress, with a link to where it stands.
- **Sign everyone out…**, the server-wide [emergency sign-out](/docs/security/emergency-sign-out/).

## Signing keys

Tokens are signed with ES256 by default (`tokens.signing_alg`; `EdDSA` is a little faster where every application
supports it). A new key is made every `tokens.key_rotation_days` (30 by default; 0 rotates by hand only). It is
published at once and starts signing 15 minutes later, so applications already know it. The previous key stays published
until the tokens it signed have expired, then it is removed.

The page lists each key's state (**Next**, **Signing**, **Previous**) and when it starts signing, stops and is removed.

- **Rotate now** makes a key that signs at once. Tokens signed before keep working until they expire.
- If a key may have been exposed, rotate, then **Remove** the old key. Tokens it signed stop verifying here at once, and
  in applications as soon as they fetch the key set again. Nobody is signed out: applications get new tokens through
  their refresh tokens. The key that signs now cannot be removed.
