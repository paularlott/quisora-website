---
title: "Revocation"
weight: 60
---

The revocation list (KRL) of a tenant holds every certificate that has not expired and **would not be issued now**, and the
CA keys that must not be trusted. Nothing has to be told that a person's access ended: the list is worked out when it is
asked for. A certificate is on it for the first of these reasons that applies:

| Reason | When |
| --- | --- |
| `revoked` | An administrator revoked it by hand, or the person revoked their own. |
| `ca_key_removed` | The CA key that signed it was removed (user or host certificate). The list revokes the key itself, so the list does not need to name the certificate. |
| `user_deleted` | The user was deleted. |
| `user_disabled` | The user was disabled, locked out, is past their end date, or their organization is gone. |
| `sessions_ended` | The user's sessions were ended: signed out everywhere, or a credential reset. For a [guest](/docs/sign-in/providers/#users-of-another-organization-guest-accounts), also when the sessions of the account in the other organization they signed in with were ended (signed out everywhere, disabled, locked out, past their end date, reset or deleted there). |
| `sign_in_ended` | The sign-in it was issued under was taken back: the account page's session, or the browser session a `quisora ssh` sign-in went through, ended from another session or by an administrator, or by removing the passkey it signed in with; the `quisora ssh` sign-in's token revoked, or the app's access removed. Also a certificate signed at the moment its sign-in was being ended: it is revoked as it is made, and the request refused, or, in a gossip cluster where the two nodes had not yet seen each other's change, revoked once they have ([How soon](/docs/ssh/revocation/#how-soon)). The user **signing out** of that browser does not revoke it: it lasts to its expiry, like the access tokens the session issued ([signing out and ending a session](/docs/sign-in/#sessions)). |
| `signed_out` | An [emergency sign-out](/docs/security/emergency-sign-out/) of the organization, or of the server, came after the certificate was issued. |
| `role_not_allowed` | The user is a manager or administrator and the tenant does not allow them certificates (it was turned off after the certificate was issued). |
| `app_unavailable` | The tenant's SSH application is disabled or missing. The certificates count again when it is back. |
| `access_removed` | The user lost access to the tenant's SSH application: removed from the access list, or the access ended. |
| `principals_changed` | A principal in the certificate is not one the user would get now: a username or group renamed, removal from a group or role, or a principal source turned off. The whole certificate goes, and a new one has the new principals. |
| `ssh_off` | SSH is turned off for the tenant: every certificate of it, host certificates too. |
| `settings_changed` | The certificate grants more than the settings would give now: a lifetime over **Certificate lifetime**, an extension that is no longer allowed, or other source addresses than the ones now set ([The settings](/docs/ssh/turning-it-on-for-a-tenant/#the-settings)). |

Host certificates are revoked in three ways only: by hand (their serial is listed), with their CA key (removed), and with
every CA key while SSH is off. Settings that are not principals loosened (a longer lifetime, more extensions, no source
addresses) apply to certificates issued after the change.

**What the list holds.** One certificates section for each CA key that `ca.pub` or `known_hosts` publishes, with the serials
revoked among the certificates that key signed; and one explicit-key section that revokes CA keys outright: a key removed by
hand stays revoked for as long as any certificate it signed can still be presented (its record is kept as a tombstone, without
its private key, for the longest lifetime plus 10 minutes: **user keys 24 hours and 10 minutes, host keys 365 days and
10 minutes**), and **while SSH is off every CA key of the tenant** is revoked. sshd checks the CA key of a certificate
against the list as well, so a revoked CA key revokes everything it signed on every server that fetches the list, even a
certificate forged with a stolen key that no list names, and even where the CA file still names the key.

In the console the tenant's SSH page has a **Certificates** table that lists them a page at a time, as the users are
listed (10, 25, 50 or 100 to a page; **Show**: active, revoked, expired or all), with the reason, and **Revoke** revokes one
by hand. The search box finds certificates by the start of the user's username or name (as they are now), the start of the
certificate's key id (it begins with the username as issued), key fingerprint (`SHA256:…`) or serial, and by a principal
written whole (`paul`, `group:ops`, `web1.example.com`); case is ignored. Expired certificates are kept an hour; a revoked
one stays on the revocation list for ten minutes after it expires, for servers whose clocks run slow. Through the API:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$QUISORA/api/orgs/acme/tenants/prod/ssh/certificates?q=paul&status=active&limit=25" | jq '.items[] | {id, serial, key_id, principals, valid_before}'
curl -X POST -H "Authorization: Bearer $TOKEN" "$QUISORA/api/orgs/acme/tenants/prod/ssh/certificates/<certificate id>/revoke"
# one user's certificates that have not expired, across the tenants (each says which tenant: tenant_id, tenant, tenant_name)
curl -s -H "Authorization: Bearer $TOKEN" "$QUISORA/api/orgs/acme/users/<user id>/ssh-certificates" | jq '.items[] | {id, tenant, serial, principals, status}'
```

The list is newest first and takes `q` (the search), `offset` and `limit` (25 a page, at most 100), and answers
`{"items": […], "total": n}` where `total` counts every match, as the other lists do. The other filters are `user`,
`status` (`active`, `revoked`, `expired`, `all`) and `host` (`true` or `false`); `id` is the
certificate's record id, not its serial. Revoking one already revoked changes nothing. A user's certificates are listed
in full, for administrators of the organization and service accounts with the `ssh` scope (403 for anyone else).

**A lost access is written down.** When the list is made and finds a certificate revoked for `access_removed`,
`principals_changed` or `role_not_allowed`, the certificate is marked revoked (by `system`, with that reason, once), so
giving the person the access, group or role back does not bring their old certificates back: they get a new one. This
is best effort and happens when a list is built: the list revokes the certificate in any case, but access that is
restored before any list was built after the loss revokes nothing. The other reasons follow the person's or the tenant's
state and are not written: a disabled account that is enabled again, the SSH application enabled again, settings put
back, or SSH turned on again, makes its certificates count again.

## How soon

A node keeps the list it made for 30 seconds (a revocation, a change of a CA key or of the tenant clears it on every
node at once; a change of a user, a group or an access list reaches the list within those 30 seconds), the revocation
list, `ca.pub` and `known_hosts` are answered with `Cache-Control: no-cache` and an `ETag` so a cache must revalidate
them (a cache cannot hand out an old `ca.pub` beside a new list after a rotation), and servers fetch every minute if you
use the timer above (plus up to 15 seconds of `RandomizedDelaySec=`). So expect a revocation, or the end of someone's
access, to reach sshd within about two minutes. The discovery document may be cached for 60 seconds. It applies to new logins. A session someone already
has open stays open unless the server runs `fetch --end-revoked`, which ends it at the same fetch (and ends any
connection once it has been open longer than `cert_ttl`)
([Setting up an Ubuntu server](/docs/ssh/setting-up-an-ubuntu-server/), step 7); otherwise end it on the server (`loginctl
terminate-user`, or kill the sshd process) when that matters.

To cut a person off at once from everything, lock them out ([emergency sign-out and lock-out](/docs/security/emergency-sign-out/#locking-out-one-person)):
their certificates go on the list as `user_disabled`.

In a [gossip cluster](/docs/running/clustering/#replicated-gossip), a certificate signed on one node at the moment its sign-in is taken back on
another may be handed out, as neither node has the other's change yet. Taking a sign-in back records it as taken back,
and that record reaches every node like any change: once it and the certificate have both reached a node, the list
that node makes revokes the certificate (`sign_in_ended`): the arrival of either makes the node's list again. So the
replication delay comes on top of the times above, and the certificate does not outlast it.

## What revocation does not cover

- **A certificate goes with the sign-in it was issued under** (`sign_in_ended`) when that sign-in is taken back: its
  browser session ended from another session or by an administrator or with the passkey it signed in with, or the
  `quisora ssh` sign-in's token or the app's access revoked; besides signing the person out everywhere, a credential reset, a lock-out, an emergency sign-out, or
  revoking the certificate itself. Signing out of the browser does not revoke it: it lasts to its expiry. Certificates
  issued before the sign-in was recorded follow only the latter. In a gossip cluster, one signed while its sign-in was
  being taken back on another node is revoked once both changes have replicated ([How soon](/docs/ssh/revocation/#how-soon)).
- Sessions already open on a server stay open, unless it runs `fetch --end-revoked` (which also ends every connection
  open longer than `cert_ttl`, so one whose certificate expired before its access was removed does not stay open). It
  ends the connection's whole login session where it has one (logind), `tmux` and `nohup` included; processes started
  outside the session (`systemd-run --user`, user services, cron) are not ended, nor, without logind, those a session
  left running.
- A host certificate revocation reaches only clients that use `RevokedHostKeys`
  ([Clients and host certificate revocation](/docs/ssh/host-certificates/#clients-and-host-certificate-revocation)).
- A server that has stopped fetching keeps its old list.
