---
title: "Build from source"
description: "Build Quisora yourself, for people who want to change it."
weight: 40
---

You don't need to build Quisora to use it. Build it if you want to change it.

You need Go 1.27, Node 24 and [Task](https://taskfile.dev).

1. **Get the code:**

   ```bash
   git clone https://github.com/paularlott/quisora.git
   cd quisora
   ```

2. **Build the binary:**

   ```bash
   task build        # makes bin/quisora
   ```

   Or build the image instead: `docker build -t paularlott/quisora .`

3. **Run it.** From here, follow the steps for [the quisora binary](/docs/getting-started/binary/) from step 2, using
   `bin/quisora`. For the image you built, follow [Docker](/docs/getting-started/docker/) from step 2.

For the build with 1Password service accounts, see [secret stores](/docs/security/secret-stores/#1password-service-accounts).

Next: [first sign-in](/docs/getting-started/first-sign-in/).
