---
title: "Guest accounts"
description: "Let the people of one organization sign in to another organization's applications."
weight: 30
---

Organizations are separate: a user belongs to one and signs in there. To let the people of one organization (often the
primary one) use another organization's applications, add an **Another organization** provider to the second one. It
works like a guest (B2B) account in Microsoft Entra: people keep signing in where they belong, and the other
organization lets them in as guests. Its sign-in page shows **Continue with** and the first organization's name.

In this page, **S** is the organization whose users sign in, and **B** is the one that receives the guests. Only a
**super admin** can create, change or delete such a provider, or a service account that
[owns](/docs/automation/service-accounts/#owning-organizations) B, when S is the primary organization or another
organization it owns.

## Setting it up

In organization B, open **Providers**, then **New provider**, and choose the type **Another organization**. Then pick
S and one of its tenants: type the start of S's name, or the tenant's, and choose **S (tenant)** from the list. It
searches as you type, so `S (sup` narrows to S's tenants starting "sup". Nothing else is needed. You do not enter a
client ID, secret or scopes.

{{< screenshot name="sign-org-provider" alt="The New sign-in provider dialog with the type Another organization and the organization and tenant list filtered as you type" class="max-w-2xl" >}}

The tenant decides who in S may sign in. S's default tenant suits "everyone in S". A members-only tenant limits it to
the people on its access list, for as long as their access lasts ([below](#only-some-people-for-a-time)).

Quisora makes the client the provider signs in with, in S: an application named `Sign-in to <B's name>` in the chosen
tenant. It is listed with S's applications, but edit the provider, not the application: it is made and removed with
the provider. S's own rules for that tenant (who may sign in, second factors) apply to the sign-in at S.

**Button label** defaults to S's display name. **Link existing users by verified email**, **Create accounts
automatically** and **counts as a second factor** are all off. Allowed email domains work as for any provider.

Changing the organization of an existing provider unlinks everyone who signed in through it. Changing the tenant
signs out the guests who signed in through the old one. They sign in again, under the new tenant's access list.

## Adding guests

Choose one of two ways when you set the provider up. You can combine them.

**Create accounts automatically** (recommended). Every user of S who signs in becomes a guest: a plain `user` in B,
with their S name and verified address, made on their first sign-in. Keep it bounded with **Only members of these
groups** (below), **Allowed email domains** and the tenants' access lists. An address that one of B's users already has
is refused, so nobody takes over an existing account this way.

**Add each person by hand.** An administrator of B adds them (**Users**, then **New user**, or an invitation) with the
same email address they have in S, verified. A super admin switches **Link existing users by verified email** on for
the provider. The person then chooses **Continue with ...** on B's sign-in page, signs in at S if needed, and returns
to B. Someone S knows but B has not added is refused.

{{< tip "warning" >}}
Linking by email is off by default here because it trusts S to say whose address is whose. S's managers,
administrators and service accounts can mark any address verified, so each could then sign in to B as any of B's
users. Switch it on only for an organization whose staff you trust that far.
{{< /tip >}}

Managers and administrators of B are never linked by email: they connect the provider on their own account page.

## Only some of S's users

**Only members of these groups** limits the provider to the members of up to 20 groups of S. Someone in none of them is
refused before anything else happens, so no guest is made for them. It is checked at every sign-in. With no groups
chosen, every user of S may sign in. If a chosen group is deleted in S it admits nobody. Choosing another source
organization clears the groups.

## Only some people, for a time

For a vendor's support staff reaching into a customer's organization (S the vendor, B the customer), pick a
members-only tenant of S as the provider's tenant, say `customer-access`. Only the people on its access list can sign
in to B through the provider. Give each of them an entry that ends
([access for a limited time](/docs/applications/timed-access/)).

- Without a live entry, their own or a group's, signing in through the provider is refused at S.
- When their entry ends, is removed or narrowed, the guest is out of B at once, and their sessions in B are signed out.
  Their access tokens and SSH certificates in B expire by the entry's end.
- B still decides what the guest gets in B: **Create accounts automatically**, the groups, and B's own tenants' access
  lists, which can have ends of their own.

## Second factors and leavers

A guest signs in to B with a first factor only, and B's own rules ask for a second factor where one is required.
Applications with the [`idp` scope](/docs/applications/signing-users-in/#the-idp-scope) also learn where the guest came
from: `idp_org` and `idp_org_name` (S), `idp_tenant` and `idp_tenant_name` (the tenant of S they signed in through)
and `idp_sub` (their ID in S).

A
super admin can turn on **counts as a second factor** when S's rules require one of everybody who signs in to that
application. Then B asks plain users for none.

A guest can't set a password, add a passkey or connect another sign-in provider in B. Any of those would let them sign
in without S, and keep access after S removes them. Their second factor in B is an authenticator app: where B asks
for one, the guest is offered the app only.

If an administrator of B sends the guest an invitation, accepting it makes the account B's own. That ends the link to
S, so S removing the person no longer reaches that account.

There is no leaver check through a refresh token, because S and B are on the same server. Instead a guest's session in
B stands on the session at S it signed in with. When a person's sessions end in S (signed out everywhere, disabled,
locked out, past their end date, sign-in reset, promoted to manager, or deleted), or they lose access to the
provider's tenant in S, the guest's sessions, refresh grants
and SSH certificates in B stop working too, within seconds. The guest account itself stays, and the person can sign in
again through S if S still lets them. Personal API tokens a guest made in B stop the same way, except that they go on
when the person only signs out in S.

{{< tip >}}
Taking someone out of the provider's groups does not end a B session they already have. And an
[emergency sign-out](/docs/security/emergency-sign-out/) of S does not reach B: disable or remove the guest account in
B too, or use B's emergency sign-out.
{{< /tip >}}
