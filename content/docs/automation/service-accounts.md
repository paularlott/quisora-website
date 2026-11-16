---
title: "Service accounts"
description: "Give provisioning tools and pipelines their own credentials, with only the scopes they need."
weight: 20
---

A service account is a non-human account of one organization, for provisioning tools, deployment pipelines and
importers. It gets short-lived access tokens with the [client credentials grant](/docs/applications/service-to-service/#client-credentials-an-app-acting-as-itself)
and calls the management API and [SCIM](/docs/automation/scim/) with them.

Unlike a [personal API token](/docs/automation/api-tokens/) it belongs to no person, so it keeps working when someone
leaves. It holds only the scopes it was granted. It acts as an administrator of its own organization within those
scopes, and the server's own administration (keys, backups, cluster, audit log, organization settings) is closed to
it. The one exception is an account of the primary organization with `orgs:manage`, which acts as a super admin in the
organizations it created, and only there ([owning organizations](#owning-organizations)).

## Making one

In the console, open the organization's **Service accounts** page and choose **New service account**. Organization
administrators and super admins can do this, and so can a service account that holds the `service_accounts` scope.
Managers cannot.

Name it for what uses it, and pick its scopes. Quisora shows the account's client ID and its secret once. Keep the
secret safe: Quisora stores only a hash.

The account asks for tokens at its organization's token endpoint, which the page shows. Ask for `scope=...` to get a
token with fewer scopes than the account has. A token lasts 10 minutes by default and cannot be revoked, but disabling
or deleting the account, or taking a scope from it, stops the tokens already issued at once.

You can also choose how the account authenticates: with the secret Quisora issued, or with `private_key_jwt` and keys
you hold (no secret is issued then). See [client authentication](/docs/applications/client-authentication/).

## Scopes

| Scope | Lets it |
| --- | --- |
| `users` | Manage users and managers: details, email addresses, sessions, linked providers, tokens, invitations |
| `manage_admins` | With `users`, manage the organization's administrators too (never super admins) |
| `groups` | Manage groups and their members |
| `providers` | Manage sign-in providers |
| `tenants` | Create, change and delete tenants |
| `clients` | Manage applications and self-registered apps |
| `access` | Manage tenants' access lists |
| `ssh` | Manage tenants' [SSH certificate](/docs/ssh/) settings, CA keys and issued certificates |
| `ssh:host` | Only sign SSH host certificates |
| `import` | With `users`, create users with a password hash, authenticator secret or provider links ([importing](/docs/automation/api-tokens/#importing-users-with-their-credentials)) |
| `scim` | Use the SCIM API |
| `service_accounts` | Manage the organization's service accounts, granting none more than it holds |
| `orgs:create` | Create organizations (primary organization only) |
| `orgs:delete` | Delete the organizations it created (primary organization only) |
| `orgs:manage` | Act as a super admin in the organizations it created, and only there (primary organization only) |

Any service account can also read its own organization, its tenants and its applications.

## Who may grant what

- A service account can grant only scopes it holds itself, so a chain of accounts never widens.
- Only super admins grant `import`, `orgs:create`, `orgs:delete` and `orgs:manage`.
- To change, rotate or delete an account you must be able to grant every scope it holds. An administrator cannot
  reach an account that holds `import`.
- A person must have signed in or confirmed it is them recently to create, change or rotate a service account. A
  personal API token cannot do it at all.
- A service account is not asked to re-authenticate for sensitive changes, so granting `manage_admins`,
  `orgs:delete` or `orgs:manage` is a decision to take seriously.

## Rotating credentials

- **A secret**: choose **Rotate secret** on the account. The old secret stops at once, so update the tool straight
  away. Tokens already issued keep working until they expire (10 minutes by default). Where an overlap matters, use
  `private_key_jwt`.
- **Keys** (`private_key_jwt`): give the account a key set holding the old and the new key, switch the tool to the new
  key, then give it the new key alone. The account is never without a working key.

## Auditing

Every change a service account makes is in the [audit log](/docs/running/audit-log/) as `service:<name>`, and changes
to the accounts themselves are events too. Calls refused for a missing scope are recorded as `api.request.refused`.
Review service accounts and their scopes with your other access reviews.

## Creating organizations from a pipeline

A pipeline that creates an organization for each customer needs one account on the primary organization, made by a
super admin with `orgs:create` (and `orgs:delete` to remove them again). The pipeline asks the management API to
create the organization and its first service account in one request. The response carries that account's secret,
shown once, and its token endpoint. The pipeline then sets the organization up with that account and may delete it
when done. An account with `orgs:delete` can delete only organizations it created itself. The request and its
optional `branding` are in the API reference at `/api-docs/`.

## Owning organizations

A simpler pipeline: one account of the primary organization with `orgs:create` and `orgs:manage` creates each
organization and then sets it up itself, with the same credentials, as a super admin would by hand. It needs no setup
account in the new organization, though it may still make one for a tool that stays with the customer.

- **It owns the organizations it created.** On a management API request for one of them, it acts as a super admin
  there: users of every role, groups, tenants, applications, providers, service accounts, SSH, and also the
  organization's settings, branding, email templates, emergency sign-out and audit log.
- **Only there.** Everywhere else (the primary organization, an organization a person or another account created) it
  is an ordinary service account. The server's own pages (keys, backups, cluster, skins, every organization's audit
  log, the list of organizations) stay closed to it. It cannot make super admins.
- **Guest providers.** For an [Another organization](/docs/sign-in/guest-accounts/) provider, it may pick as the source
  only the primary organization or another organization it owns. It can't change or delete a provider whose source it
  does not own.
- **Ownership stays with the account.** Rotating its secret or changing its keys keeps it. Deleting the account leaves
  its organizations to the super admins. Prefer `private_key_jwt` for an owner, so its keys can change with no gap.
- Everything it does is in the organization's audit log as `service:<name>`, with `acting_as: owner`.
