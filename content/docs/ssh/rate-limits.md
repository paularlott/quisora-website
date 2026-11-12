---
title: "Rate limits"
weight: 140
---

| What | Limit |
| --- | --- |
| Signing user certificates (`POST …/sign` and the account page) | 20 a minute for each person and 60 a minute for each address, counting refused requests; one budget for both ways of asking (`429`, `slow_down`; the account page says to wait a minute). |
| Revoking your own certificates on the account page | 60 a minute for each person (`429`). |
| Signing host certificates | 120 a minute for each administrator or service account (`429`, with `Retry-After`). |
| Refusals recorded in the audit log | One per person, tenant and reason a minute. |
| Starting device sign-ins, wrong device codes | 30 a minute and 20 per 15 minutes for each address: [device sign-in](/docs/applications/device/#the-users-side). |
| The discovery, CA keys, known hosts and revocation list addresses | 16 000 units a minute for each address and tenant, counted by the tenant's id whether the URL names it by id or name, with one more budget per address shared by the URLs that name no tenant (`429`): an answer with the document costs 4, a `304 Not Modified` or a refusal costs 1. A `quisora ssh fetch` run is four answers, 16 units, so about a thousand servers a minute behind one address ([Servers behind one address](/docs/ssh/setting-up-an-ubuntu-server/#servers-behind-one-address)). The revocation list is made by one request at a time for a tenant, and the others wait for it. Answers are cached for 30 seconds on a node. |
