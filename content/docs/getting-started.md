---
title: Getting started
description: Install Quisora, set it up once, and sign in for the first time.
weight: 10
---

This guide gets one Quisora server running on your own machine. It takes a few minutes.

## Install

Pick one of these.

**Download a binary.** Each [release on GitHub](https://github.com/paularlott/quisora/releases) has a binary for Linux, macOS and Windows. Put it somewhere on your path and call it `quisora`.

**Build it yourself.** You need Go, Node and [Task](https://taskfile.dev):

```bash
git clone https://github.com/paularlott/quisora.git
cd quisora
task build        # makes bin/quisora
```

**Use Docker.** Build the image from the repository:

```bash
docker build -t quisora .
```

## Make a master key

The master key locks every secret Quisora keeps, such as signing keys and provider secrets. Make one and keep it safe. Without it, the data can't be read.

```bash
export QUISORA_MASTER_KEY="$(quisora genkey)"
```

{{< tip "warning" >}}
Store the master key somewhere safe, away from the data and the backups: a password manager or a secret store such as Vault. Don't pass it as a command line flag, where others on the machine can see it.
{{< /tip >}}

## Set it up once

`bootstrap` creates the first organization, called `primary`, and a super admin account. It prints a link you use to finish setting up that account.

```bash
quisora bootstrap --public-url https://localhost:8443
```

The admin is `admin@example.com` unless you change it with `--bootstrap-admin`. The link works once and lasts 7 days. Running `bootstrap` again changes nothing.

## Start the server

```bash
quisora serve --public-url https://localhost:8443
```

This keeps its data in `./data` and makes a self-signed certificate, which is fine for trying it out.

## Sign in for the first time

1. Open the link `bootstrap` printed. Your browser warns about the self-signed certificate; accept it for now.
2. Create a passkey, or set a password. You can do both.
3. Set up a second factor. Admins always need one.

{{< screenshot name="invite" alt="The invitation page, offering to create a passkey or set a password" class="max-w-3xl" >}}

The admin console is at `https://localhost:8443/admin`. From there you can add organizations, users and applications.

{{< screenshot name="org" alt="An organization's page in the admin console, with its sign-in settings" >}}

## With Docker

The container keeps its data in `/data`, so mount a volume there:

```bash
export QUISORA_MASTER_KEY="$(docker run --rm quisora genkey)"
docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY \
  -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora bootstrap
docker run -d -p 8443:8443 -v quisora-data:/data -e QUISORA_MASTER_KEY \
  -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora
```

## Locked out?

If you lose the link, or can't sign in, make a new invitation while the server runs:

```bash
quisora invite primary admin@example.com
```

## What next

- [Configuration basics](/docs/configuration/) for a real address, certificate and database.
- [Sign-in providers](/docs/sign-in-providers/) to let people use an account they already have.
- [Connecting applications](https://github.com/paularlott/quisora/blob/main/docs/oauth/README.md) to sign people in to your apps.
