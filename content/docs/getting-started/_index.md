---
title: Getting started
description: Install Quisora, set it up once, and sign in for the first time.
weight: 10
guide: true
---

Quisora is an identity provider: your applications send people to it to sign in, and it sends them back with a token
that says who they are. It runs from one small program on a server you control.

At the end of this guide you will have one Quisora server running, with an admin account you can sign in to. It takes
a few minutes.

## Choose how to run it

Pick one. Each page takes you from nothing to a running server.

| Route | Good for |
| --- | --- |
| [Docker](/docs/getting-started/docker/) | One container. The quickest way to try Quisora. |
| [Docker Compose](/docs/getting-started/docker-compose/) | One node from a downloaded `compose.yml`. Easy to keep running. |
| [The quisora binary](/docs/getting-started/binary/) | Download it for Linux, macOS or Windows and run it on a host. Leads on to running it as a service. |
| [Build from source](/docs/getting-started/build-from-source/) | For people who want to change Quisora. |

Every route ends at [First sign-in](/docs/getting-started/first-sign-in/), where you set up your admin account.

## What you need to know first

- **The master key** locks every secret Quisora keeps. You make it once and save it in a password manager. Without it,
  the data can't be read.
- **Bootstrap** sets a new server up once. It creates the first organization, called `primary`, and a super admin
  account, and prints a link to finish setting up that account.
