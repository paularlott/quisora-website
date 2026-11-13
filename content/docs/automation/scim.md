---
title: "Provisioning with SCIM"
description: "Create, update and remove users and groups automatically from Entra ID, Okta or another directory."
weight: 30
---

SCIM lets your directory (Entra ID, Okta and similar tools) create, update and disable users and groups in Quisora
by itself. Quisora speaks SCIM 2.0.

The base URL for a provisioning tool is:

```
https://id.example.com/scim/v2/<org>
```

`<org>` is the organization's name. The server describes itself at `/scim/v2/<org>/ServiceProviderConfig` and
`/scim/v2/<org>/Schemas`, and the operations are in the API reference at `/api-docs/` under the SCIM tag.

## Setting it up

1. **Pick the credential.** The best choice is a [service account](/docs/automation/service-accounts/) with the
   `scim` scope: it belongs to the organization and no person's token is involved. Give it the `groups` scope too
   only if the tool manages groups. A tool that supports OAuth uses the account's client ID and secret and gets
   short-lived tokens. A tool that wants a fixed secret can use a
   [personal API token](/docs/automation/api-tokens/) with the `scim` scope, made by a manager or administrator.
2. **Entra ID**: in your enterprise application's provisioning settings, use the base URL above as the tenant URL
   and a personal API token with the `scim` scope as the secret token. Run **Test connection**, then turn
   provisioning on.
3. **Okta**: in the application's provisioning settings, use the base URL above as the SCIM connector base URL, and
   authenticate with the same credential. Test the connection, then turn on the actions you want (create users,
   update attributes, deactivate users, push groups).
4. In Quisora, check the [audit log](/docs/running/audit-log/): changes made through SCIM are recorded under the
   token or service account that made them.

Both tools send requests that a strict reading of the standard would refuse, and Quisora accepts them. For example, a
replace through a filter that matches nothing creates the value, and attributes it does not know are ignored.

## What a SCIM client may touch

- A manager's token changes plain users and their group memberships.
- Creating, renaming, retagging or deleting a group, anything done to a manager or administrator, and setting or
  changing a user's `externalId` need an administrator's token (or a service account with `manage_admins` for
  administrators). A manager's replace that sends the `externalId` a user already has goes through.
- A personal API token, even an administrator's, can't demote, disable, end-date or delete another administrator,
  or make anyone an administrator. A directory that offboards administrators (Entra ID, Okta) needs a service account
  with `manage_admins`.
- A SCIM client never reaches a super admin.
- A user always has a primary email address, which is their sign-in name. A request that would leave a user without
  one is refused with `invalidValue`.
- A group `PUT` that leaves `members` out keeps the members. Only an explicit empty list empties it.
- Quisora stores one phone number per user.

## Searching and listing

Lists can be filtered and sorted as the standard describes, and long filters can go in a `POST` to `/Users/.search` or
`/Groups/.search`. Finding one user by `userName`, `externalId`, `emails.value` or `id`, or one group by
`displayName`, is cheap. A request whose filter leaves more than 50,000 resources is refused with `tooMany`: narrow
the filter. Ask for `excludedAttributes=members` or `excludedAttributes=groups` when the tool does not need them.

The users list also takes `?external_id=` or `?email=` for provisioning systems that keep their own ids.

## Profile pictures

A user's `photos` entry is their profile picture. To set it, send an `https` URL (fetched once, at most 5 MB) or a
`data:` URI of a JPEG, PNG or WebP image (within the 1 MB request limit). Quisora makes its own 256 by 256 picture. Anything
else is refused with `invalidValue`. One user's picture changes at most 20 times an hour. If the organization has
pictures turned off, `photos` are ignored so a directory's sync carries on unchanged.

## Errors

| Answer | Meaning |
| --- | --- |
| `412` | The `If-Match` ETag was stale |
| `413` | The body is over 1 MiB, or a group change adds or removes more than 1,000 members |
| `429` | Too many failed sign-ins from the address. Wait for `Retry-After`. |
| `503` | Quisora cannot check the token or commit the change right now. Retry after `Retry-After`. |
