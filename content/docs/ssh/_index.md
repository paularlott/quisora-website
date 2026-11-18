---
title: "SSH certificates"
linkTitle: "SSH certificates"
description: "Log in to servers with short-lived certificates instead of copying keys around."
weight: 150
---

Quisora can be the SSH certificate authority for a tenant. People sign in to Quisora with a second factor and get a
certificate for their SSH key that lasts a few hours. Servers trust the tenant's CA key, so nobody's key has to be
copied to a server.

Access is managed in Quisora. Remove someone from a group, disable them or sign them out, and their certificates stop
working within a minute or two. There is no key to hunt down on every server.

## What you can do here

- Turn certificates on for a tenant, and choose who gets them: [turning it on](/docs/ssh/turning-it-on/)
- Make a server trust the certificates: [setting up a server](/docs/ssh/setting-up-a-server/)
- Get a certificate and log in: [getting a certificate](/docs/ssh/getting-a-certificate/)
- Let people's ssh clients trust your servers: [host certificates](/docs/ssh/host-certificates/)
- Take certificates back, and change the CA key: [revoking and rotating](/docs/ssh/revoking-and-rotating/)
- Fix a login that fails: [troubleshooting](/docs/ssh/troubleshooting/)

## How it works

1. A person runs `quisora ssh login` (or uses their account page) and signs in with a second factor.
2. Quisora signs their public key. The certificate lists their **principals**: their username, `group:<name>` for each
   of their groups and, if you turn it on, `role:<role>` for their application roles.
3. Each server fetches the tenant's CA key and revocation list every minute.
4. When the person connects, the server checks the certificate is signed by the CA, not revoked, in date, and carries a
   principal that is allowed to log in as that account.

Quisora never sees a private key. It only signs public keys.

## Good to know

- **Quisora does not create Linux accounts.** The accounts people log in as must already exist on the server.
- **Keep another way in.** Certificates already issued keep working while Quisora is down, but nobody can get a new one.
  Keep an emergency key or console access for your servers, and especially for the ones that run Quisora.
- **Open sessions stay open** after a certificate is revoked, unless the server ends them
  ([Setting up a server](/docs/ssh/setting-up-a-server/#ending-open-sessions)).
- **Only enter a sign-in code you started yourself.** Someone could start a sign-in on their machine and send you the
  code. If you enter it, they get a certificate in your name.
