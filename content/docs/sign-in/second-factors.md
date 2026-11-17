---
title: "Second factors"
description: "Passkeys, authenticator apps, recovery codes and codes by email, and how to require them."
weight: 10
aliases: ["/docs/passkeys-and-authenticator-apps/"]
---

People choose how they prove who they are on their own account page.

## Quick start

1. Open **Your account**.
2. To add a passkey: **Passkeys**, then **Add passkey**. Name it and confirm on your device.
3. Or set up an authenticator app: **Password and Authenticator App**, then **Set up**. Scan the QR code and type in
   the code the app shows.
4. Make recovery codes: **Password and Authenticator App**, **Recovery codes**, then **Create codes**. Save them in a
   password manager, or print them and lock them away.
5. To make everyone use a second factor, require it on the organization or a tenant (below).

## Requiring a second factor

An organization, or a tenant for its applications, can **require a second factor**. Then every password or provider
sign-in also asks for one of these:

- an **authenticator app** (a 6-digit code),
- a **passkey**,
- a **recovery code**, in place of either of the first two,
- a **code by email**, for users with neither of the first two, where the organization allows it.

A user with no second factor sets one up during the sign-in (an authenticator app, with a passkey offered), or gets a
code by email where that is allowed. **Try another way** at the second-factor step lists what else the account can use.

{{< screenshot name="second-factor" alt="The Try another way step at sign-in, listing a passkey, a recovery code and an email code" class="max-w-3xl" >}}

Managers, administrators and super admins always need a second factor, whatever the settings. Wrong passwords and codes
count towards a temporary lock-out of the account.

