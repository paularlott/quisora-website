---
title: "Sign-in, applications and incidents"
weight: 50
---

These have guides of their own:

- **How people sign in**, and the rules that protect accounts (session lifetimes, re-authentication for sensitive
  changes, protecting administrators): [Signing in to Quisora](/docs/sign-in/), with [passkeys](/docs/sign-in/passkeys/),
  [upstream providers](/docs/sign-in/providers/), [recovery codes](/docs/sign-in/recovery-codes/) and
  [codes by email](/docs/sign-in/email-codes/).
- **Applications** (OAuth 2 and OpenID Connect): [Connecting applications: OAuth 2 and OpenID Connect](/docs/applications/).
- **Emergency sign-out and lock-out**: [Emergency sign-out and lock-out](/docs/security/emergency-sign-out/).
- **Secrets in Vault or 1Password**: [Secrets in Vault or 1Password](/docs/security/secret-stores/).
- **Personal API tokens**: [Personal API tokens](/docs/automation/api-tokens/).
- **Service accounts** (automation that belongs to no person): [Service accounts](/docs/automation/service-accounts/).

Settings the guides refer to: `session.ttl`, `session.idle`, `session.privileged_ttl` and `session.privileged_idle`
(session lifetimes); `session.upstream_check_minutes` (leaver detection); `tokens.*` (token lifetimes and signing);
`tokens.api_token_max_days`; `[secrets.vault]` and `[secrets.onepassword]`.

Some settings are only the server's defaults: an organization can set its own in the console (**Organizations**, edit,
for super admins), and the server's applies wherever it has not. They are `limits.password_min_length`,
`limits.lockout_attempts`, `limits.lockout_minutes`, `limits.grants_per_user`, `tokens.api_token_max_days`,
`session.privileged_ttl` and `session.privileged_idle`. `ui.footer` is the default footer: an organization's administrators can set its own on its
overview's branding card, and an organization without one shows the primary organization's, else `ui.footer`. TLS 1.2 connections are offered only the
forward-secret AES-GCM cipher suites (RFC 9325, as FAPI 2.0 requires); TLS 1.3 is unaffected. Behind a proxy that ends
TLS, the proxy's configuration decides.
