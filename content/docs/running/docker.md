---
title: "Docker"
weight: 120
---

The [Dockerfile](https://github.com/paularlott/quisora/blob/main/Dockerfile) builds a static binary on a distroless base (non-root, data in `/data`). Settings are
`QUISORA_*` variables.

```bash
docker build -t quisora .
export QUISORA_MASTER_KEY="$(docker run --rm quisora genkey)"   # keep it

docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora bootstrap
docker run -d -p 8443:8443 -v quisora-data:/data -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 quisora
```

- The container's data directory is `/data`: mount a volume there; it holds the store (BadgerDB or SQLite), the node's
  id and the audit spool.
- `quisora healthcheck` is the container health check (liveness, `/healthz`). Don't restart a node for being unready:
  a cluster node catching up is alive. `quisora healthcheck --ready` checks `/readyz`.
- Compose: [deploy/compose.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.yml) (one node), [deploy/compose.cluster.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.cluster.yml)
  (three nodes on PostgreSQL with the notice gossip, a lab example: it needs `POSTGRES_PASSWORD` and `QUISORA_NOTIFY_KEY`
  as well as `QUISORA_MASTER_KEY`).
