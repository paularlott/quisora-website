---
title: "Upstream providers"
description: "Let people sign in with Google, Microsoft, GitHub, GitLab, Auth0 or your own single sign-on."
weight: 20
aliases: ["/docs/sign-in-providers/"]
---

A provider lets people sign in with an account they already have elsewhere. Each one shows on the sign-in page as
**Continue with ...**. Quisora stays the identity provider of your applications: the provider signs the person in to
Quisora, and Quisora signs them in to the application, with its own rules (tenants, access lists, second factors) on
top.

## Adding a provider

1. Open the organization, then **Providers**, then **New provider**.
2. Pick the **Type**. The dialog shows a **Callback URL** straight away.
3. At the provider, register an app and give it that callback URL as its redirect URI.
4. Copy the provider's **Client ID** and **Client secret** into the dialog and choose **Create provider**.

{{< screenshot name="sign-provider-dialog" alt="The New sign-in provider dialog for an OpenID Connect provider" class="max-w-2xl" >}}

The callback URL looks like `https://id.example.com/o/<org id>/login/callback/<provider id>`. Each provider has its
own. The client secret is stored sealed and never shown again: leave the field blank when editing to keep it.

{{< screenshot name="providers" alt="The providers page in the admin console, listing six providers" class="max-w-3xl" >}}

Providers belong to one organization. Its tenants choose which ones their applications offer: all of the
organization's providers by default, including ones added later, or a few picked under the tenant's **Sign-in rules**.

## What each type needs

| Type | Fields to fill in | Register at the provider |
| --- | --- | --- |
| **OpenID Connect** | **Issuer URL** (https). Quisora reads its discovery document. | A client, with the callback URL as a redirect URI. |
| **Google** | Nothing more. | An OAuth client in Google Cloud, with the callback URL as an authorised redirect URI. |
| **Microsoft (Entra ID)** | **Directory (tenant)**: your tenant's ID, or `organizations` with a list of **Allowed tenants** (IDs). | An app registration in Entra ID, with the callback URL as a Web redirect URI. |
| **GitHub** | Nothing more. | An OAuth app on github.com, with the callback URL as the Authorization callback URL. |
| **GitLab** | **GitLab address**: empty for gitlab.com, or your own server. | A GitLab application, with the callback URL as the redirect URI. |
| **Auth0** | **Auth0 domain**, such as `acme.eu.auth0.com` (or your custom domain). | A Regular Web Application in Auth0, with the callback URL in **Allowed Callback URLs**. |

Every type needs the **Client ID** and **Client secret** the provider gives you.

{{< tip >}}
Microsoft: personal Microsoft accounts are not supported. Add the optional claim `xms_edov` to the app registration's
ID token, or Quisora cannot tell whether an address is verified.
{{< /tip >}}

## The other settings

| Setting | What it does |
| --- | --- |
| **Button label** | What the sign-in page shows after "Continue with". Defaults to the type's name. |
| **Scopes** | `openid profile email` by default (GitHub: `read:user user:email`). Add `offline_access` to catch leavers (below). |
| **Allowed email domains** | Only people with a verified address at one of these domains can use it. Empty: anyone. |
| **Link existing users by verified email** | On by default (off for [another organization](/docs/sign-in/guest-accounts/)). See below. |
| **Create accounts automatically** | Off by default. |
| **Sign-in through this provider counts as a second factor** | Off by default. Super admins only. See below. |
| **Provider is enabled** | Off: the button goes and nobody can sign in through it. |

Pointing a provider at another issuer, Microsoft tenant or type needs the new provider's secret and unlinks everyone
who signed in through it.

## Which applications offer it

Each tenant's **Edit sign-in rules** dialog has a **Providers** section. **All of the organization's providers** (the
default) includes providers added later. Or choose a list. Only enabled providers count, whatever is ticked. A sign-in
through a provider the tenant does not offer is refused.

## Who signs in as whom

The first time someone signs in through a provider, Quisora decides which account they are:

1. **Already linked.** The provider's user id was linked before. The email address no longer matters, so it can change
   at the provider.
2. **Linked by email**, when that setting is on: the provider says the address is verified and it belongs to exactly
   one user in the organization. They are linked from then on.
3. **Created automatically**, when that setting is on: a new `user` with the provider's verified address and name.
   Refused if a user already has that address.
4. Otherwise the sign-in is refused: "the account is not linked".

**Allowed email domains** apply at every step, also to accounts already linked.

Managers and administrators are never linked by email. They sign in the usual way and connect the provider
themselves. A user who is promoted to manager, administrator or super admin loses the links they did not make
themselves on their account page, and their sessions end. The same goes for whatever was set up through a provider
while the account had no second factor of its own. They can connect the provider again if they want it. A manager or
administrator who signs in through a provider and has no second factor of their own is refused ("ask an administrator
for an invitation or a sign-in link"): whoever holds the provider's account must not choose it.

Users connect and disconnect providers on **Your account**, **Sign-in providers**, after confirming it is them.
Disconnecting is refused when it is their only way in. Administrators see a user's linked providers on the user's page
and can disconnect them.

When a sign-in creates or links an account that has no picture yet, Quisora copies the provider's picture once. It is
served from Quisora, and a picture the user or an administrator chose is never replaced.

## Second factors

A provider sign-in counts as a first factor, like a password. Quisora does not trust what a provider says about its own
second factors. Where a second factor is required, and always for managers and administrators, Quisora asks for the
user's own after the provider.

**Sign-in through this provider counts as a second factor** changes that for plain users. When the provider says a
second factor was used, or says nothing about it, Quisora asks for none after it. Turn it on only when the provider
itself makes everyone use a second factor (your company single sign-on enforcing it). Managers and administrators
always give their own.

## Catching leavers

When someone leaves, their account at the provider is disabled, but a Quisora session they started through it would
carry on. Add `offline_access` to the provider's scopes and Quisora checks with the provider every hour. When the
provider turns the person away, Quisora ends all their sessions. The account is not disabled: lock it out or give it
an end date in Quisora for that.

Google ignores `offline_access`, but Quisora always asks it for offline access. GitHub gives no refresh tokens, so
this does not apply to it.

## Reaching the provider

Quisora calls the provider's endpoints from the server, over https only. Addresses on private networks are refused
unless you allow them: list the provider's network in `server.allowed_networks` (for example
`allowed_networks = ["172.16.0.0/12"]`), or in a home lab set `server.allow_private_networks`. A provider whose
certificate comes from an internal CA needs that CA in `server.extra_ca_file`.

