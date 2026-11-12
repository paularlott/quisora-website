---
title: "The account page"
weight: 40
---

People who cannot install `quisora` can get a certificate from their account page, `/o/<org id>/account` → **SSH
certificates**. The section is shown only when a tenant with SSH on is open to them. It lists those tenants, the
principals the person would get and how long a certificate lasts, with the `quisora ssh login …` command to **Copy**.

A tenant that is open to them but would refuse them a certificate is listed under **Where you cannot get one**, with
why, rather than left out: a manager or administrator where **Managers and administrators** is off (*This tenant
gives no certificates to managers and administrators*), a session that signed in a way the tenant's sign-in rules do
not allow, or settings that give the person no principal. **Get a certificate** is off when no tenant is left to use.
A tenant the person has no access to is never named.

**Get a certificate** opens a form: the **Tenant** (when there is more than one) and the **Public key**, pasted from
`~/.ssh/id_ed25519.pub`. **Get certificate** shows the certificate, to **Copy** or **Download** as `id_ed25519-cert.pub`
(named for the key type). Save it next to the private key as that name and `ssh` uses it by itself, or run `ssh-add`
on the key. Never paste a private key.

It needs a second factor in the session (otherwise the page says *You signed in with a password only. To get a
certificate, sign out and sign in again with a one-time code or a passkey.*) and a confirmation that it is you within the
last 5 minutes (the page asks for the password or a passkey, as for an API token). The tenant's **Sign-in age** counts
from the later of the sign-in and a confirmation that used a second factor (an authenticator code or a passkey): an
account with no second factor of its own, whose second factor came from its sign-in through a provider, confirms with
the password alone, which lets the page go on but does not make an old sign-in count as new. The tenant's sign-in
methods apply as they do to the sign endpoint: a session that signed in with a method the tenant does not allow (say a
password, where the tenant allows only passkeys) is listed as one it cannot use and is refused (*this tenant does not
accept the way you signed in*). Requests share the [rate limits](/docs/ssh/rate-limits/) of the sign endpoint.

**Your certificates** lists the ones still valid, with their principals, expiry and status. The trash button is
**Revoke**: it revokes the person's own certificate, and they can get another at once (up to 60 revocations a minute for
each person: *Too many certificates revoked. Wait a minute and try again.*). A revoked or no longer valid certificate
shows why. Administrators revoke other people's from the console or the API: from the tenant's SSH page (the
**Certificates** table), or from the user's own page, whose **SSH certificates** card lists the certificates the user holds
that have not expired, across the tenants, with a **Revoke** button for each live one. Only administrators of the
organization (and super admins) see that card; managers do not. A person may have 100 certificates for a
tenant that have not expired, **revoked ones included**, since each stays on the revocation list until it expires:
past that a request is refused (*you have 100 certificates for this tenant that have not expired, the most it allows
(revoked ones count until they expire): wait until the first expires, at …*, audited as `too_many`), and revoking does
not make room.
