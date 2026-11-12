---
title: "Personal API tokens"
description: "Let a script call Quisora as you, without a browser."
weight: 10
---

A personal API token lets a script or tool call Quisora as you. Every call is checked against your role at the time it
is made. If you are demoted or your account is disabled, the token loses that access too.

## Making a token

1. Open **Your account** and find the **API tokens** card.
2. Choose **New token**, name it and pick its scopes.
3. Set an expiry if you like. Left empty, the token gets the organization's longest lifetime, or never expires if
   there is no limit.
4. Copy the token. It is shown once and looks like `qsr_<id>_<secret>`. Quisora keeps only a hash of the secret.

{{< screenshot name="tokens" alt="The API tokens card on the account page, listing two tokens with their scopes and expiry dates" >}}

## Scopes

| Scope | Who can pick it | What the token can do |
| --- | --- | --- |
| `admin` | Managers and up | Call the management API (`/api/...`, what the console uses), including the live event stream |
| `scim` | Managers and up | Call the SCIM 2.0 API, for provisioning tools |
| `backup` | Super admins | Download a backup, and nothing else. Expires within 30 days. |
| `import` | Super admins | With `admin`: create users with the password hash, authenticator secret and provider links they had in another system |
| `api` | Whoever the organization allows | Nothing in Quisora itself: it is for your own applications, which check it with Quisora |

An `api` token cannot also carry `admin`, `scim`, `backup` or `import`. Make one token for each job.

## Using a token

Send it as a bearer token:

```bash
curl -H "Authorization: Bearer $TOKEN" "https://id.example.com/api/orgs/acme/users?limit=10"
```

A `401` means the token is wrong, revoked or expired, or its owner is disabled. A `403` with `insufficient_scope`
means the token lacks the scope that call needs.

## Changing and revoking

- **Edit** (the pencil) changes a token's name, applications and scopes. It asks you to confirm it is you.
- **New secret** (the refresh button) makes a new secret after you confirm. The old one stops working at once.
- **Delete** revokes the token. Administrators can revoke a user's tokens from the user's page.
- To end every personal token in an organization at once, use [emergency sign-out](/docs/security/emergency-sign-out/)
  with **End personal API tokens too**.

A token lasts at most the organization's longest lifetime, set by a super admin on the organization (the server
default is 365 days). Setting a new secret does not extend it.

Every change made with a token is recorded in the [audit log](/docs/running/audit-log/) with the token's id, so a
misused token can be found and deleted.

## Importing users with their credentials

To move people from another system without making them set up everything again, a super admin's token with the
`admin` and `import` scopes (or a [service account](/docs/automation/service-accounts/) with `users` and `import`)
can create users together with:

- a **password hash** (`password_hash`): bcrypt, SHA-512 crypt or argon2id. The first sign-in checks it and re-hashes
  the password the Quisora way.
- an **authenticator secret** (`totp_secret`): the user keeps their app, and their next code works.
- **provider links** (`identities`): the user's first sign-in through that provider finds this account.

This is accepted only when a user is created, never on an update. Good to know:

- Imported users have no recovery codes. Their account page asks them to make some, so tell them.
- Do not send an invitation to a user imported this way: accepting it replaces everything they sign in with.
- bcrypt reads only the first 72 bytes of a password, so someone with a longer old password needs an invitation.
- Authenticator secrets are keys to the second factor. Move them server to server over TLS and never write them to a
  file, a ticket or a chat.
- Import only credentials and links you vouch for. If the user is later promoted to manager or above, links they
  did not connect themselves are dropped.

The request body is in the API reference at `/api-docs/`.

## Tokens for your own applications (`api`)

An `api` token is for your scripts calling your own applications. The application checks each token it receives with
Quisora's token introspection, as a confidential client of the same organization, and learns who the token belongs to,
their organization role, their application roles and their tags.

Two settings decide whether it works:

1. **Who may make them.** A super admin sets **API tokens for applications** in the organization's dialog on the
   **Organizations** page: nobody (the default), the members of chosen groups, or everyone. It is checked every time
   a token is used, so turning it off stops the tokens at once. They are kept, and work again if you turn it back on.
2. **Which applications accept them.** An application must have **Accepts personal API tokens** turned on in its
   settings (off by default, never for a public client). Until then it sees every `api` token as inactive.

When you make an `api` token you can tick the **Applications** that may accept it (none ticked means every
application you can use that accepts them) and **Limit to these scopes**, so a script can, for example, read orders
but not change them. A scope only narrows what your roles allow.

Introspection of an `api` token is at `/o/<org id>/oauth/introspect`. The application should allow only what both the
user's roles and the token's scopes allow.
