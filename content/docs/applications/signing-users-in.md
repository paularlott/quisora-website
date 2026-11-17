---
title: "Signing users in"
description: "The authorization code flow with PKCE, and what you get back."
weight: 10
---

## Use a library

Use an OpenID Connect library for your language. It does every step below for you. These are the values it needs:

| Value | Where to find it |
| --- | --- |
| Issuer | `https://id.example.com/o/<org id>`, shown when you create the client. The library reads the rest from it. |
| Client ID | On the client's row in the console. |
| Client secret | Shown once, when the client is made or its secret is rotated. None for a public client. |
| Redirect URI | Your app's callback address, the same as on the client. |
| Scopes | `openid profile email`, and `offline_access` to keep the user signed in. |

The rest of this page is what happens underneath, for when you need it.

## How it works

This is the usual way to sign a user in. Your app sends the browser to Quisora. The user signs in there (whatever the
tenant allows) and approves what the app asks for. Quisora sends the browser back with a one-time **code**, and your
app exchanges it for tokens.

Quisora requires PKCE (S256) of every public client, and of confidential clients unless you turn **Require PKCE** off
on the client.

## 1. Send the browser to Quisora

```
https://id.example.com/o/<org id>/oauth/authorize
  ?response_type=code&client_id=c_...&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
  &scope=openid%20profile%20email%20offline_access&state=<random>&nonce=<random>
  &code_challenge=<S256 of your verifier>&code_challenge_method=S256
```

After sign-in, the browser returns to your redirect URI with `code`, `state` and `iss`. Check that `state` is yours and
`iss` is the organization's issuer. The code works once, for 60 seconds. If something is wrong, you get `error` and
`error_description` instead. A request that cannot be trusted to go back (an unknown client or an unregistered
redirect URI) stops on an error page.

