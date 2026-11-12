---
title: "Service to service"
description: "Client credentials for jobs and services, and token exchange for an API calling another API."
weight: 30
---

## Client credentials: an app acting as itself

A background job or service with no user signs in as itself and gets an access token for its own scopes (RFC 6749
4.4).

In the client dialog, use a confidential client (a secret or [private key
JWT](/docs/applications/client-authentication/#private-key-jwt)) and tick **Client credentials** under **Grant
types**. Public clients cannot use it. Untick **Authorization code** and **Refresh token** if nobody signs in to it.
Add the scopes of your own APIs (`reports:read`): the user scopes such as `openid` or `profile` mean nothing here and
are never given. Register the APIs it calls under **Resources**.

```
POST /o/<org id>/oauth/token
grant_type=client_credentials&client_id=c_...&client_secret=qsrs_...
  &scope=reports:read&resource=https://reports.example.com/
```

`scope` asks for fewer scopes than the client has (without it, all of them). `resource` is an API registered on the
client; it becomes the token's `aud`. The token's `sub` and `client_id` are the client, which is how an API tells
these tokens from users' tokens. There is no refresh token: ask again before `expires_in` (10 minutes by default).

- A client credentials token cannot be revoked. To cut a client off, disable it: its tokens stop working through
  introspection at once.
- Userinfo does not accept these tokens, and signing users out does not end them.
- For Entra ID or Okta provisioning use a [service account](/docs/automation/service-accounts/) with the `scim`
  scope instead. See [SCIM](/docs/automation/scim/).

## Token exchange: calling another API for the user

When the orders API must call the billing API for the same user, forwarding the user's token would hand billing a
token never meant for it. With token exchange (RFC 8693) the orders API trades the user's token for a new one: for
billing only, with no more than the user's scopes, still naming the user, and naming orders as the actor.

**Set up the calling API (orders).** Give it its own confidential client with:

- **Token exchange** ticked under **Grant types**;
- the scopes it may pass on, and the APIs it may call under **Resources**;
- permission to exchange the user's token: either the token was issued for it (its client ID is in `aud`), or its
  client has **May introspect every token of the organization** on.

The user must also have access to the calling API's client, as for a sign-in.

**Exchange.**

```
POST /o/<org id>/oauth/token
client_id=<orders>&client_secret=<secret>
  &grant_type=urn:ietf:params:oauth:grant-type:token-exchange
  &subject_token=<the user's access token>
  &subject_token_type=urn:ietf:params:oauth:token-type:access_token
  &resource=https://billing.example.com/&scope=openid profile
```

The new token has `sub` of the user, `aud` of orders and billing, and `act` naming the orders client as the actor.
The billing API authorizes on `sub`.

| Parameter | Notes |
| --- | --- |
| `subject_token` | The user's access token from this Quisora. Not a refresh token and not a client credentials token. |
| `subject_token_type` | `urn:ietf:params:oauth:token-type:access_token` (or `...:jwt`). |
| `resource` or `audience` | The APIs the new token is for: only those registered on the calling client. Without it, the token is for the calling client alone. |
| `scope` | At most the subject token's scopes that the calling client also has. `offline_access` is dropped. |
| `authorization_details` | At most the [types](/docs/applications/authorization-details/) the subject token carries. |
| `actor_token` | Not supported: the authenticated client is the actor. |

The new token never has more than the subject token or the calling client has now, and expires no later than the
subject token. It belongs to the user's grant: signing the user out ends it. There is no refresh token or ID token:
exchange again with a fresh subject token. A DPoP-bound subject token can only be exchanged with a proof made with its
own key.

| Error | Why |
| --- | --- |
| `invalid_grant` | The subject token is invalid, expired, revoked, a client credentials token, not issued for this client, DPoP-bound without the right proof, or the user has no access to the application. |
| `invalid_target` | A `resource` or `audience` not registered on the calling client. |
| `invalid_scope` | A scope beyond the subject token's or the client's. |
| `invalid_authorization_details` | A type the subject token does not carry or the client is not registered for. |
| `unauthorized_client` | The client lacks the grant, or is public. |
| `temporarily_unavailable` (503) | A check could not be made. Keep the subject token and retry. |

Every exchange is audited as `oauth.token_exchange`.
