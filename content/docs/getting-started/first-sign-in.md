---
title: "First sign-in"
description: "Use the invitation link to set up your admin account, and open the console."
weight: 50
---

Your server is running, and `bootstrap` printed an invitation link. Now set up your admin account.

1. **Open the link.** Your browser warns about the self-signed certificate. Accept it for now.
2. **Create a passkey, or set a password.** You can do both.
3. **Set up a second factor.** Admins always need one: an authenticator app, or a passkey.

{{< screenshot name="invite" alt="The invitation page, offering to create a passkey or set a password" class="max-w-3xl" >}}

The admin console is at `https://localhost:8443/admin`. From there you add organizations, users and applications.

{{< screenshot name="org" alt="An organization's page in the admin console, with its sign-in settings" >}}

## Lost the link?

The link works once and lasts 7 days. Running `bootstrap` again changes nothing. To get a new link while the server
runs:

```bash
quisora invite primary admin@example.com                        # the binary
docker exec quisora quisora invite primary admin@example.com     # Docker
docker compose exec quisora quisora invite primary admin@example.com   # Docker Compose
```

## What next

1. [Add your first application](/docs/applications/#your-first-application), so people can sign in to it.
2. [Add a sign-in provider](/docs/sign-in/providers/), so people can use an account they already have.
3. [Run it for production](/docs/running/first-start/): a real address and certificate, a service, and your
   [settings](/docs/running/settings/).
4. [Set up backups](/docs/running/backup-and-restore/).
