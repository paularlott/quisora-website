---
title: "Protecting administrators"
description: "Which changes ask you to confirm it is you, and the extra rules around administrator accounts."
weight: 40
---

## Confirm it is you

Sensitive changes need a recent re-authentication: you signed in or confirmed within the last 5 minutes. The console
asks with its **Confirm it is you** dialog. A personal API token can never make these changes, through the management
API or SCIM. (A [service account](/docs/automation/service-accounts/) makes only what its scopes allow, and needs
`manage_admins` for administrators.)

- deleting an organization,
- rotating the signing keys,
- changing the primary organization's sign-in settings,
- creating an administrator or super admin, or making someone one,
- demoting, disabling or deleting another administrator or super admin,
- removing another user's password, authenticator app or passkey, or unlinking a provider from them,
- issuing an invitation for a manager or administrator,
- creating or changing a service account, or rotating its secret,
- changing an organization's [email templates](/docs/branding/emails/).

Changes to your own account (a passkey, the authenticator app, recovery codes, your primary address, connecting a
provider, an API token, signing out other sessions) need a re-authentication too, or a sign-in within 5 minutes that
used your own second factor. A sign-in through a provider trusted for the second factor does not count when the
account has its own. An account whose second factor is a passkey confirms with the passkey. A
[recovery code](/docs/sign-in/second-factors/#recovery-codes) stands in for a lost authenticator app or passkey.

## Extra rules for administrators

- **Resetting an administrator's sign-in is a super admin's job.** Sending a new invitation to a manager or
  administrator, removing their password or authenticator app, lowering their role, changing their primary email
  address, or adding a linked address to their account needs a super admin. A manager or administrator who has not
  signed in yet gets their next invitation only from whoever issued the current one, or from a super admin. So one
  administrator cannot take over another's account.
- **Never linked by email.** Providers do not link a manager's or administrator's account by email address. They
  connect the provider themselves.
- **No codes by email and no trusted provider second factor.** They always give their own.
- **Removing a super admin.** Nobody demotes, disables, locks out, end-dates or deletes themselves, and only a super
  admin does any of that to a super admin. An administrator, manager or service account cannot. Nothing guarantees a
  super admin always remains: two removing each other at the same moment can leave none, as can an end date passing
  on the last one. Organizations need no administrator of their own, since super admins administer every one.
- **Locked out of the console entirely:** see the
  [break-glass procedure](/docs/security/running-securely/#incident-response).
