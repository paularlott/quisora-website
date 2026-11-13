---
title: "Turning it on"
description: "Turn on SSH certificates for a tenant and choose who gets them."
weight: 10
---

In the console, open the organization, then **Tenants**, the tenant, and **Manage SSH certificates**. Turn on **Enable
SSH certificates**.

{{< screenshot name="ssh-page" alt="The SSH certificates page of a tenant, with SSH turned on and its settings" >}}

The first time, Quisora makes the tenant's CA key and an application called **SSH**, which people sign in through.
Leave that application alone: to stop certificates, turn SSH off instead.

## Who can get a certificate

Anyone who may use the tenant's applications. On a members-only tenant, that is the people and groups on its access
list. To keep SSH to your operations team, give only that group access to the SSH application.

On top of that, a person needs:

- a sign-in with a second factor (an authenticator app, an emailed code, or a passkey), no older than the **Sign-in age**
  setting;
- an account that is not disabled, locked out or past its end date;
- at least one principal (below);
- a modern key: ed25519, ECDSA, RSA of 2048 bits or more, or a security key.

Managers and administrators are refused by default, so taking over an admin account does not give a login on every
server. **Managers and administrators may get certificates** changes that.

If emailed codes are too weak a second factor for your servers, limit the tenant's
[sign-in methods](/docs/sign-in/#ways-to-sign-in), for example to passkeys only. That applies to sign-ins from then
on. An SSH client that is already signed in can still get certificates until its access token expires (10 minutes by
default), so sign the tenant's users out too if that matters.

## The settings

**Edit SSH settings** opens them.

{{< screenshot name="ssh-settings" alt="The SSH settings dialog: certificate lifetime, sign-in age, principals and what a session may use" class="max-w-2xl" >}}

| Setting | Default | What it does |
| --- | --- | --- |
| **Certificate lifetime** | 8 hours | How long a certificate lasts, 5 minutes to 24 hours. People may ask for less. |
| **Sign-in age** | 1 hour | How recent the sign-in must be to get a certificate. |
| **Principals** | Username and groups | What goes in the certificate for servers to check. At least one must be on. |
| **What a session may use** | Terminal and `~/.ssh/rc` | Port, agent and X11 forwarding are off unless you turn them on. |
| **Source addresses** | None | Addresses or ranges, such as your VPN, that certificates work from. |
| **Managers and administrators may get certificates** | Off | See above. |
| **Rotate the user CA key every** | By hand only | See [Revoking and rotating](/docs/ssh/revoking-and-rotating/#rotating-the-ca-key). |
| **Sign host certificates** | Off | See [Host certificates](/docs/ssh/host-certificates/). |

Tightening a setting also applies to certificates already issued: a shorter lifetime, a forwarding turned off or new
source addresses revoke the certificates that no longer fit, and people sign in again for a new one. Loosening a
setting only changes new certificates.

## Principals

A certificate's principals decide which Linux accounts its holder may log in as. Each server lists, per account, the
principals allowed in.

| Setting | Principal | Example |
| --- | --- | --- |
| Username | the username | `alice` |
| Names of the user's groups | `group:` and the group name | `group:ops` |
| Application roles | `role:` and the role | `role:deploy` |

Names may hold letters, digits, `.`, `_`, `@` and `-`. A group called `Site Reliability` (with a space) gives no
principal.

{{< tip "warning" >}}
**Use groups for shared and privileged accounts.** Managers can create and rename users, so anyone who can name a user
`root` could match a username principal. Map `root`, `ubuntu` and other powerful accounts to a `group:` principal, and
keep those groups small.
{{< /tip >}}

Removing someone from a group, or renaming them, revokes the certificates that carry the old principals.

## Turning it off

Turning SSH off revokes every certificate of the tenant, user and host certificates alike. Servers drop them at their
next fetch. Turning it on again brings back the ones that were not revoked for another reason.

To delete a tenant that uses SSH:

1. Turn SSH off. A tenant can't be deleted while SSH is on.
2. Wait a few minutes, until your servers have fetched the list that revokes everything.
3. Delete the tenant.
4. On each server, remove the three sshd lines first, reload sshd, then remove the fetch timer and the files. sshd
   refuses every login if `RevokedKeys` names a file that is gone.
