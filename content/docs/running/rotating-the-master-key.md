---
title: "Rotating the master key"
weight: 70
---

The master key seals every secret Quisora stores: authenticator (TOTP) secrets, sign-in providers' client secrets,
the signing keys' private keys, upstream refresh tokens and the keys relying parties' refresh tokens are made from.
Rotate it on a schedule, and at once if it may have been exposed. A rotation re-seals every one of those secrets with
the new key, without anyone noticing: users keep their authenticators, applications keep their refresh tokens. Then
the old key is removed, and from that moment it opens nothing the server holds.

Each key has an id (8 characters, derived from the key, revealing nothing about it): sealed values name the key that
sealed them, and the log names keys by it (`key`).

## Changing the keys: reload or restart

Each step below changes `server.master_key` and `server.previous_master_keys` in a node's config file, then either
restarts the node or tells it to reload them, without a restart. On a gossip cluster every node reloads at once with
**Reload configuration** on the admin console's System page (or `POST /api/cluster/reload`, see
[changing the cluster size](/docs/running/cluster-operations/#changing-the-cluster-size)); a single node reloads with SIGHUP:

```bash
kill -HUP <pid>                          # systemd: systemctl reload quisora (ExecReload=/bin/kill -HUP $MAINPID)
docker kill --signal HUP quisora         # Kubernetes: kubectl exec <pod> -- kill -HUP 1, once the mounted file has changed
```

- A reload reads only these two settings (and, on a gossip cluster, `cluster.key` and `cluster.previous_keys`: see
  [rotating the cluster key](/docs/running/clustering/#rotating-the-cluster-key); `cluster.size` and `cluster.peers`: see
  [changing the cluster size](/docs/running/cluster-operations/#changing-the-cluster-size); and on every node the limits and
  `server.deny_networks`: see [limits and denied addresses](/docs/running/limits-and-denied-addresses/#changing-them-without-a-restart)), from the config file
  and the `QUISORA_*` environment variables as at start-up. Nothing else is reloaded.
- Settings given on the command line (`--master-key`) cannot change while the server runs, so a reload leaves them
  alone and says so (the log, and the console's report): put them in the config file. Settings from environment
  variables cannot change either, since a running process keeps its environment; use the config file, or restart.
- A reload is refused, and the keys in use stay, when the new keys do not include the key in use: a typo or the
  wrong file cannot make a node seal with a key the others cannot open. The log says `master keys reloaded` (with
  the key ids), or `configuration not (fully) reloaded` with `error` `master keys: <the reason>` and `applied` the
  changes made before it.

## Is it done? When can the old key go?

Super admins see that a rotation is in progress on the **System overview**, which links to its status. The
same status is `GET /api/master-key` (super admin). It shows:

- the key every node seals with, and the previous keys every node holds;
- how many secrets the housekeeping leader has re-sealed so far (`resealed_secrets`), and when it last finished a
  walk over every stored record (`checked_at`, null until the first walk ends); `stale_secrets` (still sealed with a
  previous key) and `unopenable_secrets` (no configured key opens them) are what that walk found, so they say nothing
  until `checked_at` is set;
- a state: `waiting_for_nodes`, `resealing`, `unopenable`, `complete` (with
  `previous_keys_removable: true`: remove them now) or `none` (no rotation in progress).

The status is cheap: it reads the leader's last report (any node answers it), not the stored secrets, so the console
may poll it. A reload that removes a key is refused until a walk that began after the keys changed has ended with
nothing left and every node seals with the active key (the error says so).

**How long it takes.** The leader re-seals in passes, each for at most a third of its minute-long housekeeping tick
(20 seconds), and the next pass goes on where the last one stopped; a walk that finds nothing left ends the work, and
nothing is read again until the keys change. Measured on one BadgerDB node, a re-seal runs at about 3,000 users per
second (a user's authenticator secret and password hash are re-sealed in one write: about 6,500 secrets per second),
so a million users take about 5 minutes of writing, which at 20 seconds in every 60 is about **15 minutes**; add
about as much again for each million upstream identities and grants. A gossip cluster or a shared SQL database writes
more slowly (every write is replicated, or a network round trip), and each pass then gets through fewer records: that
was not measured, so watch it.
Watch it in `resealed_secrets` (status page, API) and the leader's log line `master key: secrets re-sealed with the
active key`, which gives each pass's count (`resealed`) and the total since the keys changed (`resealed_total`); the
state turns `complete` when the walk ends. A leader that changes, or restarts, begins its walk again; what it finds
already re-sealed it only reads (about 300,000 users per second).

The housekeeping leader also logs `master key rotation complete … remove server.previous_master_keys now`, and repeats
it every hour until they are removed.

## One node

1. Make a new key: `quisora genkey`.
2. Set the new key as `server.master_key` and the old one in `server.previous_master_keys`, then reload or restart:

   ```toml
   [server]
   master_key = "<new>"
   previous_master_keys = ["<old>"]
   ```

3. When the status says `complete` (a few seconds for a small installation: [how long it takes](/docs/running/rotating-the-master-key/#is-it-done-when-can-the-old-key-go)), remove `previous_master_keys`, and reload or restart.

## Several nodes (shared database or gossip)

Every node must be able to open what any other node seals, so the new key is first added everywhere as a previous key,
and only then made active. Do each step on every node, one node at a time, before starting the next step.

1. `quisora genkey`.
2. Every node: `master_key = "<old>"`, `previous_master_keys = ["<new>"]`; reload or restart. Nothing changes yet;
   every node can now open what the new key seals.
3. Every node: `master_key = "<new>"`, `previous_master_keys = ["<old>"]`; reload or restart. New secrets are sealed
   with the new key. While some nodes still seal with the old one, the status says `waiting_for_nodes` and names
   them, and nothing is re-sealed. Once all do, the housekeeping leader re-seals every stored secret, and the status
   says `complete`. A node reports its keys when it starts, before it serves, and serves only while its report counts
   (renewed every 5 minutes, good for 15): one whose report lapsed (its store refused the renewals) is not ready until
   it reports again, so every node that may seal anything is in the status.
4. Every node: remove `previous_master_keys`; reload or restart.

On a shared database the first node with the new key active also moves the database's key check to it: from then on
a node started with only the old key refuses to start.

## After the rotation

- Nothing the server holds needs the old key. Keep it only with the **backups made before the rotation**: a backup
  is verified, decrypted and restored with the key it was made with. To restore one, put its key in
  `previous_master_keys` for the restore (the restored secrets are then re-sealed with the active key as above), and
  remove it again afterwards. Make a new backup once the rotation is complete.
- Device cookies (which let a browser that signed in before skip the per-address sign-in limit) are made with the
  active key only: each browser earns a new one at its next sign-in.
- If the old key was exposed, rotating it is not enough: a copy of the database or a backup from before the rotation
  still opens with it, and the secrets it sealed are unchanged. Follow the list in
  [incident response](/docs/security/running-securely/#incident-response) ("The master key may be exposed").
- A secret that no configured key opens (the old key removed before the rotation completed, or a damaged value) is
  logged at error level (`secrets that no configured master key opens`); put the missing key back in
  `previous_master_keys`.
- Queued emails and back-channel logouts ([Queued work](/docs/running/settings/#queued-work)) are sealed too, and re-sealed by their node
  (each node its own). One sealed with a key that is no longer configured (removed too early) stays queued, to be
  delivered once its key is back: the node logs `items sealed with a master key that is not configured`, and `GET
  /api/master-key` counts them (`queued_items_lost`) with a warning in its `detail`. They need none of the configured
  keys, so they do not hold the rotation back. They are discarded a day after their last retry would have been, as
  every queued item is: by then they are worthless even if the key comes back.
