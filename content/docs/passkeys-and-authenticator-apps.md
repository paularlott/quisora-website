---
title: Passkeys and authenticator apps
description: Sign in with a fingerprint or face, add a second factor, and get back in when a phone is lost.
weight: 40
---

Quisora supports several ways to prove who you are. People choose the ones that suit them on their account page.

## Passkeys

A passkey signs you in with your fingerprint, face or device PIN instead of a password. Your device or password manager keeps the private key, and Quisora only keeps the public half.

Passkeys can't be phished, guessed or reused on another site. One passkey sign-in counts as two factors: the device you have, and the fingerprint or PIN that unlocks it.

{{< screenshot name="passkeys" alt="The Passkeys card on the account page, with a synced passkey and a security key" >}}

**To add one:** go to **Your account**, then **Passkeys** and **Add passkey**. Name it, and confirm on your device. You can also create one when you accept an invitation.

**To sign in with one:** click **Sign in with a passkey** on the sign-in page, or pick it from your browser's suggestions in the email field.

Passkeys are on by default and need no setup. Two things to know:

- The public URL must be a host name, not an IP address.
- Passkeys belong to that host name. If you change it later, everyone has to add their passkeys again.

## Authenticator apps

An authenticator app, such as 1Password, Authy or Google Authenticator, shows a 6-digit code that changes every 30 seconds. After the password, Quisora asks for the code.

**To set one up:** go to **Your account**, then **Password and Authenticator App**, and **Set up**. Scan the QR code with the app and type in the code it shows.

{{< screenshot name="totp" alt="The Set up Authenticator App dialog, with a QR code and six boxes for the code" >}}

## Recovery codes

Recovery codes get you in when your phone or security key isn't at hand. Each one works once.

Once you have an authenticator app or a passkey, make them under **Password and Authenticator App**, then **Recovery codes**. Quisora shows ten codes, once. Save them in a password manager, or print them and lock them away.

At sign-in, choose **Try another way**, then **Use a recovery code**.

{{< screenshot name="second-factor" alt="The Try another way step at sign-in, listing a passkey, a recovery code and an email code" class="max-w-3xl" >}}

## Requiring a second factor

An organization, or a tenant for its apps, can require a second factor. Then every password or provider sign-in also asks for one of these:

- an authenticator app code,
- a passkey,
- a recovery code,
- a code by email, if the organization allows it.

Managers, admins and super admins always need a second factor, whatever the settings.

{{< tip "warning" >}}
Codes by email are weaker than the others, since anyone who can read the mailbox gets the code. They are off by default, and never used for admins.
{{< /tip >}}

## More

- [Passkeys in depth](/docs/sign-in/passkeys/)
- [Recovery codes](/docs/sign-in/recovery-codes/)
- [Codes by email](/docs/sign-in/email-codes/)
