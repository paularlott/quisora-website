---
title: Documentation
linkTitle: Docs
description: Short guides to get Quisora running and to set up the things most people need.
weight: 1
---

The guides below are short on purpose. They cover what you need to get going, and link to the full reference when you want more depth.

{{< page-list section="/docs" >}}

## What Quisora is

Quisora is an identity provider. Your applications send people to Quisora to sign in, and Quisora sends them back with a token that says who they are. It speaks OpenID Connect and OAuth 2, so most apps and libraries can use it as they are.

A few words you will see in the guides:

| Word | What it means |
| --- | --- |
| Organization | A group of users with its own sign-in page, rules and look. The first one is called `primary`, and holds the super admins. |
| Tenant | A set of applications in an organization that share sign-in rules and an access list. |
| Application | An app that signs people in through Quisora (an OAuth client). |
| Provider | Another identity service people can sign in with, such as Google or your company's single sign-on. |

## Reference

The full guides, for when you need the detail.

{{< page-list section="/docs" kind="sections" >}}
