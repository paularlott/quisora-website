---
title: "Setting up an Ubuntu server"
weight: 20
---

Nothing is needed beyond `openssh-server` (already there on Ubuntu Server), and the `quisora` binary or `curl`. Nothing
on the server needs Quisora's configuration or its master key: the server only reads three public addresses. The steps
are for Debian and Ubuntu; [other distributions](/docs/ssh/setting-up-an-ubuntu-server/#other-distributions) differ in two names.

Take the discovery URL from the console (the tenant's SSH page has a **Set up servers and people** section with these
commands, the URL filled in) or from `endpoints.discovery` in the API:

```bash
export URL=https://id.example.com/o/<org id>/ssh/<tenant id>
```

**1. Install the binary.** Copy `quisora` (built with `task build`, a single static file) to the server:

```bash
sudo install -m 0755 quisora /usr/local/bin/quisora
```

No binary? `curl` does the same job, with fewer checks: [see the end of this section](/docs/ssh/setting-up-an-ubuntu-server/#without-the-quisora-binary).

**2. Fetch the CA key and the revocation list once, by hand.**

```bash
sudo quisora ssh fetch "$URL"
# updated /etc/ssh/quisora_user_ca.pub (user CA keys)
# updated /etc/ssh/quisora.krl (revocation list)
```

**3. Check the CA key's fingerprint against the console.** This is the one moment the server trusts what it is
given, so compare it out of band: the fingerprint in the **CA keys** table of the tenant's SSH page (or `keys[].fingerprint` from the
API) must be the one on the server.

```bash
ssh-keygen -lf /etc/ssh/quisora_user_ca.pub
# 256 SHA256:Hq7… quisora:acme/prod:user:<key id> (ED25519)
```

If the tenant is mid-rotation the file holds more than one key, one line each.

**4. Tell sshd to trust it.** Ubuntu's `sshd_config` includes `/etc/ssh/sshd_config.d/*.conf`, so a drop-in leaves the
main file alone. `/etc/ssh/sshd_config.d/50-quisora.conf`:

```
TrustedUserCAKeys /etc/ssh/quisora_user_ca.pub
RevokedKeys /etc/ssh/quisora.krl
AuthorizedPrincipalsFile /etc/ssh/principals/%u
```

`AuthorizedPrincipalsFile` is how a certificate is matched to a Linux account: sshd logs the person in as `<account>`
only if one of the certificate's principals is a line of `/etc/ssh/principals/<account>`. An account with no such file
cannot be logged in to with a certificate. It does not affect keys in `authorized_keys`, which keep working. Never leave
it out: it is what stops the username principal from being a login name ([Principals](/docs/ssh/turning-it-on-for-a-tenant/#principals)).

**5. Say who may log in as which account.** One file per Linux account, one principal per line, in the prefixed form:

```bash
sudo mkdir -p /etc/ssh/principals
echo group:ops | sudo tee /etc/ssh/principals/ubuntu   # members of the group "ops" may log in as ubuntu
echo alice | sudo tee /etc/ssh/principals/alice        # the user "alice" may log in as alice
```

Use `group:` (or `role:`) principals for shared and privileged accounts and usernames for personal, unprivileged ones.
Keep the list in your configuration management; Quisora does not write to the server.

**6. Check the configuration and reload sshd.** Keep your current session open until a second one works.

```bash
sudo sshd -t && sudo systemctl reload ssh
sudo sshd -T | grep -iE 'trustedusercakeys|revokedkeys|authorizedprincipalsfile'
```

sshd reads the CA file and the revocation list again at every login, so later `fetch` runs need no reload.

**7. Keep the files current with a systemd timer.** The CA key changes when it is rotated, and the revocation list
whenever a certificate is revoked or someone's access ends, so fetch every minute.
`/etc/systemd/system/quisora-ssh-fetch.service`:

```
[Unit]
Description=Fetch the SSH CA keys and revocation list from Quisora
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/quisora ssh fetch https://id.example.com/o/<org id>/ssh/<tenant id>
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ReadWritePaths=/etc/ssh
```

`/etc/systemd/system/quisora-ssh-fetch.timer`:

```
[Unit]
Description=Fetch the SSH CA keys and revocation list every minute

[Timer]
OnBootSec=30s
OnUnitActiveSec=1min
AccuracySec=5s
RandomizedDelaySec=15s

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quisora-ssh-fetch.timer
systemctl list-timers quisora-ssh-fetch.timer
journalctl -u quisora-ssh-fetch.service -n 20
```

`RandomizedDelaySec=` spreads the servers over a few seconds instead of all of them asking in the same second after a
boot or a minute tick. It matters when many servers share one address ([Servers behind one address](/docs/ssh/setting-up-an-ubuntu-server/#servers-behind-one-address)).
It adds up to 15 seconds to the revocation delay.

**What `quisora ssh fetch` does.** It exits 0 when the files are current and 1 when not (a failed run shows in
`systemctl --failed`). It fetches the user CA keys, the host CA lines and the revocation list, checks all three, and then
replaces each file that changed with a temporary file beside it and a rename. If the server cannot be reached, or
answers with something that is not a public key list or a revocation list, it changes nothing: **the last good copy stays
in use**. It installs the revocation list only if

- it parses strictly, and `ssh-keygen -Q -l -f` reads it too when `ssh-keygen` is installed (sshd refuses every login
  when it cannot read its list);
- it has a certificates section for at least one CA key the tenant publishes (a list made for another tenant protects
  nothing, so the CA keys and the host CA lines are always fetched along with it, whether or not they are written). A
  section for a key that is not published is ignored: an answer that is 30 seconds old, or an old `ca.pub` from a proxy,
  has that after a rotation, and refusing it would stop the CA file from being updated too;
- it is not older than the one in place, unless it revokes something the one in place does not. The list's version is
  the clock of the node that made it, which can run ahead and be set back, so an older list that revokes more (a
  serial, key id or key the installed one lacks) is installed all the same, and so is any list when the installed one's
  version is more than 10 minutes in this server's future. An older list that revokes nothing more (a node that kept an
  answer for 30 seconds) is not installed: `fetch` prints `note: the server's revocation list (version …) is older than
  the one in … (version …) and revokes nothing more: keeping the installed one`, updates the other files and exits 0.

The CA key and known hosts files are written only when their content changed. The revocation list carries the time it
was made, so a new copy differs from the old one nearly every time: `fetch` writes it whenever the bytes differ, and
**the file's modification time shows when the last successful fetch was**, but it prints `updated` for the list only when
what it revokes changed ([Monitoring](/docs/ssh/monitoring/)). Add `--known-hosts-file <path>` to also write the host CA lines,
`--ca-file` and `--krl-file` to use other paths (an empty value, `--ca-file=`, leaves that file alone), and
`--ca-cert <pem>` if Quisora is served with a private CA's certificate.

**Ending connections already open (`--end-revoked`).** sshd checks a certificate only when it is presented, so a
revocation stops new logins but leaves open sessions open. With `--end-revoked` (Linux, sshd logging to journald, run as
root, as the timer above does), each `fetch` also ends the connections whose certificate the list in place revokes,
and those open longer than the tenant's certificate lifetime (`cert_ttl`): it
reads the certificate logins sshd logged (`Accepted publickey for … ssh2: …-CERT … ID … (serial …) CA …`), and sends `SIGTERM` to the process of each connection whose certificate is revoked and that is still the one
that logged it. Only lines journald received from root are read (`_UID=0`, which journald takes from the sending
socket, not from what the program says), so a local user cannot log a line that names a revoked serial and a process
number of their choosing. And the process is signalled only while it is sshd's, runs as root, and started no later than
the line was logged (so not a number taken since by another connection or a restarted listener); on kernels from 5.3 it
is held by a pidfd from that check to the signal. Its parent is not checked, so connections that outlived a restart of
sshd, and those of a socket-activated sshd (`sshd -i`), are ended too. The times are compared on the clock since boot
(journald's monotonic timestamp, allowing for time spent suspended), not the wall clock, so a clock stepped forward after
a login (a resumed VM, a first NTP sync) does not hide its connection; lines from an earlier boot are not read. That process is the connection's
privileged one, which the logged-in user cannot touch, so a session cannot hide which certificate it came in with.
Ending it closes the connection and ends the session. A certificate is signed before the login it is used for and
lasts at most `cert_ttl`, so a connection open longer than that has a certificate that has expired. Its access may
have been removed since, and an expired certificate is never put on the list, so without this its connection would stay
open for good; with it, no connection outlives `cert_ttl` (8 hours by default), revoked or not. The age is counted on
journald's monotonic clock, which stops while the machine is suspended, so a connection is never ended before its
certificate expires (later by the time spent suspended). Shortening `cert_ttl` ends the connections already open
longer than the new value at the next fetch. Each one is printed (`ended the SSH connection of … (serial …, process
…): its certificate is revoked`, or `…: open longer than the certificate lifetime (8h0m0s), its certificate has
expired`), and a log that cannot be read
makes `fetch` exit 1 after the files are written. Where the connection has a login session of its own (sshd with
`UsePAM yes` and systemd-logind, the default on Ubuntu, Debian and Fedora: the connection's process leads a
`session-<id>.scope`), the whole session is ended (`loginctl terminate-session`, only while that process is still its
leader), so what the session left running in it goes too: `tmux`, `screen`, `nohup`, `setsid`. Where it has none (no
PAM, no logind, a container), only the connection is ended, and processes it left running on their own stay. Either
way, processes started outside the session (`systemd-run --user`, a user service, a cron job) are not ended: in an
incident, look for those by hand.

It keeps track of the open logins between runs, in a state file (`--state-file`, by default
`/var/lib/quisora-ssh/end-revoked.json`): the logins it has read whose connection is still open, and where it stopped
reading the log. The first run reads the whole log of this boot; each later one only what was logged since. So a
connection is known for as long as it is open, however old, and ended once its certificate is revoked or it passes
`cert_ttl`, even after `fetch` has not run for a while. The one thing it needs is the login's line: one that journald
rotated away before `fetch` read it cannot be found. Keep journald's retention (`SystemMaxUse=`, `MaxRetentionSec=` in
`journald.conf`) longer than any time `fetch` could be failing unnoticed (it alerts on failure, above), which the
defaults do on a server that is not flooding its log. Add it to the service, with a state directory:

```
StateDirectory=quisora-ssh
ExecStart=/usr/local/bin/quisora ssh fetch --end-revoked https://id.example.com/o/<org id>/ssh/<tenant id>
```

Then try it from a workstation ([Signing in from a workstation](/docs/ssh/signing-in-from-a-workstation/)).

## Other distributions

| | Debian, Ubuntu | RHEL, Fedora and relatives |
| --- | --- | --- |
| sshd's service | `ssh` (`systemctl reload ssh`) | `sshd` (`systemctl reload sshd`) |
| Where the three lines go | `/etc/ssh/sshd_config.d/50-quisora.conf` | Fedora and RHEL 9 include `/etc/ssh/sshd_config.d/*.conf` (look for the `Include` line in `/etc/ssh/sshd_config`), so a drop-in works. RHEL 8's `sshd_config` has no such line: add the three lines to `/etc/ssh/sshd_config` itself, above any `Match` block (a line below one applies only to it). |

sshd uses the first value it finds for an option. If the main file sets one of these options (`AuthorizedPrincipalsFile` in
particular) before the line that includes the drop-ins, that value wins and the drop-in's is ignored: check the result
with `sshd -T`. Use the right service name in the unit and the commands above.

## Servers behind one address

The public addresses are limited per client address and tenant: 16 000 units a minute, where an answer with a
document costs 4 units and one that is `304 Not Modified` or refused costs 1. The tenant is counted by its id, so
naming it by its id or its name in the URL is one budget; the addresses of tenants that do not exist share one more
budget for each client address. One `quisora ssh fetch` run asks for four documents (the discovery document, `ca.pub`, `krl` and `known_hosts`) and the command does not send `If-None-Match`,
so each run costs 16 units: **about a thousand servers a minute behind one address** (a NAT gateway, a proxy) before
`429`. A fetch refused that way fails and keeps the old files, so it costs freshness, not access. For a larger fleet behind
one address:

- keep `RandomizedDelaySec=` in the timer, so the servers do not all ask in the same second;
- fetch less often (every two or three minutes), which lengthens the revocation delay by that much;
- or fetch through a proxy or a mirror of your own that revalidates with `ETag` (a revalidation costs 1 unit).

A user running `quisora ssh login` from the same office uses a few more of the same budget.

## Why the revocation list must always be there

`RevokedKeys` applies to every public-key login on the server, not only to certificates. If the file is missing or
cannot be read, sshd cannot tell whether a key is revoked and refuses the login (it logs `Error checking
authentication key … in revoked keys file`): that includes your own `authorized_keys` login. Three consequences:

- Run the first `fetch` (step 2) before the drop-in is in place, and keep a second session open when you reload sshd.
- An empty revocation list is valid and is what a tenant with nothing revoked gets, so there is always something to
  fetch while SSH is on.
- Never delete the file to "reset" it. `fetch` keeps the previous copy through any outage, which is why a Quisora
  outage does not stop certificates that were already issued from working. The cost is that during an outage
  revocations are not picked up: they arrive with the first successful fetch.

## If Quisora is not reachable

"A Quisora outage does not lock anyone out" is true only for **certificates already issued**: they go on working until
they expire (at most **Certificate lifetime**, 8 hours by default, 24 at most), and servers keep the last good copy of the
CA keys and the list. Nobody can get a **new** certificate while Quisora, or the sign-in it needs (a provider, the
mail server for emailed codes), is down, so once the lifetimes run out nobody can log in with one. Revocations made
meanwhile are not picked up, either. Plan a way in that does not depend on it:

- **An emergency key.** Put an offline ed25519 key in `authorized_keys` of one named account on each server, for use
  only when Quisora is down (a passphrase-protected key, or a hardware key, kept in a safe, not in a person's agent).
  `authorized_keys` keeps working beside certificates, and `AuthorizedPrincipalsFile` does not touch it. `RevokedKeys`
  **does** apply to it, so the revocation list file must still exist and be readable: a server that has lost it refuses the
  emergency key too.
- **Or console access** to the machines: the cloud provider's serial console, a hypervisor console or an out-of-band
  controller, with a local password that you have tested.
- **Do not make Quisora's own hosts depend only on Quisora certificates**: the servers that run Quisora, its database and
  its network path need a login that works when Quisora does not, or nobody can fix it.
- Use the emergency login in a drill, and alert on its use (sshd's log shows the key's fingerprint).
- A longer **Certificate lifetime** (24 hours at most) rides through a longer outage, and lengthens the time a stolen
  certificate stays good by as much. It is not a substitute for the emergency login.

## Linux accounts must exist

Quisora decides who may present a certificate for which principal; it does not create the account on the server. A
person whose certificate is accepted by sshd but whose account does not exist is refused like any unknown user.
Create accounts with your configuration management, or by hand:

```bash
sudo adduser --disabled-password --gecos "" alice
```

On Ubuntu, sshd runs with `UsePAM yes`, which lets a passwordless account log in with a certificate. If sshd says an
account is locked, set its password field to `*`: `sudo usermod -p '*' alice`.

Shared accounts need no more: one account (`ubuntu`, `deploy`) whose principals file lists the groups that may use it.
Everyone who logs in as it is still named in the audit log (the certificate's key id is `<username>@<org>/<user id>`)
and in sshd's log ([Reading sshd's log](/docs/ssh/troubleshooting/#reading-sshds-log)).

## Without the quisora binary

Two `curl` calls do the work. This script (`/usr/local/sbin/quisora-ssh-fetch`) keeps the last good copy, checks that
the revocation list parses with `ssh-keygen`, and revalidates with the `ETag` it saved, so an unchanged document is a
`304` that costs 1 unit instead of 4. On a `304` it touches the file it keeps, so the file's age still says when the
last fetch succeeded ([Monitoring](/docs/ssh/monitoring/)). Run it from the same timer, with `ExecStart` changed:

```bash
#!/bin/sh
set -eu
URL=https://id.example.com/o/<org id>/ssh/<tenant id>
STATE=/var/lib/quisora-ssh-fetch # the ETags of the files installed
mkdir -p "$STATE"
tmp=$(mktemp -d /etc/ssh/.quisora.XXXXXX)
trap 'rm -rf "$tmp"' EXIT

# get NAME: fetches $URL/NAME into $tmp/NAME, sending the ETag of the copy installed; prints the status (200 or 304)
get() {
  tag=$(cat "$STATE/$1.etag" 2>/dev/null || true)
  curl -fsS --max-time 20 ${tag:+-H "If-None-Match: $tag"} -D "$tmp/$1.h" -o "$tmp/$1" -w '%{http_code}' "$URL/$1"
}
# put NAME FILE STATUS: installs a new document at FILE with its ETag, or touches FILE after a 304
put() {
  if [ "$3" = 304 ]; then touch "$2"; return; fi
  chmod 644 "$tmp/$1"
  mv -f "$tmp/$1" "$2"
  sed -n 's/^[Ee][Tt][Aa][Gg]: *//p' "$tmp/$1.h" | tr -d '\r' > "$STATE/$1.etag"
}

ca=$(get ca.pub)
krl=$(get krl)
[ "$ca" = 304 ] || grep -q '^ssh-' "$tmp/ca.pub"
[ "$krl" = 304 ] || ssh-keygen -Q -l -f "$tmp/krl" > /dev/null
put ca.pub /etc/ssh/quisora_user_ca.pub "$ca"
put krl /etc/ssh/quisora.krl "$krl"
```

Both documents are checked before either is installed, and a failed run (`curl` cannot reach Quisora, an answer that is
not valid) changes and touches nothing. It does not check that the list has a section for one of the tenant's CA keys,
does not refuse an older list, and does not fetch the host CA lines. Delete the saved ETags (`$STATE`) if you replace the
files by hand.
