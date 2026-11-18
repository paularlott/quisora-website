---
title: "Docker Compose"
description: "Run one Quisora node from a downloaded compose.yml."
weight: 20
---

You need Docker with Compose. You don't need the Quisora repository: the file uses the image from Docker Hub.

1. **Download** [compose.yml](https://github.com/paularlott/quisora/blob/main/deploy/compose.yml) into a folder of its
   own, and open a terminal there:

   ```bash
   mkdir quisora && cd quisora
   curl -fsSLO https://raw.githubusercontent.com/paularlott/quisora/main/deploy/compose.yml
   ```

2. **Make the master key**, once. Save the key it prints in a password manager:

   ```bash
   docker run --rm paularlott/quisora genkey
   ```

3. **Set the key** in your terminal. Every `docker compose` command for Quisora needs it, so set it again in each new
   terminal:

   ```bash
   export QUISORA_MASTER_KEY=<the key>
   ```

4. **Set the server up**, once. Copy the invitation link it prints:

   ```bash
   docker compose run --rm quisora bootstrap
   ```

   The admin is `admin@example.com`. To use another address, set `QUISORA_BOOTSTRAP_ADMIN` before this step.

5. **Start it:**

   ```bash
   docker compose up -d
   ```

Quisora now answers at `https://localhost:8443`, with a self-signed certificate that is fine for trying it out. Its data
is in a named volume, and the container restarts by itself unless you stop it.

- See what it is doing: `docker compose logs -f`.
- Stop it: `docker compose down`. This keeps the volume, and so the data.
- Set `QUISORA_PUBLIC_URL` and `QUISORA_PORT` to use another address or port.

Next: [first sign-in](/docs/getting-started/first-sign-in/). To upgrade later, see
[upgrading](/docs/running/upgrading/#with-docker).
