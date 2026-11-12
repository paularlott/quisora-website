---
title: "Deletion"
weight: 130
---

Deleting an organization, user, group, tenant or provider deletes that one record. Everything that was its stands on
it and stops counting at that write, on every node that has it: a user stands on its organization
(`service.UserUsable`, checked for every session, refresh grant, access token and API token), a credential or session
on its user and epoch, a membership on its group and user, an access entry on its tenant and subject, a connected
provider on its user and provider, an application on its organization. Readers apply this test; nothing else has
to be written for it.

**The orphan sweep is the one cascade.** The housekeeping leader reads every record of the kinds that do not expire,
20,000 a minute, owners before what they own (`service.SweepOrphans`): a record whose owner is gone (missing here and,
read through the owners, there too) is removed (a membership is marked removed, fencing stalled group writers), and so is a
credential, session or refresh grant of an epoch its account has moved past. Only records at least an hour old are
judged, so an owner created on another node has time to arrive. A pass takes about a day at five million users. It
also removes what any interrupted write left, so there is no other clean-up path to keep correct.

Deleting an organization sends no back-channel logout: a user signs in only to applications of their own
organization, and those are deleted with it (their tokens stop working at once), so the deletion is one write
whatever the organization's size. Before it, the deletion closes the organization to new users through a guard in the
organization's own partition (a lease record whose id is the organization's): every user's creation asserts the guard
open, at the version it read, in the transaction that creates the user (it reads the guard and does not write it, so
users created in parallel, as a directory provisions them, do not conflict with each other), and the deletion takes
the guard (a compare-and-swap) before it counts the users, on a copy that holds the guard and so every write of the
partition before it, and commits it (another, on the version it took) before it deletes the organization record. A
user created before the guard was taken is counted (a deletion that must find the organization empty refuses); one
whose transaction comes after it asserted a version the taking replaced, or read the taken guard, and is refused, to
be tried again. So a user is never created, and reported made, in an organization that is about to go. A creation
writes the guard only to make it (an organization's first user, or the first after a refused deletion) or to open it
once a deletion's lease has run out, which then makes that deletion's commit fail; an open guard is kept while its
organization exists (the sweep removes it only once the organization is gone), and a refused deletion gives it back
open. A deletion that dies holding the guard leaves new users refused until its lease ends (a minute). One that dies
after it committed has decided: housekeeping finishes it within a minute or two (the committed guards are indexed),
as does the deletion made again, and the guard stays committed for the tombstone retention, so a creation that read
the organization before it went is refused. A deletion without cascade is refused (not empty) while the organization
has users, also over a cascading deletion that decided and did not finish. Deleting a user tells the applications at once. Their memberships stand on them:
every reader of a group's members (lists, counts, SCIM) keeps only members that are users of the organization, by
merging the member ids with the organization's user ids read from its index a page at a time (no user record is
read), so a deleted user is never a member, whatever the clean-up has done (a pending addition that materializes
after the deletion included). A manager reference is cleared through the sparse `manager_id` index: only the
deleted user's reports are read.

A unique value held by such a record (a provider identity's subject) does not wait for the
sweep: a create that finds it taken asks `service.ReleaseUnique`, which removes the holder if, read through its owner, it
counts for nothing, and the create is tried once more. Deleting an account never blocks linking its provider
identity to another.

## Serving while not ready

Until a node is ready, **every path except `/healthz`, `/readyz`, `/assets/…`, `/branding/…` and `/favicon.ico`
answers 503** with `Retry-After: 5` (JSON `temporarily_unavailable` for `/.well-known/…`, JSON
`{"error": …}` for `/api/…` and `/scim/…`, plain text otherwise, an organization's `/o/<org>/…` pages and OAuth endpoints included): management and SCIM reads, the authorization and
sign-in pages, discovery and JWKS alike, so a client that bypasses the load balancer never receives partial, stale or
deleted data (`web.Server.serveGate`), the token, userinfo and introspection endpoints included: a node cut off from the
majority issues no tokens and answers no introspection, and clients retry on another node. A restarting node issues no
tokens until it has caught up.

## Short-lived state

Sign-in steps, codes and challenges stay in the memory of the node that made them (their ids carry its prefix) and
the others forward to it. Hash-routed state (rate-limit and lockout counters) lives on the rendezvous-hash owner
**among the nodes that are ready and alive** (each publishes `quisora.ready` in gossip metadata; a node gossip
suspects owns nothing, so its counters move at once rather than every request waiting on it). It **fails closed**:
when no ready node is in view, or the owner cannot be reached, the operation fails (the rate limit or lockout
refuses) instead of counting on one node. It is in the owner's memory only: when the owner changes (a node stops
serving, restarts, leaves or is suspected) the new owner starts from nothing, so a counter's window starts again.
A limit checked before anything else (client authentication, a bearer token) reads the counter from the owner's
last answer to this node when that is under a second old, so the requests that pass a limit cost no round trip;
every attempt that counts goes to the owner and refreshes it, so a node lets at most one attempt past a limit reached
through other nodes before it refuses too. Nothing whose safety
depends on it surviving that is kept there: single-use values are replay records (compare-and-swap checked by the owner, above).
