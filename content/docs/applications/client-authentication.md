---
title: "Client authentication"
description: "How a client proves who it is: secret, private key JWT or nothing (public)."
weight: 20
---

Every request a client makes to the token, introspection, revocation, pushed request and device endpoints says which
client it is, and a confidential client proves it. A client is registered with one method and must use it. Set it
under **Authentication** in the client dialog.

| Method | For | How |
| --- | --- | --- |
| Client secret (POST body), `client_secret_post` | Server-side apps (the default) | `client_id` and `client_secret` in the form body |
| Client secret (Basic), `client_secret_basic` | Libraries that only do this | HTTP Basic with `client_id:client_secret`, each URL-encoded |
| **Private key JWT**, `private_key_jwt` | Higher assurance, and FAPI 2.0 | A short-lived JWT signed with the client's private key; Quisora holds only the public key |
| **Public**, `none` | Single-page, mobile and desktop apps, CLIs | `client_id` only; PKCE protects the sign-in |

## Client secrets

The secret (it looks like `qsrs_...`) is shown once, when the client is made or its secret is rotated. Copy it then:
Quisora keeps only a hash.

To rotate it, click the key icon on the client's row, then **Rotate secret**. The new secret is shown once. The old
one stops working at once, so update the app straight away. Super admins rotate the secrets of first-party clients. A
[service account](/docs/automation/service-accounts/)'s secret is rotated on its own page.

{{< screenshot name="app-client-secret" alt="The New client secret dialog, showing the client ID, issuer, discovery address and the secret once" class="max-w-2xl" >}}

Wrong secrets are limited: after 30 failures a minute for one client from one address, every attempt from there is
refused for the rest of the minute, the right secret included, and the organization's audit log gets an
`oauth.client_auth.limited` event.

## Private key JWT

For each request the client signs a short JWT (a **client assertion**, RFC 7523) with its private key. Nothing secret
is stored at Quisora. Your OAuth library makes the assertion; you register the public key.

In the client dialog choose **Private key JWT**, then paste the public keys as JSON into **Public keys (JWKS)**, or
give a **JWKS URI** (an https address where the app publishes its keys; Quisora reads it again when it meets a key ID
it does not know, so you can roll keys over by publishing the new one first).

Send the assertion instead of a secret:

```
POST /o/<org id>/oauth/token
grant_type=client_credentials
  &client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
  &client_assertion=<the signed JWT>
```

| Claim | Rule |
| --- | --- |
| `iss`, `sub` | Both the client ID. |
| `aud` | The issuer (`https://id.example.com/o/<org id>`), the token endpoint, or the endpoint being called. |
| `exp` | Required, at most 5 minutes ahead. |
| `iat`, `nbf` | Optional; not in the future. |
| `jti` | Required and unique: each assertion is accepted once. |
| Header `alg` | `EdDSA`, `ES256`, `PS256` or `RS256`. `kid` picks the key when there are several. |

`client_id` may be sent too; it must then match. A wrong assertion answers `invalid_client` with what was wrong.

## Public clients

A public client has no secret: an app anyone can download cannot keep one. It sends `client_id` alone, must use PKCE,
and its refresh tokens always rotate. It cannot use client credentials or token exchange, and cannot introspect. Its
consent is never remembered, so the user always confirms. To bind its tokens to a key it holds, use
[DPoP](/docs/applications/stronger-security/#dpop-tokens-bound-to-a-key).
