---
title: "What the service builds on this"
weight: 120
---

The rules below are the service layer's (`internal/service`): they use the store's compare-and-swap, unique values and fresh reads and are the same in every mode except where noted.

## Sign-in stamps

A user's last sign-in and last accepted TOTP time step live in a separate per-user **sign-in record**
(`model.SignIn`, id = the user's id), never on the user: a sign-in can neither erase nor be erased by an
administrator's change of the user. The TOTP step is recorded with a create-once / compare-and-swap of that record
before the code is accepted, so a code is accepted once on any node: the same code presented on two nodes at once is
accepted by exactly one, and a node that has not yet received a use is refused by the owner, which has committed it. When the
step cannot be recorded the code is refused (fails closed). Failed attempts and lockouts are counted in short-lived
state (below), not in records.

## Super admins are protected by rank, not by a count

There is no cluster-wide guarantee that a usable super admin always remains. What holds instead, on every node and in
every mode, are rules about who may act on whom, none of which needs a lock or another node's answer:

- nobody demotes, disables, locks out, end-dates or deletes **themselves** (nor changes their own end date);
- only a **super admin** demotes, disables, locks out, end-dates or deletes a super admin (an administrator, a manager or a
  service account, SCIM provisioning included, cannot);
- the **system** (housekeeping, the end-date sweep, commands acting as the system) never does either: the sweep that
  disables accounts past their end date leaves super admins alone (their end date still stops their sign-in).

A deletion is one compare-and-swap on the version the rules were judged on, checked by the owner, so a user promoted
to super admin meanwhile is not deleted on the strength of the older copy. What the rules cannot prevent: **two super
admins removing each other at the same moment** (on different nodes, or one disabling the other while the other
disables them) can leave none, and so can a super admin's end date passing. The recovery is outside the service, with the
master key: `quisora invite --break-glass --super-admin <primary org> <email>` (see [incident response](/docs/security/running-securely/#incident-response)).

## The last way in

A user removing one of their own ways to sign in (a passkey, a connected provider, the authenticator app) may not
remove the last one, nor their last second factor where one is required. A removal is one compare-and-swap of the
user record, checked by the owner against the version the caller read, decided on the credentials read through the
owners (their contents: a key disabled, a provider turned off, a link of a passed epoch count for nothing). The write lists
the passkeys and links removed (`model.User.Removed`: they stop counting at that write, on every node), clears the
authenticator app, drops the recovery codes with the last second factor and moves the security generation on. Two
removals at once, however long either stalls, cannot both commit on the copy they decided on: the second is refused
(`ErrStale`), decides again on the account as the first left it, and is refused as the last way in. The records are
deleted after the commit, as tidying (the orphan sweep removes any left); an entry leaves the list once its record
has been gone for the tombstone retention, and a new credential epoch clears it. No lock is involved, so nothing
depends on a lease outliving a stalled request.

## Groups and their members

A change of a group and its members (a SCIM PATCH or PUT, an admin console change, a creation with members, a
deletion) touches several records: the group, and one membership record per user added or removed. **The group's
record is the single commit point.** Every change is committed by one compare-and-swap of that record, checked by the owner, on the version the change was made from: it writes the group's fields and appends a *change
entry* (the operation id, the users added and removed, a per-group sequence number) to the record's pending log
(`model.Group.Pending`). If that write fails nothing has happened; once it succeeds the change is committed and is
never rolled back. There is no lock and no compensating write.

The membership records are a **materialized view** of the committed entries. After the commit the writer applies
the record's entries in sequence order: each membership record stores the sequence of the change that last wrote
it, and a write carrying an older sequence is refused (the record is read, compared and written with a
compare-and-swap on its version), so a writer that stalled (for any length of time, on any node) can never
overwrite what a later change wrote. That is the fence; it needs no clock. A removal does not delete the membership
record: the record is marked removed, leaves the `group_id` and `user_id` indexes (so it is never listed) and is kept
for 7 days (`model.RemovedMemberRetention`, as long as tombstones are) to fence stalled writers before it expires.
The writer then removes the applied entries from the group's record with another compare-and-swap. A writer that
dies after the commit leaves its entry in the record; the next change of the group applies it first, and the
housekeeping leader finishes entries older than 30 s (`service.FinishGroupChanges`, found by the indexed `pending`
field, so it costs nothing when there are none). A change that cannot be materialized (a store refusing the
membership writes) stays pending and is carried forward by later commits; a record with 8 such entries refuses
further changes (`ErrUnavailable`) until they are applied.

Field changes (a rename, tags, the external id) commit on the same record with the same compare-and-swap, so they
serialise with changes of the members without a lock and preserve the pending log. A deletion is one conditional
removal of the group's record: its memberships stand on it, so from that moment nobody is a member of the group,
and the orphan sweep marks their records removed later ("Deletion" below). Creating a group with members
creates the record carrying the first entry: the group exists with every member or not at all. One change may add
and remove at most 1,000 memberships (`service.MaxMembersPerChange`), which keeps the log small; SCIM refuses a
larger PATCH or PUT with 413 (RFC 7644 §3.12) and the client splits it.

Whose membership an actor may change depends on the user's rank (an administrator never reaches a super admin; a
manager or a service account without the `manage_admins` scope changes plain users' memberships only), so a change by anyone but a super admin
judges each user it touches on the newer of this node's copy and **the owners'** (one fresh read for the whole
change, `membersToJudge`): a promotion committed anywhere counts before it has reached this node. A user who
cannot be read refuses the change; a rank that could not be read is never taken as plain.

**What readers see.** Every reader of memberships (the groups of a user for tokens and tenant access, a group's
members, member counts, SCIM resources) reads the group's record and applies its pending entries over the
membership records, so it observes exactly the committed changes: never one that failed (nothing of it was written)
and never a committed one in part. A user's groups for tokens are read group by group, each matched with the user's
membership at the same moment by the group's change numbers (a membership record carries the number of the change
that wrote it): a membership older than the group read is read again through the owner, and a group older than the
membership read is read again through the owner, until they agree, so a user never gets a group's tags from a moment they
were not its member. A committed removal is in force the moment the commit succeeds, materialized or
not; a committed addition is seen the same way (a user's groups include the organization's groups with pending
entries, one indexed read, normally empty). A membership of a group that no longer exists names no group and grants
nothing. The group's version, its SCIM ETag, moves at the commit and once more when the entry is cleared (normally
within the same request, which returns the final version); a change made from a copy that is no longer the newest
is refused (`ErrStale`, HTTP 412 with `If-Match`). A deleted user's memberships are left to the orphan sweep: they
name a user who no longer exists, and member lists leave them out.

## Refresh grants and single-use values

Refresh grants are compare-and-swaps checked by the owner because rotating a refresh token advances the grant's counter: a node that had not
yet received the advance cannot make the owner accept the old token (it is refused as stale). Replay records (`model.Replay`, `service.UseOnce`) hold the
single-use values seen (client assertion and DPoP proof `jti`s) until they expire, so a value accepted once is
refused on every node, whichever nodes stop, restart or leave meanwhile. Invitation and reset links are
compare-and-swaps too, and an account has at most one of each (a new one replaces the record, and every try of the write judges
the record it replaces). One is used up by the commit of the change it makes, a compare-and-swap of the user
record that moves the account's security generation on (`service.UseSignInLink`): a link presented to two nodes at
once is used once, and a failure before the commit leaves it usable.

The user record is also the one commit point for which of an account's credentials and sign-ins count. Every
passkey, connected provider and API token carries the account's **credential epoch** it was made in
(`model.User.CredEpoch`); every session carries its **session epoch** (`SessionEpoch`). Each works only while its
epoch is the account's. A password reset gives the account a new session epoch in its commit; an accepted invitation
(or a reset of the account's sign-in) new epochs of both: every earlier session or credential stops at that write, on
every node that has it, and the passkey an invitation stored for its new epoch beforehand starts. Of two acceptances
racing, only the winner's epoch is committed; the loser's passkey never counts. "At that write" means where the
write has landed: a check reads the node's own copy of the account (the token endpoints cache it for up to 5 s), so
on a node the commit has not reached yet the old ones work until it arrives. The commit is held by a majority when it
returns; the other nodes apply it when the owner's commit notice reaches them, a message later. A refresh grant carries the session
epoch and the sign-out stamp of the session it was granted in, never the current ones: an authorization code or
device sign-in is redeemed only while its session still signs the user in (`service.SessionUsable`, the one test of
a session, also for browsers), so a code cannot outlive, or renew, what its session lost. Removing old records after a
change is tidying of the epochs that change replaced and of no other, so a late tidying never touches what a later
change made (the orphan sweep finishes it after a crash, and removes a losing acceptance's passkey).
