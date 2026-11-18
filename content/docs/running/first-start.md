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

You also need a master key. Make it once and keep it:

1. Run `quisora genkey` once. It prints a new key.
2. Save the key in a password manager. Without it, the data can't be read.
3. Set it for Quisora: `export QUISORA_MASTER_KEY=<the key>`. Set it again in each new terminal, or put it in the
   service's environment file ([below](#running-as-a-service)).

Keep the key apart from the data and the backups.

`bootstrap` does three things:

- It creates the **primary** organization, with a second factor required.
- It creates a super admin without a password, `server.bootstrap_admin` (default `admin@example.com`).
- It prints a single-use invitation link, good for 7 days. Open it, set a password or create a passkey, then add a
  second factor.

Running it again changes nothing. To get a new link while the server runs, use `quisora invite primary admin@example.com`.
If you are locked out of the console, see [break-glass](/docs/security/running-securely/#nobody-can-get-into-the-console), the emergency way back in. Until a
server is set up, `/readyz` reports not ready.

## Running as a service

On Linux, run Quisora under systemd as its own user. Make the user, its folders and an environment file that only root
and Quisora can read:

```bash
sudo useradd --system --home-dir /var/lib/quisora --shell /usr/sbin/nologin quisora
sudo install -d -m 750 -o quisora -g quisora /var/lib/quisora
sudo install -d -m 750 -o root -g quisora /etc/quisora
sudo install -m 640 -o root -g quisora /dev/null /etc/quisora/quisora.env
sudoedit /etc/quisora/quisora.env    # QUISORA_MASTER_KEY=<the key>
```

Put settings in `/etc/quisora/quisora.toml`, which is found without `--config`. For example `server.public_url`, and
`server.data_dir = "/var/lib/quisora"`. Then write `/etc/systemd/system/quisora.service`:

```ini
[Unit]
Description=Quisora
After=network-online.target
Wants=network-online.target

[Service]
User=quisora
Group=quisora
EnvironmentFile=/etc/quisora/quisora.env
ExecStart=/usr/local/bin/quisora serve
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
# longer than server.shutdown_drain + server.shutdown_timeout (10 + 30 seconds by default)
TimeoutStopSec=60
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/quisora

[Install]
WantedBy=multi-user.target
```

Set the server up once as the service user, then start it:

```bash
sudo -u quisora sh -c 'set -a; . /etc/quisora/quisora.env; exec quisora bootstrap'
sudo systemctl daemon-reload
sudo systemctl enable --now quisora
journalctl -u quisora -f
```

- `systemctl reload quisora` applies the settings that change without a restart. Use `systemctl restart quisora` for
  the rest.
- `quisora invite` and the other commands need the same key. Run them the same way as `bootstrap` above.
- To listen on port 443 instead of 8443, add `AmbientCapabilities=CAP_NET_BIND_SERVICE` to the unit and set
  `server.listen = ":443"`.

## The primary organization

The primary organization is the first one, made by `bootstrap`, and it never changes. Super admins belong to it, and
the server's emergency sign-out counters are kept on it. Its sign-in page is `/o/<id>/login`, which is where
`https://<public_url>/` redirects to. A backup carries it, so a restored server keeps the same one. When all its super
admins are gone, `quisora invite --break-glass --super-admin` recovers access.

## Docker

The image is `paularlott/quisora` on Docker Hub. It runs as a non-root user and keeps its data in `/data`. Settings
are `QUISORA_*` variables.

`paularlott/quisora:latest` is the newest release. For production, pin a release (`paularlott/quisora:<version>`) and
change it on purpose when you [upgrade](/docs/running/upgrading/#with-docker).

1. Make the master key once, and save it in a password manager:

   ```bash
   docker run --rm paularlott/quisora genkey
   ```

2. Set it in your terminal. Do this again in each new terminal:

   ```bash
   export QUISORA_MASTER_KEY=<the key>
   ```

3. Set the server up once. Copy the invitation link it prints: `docker logs` won't show it later.

   ```bash
   docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY \
     -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora bootstrap
   ```

4. Start it in the background:

   ```bash
   docker run -d --name quisora --restart unless-stopped -p 8443:8443 -v quisora-data:/data \
     -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora
   ```

- The volume on `/data` holds the store, the node's id and the audit spool. Keep it.
- `quisora healthcheck` is the container health check (liveness). Don't restart a node for being unready: a cluster
  node catching up is alive. `quisora healthcheck --ready` checks readiness.

### Docker Compose

For one node, use [compose.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.yml). You don't need the
repository: the file uses the image from Docker Hub.

1. Download `compose.yml` into a folder of its own, and open a terminal there.
2. Make the master key once with `docker run --rm paularlott/quisora genkey`, and save it in a password manager.
3. Set it: `export QUISORA_MASTER_KEY=<the key>`.
4. Set the server up once. Copy the link it prints:

   ```bash
   docker compose run --rm quisora bootstrap
   ```

5. Start it:

   ```bash
   docker compose up -d
   ```

[compose.cluster.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.cluster.yml) runs three nodes on
PostgreSQL, as a lab example. It needs `POSTGRES_PASSWORD` and `QUISORA_NOTIFY_KEY` as well as the master key. The steps
are at the top of the file.

### Building the image yourself

From a copy of the repository: `docker build -t paularlott/quisora .`. For the
[1Password build](/docs/security/secret-stores/#1password-service-accounts), add `--build-arg GO_TAGS=onepassword`.
