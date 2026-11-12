---
title: "Revoking and rotating"
description: "How certificates stop working, and how to change the CA key."
weight: 50
---

## What revokes a certificate

You rarely need to revoke by hand. A certificate goes on the tenant's revocation list by itself when its holder:

- is disabled, locked out, deleted or past their end date;
- is signed out everywhere, resets their credentials, or is caught by an [emergency sign-out](/docs/security/emergency-sign-out/);
- loses access to the tenant, or a group or role it names;
- is renamed, or their group is;
- had the sign-in it came from ended by an administrator or from another session.

It is also revoked when you tighten the tenant's settings, or turn SSH off.

Signing out of the browser does **not** revoke a certificate. It lasts until it expires, like the tokens that session
gave out.

## By hand

The **Certificates** table on the tenant's SSH page lists the certificates issued, with a search and a filter for
active, revoked and expired ones. **Revoke** takes one back. The user's own page in the console lists theirs too, and
people can revoke their own on their account page.

{{< screenshot name="ssh-certs" alt="The Certificates table of a tenant's SSH page, with a host certificate and user certificates" class="max-w-3xl" >}}

To cut someone off from everything at once, [lock them out](/docs/security/emergency-sign-out/#locking-out-one-person).

## How soon

Servers that fetch every minute refuse a revoked certificate within about two minutes. That stops new logins. Open
sessions close at the same time only on servers that run `fetch --end-revoked`
([Ending open sessions](/docs/ssh/setting-up-a-server/#ending-open-sessions)).

A server that stops fetching keeps its old list, so [watch the fetch](/docs/ssh/setting-up-a-server/#watch-it).

## Rotating the CA key

The **CA keys** table on the tenant's SSH page shows each key and its state: **Signing**, **Next** (published, not
signing yet) or **Retired**.

**Rotate user key** offers two choices:

- **In seven days.** The new key is published now and starts signing in a week, so every server has it first. The old
  key stays trusted for another 25 hours after that, to cover the certificates it signed. This is the normal choice.
  **Rotate the user CA key every** in the settings does it on a schedule.
- **Immediately.** The new key signs now. Servers refuse new certificates until their next fetch.

A new host key signs at once. The old one stays published until you remove it, so re-sign your hosts first.

Rotating and removing keys asks you to confirm it's you.

## If a CA key may be stolen

Anyone with the key can sign certificates for anyone, and those certificates are on no list. Rotating alone isn't
enough, because the old key stays trusted for a while. So:

1. **Rotate immediately.**
2. **Remove the old key** with the trash button on its row. The revocation list then revokes the key itself, and
   servers distrust everything it signed at their next fetch.
3. Have everyone sign in again for a new certificate. For a host key, re-sign your hosts.
4. Look in the audit log for certificates issued to people you don't expect, and in sshd's logs for logins you don't
   recognise.

## After restoring a backup

A backup holds the CA keys and certificate records as they were. Restoring an older one brings back keys removed since
and undoes revocations made since. So after a restore, for each tenant that uses SSH:

1. Rotate the CA keys immediately.
2. Remove every key that was published before the restore.
3. Revoke again what was revoked since the backup, and check access lists and groups.
4. Have everyone sign in again, and re-sign your hosts.

## In the audit log

| Event | When |
| --- | --- |
| `ssh.cert.issue` | A user certificate was issued, with its principals and serial. |
| `ssh.cert.refused` | A certificate was refused, with the reason. |
| `ssh.cert.revoke` | A certificate was revoked, by hand or because its holder lost access. |
| `ssh.host.issue`, `ssh.host.refused` | A host certificate was issued or refused. |
| `ssh.settings.update` | The tenant's SSH settings changed. |
| `ssh.ca.create`, `ssh.ca.rotate`, `ssh.ca.remove` | A CA key was made, rotated or removed. |

Logins to servers are not in Quisora's log. They are in sshd's, which names the certificate by its key id and serial.
