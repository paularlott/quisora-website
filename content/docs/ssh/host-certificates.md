---
title: "Host certificates"
description: "Let people's ssh clients trust your servers without the unknown-host question."
weight: 40
---

A host certificate lets `ssh` trust a server by its name. No more "unknown host key" question, and no warning when a
server's key changes.

## Turn them on

In the tenant's SSH settings, turn on **Sign host certificates** and set **Host names allowed**, such as
`*.example.com`. Only names that match get a certificate. `*` also matches dots, so `*.example.com` matches
`a.b.example.com`.

Then make a [service account](/docs/automation/service-accounts/) with only the `ssh:host` scope. It can sign host
certificates and nothing else.

{{< tip "warning" >}}
That account can sign a certificate for any name the patterns allow. Keep the patterns narrow and its secret readable
by root only, and change the secret when a server is lost.
{{< /tip >}}

## On each server

Sign the server's host key, with `$URL` set as in [Setting up a server](/docs/ssh/setting-up-a-server/). Pass the secret in the environment so it stays out of the process list:

```bash
export QUISORA_CLIENT_ID=<the service account's id>
export QUISORA_CLIENT_SECRET=<its secret>
quisora ssh host-sign "$URL" /etc/ssh/ssh_host_ed25519_key.pub --principal server.example.com
```

Add the certificate to `/etc/ssh/sshd_config.d/50-quisora.conf` and reload sshd:

```
HostCertificate /etc/ssh/ssh_host_ed25519_key-cert.pub
```

```bash
sudo sshd -t && sudo systemctl reload ssh
```

Host certificates last up to the **Host certificate lifetime** (90 days by default) and don't renew themselves. Renew
them from a weekly timer with a short lifetime, such as `--ttl 30`, and reload sshd after each renewal.

## On each client

Fetch the host CA and the revocation list into files of their own:

```bash
sudo mkdir -p /etc/ssh/ssh_known_hosts.d
sudo quisora ssh fetch "$URL" --ca-file= --krl-file /etc/ssh/quisora-hosts.krl \
  --known-hosts-file /etc/ssh/ssh_known_hosts.d/quisora
```

Then add to `/etc/ssh/ssh_config.d/50-quisora.conf`:

```
RevokedHostKeys /etc/ssh/quisora-hosts.krl
GlobalKnownHostsFile /etc/ssh/ssh_known_hosts /etc/ssh/ssh_known_hosts.d/quisora
```

Run the fetch every few minutes from a timer, as on a server. Like sshd, `ssh` refuses every connection if the
`RevokedHostKeys` file is missing, so run the first fetch before adding the lines.

A client without `RevokedHostKeys` trusts a host certificate until it expires, even after it is revoked. That is
another reason to keep host certificates short.

A host certificate you revoke by hand stays on the revocation list, even if you turn **Sign host certificates** off
later.