| Parameter | Notes |
| --- | --- |
| `response_type` | `code`, always. |
| `client_id`, `redirect_uri` | The redirect URI must match one registered on the client exactly. An `http://localhost` one may use any port. |
| `scope` | Space-separated, at most the scopes the client allows. Without it, all of them. |
| `state`, `nonce` | Always send both. |
| `code_challenge`, `code_challenge_method` | PKCE; the method is `S256`. |
| `prompt` | `login` or `select_account` (sign in again), `consent` (ask again), `none` (show no page: `login_required` or `consent_required` instead). A public client always needs consent, so `prompt=none` fails for it. |
| `max_age` | Seconds: sign in again if the last sign-in is older. |
| `login_hint` | An email address to fill in on the sign-in page. |
| `acr_values` | `urn:quisora:acr:mfa` requires a second factor for this sign-in. |
| `claims` | Individual claims (OIDC Core 5.5), within the client's scopes. |
| `resource` | The API the access token is for. |
| `response_mode` | `query` (default) or `form_post`. |
| `dpop_jkt` | Bind the code to a [DPoP](/docs/applications/stronger-security/#dpop-tokens-bound-to-a-key) key. |

To keep the parameters out of the browser, [push them first](/docs/applications/stronger-security/#pushed-authorization-requests).

## 2. Exchange the code for tokens

Post to `/oauth/token`. The client authenticates as it is registered to ([client
authentication](/docs/applications/client-authentication/)); a public client sends only its `client_id`.

```
POST /o/<org id>/oauth/token
grant_type=authorization_code&code=<code>&redirect_uri=<same as before>
  &code_verifier=<your verifier>&client_id=c_...&client_secret=qsrs_...
```

The answer holds an `access_token`, an `id_token` (with `openid`), and a `refresh_token` (when the client has the
refresh grant and, for a long life, `offline_access`).

- **Access token**: a JWT for APIs. Its `aud` is the client, plus any resources.
- **ID token**: who signed in, for your app. Check its signature, `iss`, `aud` (your client ID), `exp` and `nonce`.
  `amr` says how the user signed in (`pwd`, a passkey, `otp`, `mfa` for two factors, `fed` for an upstream provider).
  It shows a second factor only when Quisora checked one itself or trusts the provider's, never on a provider's word.
  `acr` is `urn:quisora:acr:mfa` when a second factor was used.

A code used a second time fails, and everything issued from it is revoked.

## Scopes and claims

| Scope | Claims (ID token and userinfo) |
| --- | --- |
| `openid` | `sub` (the user's ID, which never changes). Makes it a sign-in with an ID token. |
| `profile` | `name`, `preferred_username`, `given_name`, `family_name`, `picture`, `locale`, `zoneinfo`, `updated_at` |
| `email` | `email`, `email_verified` |
| `phone` | `phone_number`, `phone_number_verified` |
| `groups` | `groups`: the names of the user's groups |
| `org` | `org`, `org_name`, `tenant`, `tenant_name`, `org_role` (`user`, `manager`, `admin` or `super_admin`) |
| `roles` | `roles` (the application roles the user's access gives them) and `tags` |
| `enterprise` | `enterprise`: job title, department, manager, employee number and the like |
| `idp` | `idp`, `idp_sub`, `idp_org`, `idp_org_name`, `idp_tenant`, `idp_tenant_name`, `idp_login`: the upstream provider the user signed in with, and the account there |
| `offline_access` | No claims: refresh tokens outlive the user's browser session. |

Access tokens always carry what APIs authorize on: `org`, `org_name`, `tenant`, `tenant_name`, `org_role`, `tags`,
`roles`, `acr`, `amr` and `auth_time`, plus `groups`, `enterprise` and the `idp` claims with those scopes. Scopes of
your own (`orders:read`) are listed on the client and passed through in `scope`: your API decides what they mean.
[Application roles](/docs/automation/api-tokens/#tokens-for-your-own-applications-api) arrive in `roles`, and
[authorization details](/docs/applications/authorization-details/) in `authorization_details`.

`picture` is the address of a 256 by 256 pixel image you can put straight in an `<img>`. It is left out when the user
has none. Who may set pictures is the organization's **Profile pictures** setting.

### The idp scope

A user can link several upstream accounts. With `idp`, the token says which kind of provider this sign-in used and
which account there, so an app that calls the provider's own APIs knows it is the same account.

| Claim | Meaning |
| --- | --- |
| `idp` | `microsoft`, `google`, `gitlab`, `auth0`, `oidc`, `github` or `organization` |
| `idp_sub` | The account's ID at the provider (for Microsoft, the object ID). Match on this. |
| `idp_org`, `idp_org_name` | A guest from another organization: that organization's ID and name. Otherwise absent. |
| `idp_tenant` | Microsoft: the directory. A guest: the ID of the tenant they signed in through in their own organization. Otherwise absent. |
| `idp_tenant_name` | A guest: that tenant's name. Otherwise absent. |
| `idp_login` | The account's name or email, for `login_hint`. It can change, so it is never an identity. |

All are absent when the user signed in another way, such as with a password.

For a [guest](/docs/sign-in/guest-accounts/), store the IDs (`idp_org`, `idp_sub`) and show people the names, such as
"Pat, a guest from fortix, support". The names are read when the token is issued, so they follow a rename.
`idp_tenant` is the tenant whose access list let the guest in. What the guest may do in your app is still what their
account in this organization gives them.

## Userinfo

`GET` or `POST` `/oauth/userinfo` with `Authorization: Bearer <access token>` returns the same claims as the ID
token, read fresh. A token whose user lost access since is refused (401 `invalid_token`). A 503
`temporarily_unavailable` means Quisora could not decide: keep the token and try again.

## Refreshing

```
POST /o/<org id>/oauth/token
grant_type=refresh_token&refresh_token=<token>&client_id=c_...&client_secret=qsrs_...
```

`scope` may ask for fewer scopes than were granted, and `resource` for fewer resources. Each refresh checks again
that the user is enabled and still has access. `invalid_grant` means the grant has ended: sign the user in again. A
503 means try again.

- **Rotation.** Each refresh returns a new refresh token and the old one stops working. Using an old one again ends
  the whole grant. Public clients always rotate. A confidential client that cannot keep the latest token can turn
  **Rotate refresh tokens** off on the client.
- **How long.** Without `offline_access`, a grant lasts as long as the user's browser session at Quisora. With it,
  refresh tokens last `tokens.refresh_ttl` (30 days). Signing the user out everywhere, locking them out or an
  emergency sign-out ends the grant either way.
- **How many.** Each code exchange makes a new grant, and a user keeps at most 1,000 by default
  (`limits.grants_per_user`). Past that, Quisora ends the least recently used. Refresh the tokens you have rather than
  signing in again.

## Introspection

An API can verify an access token itself (signature, `iss`, `aud`, `exp`) or ask Quisora, which also knows whether
the grant was revoked or the user signed out:

```
POST /o/<org id>/oauth/introspect
token=<access token>&client_id=<the API's client>&client_secret=<its secret>
```

The answer has `"active": true` and the token's claims. Only confidential clients introspect, and only for tokens
issued for them. An API that serves several apps turns on **May introspect every token of the organization** on its
client. A client with **Accepts personal API tokens** also introspects those. A 503 means Quisora could not decide:
neither serve nor refuse the token, retry.

## Revoking tokens

`POST /oauth/revoke` with `token` and the client's authentication. Revoking a refresh token (or one of the client's
access tokens) ends the grant, and every token from that sign-in stops working. The answer is 200 whether or not the
token was valid.

## Signing out

To sign the user out of Quisora too, send the browser to:

```
https://id.example.com/o/<org id>/oauth/logout?id_token_hint=<ID token>
  &post_logout_redirect_uri=https%3A%2F%2Fapp.example.com%2Fsigned-out&state=<state>
```

With a valid `id_token_hint` the user is signed out at once; without one they are asked to confirm. The
`post_logout_redirect_uri` must be registered on the client as a post-logout redirect URI.

**Back-channel logout.** Give the client a back-channel logout URI and Quisora posts a signed `logout_token` (with
`sid`) to it whenever one of the client's users' sessions ends. Your app ends its own session for that `sid` or
`sub`. Answer quickly: a logout your app does not accept is retried a few times over about an hour, and the same
logout can arrive twice.

## Tokens for an API

To get a token meant for one of your APIs (RFC 8707), register the API's address on the client under **Resources**
and add `resource` to the authorization request (and optionally again, the same or fewer, at the token request):

```
...&resource=https%3A%2F%2Fapi.example.com%2F
```

The access token's `aud` then holds the client ID and `https://api.example.com/`. The API checks that its own address
is there. A resource not registered on the client fails with `invalid_target`.

## Requiring a second factor

A tenant can require a second factor for every sign-in. An app can ask for one for a single sign-in with
`acr_values=urn:quisora:acr:mfa`: a user without one is asked for it. The ID token's `acr` is then
`urn:quisora:acr:mfa` and `amr` includes `mfa`.
