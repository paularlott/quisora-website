---
title: "Security and compliance"
linkTitle: "Security and compliance"
description: "Ideas for running Quisora securely, handling incidents, keeping secrets in a store, and keeping audit evidence."
weight: 160
---

Quisora is an identity provider: whoever controls it controls every application that trusts it. These pages cover
ways to run it safely, what to do when something goes wrong, and how to keep a record of what happened.

## What you can do here

- Harden the server before production, and respond to an incident: [running Quisora securely](/docs/security/running-securely/)
- Keep the master key and other secrets in a secret store: [secrets in Vault or 1Password](/docs/security/secret-stores/)
- Sign everyone out at once, or lock one person out: [emergency sign-out and lock-out](/docs/security/emergency-sign-out/)
- Let your support team confirm who is on a phone call: [verifying callers](/docs/access/verifying-callers/)
- Find out what personal data Quisora keeps: [personal data in Quisora](/docs/security/privacy/)
- Keep audit evidence, such as for SOC 2: [audit evidence](/docs/security/soc2/)

To report a vulnerability, see [the security policy](https://github.com/paularlott/quisora/blob/main/SECURITY.md).
