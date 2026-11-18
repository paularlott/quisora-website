---
title: Getting started
description: Install Quisora, set it up once, and sign in for the first time.
weight: 10
---

This guide gets one Quisora server running on your own machine. It takes a few minutes.

## Install

Pick one of these.

**Docker.** Pull the image from Docker Hub:

```bash
docker pull paularlott/quisora
```

`paularlott/quisora:latest` is the newest release. For production, pin a release, such as
`paularlott/quisora:<version>`, and change it on purpose when you upgrade.

**A binary.** Each [release on GitHub](https://github.com/paularlott/quisora/releases) has a binary for Linux, macOS and Windows. Put it somewhere on your path and call it `quisora`.

## Make a master key

The master key locks every secret Quisora keeps, such as signing keys and provider secrets. Without it, the data can't be read.

1. Make a new key, once:

   ```bash
   quisora genkey                          # with the binary
   docker run --rm paularlott/quisora genkey   # with Docker
   ```

2. Save the key in a password manager.
3. Set it for Quisora:

   ```bash
   export QUISORA_MASTER_KEY=<the key>
   ```

   This lasts only for the current terminal. Set it again in each new one.

{{< tip "warning" >}}
Store the master key somewhere safe, away from the data and the backups: a password manager or a secret store such as Vault. Don't pass it as a command line flag, where others on the machine can see it.
{{< /tip >}}

## Set it up and start it

`bootstrap` sets up a new server once. It creates the first organization, called `primary`, and a super admin account. It prints a link you use to finish setting up that account. Then you start the server.

The admin is `admin@example.com` unless you change it with `--bootstrap-admin` (with Docker, `-e QUISORA_BOOTSTRAP_ADMIN=...`). The link works once and lasts 7 days. Running `bootstrap` again changes nothing.

### With Docker

1. Set the server up once. Copy the link it prints: `docker logs` won't show it later.

   ```bash
   docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY \
     -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora bootstrap
   ```

2. Start the server in the background:

   ```bash
   docker run -d --name quisora --restart unless-stopped -p 8443:8443 -v quisora-data:/data \
     -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora
   ```

The data lives in the `quisora-data` volume, mounted on `/data`. Keep that volume: it is the server's data.

### With the binary

```bash
quisora bootstrap --public-url https://localhost:8443
quisora serve --public-url https://localhost:8443
```

This keeps its data in `./data`.

Either way, Quisora makes a self-signed certificate, which is fine for trying it out.

## Sign in for the first time

1. Open the link `bootstrap` printed. Your browser warns about the self-signed certificate; accept it for now.
2. Create a passkey, or set a password. You can do both.
3. Set up a second factor. Admins always need one.

{{< screenshot name="invite" alt="The invitation page, offering to create a passkey or set a password" class="max-w-3xl" >}}

The admin console is at `https://localhost:8443/admin`. From there you can add organizations, users and applications.

{{< screenshot name="org" alt="An organization's page in the admin console, with its sign-in settings" >}}

## Locked out?

If you lose the link, or can't sign in, make a new invitation while the server runs:

```bash
quisora invite primary admin@example.com
```

## Building it yourself

You don't need to build Quisora to use it. If you want to, you need Go, Node and [Task](https://taskfile.dev):

```bash
git clone https://github.com/paularlott/quisora.git
cd quisora
task build                              # makes bin/quisora
docker build -t paularlott/quisora .    # or the image
```

## What next

1. [Add your first application](/docs/applications/#your-first-application), so people can sign in to it.
2. [Add a sign-in provider](/docs/sign-in/providers/), so people can use an account they already have.
3. [Run it as a service](/docs/running/first-start/#running-as-a-service) and
   [set it up for production](/docs/running/settings/): a real address, certificate and database.
4. [Set up backups](/docs/running/backup-and-restore/).
