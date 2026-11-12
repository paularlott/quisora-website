---
title: "Stronger security"
description: "Pushed authorization requests, DPoP-bound tokens and the FAPI 2.0 profile."
weight: 50
---

Three features for apps where a leaked token or request costs real money or privacy. Each is a setting on the client,
and your OAuth library does the protocol work.

## Pushed authorization requests

With a pushed authorization request (PAR, RFC 9126) the app sends its sign-in parameters to Quisora directly, server
to server and authenticated. The browser carries only a short reference. The parameters cannot be read or changed on
the way, and are checked before the user sees anything. Any confidential client can use it.

**1. Push the request.** Post everything that would go in the authorization URL to `/oauth/par`, with the client's
authentication:

```
POST /o/<org id>/oauth/par
client_id=c_...&client_secret=qsrs_...&response_type=code&redirect_uri=...
  &scope=openid profile&state=...&nonce=...&code_challenge=...&code_challenge_method=S256
```

The answer is `201 Created` with `{"request_uri": "urn:ietf:params:oauth:request_uri:...", "expires_in": 60}`. Any
problem with the request is answered here as an OAuth error.

**2. Send the browser** to `/oauth/authorize?client_id=c_...&request_uri=<the request_uri>`. Other parameters in the
URL are ignored. The sign-in then works as usual, and the app exchanges the code as in [signing users
in](/docs/applications/signing-users-in/#2-exchange-the-code-for-tokens).

- The browser must reach the authorization endpoint within **60 seconds** of the push.
- A `request_uri` works for one client only, and once.
- A request over 4 KB is refused.
- Request objects (JAR) are not supported.

To refuse any other kind of sign-in request, turn on **Require pushed authorization requests** on the client. A DPoP
proof sent with the push binds the code to that key.

## DPoP: tokens bound to a key

An ordinary access token is a bearer token: whoever holds it can use it. With DPoP (RFC 9449) the app holds a private
key and proves it on every request. Its tokens are bound to that key and refused without a fresh proof made with it,
so a copied token is useless.

A **DPoP proof** is a small JWT signed with the app's key, made for one request: the method (`htm`), the URL
(`htu`), the time (`iat`), a unique `jti` and, with an access token, the token's hash (`ath`). It goes in a `DPoP`
header.

**Getting a bound token.** Any token request can carry a proof: code exchange, refresh, client credentials, token
exchange, device sign-in. Proofs at the token endpoint need a **nonce** from Quisora. The first request without one
fails with `use_dpop_nonce`, and every answer carries the nonce to use next in its `DPoP-Nonce` header. Retry with it.
The answer has `"token_type": "DPoP"`, and the access token's `cnf.jkt` is the key's thumbprint. A nonce lasts two to
three minutes, each proof works once, and its `iat` must be within 5 minutes of the server's clock.

**Using the token.** At userinfo, SCIM and any API that supports DPoP, send `Authorization: DPoP <token>` (not
`Bearer`) with a new proof for that request. The same token with no proof, a proof from another key, or as `Bearer`
is refused.

**Refresh tokens.** A public client's refresh tokens are bound to the key of its first proof: each refresh needs a
proof from that key. A confidential client's stay bound to its client authentication.

**Binding the code too.** Add `dpop_jkt=<the key's thumbprint>` to the authorization request, or send a proof with the
pushed request. The code is then exchanged only with a proof from that key.

**Requiring it.** Turn on **Require DPoP-bound tokens** on the client to refuse token requests without a proof. Turn
it on once the app sends proofs.

**For APIs that check tokens themselves.** For a token with `cnf.jkt`, an API must accept it only with the `DPoP`
scheme and one proof in the `DPoP` header, verify the proof's signature with the `jwk` in its header, check that the
key's thumbprint equals `cnf.jkt`, check `htm` and `htu` against the request, that `iat` is recent and `jti` is new,
and that `ath` is the base64url SHA-256 of the access token. A DPoP library does all of this. Introspection reports
`cnf`, and the API still checks the proof.

| Error | Why |
| --- | --- |
| `use_dpop_nonce` (400) | The proof had no nonce, or an old one. Retry with the `DPoP-Nonce` header's value. |
| `invalid_dpop_proof` | The proof is malformed, for another method or URL, too old, used before, or missing when the client requires one. |
| `invalid_grant` (refresh token or subject token bound to a DPoP key) | Presented without a proof, or with one from another key. |
| `invalid_grant` (not made with the key the authorization request named) | A code bound with `dpop_jkt` exchanged with another key. |

## FAPI 2.0 Security Profile

The FAPI 2.0 Security Profile is the OpenID Foundation's rule set for APIs such as open banking, health records and
payments. Quisora passes its certification tests for the `private_key_jwt` plus DPoP variant. Turn it on per client:
**FAPI 2.0 Security Profile** in the client dialog (shown for **Private key JWT**). Other clients are unaffected.

| | What it means for the client |
| --- | --- |
| Client authentication | [Private key JWT](/docs/applications/client-authentication/#private-key-jwt) only. The assertion's `aud` must be the issuer alone, as a string, and it must not be RS256. |
| Sign-in requests | Pushed only: **Require pushed authorization requests** is on. |
| Tokens | DPoP-bound only: **Require DPoP-bound tokens** is on. No RS256 proofs. |
| Refresh tokens | Do not rotate: the same refresh token keeps working. |
| ID tokens | Signed with PS256, ES256 or EdDSA, never RS256. |
| Authorization codes | Last at most 60 seconds. |
| PKCE | Required (S256). |
| Grants | The device grant is not allowed. |

Saving a FAPI client that cannot meet these (a client secret, RS256 ID tokens, PKCE off, the device grant) is refused,
naming the field to fix.

A sign-in is a push with a DPoP proof (the first push gets the nonce), the browser sent to `/oauth/authorize` with the
`request_uri` within 60 seconds, then a code exchange within 60 seconds with a new client assertion and a proof from
the same key. Refreshing works the same way, and returns no new refresh token.

Quisora offers only forward-secret AEAD cipher suites over TLS 1.2 (and TLS 1.3 as usual). Behind a proxy that ends
TLS, the proxy's configuration decides. mTLS is not supported: use DPoP and private key JWT.

| Error | Why |
| --- | --- |
| `invalid_client`: assertion needs `aud` set to the issuer alone | The `aud` is the token endpoint or an array, or it is RS256. |
| `invalid_request` (at the redirect URI): must push its authorization requests | The request was made without PAR. |
| `invalid_dpop_proof`: must send a DPoP proof | A token request without a proof. |
