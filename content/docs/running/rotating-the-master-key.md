---
title: "Rotating the master key"
description: "Replace the key that seals every stored secret, without anyone noticing."
weight: 50
---

The master key seals every secret Quisora stores: authenticator secrets, sign-in providers' client secrets, signing
keys' private keys and upstream refresh tokens. Rotate it on a schedule, and at once if it may have been exposed. A
rotation re-seals every secret with the new key. Users keep their authenticators and applications keep their refresh
tokens. Then you remove the old key, and it opens nothing the server holds.

Each key has an 8-character id derived from it, which the logs use (`key`).

## Changing keys: reload or restart

Each step below edits `server.master_key` and `server.previous_master_keys` in a node's config file, then restarts the
node or reloads it. Put the keys in the config file: values given as flags or environment variables cannot change in a
running server.

- **One node:** `kill -HUP <pid>` (systemd: `systemctl reload quisora`).
- **A gossip cluster:** **Reload configuration** on the System page reloads every node at once.

A reload is refused, and the keys in use stay, when the new keys do not include the key in use, so a typo cannot make a
node seal with a key the others cannot open. The log says `master keys reloaded`, or `configuration not (fully)
reloaded` with the reason.

## One node

1. Make a new key with `quisora genkey`.
2. Set the new key as `server.master_key` and the old one in `server.previous_master_keys`, then reload or restart:

   ```toml
   [server]
   master_key = "<new>"
   previous_master_keys = ["<old>"]
   ```

3. When the status says `complete`, remove `previous_master_keys`, and reload or restart.

## Several nodes (shared database or gossip)

Every node must be able to open what any other node seals. So add the new key everywhere as a previous key first, and
only then make it active. Finish each step on every node before starting the next.

1. `quisora genkey`.
2. Every node: `master_key = "<old>"`, `previous_master_keys = ["<new>"]`. Reload or restart. Nothing changes yet.
3. Every node: `master_key = "<new>"`, `previous_master_keys = ["<old>"]`. Reload or restart. While some nodes still seal
   with the old key, the status says `waiting_for_nodes` and names them. Once all use the new one, the leader node
   re-seals every stored secret and the status says `complete`.
4. Every node: remove `previous_master_keys`. Reload or restart.

On a shared database, a node started with only the old key refuses to start once the first node has the new key active.

## Is it done?

Super admins see a rotation in progress on the **System overview** page, which links to its status. The status shows the
key every node seals with, how many secrets have been re-sealed, and a state:

| State | Meaning |
| --- | --- |
| `waiting_for_nodes` | Some nodes still seal with the old key. |
| `resealing` | Secrets are being re-sealed. |
| `unopenable` | Some secrets are not opened by any configured key. Put the missing key back in `previous_master_keys`. |
| `complete` | Remove the previous keys now. |
| `none` | No rotation in progress. |

A reload that removes a key is refused until the re-seal has finished.

The re-seal runs in short passes in the background. On one BadgerDB node a million users take about 15 minutes. A
cluster or shared SQL database is slower. Small installations finish in seconds. The leader logs `master key rotation
complete` and repeats it every hour until you remove the previous keys.

## After the rotation

- Keep the old key only with the **backups made before the rotation**. To restore one, put its key in
  `previous_master_keys` for the restore, then remove it again. Make a new backup once the rotation is complete.
- If the old key was exposed, rotating is not enough: a copy of the database or an older backup still opens with it.
  Follow "The master key may be exposed" in [incident response](/docs/security/running-securely/#incident-response).
- Browsers that signed in before earn a new device cookie at their next sign-in.
- Queued emails and logouts are re-sealed by their own node. One sealed with a key that is no longer configured stays
  queued until its key is back.
