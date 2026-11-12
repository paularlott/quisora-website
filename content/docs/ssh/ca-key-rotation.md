---
title: "CA key rotation"
weight: 70
---

A tenant has a **user CA key**, which signs user certificates, and a **host CA key** when host certificates are on. Each
is an ed25519 key that Quisora keeps sealed with the master key. The SSH page's **CA keys** table shows each key's
fingerprint, state, when it signs and until when it is published: **Signing**, **Next** (published, not signing yet) and
**Retired** (no longer signs, certificates it signed still work).

A user key's successor is published at once and signs **seven days** later, so servers that fetch the CA list at least
once in a week trust it before it signs. The old key stops signing then, and stays published for another 25 hours, which
covers the longest certificate it signed (24 hours) and a server's next fetch. After that it leaves the list by itself.

- **Scheduled.** `rotation_days` (8 to 3650) makes the successor when the newest user key is `rotation_days` minus seven
  days old, so it signs when the key is `rotation_days` old. Quisora does this itself (audited as `ssh.ca.rotate` by the
  system). 0 rotates by hand only. Host keys are never rotated on a schedule.
- **By hand.** **Rotate user key** → **In seven days**, or `{"immediate": false}` in the API. It is refused while
  another rotation of the user key is under way. **Rotate host key** has no choice to make (below).
- **Immediately.** **Rotate user key** → **Immediately** (`{"immediate": true}`): the new key signs at once and the old one
  stops signing now, published for another 25 hours. It replaces a rotation under way. Servers that have not fetched
  the new key refuse new certificates until they do.
- **A host key** signs from the moment it is made, whichever you choose; the old host key stays published until you remove
  it, so existing host certificates keep working while you re-sign the hosts and refresh the clients' `known_hosts`.

```bash
curl -X POST -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" \
  -d '{"purpose": "user", "immediate": false}' "$QUISORA/api/orgs/acme/tenants/prod/ssh/rotate"
```

Rotation is not atomic across nodes. Two nodes that enable SSH or rotate a key in the same instant can each make a key,
and both are published. After a rotation, look at the **CA keys** table: it should show one key that signs and, for a
rotation in seven days, one **Next**. If there is an extra, remove it once it no longer signs.

**Removing a key.** A key that no longer signs can be removed (the trash button on its row, or
`DELETE /api/orgs/{org}/tenants/{id}/ssh/keys/{key id}`). It is no longer published, and **the revocation list revokes the
key itself**, so every server that fetches the list distrusts the key and everything it signed, certificates that no
list names included. Its record stays, as a tombstone without the private key, for as long as the longest certificate
it could have signed could be presented ([Revocation](/docs/ssh/revocation/)). A key that signs now, or has not started, cannot
be removed.

**A CA key may be compromised.** Anyone with the key can sign certificates for any principal, and a certificate they
make is on no list of serials, so the cure is to take the key away. Rotation alone is not enough: a retired key stays
published (25 hours for a user key; for a host key until you remove it), and everything it signed still works.

1. **Rotate immediately** (user key, or host key). The new key signs at once.
2. **Remove the old key.** This is the step that revokes it: the list now revokes the key itself, so servers drop it
   at their next fetch, about a minute, whether or not their CA file changed.
3. **Check a server**: `ssh-keygen -lf /etc/ssh/quisora_user_ca.pub` no longer shows the old fingerprint, and
   `ssh-keygen -Q -f /etc/ssh/quisora.krl <the old public key in a file>` prints `REVOKED`. Servers that do not run `fetch`
   need the new CA file by hand.
4. Everyone gets a new certificate: signing in again is enough.
5. For a host key, also re-sign the hosts with `host-sign` (and reload sshd) and refresh `known_hosts` on every client;
   clients that revoke host keys drop the old key at their next fetch.
6. Check the audit log for `ssh.cert.issue` with an unexpected user, and server logs for logins with a key id you do not
   know ([incident response](/docs/security/running-securely/#incident-response)).

**Rotate and remove ask for a recent re-authentication.** The console asks for the password or a passkey if you have not
confirmed it is you in the last 5 minutes. A [service account](/docs/automation/service-accounts/) with the `ssh` scope does not
need it. A personal API token cannot rotate or remove keys at all (`403`, field `reauth`): a stolen token could otherwise
cut off every server. Changing the settings needs no re-authentication.
