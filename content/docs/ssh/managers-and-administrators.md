---
title: "Managers and administrators"
weight: 80
---

By default managers and administrators are refused certificates, so the people who manage Quisora are not on your
servers by default: someone who takes over an administrator's account does not get a login on every server with it.
Turning **Managers and administrators may get certificates** (`allow_privileged`) on lets them. The same setting controls the SSH application's
device sign-in for them ("Managers and administrators may approve device sign-ins": [device sign-in](/docs/applications/device/)),
and is kept in step by Quisora. Turning it off again puts their existing certificates on the revocation list
(`role_not_allowed`).

Keeping managers out of servers does not keep them out of what they control: managers create and rename users and add
people to groups, and so decide who carries which username and group principal ([Principals](/docs/ssh/turning-it-on-for-a-tenant/#principals)).
