---
title: "Access for a limited time"
description: "Give a user or group access to a tenant's apps until a set time, and let Quisora end it."
weight: 70
---

On a tenant whose **Who can sign in** is **Only users and groups given access**, an entry on its access list can end
**at a set time**: three hours to deal with an incident, a day to help a customer. Quisora does not decide who should
have it. An administrator gives it in the console, or a tool that approves requests its own way (a ticketing system, a
chat bot) gives it through the management API. Quisora ends it.

## Giving it

In the console, open the tenant. On its **Access** card, choose **Add access**, or edit an entry, and set
**Access ends**. The list shows each entry's end under **Ends**.

{{< screenshot name="app-access-ends" alt="A tenant's Access card listing two people whose access ends at a set time and a group with no end" class="max-w-3xl" >}}

You enter the date and time in your own time zone, which the form names. Lists show the end in each viewer's own time
zone.

{{< screenshot name="app-access-dialog" alt="The Edit access dialog with Access ends set and the viewer's time zone named below it" class="max-w-2xl" >}}

To give more time, edit the entry and set a later end. There is one entry per user or group in a tenant. To end access
now, remove the entry.

A tool does the same through the management API, as an administrator or a
[service account](/docs/automation/service-accounts/) with the `access` scope. It sends `expires` as a time with its
offset (such as `2026-11-17T15:00:00+08:00`), and may send a `reason` of up to 500 characters, such as the ticket that
approved it. The reason goes in the audit log, not on the entry. The details are in the API reference at `/api-docs/`.

## How it ends

At the end the person is refused at once, on every node: sign-in, refresh, userinfo, introspection and SSH
certificates all check the entries each time. Nothing has to run first.

- **Tokens and SSH certificates** issued while only entries with an end let the person in expire by that end. If an
  entry without an end lets them in too (their own or a group's), tokens last as usual.
- **Within a minute** Quisora removes the ended entry and signs the person out of each app they no longer have:
  back-channel logout to the app, and their refresh tokens and SSH certificates for it revoked. Someone another entry
  still lets in is left alone.
- **Removing an entry, or narrowing it** (fewer apps, an earlier end) does the same at once.
- **Guests** who came into another organization through a [provider](/docs/sign-in/guest-accounts/#only-some-people-for-a-time)
  whose sign-in app is in this tenant are out of that organization at the same moment, and signed out there too.

An app that keeps its own session for hours without refreshing or checking its tokens hears of the end only through
back-channel logout. Give it a back-channel logout URI.

## In the audit log

| Event | When |
| --- | --- |
| `tenant.access.add`, `tenant.access.update`, `tenant.access.remove` | Someone gave, changed or removed access, with `expires` in UTC and the `reason` given. |
| `tenant.access.expire` | Access ended by itself, recorded as the system. |
