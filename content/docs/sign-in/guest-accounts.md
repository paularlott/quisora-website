---
title: "Guest accounts"
description: "Let the people of one organization sign in to another organization's applications."
weight: 30
---

Organizations are separate: a user belongs to one and signs in there. To let the people of one organization (often the
primary one) use another organization's applications, add an **Another organization** provider to the second one. It
works like a guest (B2B) account in Microsoft Entra: people keep signing in where they belong, and the other
organization lets them in as guests. Its sign-in page shows **Continue with** and the first organization's name.

In this page, the **home organization** is where the people belong and sign in. The **host organization** is the one
that lets them in as guests.

Only a **super admin** can create, change or delete such a provider. So can a service account that
[owns](/docs/automation/service-accounts/#owning-organizations) the host organization, when the home organization is the
primary organization or another organization it owns.

## Setting it up

1. In the host organization, open **Providers**, then **New provider**.
2. Choose the type **Another organization**.
3. Pick the home organization and the tenant its people sign in through. Type the start of the organization's name,
   or the tenant's, and choose from the list. It searches as you type, so `Acme (sup` narrows to Acme's tenants
   starting "sup". In most cases, choose the organization's **own tenant**, listed first (below).
4. Create the provider. You don't enter a client ID, secret or scopes.
5. In the home organization, give the people or groups who may sign in access to that tenant, for good or until a set
   time. Or let them [ask for it](/docs/access/access-requests/).

{{< screenshot name="sign-org-provider" alt="The New sign-in provider dialog with the type Another organization and the organization and tenant list filtered as you type" class="max-w-2xl" >}}

The tenant decides which people from the home organization get in, through its access list. Giving and ending that
access works as for any tenant: see [Access](/docs/access/). The choices:

- **Its own tenant** (the default): a new members-only tenant of the home organization, made for this provider and
  named after the host organization. Nobody is on its access list, so nobody signs in until an administrator of the
  home organization gives them access there. To let everyone in, set its **Who can sign in** to **Everyone in the
  organization**. It holds the provider's sign-in application and nothing else, is marked **Provider sign-ins**, and is
  removed with the provider. One tenant per host keeps each host's access list apart.
- **An existing tenant**: the default tenant suits "everyone". A members-only one limits it to the people on its access
  list, shared by every provider that uses it. Another provider's own tenant can't be chosen.

Providers made before own tenants existed keep the tenant they have.

Quisora makes the client the provider signs in with, in the home organization: an application named
`Sign-in to <host's name>` in the chosen tenant. It is listed with the home organization's applications, but edit the
provider, not the application: it is made and removed with the provider. The home organization's own rules for that
tenant (who may sign in, second factors) apply when people sign in there.

**Button label** defaults to the home organization's display name. **Link existing users by verified email**,
**Create accounts automatically** and **counts as a second factor** are all off. Allowed email domains work as for any
provider.

Changing the organization of an existing provider unlinks everyone who signed in through it. Changing the tenant
signs out the guests who signed in through the old one. They sign in again, under the new tenant's access list.

## Adding guests

Choose one of two ways when you set the provider up. You can combine them.

**Create accounts automatically** (recommended). Everyone from the home organization who signs in becomes a guest: a
plain `user` in the host organization, with their name and verified address, made on their first sign-in. Keep it
bounded with **Only members of these groups** (below), **Allowed email domains** and the tenants' access lists. An
address that one of the host's own users already has is refused, so nobody takes over an existing account this way.

**Add each person by hand.** An administrator of the host organization adds them (**Users**, then **New user**, or an
invitation) with the same email address they have at home, verified. A super admin switches **Link existing users by
verified email** on for the provider. The person then chooses **Continue with ...** on the host's sign-in page, signs in
at home if needed, and comes back. Someone the host has not added is refused.

{{< tip "warning" >}}
Linking by email is off by default here because it trusts the home organization to say whose address is whose. Its
managers, administrators and service accounts can mark any address verified, so each could then sign in to the host
organization as any of its users. Switch it on only for an organization whose staff you trust that far.
{{< /tip >}}

Managers and administrators of the host organization are never linked by email. They connect the provider on their own
account page.

## Only some of the home organization's users

**Only members of these groups** limits the provider to the members of up to 20 groups of the home organization.
Someone in none of them is refused before anything else happens, so no guest is made for them. It is checked at every
sign-in. With no groups chosen, everyone in the home organization may sign in. If a chosen group is deleted there, it
admits nobody. Choosing another home organization clears the groups.

## Only some people, for a time

Take a vendor's support staff who need to reach into a customer's organization. The vendor is the home organization and
the customer is the host. Give the provider its own tenant (the default), or another members-only tenant of the
vendor. Only the people on its access list can sign in to the customer through the provider. Give each of them an
entry that ends ([access for a limited time](/docs/access/timed-access/)), or let them ask for one with an
[access request](/docs/access/access-requests/). A guest asks in their own organization, the vendor.

- Without a live entry, their own or a group's, signing in through the provider is refused at home.
- When their entry ends, is removed or narrowed, the guest is out of the host organization at once, and their sessions
  there are signed out. Their access tokens and SSH certificates there expire by the entry's end.
- The host still decides what the guest gets: **Create accounts automatically**, the groups, and its own tenants'
  access lists, which can have ends of their own.

## Second factors and leavers

A guest signs in to the host organization with a first factor only, and the host's own rules ask for a second factor
where one is required. Applications with the [`idp` scope](/docs/applications/signing-users-in/#the-idp-scope) also
learn where the guest came from: `idp_org` and `idp_org_name` (the home organization), `idp_tenant` and
`idp_tenant_name` (the tenant they signed in through) and `idp_sub` (their ID at home).

A super admin can turn on **counts as a second factor** when the home organization's rules require one of everybody
who signs in to that application. Then the host asks plain users for none.

A guest can't set a password, add a passkey or connect another sign-in provider in the host organization. Any of those
would let them sign in without their home organization, and keep access after it removes them. Their second factor in
the host organization is an authenticator app: where the host asks for one, the guest is offered the app only.

If an administrator of the host organization sends the guest an invitation, accepting it makes the account the host's
own. That ends the link to the home organization, so removing the person there no longer reaches that account.

There is no leaver check through a refresh token, because both organizations are on the same server. Instead a guest's
session in the host organization stands on the session at home it signed in with. When a person's sessions end at home
(signed out everywhere, disabled, locked out, past their end date, sign-in reset, promoted to manager, or deleted), or
they lose access to the provider's tenant there, the guest's sessions, refresh grants and SSH certificates in the host
organization stop working too, within seconds. The guest account itself stays, and the person can sign in again if
their home organization still lets them. Personal API tokens a guest made in the host organization stop the same way,
except that they go on when the person only signs out at home.

{{< tip >}}
Taking someone out of the provider's groups does not end a session they already have in the host organization. And an
[emergency sign-out](/docs/security/emergency-sign-out/) of the home organization does not reach the host: disable or
remove the guest account there too, or use the host's emergency sign-out.
{{< /tip >}}
