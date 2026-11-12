---
title: "Getting a certificate"
description: "Sign in from your computer and log in to servers."
weight: 30
---

## From the command line

Install `quisora` on your computer. Your account page shows the command with your tenant's address filled in:

```bash
quisora ssh login https://id.example.com/o/<org id>/ssh/<tenant id>
```

A browser opens. Sign in with a second factor and confirm. The command prints:

```
Signed in to acme/prod.
Principals: alice, group:ops
Valid until: 2026-10-31 18:04 AEDT (8h0m0s left)
Added to ssh-agent; it is removed when the certificate expires.
```

Then use `ssh` as usual:

```bash
ssh ubuntu@server.example.com
```

The new key lives only in your SSH agent and is gone when the certificate expires. Run `quisora ssh login` again
when it does.

| Option | What it does |
| --- | --- |
| `--device` | Sign in on another device with a code. For a machine with no browser. |
| `--key <path>` | Get a certificate for a key you already have, such as one with a passphrase or a security key. |
| `--ttl 2h` | Ask for a shorter certificate. |
| `--principal group:ops` | Ask for only some of your principals. |
| `--no-agent` | Write the key to a file in `~/.ssh/quisora` instead of the agent. |

`quisora ssh status` shows your certificates and the time left. `quisora ssh logout` removes them.

**No agent?** If no agent is running, or it won't take the key (1Password and Secretive don't), `login` writes the key
to `~/.ssh/quisora` and says how to use it. On Windows it always writes a file.

## On a machine without a browser

```bash
quisora ssh login --device https://id.example.com/o/<org id>/ssh/<tenant id>
```

It prints an address and a code. Open the address on any device, check the code matches, and sign in.

{{< tip "warning" >}}
Only enter a code that you started yourself. Someone could send you their code, and if you enter it, their machine gets
a certificate in your name.
{{< /tip >}}

## From your account page

If you can't install `quisora`, go to **Your account**, then **SSH certificates**. It lists the tenants you can use,
the principals you would get, and your certificates.

{{< screenshot name="account-ssh" alt="The SSH certificates card on the account page, with the login command and two certificates" class="max-w-3xl" >}}

**Get a certificate** asks for your public key, such as the contents of `~/.ssh/id_ed25519.pub`. Never paste a private
key. Save the certificate next to your key as `id_ed25519-cert.pub`, and `ssh` uses it by itself.

The trash button revokes one of your certificates.

## If you have many keys

sshd allows only a few attempts per connection. If your agent holds many keys, you may see `Too many authentication
failures` before the certificate is tried. Tell `ssh` which key to use in `~/.ssh/config`:

```
Host *.example.com
    User ubuntu
    IdentityFile ~/.ssh/quisora/acme-prod.pub
    CertificateFile ~/.ssh/quisora/acme-prod-cert.pub
    IdentitiesOnly yes
```

`login` keeps those two files (public parts only) for this. If you used `--no-agent`, name the private key instead:
`IdentityFile ~/.ssh/quisora/acme-prod`.
