---
title: "Access"
linkTitle: "Access"
description: "Decide who may use a tenant's applications, for how long, and who approves it."
weight: 125
---

This section is about who may use your applications. You decide it per tenant, with an access list of people and
groups.

## What you can do

- Let everyone in the organization use a tenant's apps, or only the people you choose:
  [who can sign in](#who-can-sign-in).
- Give a person or a group access: [add them to the access list](#giving-access).
- Give access that ends at a set time: [access for a limited time](/docs/access/timed-access/).
- Let people ask for access, and have someone approve it: [access requests](/docs/access/access-requests/).
- Let people from another organization in as guests: [guest accounts](/docs/sign-in/guest-accounts/).
- Let your support team confirm that a caller is the account holder: [verifying callers](/docs/security/verifying-callers/).

## Tenants

A **tenant** is a group of applications that share sign-in rules. Every organization has a default one. You might add
another for staff tools, or one for customer apps, so each has its own rules.

In the console, open **Tenants** and choose a tenant to see its rules, its access list and its applications.

## Who can sign in

Each tenant has a **Who can sign in** setting:

- **Everyone in the organization**: every user of the organization can use the tenant's apps. The organization's
  default tenant starts this way, so its apps work at once.
- **Only users and groups given access**: only the people on the tenant's access list can. Such a tenant is called
  **members-only**. A new tenant you add starts this way, so nobody gets in until you give them access.

To change it, open the tenant, choose **Edit sign-in rules**, and pick one under **Who can sign in**.

{{< screenshot name="sign-tenant-rules" alt="The Edit sign-in rules dialog of a tenant: who can sign in, sign-in methods and providers" class="max-w-2xl" >}}

Switching to everyone keeps the access list, unused, in case you switch back.

## Giving access

On a members-only tenant, the **Access** card holds the access list. Each entry is one user or one group.

1. Open the tenant and find the **Access** card.
2. Choose **Add access**.
3. Find the user or group. A group gives access to every member, including people who join later.
4. Optionally add **Roles** and **Tags**. Apps that ask for the `roles` scope receive them in their tokens.
5. Choose the clients it covers, or leave **All of this tenant's clients** on.
6. Optionally set **Access ends** ([access for a limited time](/docs/access/timed-access/)).
7. Choose **Add access**.

{{< screenshot name="app-access-ends" alt="A tenant's Access card listing two people whose access ends at a set time and a group with no end" class="max-w-3xl" >}}

There is one entry per user or group in a tenant. To change one, choose its pencil button.

### Defaults for new access

**Edit defaults** on the Access card sets roles, tags and authorization details that every new entry gets when it
gives none of its own. That covers entries added by hand, through the API, or by an approved
[access request](/docs/access/access-requests/). Changing the defaults later changes no existing entry.

[Authorization details](/docs/applications/authorization-details/) are fine-grained permissions for your APIs.

### Removing access

Choose the trash button on the entry. The person, or the group's members, lose access at once, and are signed out of
the apps they can no longer use. Someone another entry still lets in keeps that access.

## Groups

A **group** is a set of users. Groups make access easier to manage: put a group on an access list once, then add and
remove people from the group.

- An administrator makes groups on the **Groups** page, with **New group**. **Members** adds and removes people.
  Managers can add plain users to groups and take them out.
- Tags on a group go to every member. Apps that ask for the `groups` scope get the names of a person's groups.
- A group's settings also turn on [access requests](/docs/access/access-requests/): which groups may ask, and which
  group approves.

## In this section

- [Access for a limited time](/docs/access/timed-access/): access that ends, and signs people out, at a set time
- [Access requests](/docs/access/access-requests/): people ask for access for a while, and an approver group decides
- [Guest accounts](/docs/sign-in/guest-accounts/): people from another organization, let in through a provider
