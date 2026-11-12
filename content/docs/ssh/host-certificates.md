---
title: "Host certificates"
weight: 50
---

A host certificate lets people's ssh clients trust a server by its name without the "unknown host key" question, and
when the server's key changes, without a warning.

**1. Turn them on** for the tenant: **Sign host certificates**, with **Host names allowed** (`*.example.com`) and the
**Host certificate lifetime**. This makes a host CA key. A host name is signed only if it matches a pattern; the match
is `path.Match`-style on the lower-case name, and `*` also matches dots (`*.example.com` matches `a.b.example.com`).

**2. Make a service account** that may only sign host certificates, with the `ssh:host` scope (the organization's
**Service accounts** page, or the API: [service accounts](/docs/automation/service-accounts/)). The `ssh` scope alone is not enough,
and `ssh:host` can do nothing else:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "ssh-host-signer", "scopes": ["ssh:host"]}' "$QUISORA/api/orgs/acme/service-accounts"
```

The account can sign a certificate for **any** name that matches the tenant's host patterns, for any key, so a server that
holds its secret can vouch for any other host in those patterns. Keep the patterns as narrow as you can, keep the secret
readable by root only, rotate it when a server is lost, and consider signing from one trusted machine instead of from
every server.

**3. On each server**, as root, sign its host key. The secret goes in the environment, so it stays out of the process
list:

```bash
export QUISORA_CLIENT_ID=<the account's id>
export QUISORA_CLIENT_SECRET=<its secret>
quisora ssh host-sign "$URL" /etc/ssh/ssh_host_ed25519_key.pub --principal server.example.com
# Host certificate for server.example.com, valid until 2027-01-29 18:04 AEDT (2159h0m0s left).
# HostCertificate /etc/ssh/ssh_host_ed25519_key-cert.pub
```

The certificate is written beside the key, and the last line is what sshd needs. Without `--principal` the server's
fully qualified name is used. Options:

| Option | What it does |
| --- | --- |
| `--principal <name>` | A name the certificate is for (repeat it); each must match a host pattern of the tenant. |
| `--ttl <days>` | Ask for a certificate of this many days, `90` or `90d` (1 to 365; hours that make whole days, such as `2160h`, also work). The tenant refuses more than its **Host certificate lifetime**, which is also the default. |
| `--auth-method auto\|post\|basic` | How the service account authenticates at the token endpoint. A service account is registered for `client_secret_post` unless made otherwise, so `auto` (the default) tries that and, if the server answers `invalid_client`, once more with `client_secret_basic`. `post` or `basic` tries only that one. |
| `--token <token>` (`QUISORA_TOKEN`) | An access token with `ssh:host` instead of the client id and secret: the way for a service account that authenticates with a private key. |

`--client-secret` and `--token` are accepted as options too, with a warning: anyone on the machine sees the command line
(`ps`), so use the environment. The command follows redirects only within the server's address (scheme, host and port,
with a default port written out or left off being the same), or from `http://` up to `https://` on the same host, so a
redirect cannot send the secret elsewhere, nor back from `https://` to `http://`.

Add the line to sshd and **reload sshd**, so that it serves the certificate (and does so again after every renewal,
below):

```
# /etc/ssh/sshd_config.d/50-quisora.conf
HostCertificate /etc/ssh/ssh_host_ed25519_key-cert.pub
```

```bash
sudo sshd -t && sudo systemctl reload ssh
```

Through the API (`ttl_days` is optional and at most the tenant's lifetime):

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"public_key": "'"$(cat /etc/ssh/ssh_host_ed25519_key.pub)"'", "principals": ["server.example.com"], "ttl_days": 30}' \
  "$QUISORA/api/orgs/acme/tenants/prod/ssh/host-certificates"
```

**4. On every client**, trust the host CA, and set up revocation as below.

## Clients and host certificate revocation

The tenant publishes the host CA lines at `…/ssh/<tenant id>/known_hosts`
(`@cert-authority *.example.com ssh-ed25519 AAAA… quisora:acme/prod:host:<key id>`, one per host CA key). Do not paste
them into `/etc/ssh/ssh_known_hosts` by redirecting `curl`: a failed `curl` empties the file, and the file also holds
whatever else the machine trusts. Keep Quisora's lines in a file of their own and let `fetch` manage it.

**What revocation covers on a client.** sshd's `RevokedKeys` is for users logging in to a server. When **a client** checks a
server's host certificate it looks at its own `RevokedHostKeys`. Without it, the client trusts a host certificate until
it expires, whatever Quisora revokes: a host certificate revoked by hand, a removed host CA key, or SSH turned off. The
revocation list is the same list the servers fetch, so a client can use it:

```bash
sudo mkdir -p /etc/ssh/ssh_known_hosts.d
sudo quisora ssh fetch "$URL" --ca-file= --krl-file /etc/ssh/quisora-hosts.krl \
  --known-hosts-file /etc/ssh/ssh_known_hosts.d/quisora
