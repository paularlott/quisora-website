---
title: "Emergency sign-out and lock-out"
description: "End every session at once, or lock out one person completely."
weight: 30
---

Two tools for when something has gone wrong:

- **Emergency sign-out** ends every session of an organization, or of every organization, at once, on every node. Use
  it when an attacker may hold sessions or tokens and you do not know whose.
- **Lock out** does the same for one person and also removes every way they had to sign in. Use it for a compromised
  account, or someone who has left.

What to do around them is in the [incident response](/docs/security/running-securely/#incident-response).

## Emergency sign-out

### In the console

- **One organization**: open its **Overview** page and choose **Sign everyone out...**. Its administrators and super
  admins can do this (for the primary organization, super admins only).
- **Every organization**: **System overview**, the same button (super admins).

{{< screenshot name="sec-org-signout" alt="The Sign everyone out dialog, asking for a reason and a typed confirmation" class="max-w-2xl" >}}

The dialog asks for a **Reason**, which is recorded in the audit log, and whether to **End personal API tokens too**.
You then type the organization's name (or `everyone`) to confirm. If you have not signed in or confirmed it is you in
the last 5 minutes, it asks for that first. This cannot be done with an API token, so a stolen token cannot lock
everyone out.

### From the command line

For when the console cannot be used. It needs the master key and the same settings as `serve`:

```bash
quisora sign-out --org acme --reason "Suspected session theft"
quisora sign-out --all --reason "Suspected session theft" --api-tokens
```

It asks you to type the organization's name (or `everyone`) unless given `--yes`.

- **Shared database** (PostgreSQL, MySQL, MariaDB): it writes to the database and the servers follow within seconds.
- **BadgerDB or SQLite on one node**: it asks the running server at `server.public_url` (or `--server`). With the
  server stopped, it writes to the store itself.
- **Gossip cluster**: it always asks a running node, so a majority of the nodes must be running.

`--ca-file` adds certificates to trust for the server, and `--insecure` skips the check. The audit log records the
command as `command:sign-out`.

### What ends, and what does not

Ended at once, on every node:

- every browser session of the organizations affected (your own session stays);
- every refresh grant, so applications cannot get new tokens, and access tokens issued from them stop working at
  userinfo and introspection;
- with the option, every personal API token, for good.

[SSH certificates](/docs/ssh/revoking-and-rotating/) the tenants issued go on their revocation lists within 30
seconds. A server refuses them when it next fetches the list (a minute or two), and a session already open stays open
unless the server runs `fetch --end-revoked`. Host certificates are not affected.

Applications are told through back-channel logout. People can sign in again straight away: nothing about their
accounts changes.

Not ended:

- tokens of applications acting for themselves ([client credentials](/docs/applications/service-to-service/#client-credentials-an-app-acting-as-itself)): rotate
  the client's secret or disable the client;
- access tokens already held by applications that verify them themselves, until they expire (`tokens.access_ttl`, 10
  minutes by default). Shorten that setting if the window matters to you.

It is audited as `org.signout` (one organization) or `server.signout` (all), with the reason and counts.

{{< tip "warning" >}}
Restoring a backup made before a sign-out brings back what it ended. Sign everyone out again after restoring one
([Backup and restore](/docs/running/backup-and-restore/)).
{{< /tip >}}

In a gossip cluster the sign-out needs a majority of the nodes: with fewer up, it is refused and nothing is half done.
A node cut off from the majority serves nothing until it rejoins and learns of the sign-out.

## Locking out one person

On the user's page in the console, choose **Lock out...** and give a reason. It disables the account and, at once:

- signs them out everywhere, ends their refresh grants and forgets the consent they gave applications;
- removes every way they had to sign in: password, authenticator app, passkeys, recovery codes, linked providers;
- removes their personal API tokens and any unused invitation, reset and verification links;
- puts their [SSH certificates](/docs/ssh/revoking-and-rotating/) on the revocation list (a session already open
  stays open).

The account stays, for the audit log. Enabling it again brings none of that back: send a **New invitation link** so
they can set up their sign-in again. It is audited as `user.locked_out`. You cannot lock yourself out, and locking out
a manager or administrator is a super admin's change.
