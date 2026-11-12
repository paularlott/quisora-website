---
title: "Risks"
weight: 100
---

**Device-code phishing.** Someone can start `quisora ssh login --device` on their own machine and send a victim the code
("enter this code to verify your account"). If the victim enters it and allows, the attacker's machine is signed in as
them and gets a certificate for their principals, which here means a login on servers. Quisora makes this hard, as
described for [device sign-in](/docs/applications/device/): the device page and the consent screen warn about codes from someone
else, consent is always asked, codes last 10 minutes and work once, and a second factor is required. Managers and
administrators cannot be caught while **Managers and administrators may get certificates** is off. Tell people to enter
a code only if they started it themselves, and limit the damage with a short lifetime and
[source addresses](/docs/ssh/source-addresses/). If someone approved a code they were sent, revoke the certificate and sign the person out
everywhere ([incident response](/docs/security/running-securely/#incident-response)).

**Codes at the loopback address.** The browser sign-in sends its code to a port on `127.0.0.1` that the command
chooses, and any program on the machine can listen on a port there, another user's included. Someone who shares the
machine could send you a sign-in link that returns to their own port, and get a certificate for your principals from
it. So the browser sign-in always asks you to confirm, like the device sign-in: approve only a sign-in you have just
started with `quisora ssh login`.

**Where the private key is.** With the agent, the key is in the agent's memory and vanishes with the certificate. Anyone
who can reach the agent's socket as that user (or as root, or through a forwarded agent) can use the key while the
certificate is valid. With the file form, the private key stays on disk (`~/.ssh/quisora`, unencrypted, mode 0600, or
protected only by the profile's access control on Windows) long after the certificate has expired: the key is no use
without a certificate, but `logout` deletes it (it does not wipe the disk). For stronger protection use `--key` with a
passphrase-protected or security key.

**A certificate is valid until it expires.** There is no way to take back an open session or a certificate from a server
that has stopped fetching. Keep lifetimes as short as your people can stand (the default is 8 hours), and watch that
`quisora-ssh-fetch` keeps succeeding ([Monitoring](/docs/ssh/monitoring/)).

**The first fetch is trust on first use.** Compare the CA key's fingerprint with the console, as in the setup steps.

## Known limits

- Open sessions stay open on servers that do not run `fetch --end-revoked` (Linux with journald), and a host revocation
  reaches only clients that set `RevokedHostKeys` ([What revocation does not cover](/docs/ssh/revocation/#what-revocation-does-not-cover)).
- The SSH application uses ordinary bearer access tokens, not DPoP-bound ones. An access token that leaks in the minutes
  it lives (10 by default, `tokens.access_ttl`) can be used to ask for a certificate for another key, if the
  sign-in behind it is still within **Sign-in age**.
- CA key rotation is not atomic across nodes: a rare race can leave an extra published key, which you remove.
- An emailed one-time code counts as a second factor. Limit the tenant's sign-in methods if that is too weak.
- Certificates already issued outlast a Quisora outage, but no new one can be signed during it.
- A restore from a backup can undo revocations and bring back a removed CA key ([Backup and restore](/docs/ssh/backup-and-restore/)).
