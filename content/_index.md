---
title: Quisora
description: Quisora is an open source identity provider in one binary. Passkeys, second factors and single sign-on for your applications, on your own servers.
layout: index
---

{{< hero
  kicker="Open source identity provider"
  title="Sign-in for your apps, *on your own servers*"
  subtitle="Quisora signs people in to your applications. Passkeys, authenticator apps and single sign-on are built in, and it all runs from one small program you host yourself."
  btn1="Get started"
  btn1Link="/docs/getting-started/"
  btn2="View on GitHub"
  btn2Link="https://github.com/paularlott/quisora"
  shot="users"
  alt="The Quisora admin console, listing the users of an organization"
>}}

{{< features
  title="Why Quisora?"
  intro="Every app needs sign-in. Quisora gives you one safe place for it, so each app doesn't have to build its own."
>}}

{{< feature icon="server" title="Yours to run" >}}
One binary for Linux, macOS or Windows. Your users and their data stay on servers you control, with no outside service in the loop.
{{< /feature >}}

{{< feature icon="key" title="Passkeys first" >}}
People sign in with a fingerprint, face or device PIN. Passwords with an authenticator app work too, with recovery codes for a lost phone.
{{< /feature >}}

{{< feature icon="plug" title="Works with your apps" >}}
Standard OpenID Connect and OAuth 2. Any app or library that speaks them can use Quisora to sign people in.
{{< /feature >}}

{{< feature icon="users" title="Many organizations" >}}
Run sign-in for several companies, teams or customers from one server. Each organization has its own users, rules and look.
{{< /feature >}}

{{< feature icon="shield" title="Safe by default" >}}
Admins always use a second factor. Secrets are sealed at rest, every change is in the audit log, and backups are always encrypted.
{{< /feature >}}

{{< feature icon="palette" title="An accessible console" >}}
A clean admin console in light and dark, built to WCAG 2.2 AA. Changes show up live, and nothing loads from a CDN.
{{< /feature >}}

{{< /features >}}

{{< showcase shot="login" alt="The sign-in page of an organization, with single sign-on, passkey and email options" >}}
## A sign-in page for each organization

Each organization gets its own sign-in page. Offer passkeys, a password with a second factor, or "Continue with" Google, Microsoft, GitHub, GitLab, Auth0 or your own single sign-on.

[About sign-in providers](/docs/sign-in/providers/)
{{< /showcase >}}

{{< showcase shot="passkeys" alt="The passkeys card on a user's account page, listing two passkeys" reverse="true" >}}
## People look after their own account

On their account page, people add passkeys and authenticator apps, see where they are signed in, and make API tokens for their scripts.

[About passkeys and authenticator apps](/docs/sign-in/second-factors/)
{{< /showcase >}}

{{< showcase shot="system" alt="The system overview, showing a three node cluster" >}}
## Grows with you

Start with one node on its built-in database. Later, run several nodes on PostgreSQL, MySQL or MariaDB, or let each node keep its own copy and replicate.

[About running a cluster](/docs/running/clustering/)
{{< /showcase >}}

{{< features
  title="Everything in the box"
  intro="No plugins to hunt for. These all come with Quisora."
>}}

{{< feature icon="code" title="Automation" >}}
A REST API with an OpenAPI document, SCIM 2.0 for Entra ID and Okta, personal API tokens and service accounts.
{{< /feature >}}

{{< feature icon="terminal" title="SSH certificates" >}}
Short-lived SSH certificates for people who signed in with a second factor. No more copying keys to every server.
{{< /feature >}}

{{< feature icon="archive" title="Backups" >}}
Online backups, always encrypted with a password. A restore is checked before anything is written.
{{< /feature >}}

{{< /features >}}

<section class="glass mt-20 p-6 sm:p-10 text-center">
  <h2 class="text-3xl font-extrabold tracking-tight mb-3">Getting started</h2>
  <p class="text-muted text-lg max-w-xl mx-auto mb-6">Make a master key once and save it in a password manager. Set it in your terminal, set the server up once, and start it. Then open the link it prints and make your admin account.</p>
  <div class="max-w-2xl mx-auto text-left">

```bash
quisora genkey                       # once: save the key it prints in a password manager
export QUISORA_MASTER_KEY=<the key>  # again in each new terminal
quisora bootstrap --public-url https://localhost:8443
quisora serve --public-url https://localhost:8443
```

  </div>
  <a href="/docs/getting-started/" class="btn btn-primary mt-4">Read the getting started guide</a>
</section>
