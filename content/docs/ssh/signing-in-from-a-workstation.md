---
title: "Signing in from a workstation"
weight: 30
---

Install `quisora` (the same binary; the `ssh` commands need no configuration), then:

```bash
quisora ssh login https://id.example.com/o/<org id>/ssh/<tenant id>
```

A browser opens on Quisora's sign-in page. Sign in with a second factor, confirm on the page that follows that you want
`quisora ssh` signed in (it is always asked), and the command prints:

```
Signed in to acme/prod.
Principals: alice, group:ops
Valid until: 2026-10-31 18:04 AEDT (8h0m0s left)
Added to ssh-agent; it is removed when the certificate expires.
The public key and certificate are also in ~/.ssh/quisora/acme-prod{.pub,-cert.pub}, to name them in ~/.ssh/config
(IdentityFile ~/.ssh/quisora/acme-prod.pub, CertificateFile ~/.ssh/quisora/acme-prod-cert.pub, IdentitiesOnly yes).
```

Then `ssh ubuntu@server.example.com` as usual. The sign-in asks for a second factor and a sign-in no older than the
tenant's **Sign-in age**, so someone who signed in with a password only is asked for the second factor on the way. The
person's own account page shows the same command, with the URL filled in
([The account page](/docs/ssh/the-account-page/)).

| Option | What it does |
| --- | --- |
| `--device` | Sign in with a code on another device (the device flow), for a machine without a browser, such as a server you are logged in to. It asks for the same second factor and sign-in age as the browser sign-in ([On a machine without a browser](/docs/ssh/signing-in-from-a-workstation/#on-a-machine-without-a-browser)). |
| `--no-browser` | Print the sign-in URL instead of opening it. The browser must be on this machine: the sign-in returns to a port on `127.0.0.1`. |
| `--no-agent` | Do not use ssh-agent: write the key and certificate to `~/.ssh/quisora` ([below](/docs/ssh/signing-in-from-a-workstation/#the-agent-or-a-file)). |
| `--key <path>` | Get the certificate for this existing key (its `.pub`) and write it to `<path>-cert.pub`, instead of making a new key. |
| `--principal <name>` | Ask for these principals only, in the prefixed form such as `group:ops` (repeat it). The default is every principal the person may have. |
| `--ttl <duration>` | Ask for a shorter certificate, such as `2h` or `90m` (or seconds). The default is the tenant's lifetime; at least 60 seconds. |
| `--insecure`, `--ca-cert <pem>` | Do not verify Quisora's TLS certificate (development), or trust the CAs in this file. |

## The agent, or a file

By default `login` makes a new ed25519 key in memory and loads it with its certificate into `ssh-agent`
(`SSH_AUTH_SOCK`) for exactly as long as the certificate lasts, with the comment `quisora:<org>/<tenant>`. The private
key never touches the disk and the agent drops it when the certificate expires. A new `login` replaces the tenant's
earlier certificate in the agent. It also writes the public key and the certificate, **without the private key**, to
`~/.ssh/quisora/<org>-<tenant>.pub` and `-cert.pub`, so that `~/.ssh/config` can name them ([ssh_config](/docs/ssh/signing-in-from-a-workstation/#ssh_config)).
`quisora ssh status` lists that certificate file as `file (no key)`, to tell it from one with its key beside it.

`login` writes the key and certificate to files, `~/.ssh/quisora/<org>-<tenant>` (the key with mode 0600, beside `.pub` and
`-cert.pub`), and says how to use them (`ssh -i ~/.ssh/quisora/<org>-<tenant> <host>`), when:

- you give `--no-agent`;
- no agent is running (`SSH_AUTH_SOCK` is not set, or the socket does not answer): `warning: no ssh-agent: …: writing the
  key to a file instead`;
- the agent refuses the key: it is locked, or it does not accept imported keys, as the agents of 1Password and
  Secretive do: `warning: ssh-agent did not take the key (…; it may be locked, or not accept imported keys): writing the
  key to a file instead`. The certificate you signed in for is not thrown away;
- the system is **Windows**: the agent of Windows' OpenSSH is a named pipe, which `quisora` does not use, so it always
  writes files. Windows does not apply the 0600 mode, so what protects the private key is the access control of your
  user profile (`%USERPROFILE%\.ssh\quisora`): make sure no one else can read it. Use `ssh -i` with the path it prints.

With `--key`, nothing is made: the certificate is for the key you name, in the agent or not. Use it with a key that has a
passphrase, or a security key (`id_ed25519_sk`), when you do not want a key without a passphrase on the disk. OpenSSH
uses `<key>-cert.pub` automatically with `-i <key>`.

`quisora ssh status` lists the Quisora certificates in the agent and in `~/.ssh/quisora` with their principals and time
left, and `quisora ssh logout [<discovery URL>]` removes them (one tenant's, or all of them without the URL) from both.
To read a certificate: `ssh-keygen -L -f ~/.ssh/quisora/acme-prod-cert.pub`, or for the agent
`ssh-add -L | grep cert | ssh-keygen -L -f -`.

## On a machine without a browser

```bash
quisora ssh login --device https://id.example.com/o/<org id>/ssh/<tenant id>
```

It prints a URL and a code. Open the URL on any device, check that it shows the same code, sign in and allow it. The
command waits and then does the same as above. Anyone can start this on any machine, so only enter a code you started
yourself ([Risks](/docs/ssh/risks/)).

The command sends the same demands as the browser sign-in when it asks for the code: a second factor (`acr_values`) and a
sign-in no older than the tenant's **Sign-in age** (`max_age`). The device page meets them as any sign-in does
([device sign-in](/docs/applications/device/)): a browser whose session is a password only is sent on to the second factor,
and one whose session is older than **Sign-in age** signs in again. There is nothing to sign out of first. The command
keeps asking until the code expires, ten minutes after it was made: it waits longer between asks when the server says so,
and when the network, a proxy or the server does not answer it says so once and tries again (`warning: the token endpoint
did not answer (…): trying again until the code expires`).

## ssh_config

```
# ~/.ssh/config
Host *.example.com
    User ubuntu
    # with the agent (the default): the key is in the agent; these name it
    IdentityFile ~/.ssh/quisora/acme-prod.pub
    CertificateFile ~/.ssh/quisora/acme-prod-cert.pub
    IdentitiesOnly yes
```

With the file form (no agent, `--no-agent`, or Windows), name the private key instead, and `ssh` finds
`acme-prod-cert.pub` beside it:

```
Host *.example.com
    User ubuntu
    IdentityFile ~/.ssh/quisora/acme-prod
    IdentitiesOnly yes
```

`ssh -v` shows `Offering public key: … ED25519-CERT` when the certificate is being used.

**Why `IdentitiesOnly yes`.** sshd allows only a few failed attempts a connection (`MaxAuthTries`, 6 by default) and counts
every key the client offers. A person whose agent holds many keys can use them all up before the certificate is
offered, and the connection closes with `Too many authentication failures`. `IdentitiesOnly yes` makes `ssh` offer only
the keys the configuration names, here the Quisora key. In agent mode that works because `login` leaves the `.pub` and
`-cert.pub` files: `ssh` asks the agent for the key in `acme-prod.pub` and pairs it with the certificate in
`acme-prod-cert.pub`. (`IdentitiesOnly yes` with no such file would offer nothing at all.) The files stay after the
certificate has expired, and the agent forgets the key then: `ssh` fails until the next `login`. `logout` removes them.
Agent forwarding is off in certificates by default; `ssh -A` has no effect unless the tenant turns it on.
