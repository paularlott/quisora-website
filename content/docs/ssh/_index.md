---
title: "SSH certificates"
linkTitle: "SSH certificates"
description: "Short-lived SSH certificates for people and servers, signed by a tenant's certificate authority."
weight: 150
---

Quisora can act as the SSH certificate authority of a tenant. People sign in to Quisora with a second factor and get a
short-lived OpenSSH certificate for their key. Servers trust the tenant's CA key instead of a list of user keys, and the
certificate's principals (the person's username, `group:<name>` for each of their groups, `role:<role>` for each
application role) decide who may log in as which Linux account. Access is managed in Quisora: remove someone from a
group, disable them or sign them out, and their certificates stop working within a minute or two, with no key to remove
from any server.

Quisora signs **user certificates** for people and, if you turn it on, **host certificates** for servers, so that
people's ssh clients trust a server without asking about its key. It never sees a private key: it signs the public key
it is given.

```
Workstation                              Quisora                                   Server (sshd)
  │ quisora ssh login ───────────────▶  │ sign in, second factor                         │
  │ ◀─── certificate: principals, 8 h   │                                                │
  │                                     │ ◀── quisora ssh fetch, every minute ────────── │
  │                                     │ ──▶ CA public keys, revocation list (KRL) ───▶ │
  │ ssh ubuntu@server (key + certificate) ─────────────────────────────────────────────▶ │
  │         sshd checks: CA trusted? not revoked? in date? a principal listed in principals/ubuntu?
```

The public addresses are under the organization's issuer, `https://id.example.com/o/<org id>`; a tenant's SSH address, the
**discovery URL** the commands start from, is `https://id.example.com/o/<org id>/ssh/<tenant id>`. Use the tenant's
**id** (the console and the account page show it that way): the tenant's name works in the address too, but a tenant
that is renamed no longer answers to its old name, and a server still fetching from it gets `404` and goes on with its
last copy of the files, which stops its revocations without any other sign than a failing fetch.

**What to know before you start.**

- A certificate is checked when someone connects. Revoking one, or ending a person's access, stops new logins within a
  minute or two ([Revocation](/docs/ssh/revocation/)); sessions already open stay open unless servers run `fetch` with
  `--end-revoked`, which ends them within the same minute or two ([Setting up an Ubuntu server](/docs/ssh/setting-up-an-ubuntu-server/), step 7).
- The revocation list must always be present on the server, or sshd refuses every public-key login
  ([Why the revocation list must always be there](/docs/ssh/setting-up-an-ubuntu-server/#why-the-revocation-list-must-always-be-there)).
- Quisora does not create Linux accounts. Each account people log in as must exist on the server
  ([Linux accounts](/docs/ssh/setting-up-an-ubuntu-server/#linux-accounts-must-exist)).
- Always match certificates to accounts with `AuthorizedPrincipalsFile`, never with sshd's default (the principal must
  equal the login name), and do not map privileged accounts such as `root` by username: people who can create or rename
  users decide what a username is ([Principals](/docs/ssh/turning-it-on-for-a-tenant/#principals)).
- A revoked or removed **host** certificate is refused only by clients that set `RevokedHostKeys`; sshd's `RevokedKeys`
  covers user logins only ([Host certificates](/docs/ssh/host-certificates/)).
- Certificates already issued go on working while Quisora is down, but nobody can get a new one. Keep a way into your
  servers that does not depend on Quisora ([If Quisora is not reachable](/docs/ssh/setting-up-an-ubuntu-server/#if-quisora-is-not-reachable)).
- Someone can start a device sign-in on their own machine and send a victim the code. If the victim enters it, the
  attacker gets a certificate with the victim's principals ([Risks](/docs/ssh/risks/)).

## In this guide

- [Turning it on for a tenant](/docs/ssh/turning-it-on-for-a-tenant/)
- [Setting up an Ubuntu server](/docs/ssh/setting-up-an-ubuntu-server/)
- [Signing in from a workstation](/docs/ssh/signing-in-from-a-workstation/)
- [The account page](/docs/ssh/the-account-page/)
- [Host certificates](/docs/ssh/host-certificates/)
- [Revocation](/docs/ssh/revocation/)
- [CA key rotation](/docs/ssh/ca-key-rotation/)
- [Managers and administrators](/docs/ssh/managers-and-administrators/)
- [Source addresses](/docs/ssh/source-addresses/)
- [Risks](/docs/ssh/risks/)
- [Backup and restore](/docs/ssh/backup-and-restore/)
- [Monitoring](/docs/ssh/monitoring/)
- [What is recorded](/docs/ssh/what-is-recorded/)
- [Rate limits](/docs/ssh/rate-limits/)
- [Troubleshooting](/docs/ssh/troubleshooting/)
- [Reference](/docs/ssh/reference/)
