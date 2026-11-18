---
title: "Docker"
description: "Run Quisora in one container. The quickest way to try it."
weight: 10
---

You need Docker installed. Nothing else.

1. **Get the image** from Docker Hub:

   ```bash
   docker pull paularlott/quisora
   ```

   `paularlott/quisora:latest` is the newest release. For production, pin a release, such as
   `paularlott/quisora:<version>`, and change it on purpose when you upgrade.

2. **Make the master key**, once. Save the key it prints in a password manager:

   ```bash
   docker run --rm paularlott/quisora genkey
   ```

3. **Set the key** in your terminal. Set it again in each new terminal:

   ```bash
   export QUISORA_MASTER_KEY=<the key>
   ```

4. **Set the server up**, once. Copy the invitation link it prints: `docker logs` won't show it later.

   ```bash
   docker run --rm -v quisora-data:/data -e QUISORA_MASTER_KEY \
     -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora bootstrap
   ```

   The admin is `admin@example.com`. To use another address, add `-e QUISORA_BOOTSTRAP_ADMIN=you@example.com`.

5. **Start the server** in the background:

   ```bash
   docker run -d --name quisora --restart unless-stopped -p 8443:8443 -v quisora-data:/data \
     -e QUISORA_MASTER_KEY -e QUISORA_PUBLIC_URL=https://localhost:8443 paularlott/quisora
   ```

Quisora now answers at `https://localhost:8443`, with a self-signed certificate that is fine for trying it out. Its data
is in the `quisora-data` volume. Keep that volume: it is the server's data.

- See what it is doing: `docker logs -f quisora`.
- Stop it: `docker stop quisora`. Start it again: `docker start quisora`.

Next: [first sign-in](/docs/getting-started/first-sign-in/). For production, see
[running Quisora](/docs/running/first-start/#docker).
