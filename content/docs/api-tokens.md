---
title: API tokens
description: Let a script or tool call Quisora as you, without a browser.
weight: 50
---

A personal API token lets a script call Quisora as you. A token never has more access than you do. If your role changes or your account is turned off, the token loses that access too.

{{< screenshot name="tokens" alt="The API tokens card on the account page, listing two tokens with their scopes and expiry dates" >}}

## Making a token

1. Go to **Your account**, then **API tokens** and **New token**.
2. Give it a name and pick what it may do (its scopes).
3. Choose when it expires, if you like.
4. Copy the token. It is shown once, and looks like `qsr_<id>_<secret>`.

Quisora keeps only a hash of the secret, so it can't show it to you again.

## Scopes

| Scope | Who can pick it | What it is for |
| --- | --- | --- |
| `admin` | Managers and up | The management API, `/api/...`, which the admin console uses |
| `scim` | Managers and up | The SCIM 2.0 API, for provisioning tools |
| `backup` | Super admins | Taking [backups](/docs/backups/). Expires within 30 days. |
| `import` | Super admins | Bringing in users with their passwords from another system |
| `api` | As the organization allows | Your own applications, which check the token with Quisora |

An `api` token can't have any of the other scopes. Make a separate token for each job.

## Using a token

Send it as a bearer token:

```bash
export QUISORA=https://id.example.com
export TOKEN=qsr_...
curl -H "Authorization: Bearer $TOKEN" "$QUISORA/api/orgs/acme/users?limit=10"
```

The full API reference is on your own server at `/api-docs`.

## Changing and revoking

- **Edit** changes a token's name, and for an `api` token, which apps it is for.
- **New secret** replaces the secret. The old one stops working at once.
- **Delete** revokes the token. Admins can also revoke someone's tokens from their user page.

Tokens last at most 365 days unless a super admin sets a different limit for the organization.

{{< tip >}}
For automation that shouldn't depend on one person, use a [service account](/docs/automation/service-accounts/) instead. It belongs to the organization, not to a user.
{{< /tip >}}

## More

The [full API tokens guide](/docs/automation/api-tokens/) covers SCIM, importing users, and checking `api` tokens from your own apps.
