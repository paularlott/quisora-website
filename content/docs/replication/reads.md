---
title: "Reads"
weight: 60
---

- **Most reads are local**, on whichever node took the request, and see only committed data: listings, loading a client,
  checking a session or an API token. They lag the owner by a message after a write, a heartbeat at the worst.
- **Caches above the store** (sessions, clients, users, organizations, signing keys, sign-out counters) hold an entry
  at most 5 s, whatever the store: a change made elsewhere counts on every node within that, and sooner on a node that
  hears of it (`Node.OnChange` evicts the entry). So what a node serves is current within `StaleAfter` (the gate below)
  plus those 5 s, as with a database replica behind a cache.
- **Fresh reads are the cluster store's own.** When a write's outcome is unknown, the store reads the record on its
  partition's owner (`cluster.Store.FreshIn`, `partition.Manager.Read`: the owner confirms with a majority that it still
  owns the partition and answers from its committed data) to settle the write. The application never asks for one: a
  decision that must be exact is a compare-and-swap, which the owner decides.
- **The staleness gate.** A node serves a record from its own copy only while it can vouch for its copy of the record's
  partition (`partition.Manager.CanRead`): it has heard the partition's owner within the protocol's `StaleAfter` (or,
  owning it, a majority), it has not trailed what the owner reported committed for that long (a follower whose catch-up
  keeps failing), the partition has not diverged here, and the node is not copying its data (resync). Otherwise the
  single-record reads of the cluster store (`Get`, `GetIn`, `GetByUnique`, `GetMany`, `Lookup`) refuse with `store.ErrUnavailable`
  (HTTP 503), so a revoked session, a disabled user or a rotated secret is never served from a copy that stopped following
  the cluster for longer than that bound and a cache's 5 s, however long it stays behind; the other nodes serve it. A
  read that finds nothing is gated the same way, on the partition the record would be in: the one its key names (an
  organization's name: the global partition; a username, email, external id, group, tenant or provider name: the
  organization id the value starts with, `model.UniquePartition`; a lock or replay id: its own), or the one of a copy
  this node holds in any state (a record expired or deleted here, which never moves). So an unknown username at sign-in
  answers "not found" while another organization's partition is between owners. A caller that knows the organization
  of what it looks for asks that organization's partition alone (`store.GetIn`: a record of another partition is "not
  found" to it, which is what the caller would make of it anyway): a session cookie is looked for in the partition of
  the organization whose cookie it is, so a stale or made-up cookie is "signed out", not 503, while another
  organization's partition is between owners. Only a miss whose key names no partition (an id never received here asked
  without its organization, a link token, a provider identity or a passkey credential) needs every partition readable,
  since what it lacks may be in any. A node's own audit events, queued items and short-lived state are
  not in a partition and are exempt. Listings and counts are not
  gated (they are not decisions about one record), except listings of organizations and signing keys, which live only in
  the global partition: a node that trails it refuses them, so it never publishes a key set the majority has changed (a
  revoked key). Its JWKS then answers 503 once its cached key set is due (5 s), rather than the keys it last loaded. A follower keeps serving a partition while its owner hands it over
  (freshness counts from the last owner heard, within the staleness limit, as between heartbeats); a partition whose owner
  crashed is refused once that limit passes, until its new owner is heard (writes to it fail meanwhile too).
  A node that is cut off from the majority hears no owner, so its partitions are unreadable, and it is not ready.
- **Readiness follows divergence, and the global partition; no other unreadability.** A node is not ready while a partition
  has diverged on it (only an operator can clear that); `GET /api/cluster` says which and why, and the log has it (a
  divergence at warn level, once per partition). It is also not ready while it cannot read the global partition
  (organizations and signing keys: it has not heard its owner yet after starting, or trails it), because nearly every
  request needs it (the organization of the address, the keys of a token): such a node could serve no sign-in or token
  anyway, so it takes no traffic. Any other partition that is merely unreadable on a node (an owner that cannot be
  replaced, a catch-up that keeps failing) does not take the node out of rotation: its records answer 503 one by one
  while every other partition keeps working, and an unreadable partition is usually unreadable on every node, which
  would otherwise turn the loss of one partition (1/64 of the organizations) into a total outage.
  `partitions_unreadable` in `GET /api/cluster` and `quisora_partitions_unreadable` stay: alert on them.
- **Bounded staleness.** A node that cannot see a majority is not ready: `/readyz` says 503 and so does everything else but
  the probes, the token endpoints included, so a node cut off serves no revoked session or disabled account.
- **Hot records.** A sign-in's stamps (the last sign-in, the last TOTP step) are in a record of their own
  (`model.SignIn`), and failed attempts and lockouts in short-lived state, so sign-ins do not make an administrator's change
  of the user fail on the user's expected version.
