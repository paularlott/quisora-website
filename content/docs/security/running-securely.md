---
title: "Running Quisora securely"
description: "What Quisora protects, what you must provide, a hardening checklist and what to do in an incident."
weight: 10
---

## Hardening checklist

Before production:

1. **Master key** (`server.master_key`): read it from [Vault or 1Password](/docs/security/secret-stores/) with read
   access to Quisora's items only, else from an environment variable or a config file only Quisora's user can read.
   Never on the command line or in the data directory, and kept apart from the data and the backups.
   [Rotate it](/docs/running/rotating-the-master-key/) on a schedule.
2. **TLS**: a real certificate. Behind a load balancer, set `server.trust_proxy` to its addresses and no wider, and
   make each proxy append the address it received the connection from to `X-Forwarded-For` (nginx's
   `$proxy_add_x_forwarded_for`, HAProxy's `option forwardfor`) instead of passing the header on. Otherwise a client
   can name any address it likes, and the rate limits and the audit log's addresses are wrong.
3. **Database**: verified TLS (no start-up warning about it) and encryption at rest
   ([Encryption at rest](/docs/running/storage/#encryption-at-rest)).
4. **Cluster**: `cluster.key` from a secret store, and the gossip port (7946) reachable by the other nodes only. With
   BadgerDB, keep `storage.badgerdb.sync_writes = true` (the default; a gossip node refuses to start without it).
5. **Audit**: send audit events to VictoriaLogs. Every production deployment needs it, and each start without it logs
   a warning. Each node keeps a spool in its data directory, so give it room. Keep logs for your audit period, let
   nobody delete from them, ship the structured log too, and alert on `audit.undelivered`
   ([Audit log](/docs/running/audit-log/)).
6. **Monitoring**: set `metrics.token` and put the [suggested alerts](/docs/running/monitoring/#metrics)
   in place.
7. **Backups**: on a schedule, encrypted (the default), the password kept apart from them, and a restore tested
   regularly.
8. **People**: as few super admins as possible, and every administrator with a passkey or authenticator app. Keep API
   token lifetimes short (`tokens.api_token_max_days`, 365 by default). Leave the organization setting for who may
   make `api` tokens off, or limit it to the groups that need them. Leave
   [Quisora's own MCP server](/docs/automation/mcp/#quisoras-own-mcp-server) off unless AI assistants are to manage
   users (or turn it off for the whole server with `--disable-mcp`), and review its approved clients under
   **Self-registered apps**. Review access regularly from the user lists.
9. **Mail**: set `mail.tls` to `starttls` or `tls`. Leave codes by email as a second factor off (the default) unless
   the mailboxes are as well protected as the passwords.
10. **SSH certificates** (if you use them): `AuthorizedPrincipalsFile` on every server with `group:` principals for
    privileged accounts, the fetch timer (with `--end-revoked` on Linux) alerting on failure and on a revocation list
    older than 5 minutes, a break-glass login that does not depend on Quisora, host certificates of a few weeks with
    `RevokedHostKeys` on the clients, and the CA key fingerprints checked against the console on first use
    ([SSH certificates](/docs/ssh/)).

{{< tip "warning" >}}
Profile pictures are public to anyone who has their URL: applications show them on their own pages without signing
in. A picture lives only while it is the user's current one. An organization that wants none can turn pictures off,
and a server can start with `--disable-pictures`.
{{< /tip >}}

## What Quisora protects against

Quisora is built to withstand attackers on the internet (with no credentials, or with a user's own), users of one
organization trying to reach another, applications trying to exceed what they were granted, and someone who gets a
copy of the database or a backup. It does not defend against someone who controls a node's host, its memory or its
configuration: whoever can run the commands on a server is fully trusted.

What you provide around it:

- a real TLS certificate (or a TLS proxy), and `server.trust_proxy` set when you run behind a load balancer;
- least-privilege applications: only the scopes and tenants they need;
- few super admins, and reviewed access;
- encryption at rest for the storage, and verified TLS to a database server;
- the master key and cluster key kept like the secrets they are;
- control of who can log in to the hosts and read the configuration.

Passwords must be at least the organization's shortest length, else 15 characters, and are refused when they are
common words, keyboard runs, repeated patterns or built on the person's name, email or organization. These are offline
checks. There is no breached-password list.

## Incident response

Every step below leaves a record in the audit log. Search it (the console's audit page, or VictoriaLogs) by target,
actor or action.

### Everyone must be signed out now

An attacker may hold sessions or tokens and you do not know whose. Pull the [emergency
sign-out](/docs/security/emergency-sign-out/): the organization's **Overview** page, or **System overview** for every
organization. If the console cannot be used, run `quisora sign-out --org <name>` or `--all` on a server with the master
key.

- [ ] Choose **End personal API tokens too** if scripts may be involved.
- [ ] Rotate the secrets of applications acting for themselves (client credentials): sign-out does not end them.
      Disable a client to end the tokens it holds.
- [ ] Applications that verify access tokens themselves accept those already issued until they expire (10 minutes
      by default).

### An administrator's account may be compromised

- [ ] Lock it out: the user's page, **Lock out**. A manager's or administrator's account is locked out by a super
      admin.
- [ ] Review what it did: the audit log with that actor. Look for new administrators, clients or providers, changed
      organization settings, invitations and downloaded backups.
- [ ] If it was a super admin, also work through the master key and signing key steps below.

### A user's account may be compromised, or someone has left

- [ ] Lock it out, then (to let the right person back in) enable it and send a new invitation.
- [ ] Review the applications it consented to (`oauth.consent`, `oauth.grant`).

### A client secret leaked

- [ ] Rotate it on the application. The old one stops working at once.
- [ ] Disable the client if tokens may have been issued with it.

### Signing keys may be exposed

- [ ] On **System overview**, rotate the signing key, then **Remove** the old one. The new key signs at once and
      nobody is signed out. Without the removal, tokens signed by the old key keep working until they expire.

### SSH: a person's access must end, or a certificate may be stolen

- [ ] Lock the person out or disable them, sign them out everywhere, or revoke the certificate on the tenant's
      **SSH certificates** card. Servers refuse it when they next fetch the list, in a minute or two.
- [ ] End any session already open on a server. Signing out one session or revoking one grant is not enough.
- [ ] Look for `ssh.cert.issue` by that person in the audit log, and in sshd's log for the certificate's key id.

### SSH: a CA key may be exposed

- [ ] On the tenant's **SSH certificates** card, rotate the key immediately, then remove the old key. Rotating alone
      leaves the old key trusted. Removing it makes every server that fetches the list distrust it and everything
      it signed.
- [ ] Everyone signs in again for a new certificate.
- [ ] For a host key, re-sign the hosts and refresh the clients' `known_hosts`.
- [ ] See [revoking and rotating](/docs/ssh/revoking-and-rotating/#rotating-the-ca-key).

To stop a tenant's SSH access altogether, turn SSH off on the tenant (do not delete the SSH application). Delete the
tenant only after the servers have fetched the list.

### The master key may be exposed

Whoever has the key and a copy of the database or an older backup can open everything it sealed.

- [ ] [Rotate the master key](/docs/running/rotating-the-master-key/) and remove the old key as soon as the re-seal
      is done.
- [ ] Pull the emergency sign-out for every organization with personal API tokens:
      `quisora sign-out --all --api-tokens`.
- [ ] Rotate and remove the signing keys.
- [ ] Rotate and remove the SSH CA keys of every tenant that uses SSH.
- [ ] Rotate each sign-in provider's client secret, at the provider and then in Quisora.
- [ ] Have users with an authenticator app set it up again.

Backups made with the old key are exposed only if their passwords may be too. Keep the old key with those backups to
restore them.

### A backup or the database leaked

Password hashes and secrets are sealed with the master key, so without it they are of no use. If the key may have
leaked too, do everything under the master key above, and reset passwords if you cannot rule out offline guessing of
weak ones.

### `cluster.key` leaked

- [ ] Rotate it on every node while the cluster runs ([rotating the cluster key](/docs/running/clustering/#rotating-the-cluster-key))
      and finish the last round promptly.
- [ ] Check who could reach the gossip port.

### A user lost their authenticator app or passkey

With recovery codes they can sign in and set up a new factor. Without, an administrator uses **Remove authenticator
app** on the user's page (they keep their password), removes the lost passkey from its list, or sends an invitation
(which replaces every credential). A `login.recovery_code` the user did not make means someone has their password and
codes: lock the account out. Likewise a `login.email_code.sent` they did not ask for means someone has their password.

### A user approved a device sign-in they did not start

- [ ] Find `oauth.device.approve` and the `oauth.grant` after it, and revoke that grant (the user's **Applications**,
      or sign the user out everywhere).
- [ ] If it was for a tenant's SSH application, revoke the person's certificates too.

### Nobody can get into the console

The last super admin lost their password, authenticator and passkeys, or their account ended. You need a server's
configuration and the master key, not the console.

1. On a node (or any machine with its configuration and the master key), issue a break-glass invitation for a super
   admin of the primary organization:

   ```bash
   quisora invite primary admin@example.com --break-glass
   ```

   The command asks the running server at `server.public_url` (or `--server https://...`) to issue it. No sign-in or
   token is involved. `--ca-file` adds a certificate to trust, and `--insecure` skips the check.
2. It prints a single-use link, valid for 24 hours. Open it, set a password or passkey and enrol a second factor.
   It works even when the account is disabled and enables it again. Accepting it removes the account's old password,
   authenticator app and passkeys and ends its sessions and API tokens.
3. Check the audit log for `user.invite.break_glass` and the sign-ins after it. Then give a second person super admin.

If no super admin is left at all, add `--super-admin`:

```bash
quisora invite --break-glass --super-admin primary admin@example.com
```

The account becomes an enabled super admin at once. It needs `--break-glass` and a user in the primary organization.

Whoever runs these commands holds the master key, so keep the configuration and the key as protected as the
break-glass step they allow.

### Signs of an attack

Watch for bursts of `login.failure`, `login.limited`, `org.spray.start`, `oauth.client_auth.limited` and
`api.request.refused`, and any `apitoken.refused` with reason `wrong secret`, `oauth.refresh.reuse`,
`oauth.code.replay` or `passkey.clone`. The event names the target and the address. Reuse and replay have already
revoked the grant, and a cloned passkey has already been disabled.

- [ ] If the attack continues, add the address to `server.deny_networks` in every node's config and reload every node
      (SIGHUP, or **Reload configuration**). Block many addresses upstream, in a firewall or the proxy in front
      ([under attack](/docs/running/settings/#under-attack)).
- [ ] Follow the account steps above for the targets.
- [ ] Export the relevant audit events before their retention ends.

## Lockout and password spraying

A wrong password counts against the account. After the organization's lockout attempts (`limits.lockout_attempts`,
default 10) within its lockout time (`limits.lockout_minutes`, default 15), the account is refused until the time is
up. A successful sign-in gives its attempt back. An address with no account is locked the same way, so lockout does
not reveal which accounts exist. A browser that has signed in to the account before counts its own failures, so
someone locking the account does not lock out its owner's browsers. An organization can set its own numbers.

An organization is **under a password spray** when more than `limits.org_failures_per_minute` failed passwords (default
100, `0` turns it off) arrive in a minute. Until a lockout time has passed without such a minute, each address may fail
only as often as one account may, across the whole organization, and past that it is refused even with the right
password. One address can then lock at most one account per lockout time, and people at other addresses sign in as
usual. The audit log shows `org.spray.start` and `org.spray.end`. Block the addresses upstream, and tell people to
sign in from a browser they have used before or with a passkey. Raise the limit for an organization whose people
mistype more than 100 passwords a minute.
