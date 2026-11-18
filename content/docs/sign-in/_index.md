---
title: "Signing in to Quisora"
linkTitle: "Signing in"
description: "Passwords, passkeys, second factors, upstream providers, sessions and protecting administrators."
weight: 120
---

This section is about how people sign in to Quisora, and the rules that protect their accounts. How your apps send
people here is in [Connecting applications](/docs/applications/).

## What you can do here

- Choose how people sign in: [ways to sign in](#ways-to-sign-in)
- Invite people: [inviting people](#inviting-people)
- Set how long people stay signed in: [sessions](#sessions)
- Add passkeys and authenticator apps, and require a second factor: [second factors](/docs/sign-in/second-factors/)
- Let people sign in with Google, Microsoft or your own single sign-on: [upstream providers](/docs/sign-in/providers/)
- Let people from another organization in as guests: [guest accounts](/docs/sign-in/guest-accounts/)
- Keep administrator accounts safe: [protecting administrators](/docs/sign-in/protecting-administrators/)

Who may use a tenant's apps (everyone, or only the people you choose) is set in [Access](/docs/access/).

## Where people sign in

Each organization has its own sign-in page at `/o/<org>/login`, where `<org>` is the organization's name or its id.
Your applications send people there, so most people never type it. The account page is `/o/<org>/account`.

{{< screenshot name="login" alt="An organization's sign-in page with two Continue with buttons, a passkey button and an email field" class="max-w-3xl" >}}

Visiting `https://id.example.com/` itself signs no one in: it tells a signed-out visitor to start from their
application or their organization's sign-in link. Administrators of the primary organization sign in at `/admin`.

A browser keeps one session per organization. Being signed in to one organization is not being signed in to another.

## Ways to sign in

Each organization chooses its methods. A super admin opens **Organizations**, **Edit**, then **Sign-in methods**. Each
tenant can narrow the methods for its applications, never widen them: open the tenant and choose **Edit sign-in
rules**.

{{< screenshot name="sign-tenant-rules" alt="The Edit sign-in rules dialog of a tenant: who can sign in, sign-in methods and providers" class="max-w-2xl" >}}

| Method | What it is |
| --- | --- |
| **Password** | Users choose their own passwords through an invitation. Administrators never set them. **Allow password reset** sends a reset link by email. |
| **Passkey** | A fingerprint, face or device PIN, as the whole sign-in or as the second factor after a password. See [Second factors](/docs/sign-in/second-factors/#passkeys). |
| **Providers** | "Continue with" Google, Microsoft or your own single sign-on. See [Upstream providers](/docs/sign-in/providers/). |

## Inviting people

New users get an **invitation link**. The administrator sees it, or Quisora emails it when the server sends email. It
works once and lasts 7 days. With it the user sets a password, creates a passkey, or both.

A user has one invitation at a time: a new one replaces the last. The link keeps working until set-up is finished, so
if something fails half way (a password the policy refuses, say), the user simply tries again.

{{< tip "warning" >}}
Accepting an invitation replaces every way the user signed in before, all at once: passkeys, connected providers, API
tokens and sessions stop working. That is also how someone who lost everything gets back in.
{{< /tip >}}

When someone changes a way into their account (a password, authenticator app, passkey, recovery codes or a connected
provider), anything half done for that account stops working and they start again. That includes a sign-in waiting for
its second factor, and unused invitation and reset links.

## Sessions

Browser sessions last 7 days from sign-in and end after 24 hours without use. An organization can set shorter
lengths on its settings, never longer. For managers and above, a session lasts at most 12 hours, and ends after 1 hour
without use. The primary organization's settings cover the super admins, so only super admins change them.

Users see their sessions on their account page and can end any of them. Administrators can end a user's sessions from
the user's page. Changing a password signs the user out everywhere else.

A user holds at most 100 sessions at once (`limits.sessions_per_user`). A sign-in is never refused for it: the sessions
used least recently end instead, as if signed out, and each is recorded as `login.session.evict`. The session just
made is always kept.

Signing out and ending a session are not the same:

| | Signing out of this browser | Ending a session from elsewhere, signing out everywhere, a lock-out |
| --- | --- | --- |
| The browser session | ends | ends |
| Applications' sign-ins without `offline_access` | end | end |
| Applications' sign-ins with `offline_access` | go on until they expire | end |
| [SSH certificates](/docs/ssh/revoking-and-rotating/) issued in the session | go on until they expire | are revoked |

To end everyone's sessions at once, or lock one person out, see
[Emergency sign-out and lock-out](/docs/security/emergency-sign-out/).
