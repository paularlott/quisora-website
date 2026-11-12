---
title: "Troubleshooting"
description: "What sshd's log and Quisora's messages mean, and what to do."
weight: 60
---

## Reading sshd's log

sshd logs to `/var/log/auth.log`, or `journalctl -u ssh` (`-u sshd` on RHEL and Fedora). With `LogLevel VERBOSE` in
`sshd_config`, each login names the certificate:

```
Accepted publickey for ubuntu from 203.0.113.7 port 51022 ssh2: ED25519-CERT SHA256:Fy3… ID alice@acme/<user id> (serial 8123456789012345678) CA ED25519 SHA256:Hq7…
```

`ID` names the person. Search for the `serial` in the tenant's **Certificates** table to see the certificate.

## On the server

| sshd says | What to do |
| --- | --- |
| `Certificate does not contain an authorized principal` | None of the person's principals is in `/etc/ssh/principals/<account>`. Check both. A group needs its prefix: `group:ops`, not `ops`. |
| `Authentication key … revoked by file` | The certificate is revoked. The **Certificates** table says why. The person signs in again if they still have access. |
| `Error checking authentication key … in revoked keys file` | `/etc/ssh/quisora.krl` is missing. Run `quisora ssh fetch` and check the timer. |
| `Certificate invalid: expired` | Run `quisora ssh login` again. |
| `Certificate invalid: not yet valid` | The server's clock is behind. Fix its time sync. |
| `User … not allowed`, or no such user | The Linux account is missing or locked. |
| Only `Permission denied (publickey)` | The certificate wasn't offered. Try `ssh -v` and `quisora ssh status`, and see [If you have many keys](/docs/ssh/getting-a-certificate/#if-you-have-many-keys). |

## From `quisora ssh`

| Message | What to do |
| --- | --- |
| `a second factor is required` | Sign in with an authenticator code or a passkey. |
| `the sign-in is too old` | Sign in again. |
| `this account has no access to this tenant's SSH` | Add the person, or their group, to the tenant's access list. |
| `managers and administrators cannot get SSH certificates from this tenant` | Turn on **Managers and administrators may get certificates**, or use a non-admin account. |
| `there is no principal to put in a certificate` | Turn on **Username** or **Names of the user's groups**. A group name with a space gives no principal. |
| `you have 100 certificates for this tenant that have not expired` | Wait for the first to expire (the message says when). Revoked ones count too. |
| `SSH certificates are turned off for the tenant` | Ask the tenant's administrators. |
| `discovery: nothing at …` | The address is wrong. Copy it from the console. |
| `timed out … waiting for the sign-in` | The browser isn't on this machine. Use `--device`. |
| `warning: ssh-agent did not take the key` | The agent is locked, or doesn't accept imported keys. Use the file it wrote instead. |
| `too many requests` | Wait a minute. |
| A TLS or `x509` error | Quisora's certificate isn't trusted here. Add `--ca-cert <file>` for a private CA. |

`quisora ssh fetch` exits with an error and changes nothing when Quisora can't be reached or the answer isn't valid.
Run it by hand to see the message.
