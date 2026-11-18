---
title: "The quisora binary"
linkTitle: "The quisora binary"
description: "Download Quisora for Linux, macOS or Windows and run it on a host."
weight: 30
---

Quisora is one program, `quisora`. These steps use a terminal on Linux or macOS. On Windows, use PowerShell and set
variables with `$env:QUISORA_MASTER_KEY = "<the key>"` instead of `export`.

1. **Download** the binary for your system from the [releases on GitHub](https://github.com/paularlott/quisora/releases).
   Take `quisora-<os>-<arch>`, such as `quisora-linux-amd64`. If you don't use
   [1Password service accounts](/docs/security/secret-stores/#1password-service-accounts), `quisora-slim-<os>-<arch>`
   is a smaller file without them.
   Name it `quisora` and put it somewhere on your path. On Linux and macOS, make it runnable:
   `chmod +x quisora`.

2. **Make the master key**, once. Save the key it prints in a password manager:

   ```bash
   quisora genkey
   ```

3. **Set the key** in your terminal. Set it again in each new terminal:

   ```bash
   export QUISORA_MASTER_KEY=<the key>
   ```

4. **Set the server up**, once. Copy the invitation link it prints:

   ```bash
   quisora bootstrap --public-url https://localhost:8443
   ```

   The admin is `admin@example.com`. To use another address, add `--bootstrap-admin you@example.com`.

5. **Start the server:**

   ```bash
   quisora serve --public-url https://localhost:8443
   ```

Quisora now answers at `https://localhost:8443`, with a self-signed certificate that is fine for trying it out. It keeps
its data in `./data`, in the folder you ran it from. Stop it with Ctrl+C.

Next: [first sign-in](/docs/getting-started/first-sign-in/). To keep it running on a Linux server, see
[running as a service](/docs/running/first-start/#running-as-a-service).
