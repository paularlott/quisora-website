---
title: Documentation
linkTitle: Docs
description: Get Quisora running, connect your applications, and run it in production.
weight: 1
---

New to Quisora? Start with [Getting started](/docs/getting-started/).

{{< page-list section="/docs" >}}

## What Quisora is

Quisora is an identity provider. Your applications send people to Quisora to sign in, and Quisora sends them back with a token that says who they are. It speaks OpenID Connect and OAuth 2, the standard ways for apps to sign people in and get tokens, so most apps and libraries can use it as they are.

A few words you will see in the guides:

| Word | What it means |
| --- | --- |
| Organization | A group of users with its own sign-in page, rules and look. The first one is called `primary`, and holds the super admins. |
| Tenant | A group of applications that share sign-in rules. Every organization has a default one. |
| Application | An app that signs people in through Quisora (an OAuth client). |
| Provider | Another identity service people can sign in with, such as Google or your company's single sign-on. |
| Gossip | A way to run several nodes where each keeps its own copy, and the nodes copy changes to each other directly. |
| Break-glass | An emergency way back in when nobody can sign in to the console, run on a server with the master key. |

## Roles

Every user has one role in their organization.

| Role | What they can do |
| --- | --- |
| Super admin | Everything, in every organization, and the server itself. Super admins belong to the primary organization. |
| Administrator | Run their own organization: its users, groups, tenants, applications and providers. |
| Manager | Look after plain users: create and change them, and add them to groups or take them out. |
| User | Sign in to applications and look after their own account. |

Managers and above always use a second factor. More in [protecting administrators](/docs/sign-in/protecting-administrators/).

## The management API

Everything in the console can also be done through the management API. Every server shows its API reference at `/api-docs/`. See [automation](/docs/automation/) to get started.

## Reference

The full guides, for when you need the detail.

{{< page-list section="/docs" kind="sections" >}}
