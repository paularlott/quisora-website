---
title: "Device sign-in"
description: "Sign users in on a CLI, a TV or another device that cannot show a sign-in page."
weight: 40
---

Device sign-in (the device authorization grant, RFC 8628) signs a user in on something that cannot show a sign-in
page: a command-line tool, a TV, a kiosk. The device shows a short code. The user opens the organization's `/device`
page on their phone or computer, enters the code, signs in as usual and approves. The device, which has been asking
Quisora in the background, then gets its tokens.

{{< tip "warning" >}}
Someone can start a device sign-in on their own machine and send a victim the code ("enter this code to verify your
account"). If the victim approves, the attacker's device is signed in as them. So device sign-in is off until you turn
it on per client, the consent screen always asks (even for first-party apps), and managers and administrators cannot
approve unless you allow it. Turn it on only for apps that need it.
{{< /tip >}}

## Turning it on

In the console, open the tenant's **Clients**, then the client (or **New client**), and tick **Device sign-in** under
**Grant types**.

{{< screenshot name="app-client-device" alt="The client dialog with the switch for managers and administrators approving device sign-ins" class="max-w-3xl" >}}

- The client can be public (the usual choice for a CLI) or confidential. It cannot use the FAPI 2.0 profile, and it
  needs no redirect URIs.
- Tick **Refresh token** too if the device should stay signed in, and allow the `offline_access` scope.
- **Managers and administrators may approve device sign-ins** is off by default. Turn it on only for an
  administrators' tool.

Quisora's own `quisora ssh login --device` is a device sign-in too, through the tenant's
[SSH application](/docs/ssh/turning-it-on/).

## What the device does

**1. Ask for a code.** A public client sends its `client_id`; a confidential one authenticates as at the token
endpoint. `scope` and `resource` are optional. `acr_values=urn:quisora:acr:mfa` makes the approver use a second
factor, and `max_age` makes an older session sign in again.

```
POST /o/<org id>/oauth/device_authorization
client_id=c_...&scope=openid profile offline_access
```

```json
{
  "device_code": "a1.clGjx-yXuyn5NlPiCcTvlDX2GCiWbZ1y",
  "user_code": "PRFL-NXBM",
  "verification_uri": "https://id.example.com/o/<org id>/device",
  "verification_uri_complete": "https://id.example.com/o/<org id>/device?user_code=PRFL-NXBM",
  "expires_in": 600,
  "interval": 5
}
```

**2. Show the user what to do.** Show `verification_uri` and `user_code`. A device with a screen can show
`verification_uri_complete` as a QR code. Keep `device_code` private: it collects the tokens.

**3. Ask for the tokens** every `interval` seconds until the answer is no longer `authorization_pending`:

```
POST /o/<org id>/oauth/token
grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=c_...&device_code=<device_code>
```

| Answer | What the device does |
| --- | --- |
| `authorization_pending` | Wait `interval` seconds and ask again. |
| `slow_down` | Add 5 seconds to the interval, wait, ask again. |
| `access_denied` | Stop: the user denied it, has no access, or is a manager or administrator the app does not allow. |
| `expired_token` | The 10 minutes passed. Start again from step 1. |
| 200 with tokens | Approved. Keep them: you get them once. |

**4. Use the tokens.** They are the same as from any other sign-in ([signing users
in](/docs/applications/signing-users-in/)). A public client's refresh tokens rotate: keep only the latest. To sign the
device out, revoke its refresh token.

## What the user does

1. Open `https://id.example.com/o/<org id>/device` (or scan the QR code) and type the code. Capitals and the dash do
   not matter.
2. Sign in as for any app of the client's tenant. Someone already signed in goes straight on.
3. Read the consent screen, which names the app and warns about codes from someone else, then choose **Allow** or
   **Deny**. The device gets its tokens at its next request.

## How long it stays signed in

As with any sign-in, the grant lasts as long as the browser session that approved it, unless `offline_access` was
granted: then refresh tokens last up to `tokens.refresh_ttl` (30 days), renewed by each refresh. Signing the user out
everywhere, locking them out, an [emergency sign-out](/docs/security/emergency-sign-out/) or removing their access
ends it.

## What is recorded

| Audit event | When |
| --- | --- |
| `oauth.device.approve` | The user allowed a device sign-in. |
| `oauth.consent` with `decision` `deny` | The user denied it. |
| `oauth.grant` with `grant_type` `device_code` | The device collected its tokens. |
| `oauth.device.start` | A device asked for a code (only with `audit.tokens = true`). |

If someone approved a code they were sent, see the [incident response](/docs/security/running-securely/#incident-response).
