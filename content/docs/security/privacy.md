---
title: "Personal data in Quisora"
description: "What Quisora stores about people, for how long, and how to answer a data subject's request."
weight: 40
---

The organization running Quisora is the controller of this data. This page is the information you need for your
records of processing and your privacy notice.

## What is stored

| Where | Personal data | Kept |
| --- | --- | --- |
| User | Username, email addresses (and whether verified), names, phone, locale, time zone, user type, work details (title, department, organization, division, cost centre, employee number, manager), tags, external id, role, status, end date | Until the user is deleted |
| Credentials | Password (argon2id hash, sealed), authenticator secret (sealed), passkeys (public key, name, model id, counter, last used) | Until removed, or the user is deleted |
| Sign-ins | Last sign-in time, failed-attempt counters | Counters expire within minutes |
| Sessions | IP address, browser user agent, sign-in time and methods | Until the session ends (`session.ttl`, `session.idle`) |
| Applications | Consents and refresh grants: application, scopes, times | Until revoked or expired (`tokens.refresh_ttl`) |
| Connected providers | The provider's subject id and email address, and its refresh token (sealed) | Until disconnected, or the user is deleted |
| API tokens | Name, scopes, times (the token only as a hash) | Until revoked or expired |
| Audit events | Actor and target, IP address, user agent, session id, what changed | `audit.retention_days` in the database; in VictoriaLogs, its retention |
| Structured log | Every audit event; with `log.access`, every request's path and client address; recipients of email that could not be delivered | The log pipeline's retention |
| Backups | All of the above | As long as the backups are kept |

Tokens issued to applications carry the claims the user consented to (names, email, groups, roles, tags). Those copies
are the applications' responsibility.

## Requests from data subjects

**Access.** An administrator of the user's organization can see the user's record, sessions, applications, tokens and
connected providers on the user's page in the console, and the audit events about them (search the
[audit log](/docs/running/audit-log/) by username). There is no one-click export yet: gather these into your answer.

**Correction.** Administrators edit every field. Users edit their own profile on the account page.

**Erasure.** Delete the user on their page in the console. That removes the user record, ends their sessions and
refresh grants (applications are told through back-channel logout) and clears them as manager of others. Everything
else that belonged to them (passkeys, connected providers, API tokens, group memberships, access entries) stops working
at once and is cleaned up in the background, within about a day at five million users. Deleting an organization does
the same for everything in it.

What remains:

- **Audit events** naming the user, until their retention ends. They are the security record of what happened and are
  usually kept under a legal obligation or legitimate interest. State that in your privacy notice.
- **Backups**, until they expire. A restore brings the user back, so delete them again after restoring.
- **Deletion markers** (the record's id, no personal data), for 7 days.
- **Logs**, for the log pipeline's retention.

## Choices that reduce what is kept

- `audit.logins = false` stops recording successful sign-ins (failures are always recorded). Keep it on if you need an
  audit trail for SOC 2 or similar: successful sign-ins are the evidence of access reviews.
- `log.access = false` keeps request paths and client addresses out of the log (query strings are never logged).
- Use a short `audit.retention_days` and a VictoriaLogs retention no longer than your audit period needs.
- Keep backups no longer than your recovery policy needs.
