---
title: Sign-in providers
description: Let people sign in with an account they already have, such as Google, Microsoft or your company's single sign-on.
weight: 30
---

A sign-in provider lets people use an account they already have elsewhere. Each provider shows up on the sign-in page as a **Continue with** button.

Quisora stays in charge. The provider signs the person in to Quisora, and Quisora then signs them in to your app, with its own rules on top: who may use which app, and whether a second factor is needed.

{{< screenshot name="login" alt="An organization's sign-in page with two Continue with buttons, a passkey button and an email field" >}}

## Where people sign in

Each organization has its own sign-in page at `/o/<org>/login`, where `<org>` is the organization's name or id. Your apps send people there for you, so most people never type it.

## Supported providers

| Type | What you need from the provider |
| --- | --- |
| OpenID Connect | The issuer URL. Use it for your company's own single sign-on. |
| Google | Nothing extra |
| Microsoft (Entra ID) | Your directory (tenant) ID |
| GitHub | Nothing extra (an OAuth app on github.com) |
| GitLab | Your GitLab address, or leave it empty for gitlab.com |
| Auth0 | Your Auth0 domain |

Every type also needs a **client ID** and **client secret** from the provider.

## Adding one

1. In the admin console, open the organization, then **Providers** and **New provider**.
2. Pick the type. The dialog shows a **Callback URL** straight away.
3. At the provider, register an app and paste in that callback URL as the redirect URI.
4. Copy the provider's client ID and secret back into Quisora, and save.

{{< screenshot name="providers" alt="The providers page in the admin console, listing six providers" >}}

The secret is stored sealed with the master key and never shown again.

## Useful settings

- **Allowed email domains.** Only people with a verified address at these domains can use the provider. Leave it empty to allow anyone.
- **Link existing users by verified email.** On by default. If the provider says the address is verified and it matches one user, they are linked. Admins are never linked this way: they connect a provider themselves from their account page.
- **Create accounts automatically.** Off by default. When on, someone signing in for the first time gets a new account.
- **Counts as a second factor.** Off by default. Turn it on only if you trust the provider to check a second factor itself.

## Choosing which apps offer it

Each tenant decides which providers its apps show. By default that is all of the organization's providers, including ones you add later. You can pick a few instead under the tenant's **Sign-in rules**.

{{< tip >}}
Want people's sessions to end when they leave the company? Add the `offline_access` scope to the provider. Quisora then checks with it every hour, and signs the person out once the provider turns them away.
{{< /tip >}}

## More

The [full providers guide](https://github.com/paularlott/quisora/blob/main/docs/sign-in/providers.md) covers guest accounts from another organization, how leavers are spotted, and setting providers up through the API.