```

`--ca-file=` (empty) skips the user CA file, which a client does not need. A machine that is both a server and a client
needs one fetch: add `--known-hosts-file /etc/ssh/ssh_known_hosts.d/quisora` to the server's command and point
`RevokedHostKeys` at `/etc/ssh/quisora.krl`. Then tell `ssh` about both files, in `/etc/ssh/ssh_config.d/50-quisora.conf`
(or in `/etc/ssh/ssh_config` where the system has no `ssh_config.d`):

```
RevokedHostKeys /etc/ssh/quisora-hosts.krl
GlobalKnownHostsFile /etc/ssh/ssh_known_hosts /etc/ssh/ssh_known_hosts.d/quisora
```

`GlobalKnownHostsFile` replaces the default, so the line names `/etc/ssh/ssh_known_hosts` as well. **`RevokedHostKeys`
makes `ssh` refuse every connection if the file is missing or unreadable** (`Error checking host key … in revoked keys
file`), as sshd does for `RevokedKeys`: run the `fetch` before you add the lines, keep the file, and run the fetch from a
timer like the server's (the same unit with this `ExecStart`, with `RandomizedDelaySec=`). The list also applies to a
host's plain host key, not only to certificates. For one person on a workstation, the same lines in `~/.ssh/config`
work with files in the home directory (`UserKnownHostsFile ~/.ssh/known_hosts ~/.ssh/quisora_known_hosts`).

Without the binary, use temporary files and a rename, never a redirect onto the live file (`/usr/local/sbin/quisora-ssh-fetch-hosts`):

```bash
#!/bin/sh
set -eu
URL=https://id.example.com/o/<org id>/ssh/<tenant id>
DIR=/etc/ssh/ssh_known_hosts.d
tmp=$(mktemp -d "$DIR/.quisora.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
curl -fsS --max-time 20 "$URL/known_hosts" -o "$tmp/known_hosts"
curl -fsS --max-time 20 "$URL/krl" -o "$tmp/krl"
if grep -qv '^@cert-authority ' "$tmp/known_hosts"; then echo "not a known_hosts list" >&2; exit 1; fi
ssh-keygen -Q -l -f "$tmp/krl" > /dev/null
chmod 644 "$tmp/known_hosts" "$tmp/krl"
mv -f "$tmp/known_hosts" "$DIR/quisora"
mv -f "$tmp/krl" /etc/ssh/quisora-hosts.krl
```

**The limits, plainly.**

- Only a client that fetches the list and sets `RevokedHostKeys` honours a host revocation, and only after its next fetch.
  A laptop that does neither trusts a host certificate until it expires, or until the `@cert-authority` line is gone from
  its file.
- Removing a host CA key takes its line out of `known_hosts`, and the list revokes the key outright, so a client that
  runs the fetch drops both at its next run. Turning SSH off leaves the lines in place and relies on the list.
- A stolen host private key, with its certificate, impersonates that host until the certificate expires or a client revokes it. So
  **keep host certificates short**: a few weeks at most, renewed automatically (below), rather than the 90-day default,
  if you cannot count on every client revoking.

## Renewing and rotating host keys

Host certificates last up to `host_ttl_days` and are not renewed by themselves: run `host-sign` again before they expire,
and reload sshd after each run, or sshd goes on serving the old certificate until it restarts. From a timer, for
instance weekly with a certificate of 30 days. `/etc/systemd/system/quisora-host-sign.service`:

```
[Unit]
Description=Renew this server's SSH host certificate
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/quisora/host-sign.env
ExecStart=/usr/local/bin/quisora ssh host-sign https://id.example.com/o/<org id>/ssh/<tenant id> /etc/ssh/ssh_host_ed25519_key.pub --principal server.example.com --ttl 30
ExecStartPost=/bin/systemctl reload ssh
```

`/etc/quisora/host-sign.env` holds `QUISORA_CLIENT_ID=…` and `QUISORA_CLIENT_SECRET=…`, owned by root with mode 0600. The
reload runs only if `host-sign` succeeded (use `sshd` for the unit name on RHEL and Fedora).
`/etc/systemd/system/quisora-host-sign.timer`:

```
[Unit]
Description=Renew this server's SSH host certificate every week

[Timer]
OnCalendar=weekly
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

To replace a server's host key, make the new key (`ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""` after
moving the old one away), run `host-sign` and reload sshd; clients with the `@cert-authority` line accept it without a
warning. To rotate the host CA key itself, see [CA key rotation](/docs/ssh/ca-key-rotation/).
