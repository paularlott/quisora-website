---
title: "First start"
description: "Create the first organization and super admin, then run the server, on a host or in Docker."
weight: 10
---

`quisora serve` never creates anything. Set a new server up once with `quisora bootstrap`, then serve:

```bash
quisora bootstrap --data-dir /var/lib/quisora --public-url https://id.example.com
quisora serve --data-dir /var/lib/quisora --public-url https://id.example.com
```

You also need a master key (`quisora genkey` prints one). Set it as `server.master_key` or `QUISORA_MASTER_KEY`, and keep
it safe, apart from the data and the backups.

`bootstrap` does three things:

- It creates the **primary** organization, with a second factor required.
- It creates a super admin without a password, `server.bootstrap_admin` (default `admin@example.com`).
- It prints a single-use invitation link, good for 7 days. Open it, set a password or create a passkey, then add a
  second factor.

Running it again changes nothing. To get a new link while the server runs, use `quisora invite primary admin@example.com`.
If you are locked out of the console, see [break-glass](/docs/security/running-securely/#incident-response). Until a
server is set up, `/readyz` reports not ready.

## The primary organization

The primary organization is the first one, made by `bootstrap`, and it never changes. Super admins belong to it, and
the server's emergency sign-out counters are kept on it. Its sign-in page is `/o/<id>/login`, which is where
`https://<public_url>/` redirects to. A backup carries it, so a restored server keeps the same one. When all its super
admins are gone, `quisora invite --break-glass --super-admin` recovers access.

## Docker

The [Dockerfile](https://github.com/paularlott/quisora/blob/main/Dockerfile) builds a static binary on a distroless
base. It runs as a non-root user and keeps its data in `/data`. Settings are `QUISORA_*` variables.

```bash
docker build -t quisora .
export QUISORA_MASTER_KEY="$(docker run --rm quisora genkey)"   # keep it

docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora bootstrap
docker run -d -p 8443:8443 -v quisora-data:/data -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora
```

- Mount a volume on `/data`. It holds the store, the node's id and the audit spool.
- `quisora healthcheck` is the container health check (liveness). Do not restart a node for being unready: a cluster
  node catching up is alive. `quisora healthcheck --ready` checks readiness.
- [deploy/compose.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.yml) runs one node.
  [deploy/compose.cluster.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.cluster.yml) runs three
  nodes on PostgreSQL, as a lab example. It needs `POSTGRES_PASSWORD` and `QUISORA_NOTIFY_KEY` as well as the master key.
