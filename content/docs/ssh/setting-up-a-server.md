---
title: "Setting up a server"
description: "Make a Linux server accept the tenant's certificates."
weight: 20
---

A server needs only OpenSSH and the `quisora` binary. It needs none of Quisora's configuration or secrets: it reads
three public files. The steps are for Ubuntu and Debian; [other distributions](#other-distributions) differ slightly.

The tenant's SSH page in the console has the commands with the address filled in:

{{< screenshot name="ssh-setup" alt="The Set up servers and people section of a tenant's SSH page, with commands to copy" >}}

The address in them is the tenant's **discovery URL**. It names the organization and tenant by id, so it keeps working
if they are renamed:

```bash
export URL=https://id.example.com/o/<org id>/ssh/<tenant id>
```

## Steps

**1. Install the binary.**

```bash
sudo install -m 0755 quisora /usr/local/bin/quisora
```

**2. Fetch the CA key and revocation list.**

```bash
sudo quisora ssh fetch "$URL"
```

**3. Check the CA key.** Compare its fingerprint with the **CA keys** table on the tenant's SSH page. This is the one
time the server takes what it is given on trust.

```bash
ssh-keygen -lf /etc/ssh/quisora_user_ca.pub
```

**4. Tell sshd to trust it.** Create `/etc/ssh/sshd_config.d/50-quisora.conf`:

```
TrustedUserCAKeys /etc/ssh/quisora_user_ca.pub
RevokedKeys /etc/ssh/quisora.krl
AuthorizedPrincipalsFile /etc/ssh/principals/%u
```

Always include `AuthorizedPrincipalsFile`. Without it, sshd lets anyone in whose username matches the account name.

**5. Say who may log in as which account.** One file per account, one principal per line:

```bash
sudo mkdir -p /etc/ssh/principals
echo group:ops | sudo tee /etc/ssh/principals/ubuntu   # the ops group may log in as ubuntu
echo alice | sudo tee /etc/ssh/principals/alice        # alice may log in as alice
```

Keep these files in your configuration management. Quisora never writes to your servers.

**6. Reload sshd.** Keep your current session open until a new one works.

```bash
sudo sshd -t && sudo systemctl reload ssh
```

**7. Fetch every minute.** The revocation list changes whenever someone loses access.
`/etc/systemd/system/quisora-ssh-fetch.service`:

```
[Unit]
Description=Fetch the SSH CA keys and revocation list from Quisora
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
StateDirectory=quisora-ssh
ExecStart=/usr/local/bin/quisora ssh fetch --end-revoked https://id.example.com/o/<org id>/ssh/<tenant id>
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
RandomizedDelaySec=15s

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quisora-ssh-fetch.timer
```

If Quisora can't be reached, `fetch` keeps the last good copy of the files and exits with an error.

Now try it from a workstation: [Getting a certificate](/docs/ssh/getting-a-certificate/).

## Ending open sessions

sshd checks a certificate only at login, so revoking it doesn't close sessions already open. With `--end-revoked` (as
in the service above), each fetch also ends:

- sessions whose certificate is now revoked;
- sessions open longer than the certificate lifetime, so nobody stays logged in past it.

On Ubuntu, Debian and Fedora this ends the whole login session, `tmux` and `screen` included. Processes started outside
it, such as cron jobs or user services, are not touched. It needs Linux with journald, which those systems have.

## Linux accounts

Quisora doesn't create accounts. Make them with your configuration management, or by hand:

```bash
sudo adduser --disabled-password --gecos "" alice
```

Shared accounts such as `ubuntu` or `deploy` work too. sshd's log still names the person behind each login.

When someone leaves, delete their Linux account. A new user given the same username would otherwise reach it.

## Keep the revocation list in place

`RevokedKeys` applies to every key login on the server, not only certificates. If the file is missing, sshd refuses
**all** key logins, your own included. So never delete it to reset it, and run the first fetch before adding the
sshd lines.

## Keep another way in

If Quisora is down, certificates already issued keep working until they expire, but nobody can get a new one. Keep a
way in that doesn't need Quisora:

- an emergency key in one account's `authorized_keys`, kept offline and alerted on when used, or
- console access through your cloud provider or hypervisor.

This matters most for the servers that run Quisora and its database.

## Watch it

A server that stops fetching keeps its old list, and won't pick up new revocations. Alert when:

- the fetch service fails (`systemctl is-failed quisora-ssh-fetch.service`), or
- `/etc/ssh/quisora.krl` is more than 5 minutes old. Each successful fetch rewrites it.

```bash
find /etc/ssh/quisora.krl -mmin -5 | grep -q .   # fails when the list is stale or missing
```

## Other distributions

On RHEL and Fedora, sshd's service is called `sshd`, not `ssh`. Fedora and RHEL 9 read `/etc/ssh/sshd_config.d/` like
Ubuntu. On RHEL 8, put the three lines in `/etc/ssh/sshd_config` itself, above any `Match` block.

Check the result with `sudo sshd -T | grep -iE 'trustedusercakeys|revokedkeys|authorizedprincipalsfile'`. If the main
file sets one of these options first, its value wins.