An application can also ask for a second factor for a single sign-in: see
[signing users in](/docs/applications/signing-users-in/#requiring-a-second-factor).

## Passkeys

A passkey signs you in with your fingerprint, face or device PIN. Your device or password manager keeps the private
key, and Quisora keeps only the public one. Passkeys can't be phished, guessed or reused on another site. One passkey
sign-in counts as two factors: the device you have, and the fingerprint or PIN that unlocks it.

### Turning them on

Passkeys are on by default. You can switch them off per organization and per tenant: the organization's **Passkeys**
switch and each tenant's **Passkey** switch decide whether users may sign in with a passkey. A tenant cannot turn it on where the organization has it off. A passkey used as the
second factor after a password works either way.

There is nothing to configure, but two things to know:

- `server.public_url` must be a host name, not an IP address. With an IP address, passkeys are unavailable.
- Passkeys belong to that host name. If you change it, every existing passkey stops working and everyone adds new
  ones.

### Adding one

{{< screenshot name="passkeys" alt="The Passkeys card on the account page, with a synced passkey and a security key" class="max-w-2xl" >}}

- **On the account page:** **Your account**, then **Passkeys**, then **Add passkey**. Name it and confirm on your
  device. Quisora may ask you to confirm it is you first. You can have up to 20.
- **When accepting an invitation:** **Create a passkey**, instead of or as well as a password.
- **When a second factor is required and you have none:** **Use a passkey** at the set-up step.

A passkey must verify the user with a PIN, fingerprint or face. A security key without a PIN is refused. The account
page lists each passkey as **synced** (kept in a password manager or keychain, on all your devices) or
**device-bound** (such as a security key), with when it was added and last used. You can rename or delete one.
Quisora refuses to delete the last passkey of an account that needs it as a second factor or as its only way in.

### Signing in

- **On its own:** click **Sign in with a passkey**, or pick the passkey your browser offers in the email field. No
  password and no further second factor are asked.
- **After a password:** an account whose second factor is a passkey sees **Confirm with your passkey**. An account with
  an authenticator app too finds **Use your passkey** under **Try another way**.
- **To confirm it is you** before a sensitive change: **Use a passkey** in the **Confirm it is you** dialog.

A passkey belongs to one organization's account and is refused at another organization's sign-in page.

### Copied passkeys

A device-bound passkey's counter must go up with each use. If it doesn't, the key may have been copied. Quisora
disables it at once, ends every session that signed in with it, and tells applications. The user sees it marked
**Disabled**, with the advice to delete it and change their password.

A passkey marked **Cannot sign in** was added before user verification was required: delete it and add it again.

An account whose only second factor is a passkey that can no longer be used cannot sign in with its password alone. It
sees "Ask an administrator for a new invitation".

### For administrators

The user's page in the console lists their passkeys, with **Remove** for a lost or replaced device. Removing one stops
it signing the user in and ends the sessions that used it. If it was their only way in, send a **New invitation
link**.

## Authenticator apps

An authenticator app (1Password, Authy, Google Authenticator and others) shows a 6-digit code that changes every 30
seconds. To set one up, go to **Your account**, then **Password and Authenticator App**, then **Set up**. Scan the QR
code and type in the code the app shows.

{{< screenshot name="totp" alt="The Set up Authenticator App dialog, with a QR code and six boxes for the code" class="max-w-2xl" >}}

## Recovery codes

Recovery codes get you in when your phone or security key isn't at hand. Each works once. They don't replace a
forgotten password: that is a password reset or an invitation.

**To make them:** once you have an authenticator app or a passkey, go to **Your account**, **Password and
Authenticator App**, **Recovery codes**, then **Create codes**. Quisora shows ten codes, once, with **Copy** and
**Download**. Keep them apart from your phone: in a password manager, or printed and locked away. Click **I have saved
them** to close the dialog.

The row then shows how many are left (with a warning at three or fewer). **Create new codes** replaces them: the old
ones stop working at once, used or not.

**To use one:** at the second-factor step choose **Try another way**, then **Use a recovery code**. Typing it loosely
works: lower case, without the dash, `O` for `0`. The same link, **Lost your authenticator app? Use a recovery code**,
appears in the **Confirm it is you** dialog, so someone still signed in can remove and set up their app again.

Once in, set up your second factor again (a new phone or passkey) and make new codes if few are left.

Every use is emailed to the user, with the number of codes left, and recorded in the audit log. A use the user did not
make means someone has their password and their codes: [lock the account out](/docs/security/emergency-sign-out/#locking-out-one-person)
and send a new invitation.

Codes go away when you create new ones, when the account's last second factor is removed, and when an invitation is
accepted or the account is locked out.

### Someone with no codes and no second factor

They cannot sign in on their own: **Try another way** tells them to ask an administrator. For a lost authenticator
app, the administrator opens the user's page and chooses **Sign-in**, then **Remove authenticator app**. The user keeps
their password and sets up a new app on their account page or at their next sign-in. If the password is lost too,
**New invitation link** replaces every way in. Only a super admin can do either for a manager or administrator.

## Codes by email

An organization can let users give their second factor as a 6-digit code emailed to them. It is for people who will
not or cannot use an authenticator app or a passkey.

{{< tip "warning" >}}
This is weaker than the other factors: whoever can read the mailbox has the code, and where password resets are on, the
password too. It is off by default and never used for managers and administrators. Turn it on only where that risk
is acceptable.
{{< /tip >}}

**To turn it on:** a super admin opens **Organizations**, **Edit**, and ticks **Allow codes by email as a second
factor** under **Sign-in methods**. The server must be able to send email (see [Email](/docs/running/settings/#email)). Without
it the switch is disabled and says why.

A user can get codes by email when all of these hold:

- their organization allows it,
- their primary email address is verified,
- they are not a manager, administrator or super admin,
- they have no authenticator app and no passkey.

For them, when a second factor is required, Quisora sends a code straight away instead of asking for an authenticator
app. The code is 6 digits, lasts 10 minutes and works once. **Send a new code** asks for another (only the newest
works). Wrong codes count towards the lock-out. Every code sent is in the audit log.
