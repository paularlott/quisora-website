---
title: "Connecting applications: OAuth 2 and OpenID Connect"
linkTitle: "Connecting applications"
description: "Sign users in to your apps with OpenID Connect, and get tokens for services and APIs."
weight: 130
---

Quisora is an OpenID Connect provider and OAuth 2 authorization server. Your apps sign users in through it, your APIs
check the tokens it issues, and your services get tokens of their own.

Each organization is its own authorization server. Its **issuer** is your server's address, then `/o/`, then the
organization's id (for example `https://id.example.com/o/034nmRmWuXazwvCcdrmRxu`). Every endpoint is under it. Any
certified OpenID Connect library works: give it the issuer and it reads the rest from discovery at
`<issuer>/.well-known/openid-configuration`. Use the id form, not the organization's name: the issuer in tokens and
in generated links is always the id.

## Registering a client

An application is a **client**. It belongs to a tenant, and so to one organization: its client ID is unknown at any
other organization's endpoints. The tenant decides who may sign in and how, so first decide which tenant the app
belongs in.

In the console, open the organization, then **Tenants**, the tenant, and **Clients**. Click **New client**.

{{< screenshot name="app-clients" alt="The Clients page of a tenant, with its list of clients and the New client button" >}}

{{< screenshot name="app-client-new" alt="The New client dialog with authentication, grant types and redirect URIs" class="max-w-3xl" >}}

| Setting | What to choose |
| --- | --- |
| **Authentication** | A secret for a server-side app. **Public** for an app that cannot keep a secret (single-page, mobile, desktop, CLI). **Private key JWT** for higher assurance ([client authentication](/docs/applications/client-authentication/)). |
| **Grant types** | **Authorization code** to sign users in, **Refresh token**, **Client credentials**, **Token exchange**, **Device sign-in**. |
| **Redirect URIs** | Where the sign-in result goes. Use https, `http://localhost` for desktop apps, or a private scheme such as `com.example.app:/callback` for mobile apps. |
| **Allowed scopes** | The standard scopes it may ask users for, and scopes of your own APIs. A scope you take off counts at once: it is left out of tokens from then on, even from a refresh or a sign-in code issued before the change. |
| **Resources** | The APIs it may ask tokens for ([resource indicators](/docs/applications/signing-users-in/#tokens-for-an-api)). |

The client ID is on the client's row. The client secret is shown once, when the client is made or its secret is
rotated.

### Consent

Users approve what an application asks for on a consent screen. Each client chooses how often:

- **By default**, once each time they sign in. Signing out ends the approval.
- **Remember consent** asks each user once. The approval stays until the user removes the app under **Connected
  apps** on their account page, a manager removes it, or the account is locked out.
- **First-party application** (super admins only) never asks. A tenant's SSH application always asks.

The screen comes back whenever the app asks for new scopes or resources, changes its redirect URIs or credentials, or
sends `prompt=consent`. A public client and a device sign-in always ask, whatever the setting.

## Endpoints

All under the issuer `/o/<org id>`:

| Path | What it is |
| --- | --- |
| `/.well-known/openid-configuration` | Discovery (also `/.well-known/oauth-authorization-server`) |
| `/oauth/authorize` | Authorization (the browser) |
| `/oauth/token` | Token |
| `/oauth/userinfo` | Userinfo |
| `/oauth/jwks` | Signing keys |
| `/oauth/introspect` | Introspection (RFC 7662) |
| `/oauth/revoke` | Revocation (RFC 7009) |
| `/oauth/logout` | End session (RP-initiated logout) |
| `/oauth/par` | Pushed authorization requests (RFC 9126) |
| `/oauth/device_authorization`, `/device` | Device sign-in (RFC 8628) |
| `/oauth/register` | Dynamic client registration (RFC 7591), for [self-registered apps](/docs/automation/mcp/) |

Behind a proxy, set `server.trust_proxy`. Otherwise every user shares the proxy's address, and each address may make
only 300 authorization requests a minute.

## Tokens

| Token | Lifetime | Setting |
| --- | --- | --- |
| Authorization code | 60 seconds | `tokens.code_ttl` (at most 600) |
| Access token | 10 minutes | `tokens.access_ttl` |
| ID token | 10 minutes | `tokens.id_token_ttl` |
| Refresh token | 30 days, and only as long as the user's session without `offline_access` | `tokens.refresh_ttl` |

Access and ID tokens are JWTs signed with keys that rotate automatically (ES256 by default; EdDSA, RS256 or PS256 per
client). Verify them against the organization's `/oauth/jwks`, check `iss`, and refresh the keys when a token names a
`kid` you do not have.

Signing a user out, locking them out, removing their access or an
[emergency sign-out](/docs/security/emergency-sign-out/) ends their grants. Refresh tokens stop at once. Access
tokens stop working through introspection and userinfo. An API that only checks signatures accepts them until they
expire.

## Not supported

The implicit and hybrid flows, the password grant, request objects (JAR), mTLS client authentication and
certificate-bound tokens, and front-channel logout.

Everything in the console can also be done through the management API. Every server shows its API reference at
`/api-docs/`.

## In this guide

- [Signing users in](/docs/applications/signing-users-in/): authorization code with PKCE, scopes and claims, refresh, introspection, sign-out
- [Client authentication](/docs/applications/client-authentication/): secrets, private key JWT and public clients
- [Service to service](/docs/applications/service-to-service/): client credentials and token exchange
- [Device sign-in](/docs/applications/device-sign-in/): sign in on a CLI, a TV or another device without a browser
- [Stronger security](/docs/applications/stronger-security/): pushed requests, DPoP and the FAPI 2.0 profile
- [Authorization details](/docs/applications/authorization-details/): fine-grained permissions in access tokens
