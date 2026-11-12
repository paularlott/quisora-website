---
title: "Turning it on for a tenant"
weight: 10
---

In the console: the organization → **Tenants** → the tenant's **SSH** column (or the tenant → **Manage SSH certificates**) →
the tenant's SSH page (`/admin/orgs/<org>/tenants/<tenant>/ssh`) → **Enable SSH certificates**. The tenant page itself has
only a summary card that says whether SSH is on, and the **Tenants** list an **SSH** column (On or Off) that opens the page.
The first time, Quisora makes the tenant's user CA key (and a host CA key if host certificates are on) and an
application named **SSH**, which people sign in through to get certificates. It is a public, first-party client with the
authorization code and device sign-in grants, listed on the tenant's **Clients** page. It uses bearer access tokens, not
DPoP ([Known limits](/docs/ssh/risks/#known-limits)). Do not disable or delete it. While it is disabled or missing nobody can get a
certificate, and every certificate goes on the revocation list (reason `app_unavailable`) until it is back. While SSH is on,
Quisora's housekeeping makes a new application within a minute when it was deleted (saving the settings does it at once),
and the certificates count again: **deleting the application does not cut anyone off. To cut access, turn SSH off.**
**Edit SSH settings** changes the settings below.

Through the management API, with a [personal API token](/docs/automation/api-tokens/) that has the `admin` scope, or a
[service account](/docs/automation/service-accounts/) with the `ssh` scope. `{tenant}` is the tenant's name or id:

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled": true, "cert_ttl": 28800, "principal_groups": true}' \
  "$QUISORA/api/orgs/acme/tenants/prod/ssh"
```

Settings you leave out keep their values. The answer is the settings, the CA keys (`keys`, each with its `fingerprint`
and `state`) and the addresses people and servers use (`endpoints`: `discovery`, `ca_pub`, `known_hosts`, `krl`,
`host_sign`); `GET` on the same address shows them again. A setting out of range answers `422` with the field named,
such as `ssh.cert_ttl`.

While SSH is on, at least one of the three principal settings must be on (`422`, field `ssh.principal_username`).
The lists (`source_addresses`, `host_patterns`) hold at most 32 entries: a longer list is refused before it is read.

## Turning it off, and removing a tenant

Turning SSH off **revokes every certificate of the tenant**. Signing stops (`404` from the sign endpoint, and the
account page does not offer the tenant), and the discovery document answers `"enabled": false`, but the CA keys, the
known hosts and the revocation list stay published. The list then revokes every CA key of the tenant outright, which
revokes everything they signed, user and host certificates alike (sshd checks a certificate's CA key against the list
too, so a server whose CA file still names the keys distrusts them), and names the user certificates that have not
expired (reason `ssh_off`). Servers drop them when they next fetch the list, within the revocation delay
([How soon](/docs/ssh/revocation/#how-soon)). Servers that run `quisora ssh fetch` need no change. The CA keys are kept, and the tenant's
SSH application is disabled (by the system, `client.update` in the audit log), so no one can sign in to it either.
Turning SSH on again enables the application and makes the certificates valid again unless they were revoked otherwise
(a certificate revoked by hand, or because its user lost access, stays revoked). A tenant that never had SSH enabled
answers `404` everywhere.

Host certificates are revoked by the same list, but only clients that set `RevokedHostKeys` honour it
([Clients and host certificate revocation](/docs/ssh/host-certificates/#clients-and-host-certificate-revocation)).

A **tenant cannot be deleted while SSH is on** (`409`: turn SSH off first), and neither can an organization that has
such a tenant, with or without `cascade`. The order is:

1. Turn SSH off.
2. Wait until the servers have fetched the list that revokes everything: the fetch interval plus the list's 30 seconds
   in the cache, so a few minutes with the timer below. On a server, `ssh-keygen -Q -f /etc/ssh/quisora.krl
   /etc/ssh/quisora_user_ca.pub` prints `REVOKED` once it has. After the tenant is deleted there is no list left to
   fetch, and a server that had not fetched yet goes on trusting the CA keys it has until the certificates expire.
3. Delete the tenant. Its SSH application is deleted with it, by the system (`client.delete` in the audit log), and so is
   any other SSH application Quisora made for the tenant and no longer uses; any other application still blocks the
   deletion. Its CA keys and certificate records are removed in the background. If SSH is turned on again between the
   check and the deletion, the deletion fails (`409`, someone else changed it) rather than go ahead.
4. Take the tenant's set-up away: on every server remove the sshd drop-in (`TrustedUserCAKeys`, `RevokedKeys`,
   `AuthorizedPrincipalsFile`) and the fetch timer and service, then `sshd -t`, reload sshd, and delete the files;
   on every client remove the `RevokedHostKeys` and `GlobalKnownHostsFile` lines, then the host files. Take the
   configuration line out **before** the file it names: sshd and ssh refuse every login or connection when a
   `RevokedKeys` or `RevokedHostKeys` file is missing.

## Who may get a certificate

Anyone who could sign in to the tenant's applications: when the tenant is open to everyone in the organization,
everyone; when it is members-only, the people and groups on its access list whose entry covers the SSH application,
within their end dates. To keep SSH to the operations team on a members-only tenant, give only that group access (an
access entry can be limited to chosen applications, so the SSH application can be the only one it covers). An entry
limited that way names the application by its client id: **do not delete the SSH application** to stop certificates.
While SSH is on Quisora makes a new one within a minute (logged as a warning, and audited `client.create` by `system`
with the client id it `replaces`), which has a new client id: entries that named the old one do not cover it, so their
people lose access, and since a lost access is written down, their certificates stay revoked. Turn SSH off instead; to
give the new application to such entries, edit them. On top of that, a certificate is refused unless:

- the sign-in used a second factor (password and an authenticator app or an emailed one-time code, or a passkey that
  verified the user) and is no older than **Sign-in age**;
- the sign-in the request comes from has not ended: a session signed out everywhere, a credential reset or an emergency
  sign-out since it began refuses it (`session_ended`);
- the account is usable (not disabled, locked out, or past its end date);
- the tenant's SSH application is enabled (`app_unavailable`; Quisora disables it while SSH is off and enables it again
  with SSH);
- the person is not a manager or administrator, unless the tenant allows it ([Managers and administrators](/docs/ssh/managers-and-administrators/));
- there is at least one principal to put in it;
- the person has fewer than 100 user certificates for the tenant that have not expired, **revoked ones included**: a
  revoked certificate stays on the revocation list until it expires, so revoking does not make room (`too_many`: the
  refusal says when the first of them expires);
- the public key is an ed25519, ECDSA (P-256, P-384 or P-521) or RSA key of at least 2048 bits, or a security key
  (`sk-ssh-ed25519@openssh.com`, `sk-ecdsa-sha2-nistp256@openssh.com`). DSA keys, short RSA keys and keys that are
  already certificates are refused.

An emailed code is a second factor like the others here. Where that is too weak for your servers, limit the tenant's
sign-in methods ([sign-in](/docs/sign-in/#ways-to-sign-in)), for example to passkeys.

## The settings

In the console the lifetimes are in minutes; in the API they are in seconds.

| Console | API (`PATCH`) | Default | What it does |
| --- | --- | --- | --- |
| **Enable SSH certificates** | `enabled` | off | Off: no signing, and every certificate and CA key is revoked until it is on again ([turning it off](/docs/ssh/turning-it-on-for-a-tenant/#turning-it-off-and-removing-a-tenant)). |
| **Certificate lifetime** | `cert_ttl` | 28800 (8 hours) | 300 to 86400 seconds. People may ask for a shorter one. A certificate never outlasts the account's end date. |
| **Sign-in age** | `max_auth_age` | 3600 (1 hour) | 60 to 86400 seconds: how recent the sign-in must be when a certificate is asked for. |
| **Principals** → **Username** | `principal_username` | on | The user's username is a principal. At least one of the three must be on. |
| **Names of the user's groups** | `principal_groups` | on | `group:` and the name of each of the user's groups are principals, such as `group:ops`. |
| **Application roles** | `principal_roles` | off | `role:` and each role the tenant's access list gives the user are principals, such as `role:deploy` (a members-only tenant). |
| **What a session may use** → **Terminal (pty)** | `permit_pty` | on | The certificate's `permit-pty` extension. |
| **~/.ssh/rc** | `permit_user_rc` | on | `permit-user-rc`. |
| **Port forwarding** | `permit_port_forwarding` | off | `permit-port-forwarding`. |
| **Agent forwarding** | `permit_agent_forwarding` | off | `permit-agent-forwarding`. |
| **X11 forwarding** | `permit_x11_forwarding` | off | `permit-X11-forwarding`. |
| **Source addresses** | `source_addresses` | none | Addresses or CIDR ranges the certificate works from ([Source addresses](/docs/ssh/source-addresses/)). At most 32. |
| **Managers and administrators may get certificates** | `allow_privileged` | off | See [below](/docs/ssh/managers-and-administrators/). |
| **Rotate the user CA key every (days)** | `rotation_days` | 0 | 8 to 3650, or 0 to rotate by hand only ([CA key rotation](/docs/ssh/ca-key-rotation/)). |
| **Sign host certificates** | `host_certs` | off | Lets servers get host certificates. Needs `host_patterns`. |
| **Host certificate lifetime (days)** | `host_ttl_days` | 90 | 1 to 365. |
| **Host names allowed** | `host_patterns` | none | Patterns host names must match, such as `*.example.com` or `db1.internal`. At most 32. |

`client_id` in the answer is the SSH application's id; it is not set by hand.

**Tightening applies to certificates already issued; loosening does not.** A certificate that is still valid and
grants more than the settings would give now is put on the revocation list (reason `settings_changed`): one whose lifetime
is longer than **Certificate lifetime**, one with an extension that is no longer on, and, when source addresses are set,
one made with other addresses. People get a new certificate by signing in again. A longer lifetime, an extension turned
on, or source addresses removed change only the certificates made afterwards. The revocation follows the settings, so
putting the setting back brings those certificates back. Lowering the lifetime therefore revokes every live certificate
that was made with the longer one, within a minute or two.

## Principals

A user certificate carries the principals the settings give the person, sorted:

| Source | Setting | Principal | Example |
| --- | --- | --- | --- |
| The username | `principal_username` | the username as it is | `alice` |
| Each group the user is in | `principal_groups` | `group:` and the group's name | `group:ops` |
| Each application role the tenant's access list gives the user | `principal_roles` | `role:` and the role | `role:deploy` |

The name part (the username, the group's name, the role) is used only if it is 1 to 64 letters, digits, `.`, `_`, `@`
or `-`: a group called `Site Reliability` (with a space) gives no principal, and neither does a username with a `+` or
a non-ASCII letter. Names are case-sensitive. A person can ask for a subset, in the prefixed form
(`quisora ssh login --principal group:ops`).

**Why there are prefixes.** A username can never contain a colon, so no username can equal a `group:` or `role:`
principal. Managers can create and rename users. Had a group's principal been the bare name, a manager could have made
a user named `ops`, and that user would carry the principal that `/etc/ssh/principals/ubuntu` gives to the group. Now
the only way to carry `group:ops` is to be in the group `ops`.

**The username principal is only as strong as who may name users.** It equals the person's login name, and managers
(and administrators) can create and rename users. So:

- Always set `AuthorizedPrincipalsFile` (the [setup](/docs/ssh/setting-up-an-ubuntu-server/) does). Without it sshd accepts any
  certificate from a trusted CA that carries the login name as a principal, so a user named `root` or `ubuntu` would be
  let in as that account.
- Do not map privileged accounts by username: no `/etc/ssh/principals/root` that lists a username, and none for an
  account that can become root. Give them a `group:` principal, and keep the membership of such groups small and
  reviewed. Managers can add people to groups, which is the same as granting them every login the group's principal is
  listed for.
- Delete the Linux account of someone who leaves. A new user given the same username would otherwise reach it.

A certificate that cannot get any principal is refused. Turning a principal source off, or removing someone from a
group, is not ignored by certificates already issued: they are revoked if they carry a principal the person would not get
now ([Revocation](/docs/ssh/revocation/)), and so does renaming a user or a group. Adding someone to a group changes nothing until
they get a new certificate.
