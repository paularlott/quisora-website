---
title: "Troubleshooting"
weight: 150
---

## Reading sshd's log

sshd's log is `/var/log/auth.log` (or `journalctl -u ssh`, `-u sshd` on RHEL and Fedora). Set `LogLevel VERBOSE` in
`sshd_config` to get the certificate on every line. A certificate that is accepted:

```
sshd[2210]: Accepted publickey for ubuntu from 203.0.113.7 port 51022 ssh2: ED25519-CERT SHA256:Fy3… ID alice@acme/<user id> (serial 8123456789012345678) CA ED25519 SHA256:Hq7…
```

`ID` is the certificate's key id, `<username>@<org name>/<user id>` (for a host certificate, `host:<name>@<org name>`),
`serial` is its serial, and the `CA` fingerprint is the one in the console's **CA keys** table. Find the certificate in the
console's **Certificates** table (the tenant's SSH page) by serial to see its principals, expiry and status.

## What went wrong

| In sshd's log, or what you see | Cause | What to do |
| --- | --- | --- |
| `Certificate does not contain an authorized principal` | None of the certificate's principals is a line of `/etc/ssh/principals/<account>`. | Look at the principals the person got (`quisora ssh status`, or the console) and the file. A group principal needs its prefix (`group:ops`, not `ops`). A principal source may be off, or a group name has a space or other character that is dropped. |
| `Failed publickey for …` with an `ID … (serial …) CA …` that is not Quisora's | The certificate is from another CA, or from a CA key that was removed. | Compare the `CA` fingerprint with the console, and run `fetch`. |
| `Authentication key … revoked by file /etc/ssh/quisora.krl` | The certificate, or the CA key that signed it, is on the revocation list. | The console's **Certificates** table gives the reason (a revoked CA key names the key's fingerprint, not a serial). The person gets a new one by signing in again, if they may. |
| `Error checking authentication key … in revoked keys file` | `/etc/ssh/quisora.krl` is missing or unreadable. | [Why the revocation list must always be there](/docs/ssh/setting-up-an-ubuntu-server/#why-the-revocation-list-must-always-be-there): run `fetch`; check the timer. |
| From `ssh`: `Error checking host key … in revoked keys file` | The client's `RevokedHostKeys` file is missing or unreadable: every connection is refused. | Run the client's fetch; or take the `RevokedHostKeys` line out until the file is there. |
| `Certificate invalid: expired` | The certificate's lifetime is over. | `quisora ssh login` again. |
| `Certificate invalid: not yet valid` | The server's clock is behind. Certificates are valid from 5 minutes before they are signed, so skew beyond that shows. | Fix NTP on the server (and on the workstation, if it is ahead). |
| Nothing but `Permission denied (publickey)`, and no certificate in sshd's log | The client did not offer it: no agent, or `IdentitiesOnly` with nothing it can offer, or too many keys offered first (`Too many authentication failures`), or the agent dropped the expired key. | `ssh -v`; `quisora ssh status`; see [ssh_config](/docs/ssh/signing-in-from-a-workstation/#ssh_config). |
| `User … not allowed because …`, or the account does not exist | The Linux account is missing or locked. | [Linux accounts must exist](/docs/ssh/setting-up-an-ubuntu-server/#linux-accounts-must-exist). |
| `quisora ssh fetch` exits 1: `user CA keys: …` or `revocation list: …` | Quisora cannot be reached, or the answer is not valid. Nothing was changed. | Run it by hand to see the message; check the discovery URL. |
| `revocation list: it has no section for any of the CA keys the tenant publishes: is this the right tenant?` (from `fetch`) | The list is another tenant's (or a proxy answered with another tenant's list). Nothing was changed. | Check the URL. |
| `revocation list: ssh-keygen cannot read it, so sshd would refuse it: …` (from `fetch`) | OpenSSH's own parser rejected the file. Nothing was changed. | Run `ssh-keygen -Q -l -f` on a copy from the address; report it. |
| `note: the server's revocation list (version …) is older than the one in … (version …) and revokes nothing more: keeping the installed one` (from `fetch`) | A node answered with a list it made before the one installed, with nothing more revoked in it. Exit code 0; the other files were updated. | Nothing, unless it repeats. |
| `warning: SSH certificates are turned off for …` (from `fetch`) | SSH is off for the tenant: the files are still written, and the revocation list revokes every certificate and CA key. | Turn SSH on if that is not what you meant. |
| `SSH certificates are turned off for the tenant …` (from `login` or `host-sign`) | The same. | Ask the tenant's administrators. |
| `discovery: nothing at …: the URL is wrong, or SSH was never enabled for the tenant` | The address, or SSH was never on, or the tenant was renamed (a name in the URL) or deleted. | Copy the discovery URL from the console; use the tenant's id. |
| `a second factor is required: sign in with a one-time code or a passkey` | The sign-in was a password only. | Sign in with a second factor. |
| `the sign-in is too old to get a certificate: sign in again` | The sign-in is older than **Sign-in age**. | Sign in again. |
| `the sign-in this request comes from has ended: sign in again` | The session or grant behind the request was signed out everywhere, reset or signed out by an emergency sign-out since it began (`session_ended`). | Run `quisora ssh login` again. |
| `this tenant's SSH application is disabled or missing` | The SSH application was disabled or deleted (`app_unavailable`). | Enable it, or wait: while SSH is on, Quisora makes a new one within a minute (with a new client id: check access entries limited to the old one). |
| `this account has no access to this tenant's SSH` | The tenant is members-only and the person, or one of their groups, is not on its access list for the SSH application. | Add them under **Access**. |
| `managers and administrators cannot get SSH certificates from this tenant` | `allow_privileged` is off. | [Managers and administrators](/docs/ssh/managers-and-administrators/). |
| `there is no principal to put in a certificate for this account` | The principal sources that are on give this person nothing (no roles, groups without a valid name). | Turn **Username** or **Names of the user's groups** on. |
| `you have 100 certificates for this tenant that have not expired, the most it allows …` | 100 certificates that have not expired, revoked ones included (`too_many`). | Wait until the first expires (the message says when); revoking does not help. |
| `"x" is not one of yours; you may use …` | `--principal` named a principal the person does not get, or without its prefix (`ops` for `group:ops`). | Leave `--principal` out, or use one listed. |
| `this access token is not for the tenant's SSH application` | A token from another application was used. | Use `quisora ssh login`, which uses the right one. |
| `timed out after 5m0s waiting for the sign-in` | The browser did not come back to the command in 5 minutes: it is not on this machine, or it was not finished. | Use `--device` on a machine whose browser is elsewhere. |
| `the sign-in expired before it was approved: start again` (from `--device`) | The code was not approved in its 10 minutes. | Run it again. |
| `warning: the token endpoint did not answer (…): trying again until the code expires` (from `--device`) | The network, a proxy or the server did not answer; the command keeps asking until the code expires. | Nothing, unless it does not end. |
| `warning: no ssh-agent: …: writing the key to a file instead` | `SSH_AUTH_SOCK` is not set or the agent does not answer. | `eval "$(ssh-agent)"` and log in again, or use the file. |
| `warning: ssh-agent did not take the key (…): writing the key to a file instead` | The agent is locked, or does not accept imported keys (1Password, Secretive). | Unlock it, or use the file: `ssh -i ~/.ssh/quisora/<org>-<tenant>`. |
| `too many requests: wait a moment and try again` | The rate limit. | Wait a minute; for `fetch` see [Servers behind one address](/docs/ssh/setting-up-an-ubuntu-server/#servers-behind-one-address). |
| `certificate request: the server's certificate is not valid: …` (from `login`), or the same with `host certificate request:` | The sign endpoint answered, but the certificate in the answer does not parse as an SSH certificate. It is not about TLS: something between you and Quisora (a proxy, a captive portal) changed the answer, or the server is not a Quisora of this version. | Run it again; try without the proxy; report it with the answer. |
| `the server signed a different key than the one sent`, `the server did not return a certificate`, `the server returned a certificate of the wrong type` | The answer was not the certificate that was asked for. | As above. |
| `discovery: Get "…": … x509: …` or another TLS error | Quisora's TLS certificate is not trusted here. | `--ca-cert <pem>` for a private CA. |
| `token request: … (tried client_secret_post, then client_secret_basic)` (from `host-sign`) | The service account's id or secret is wrong, or it authenticates another way (a private key). | Check the id and secret; use `--token` for a private-key account. |
| `--ttl "…": give a whole number of days …` (from `host-sign`) | Not a number of days of at least 1. | `--ttl 30`, `--ttl 30d`. |
