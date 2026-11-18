---
title: "Automation"
linkTitle: "Automation"
description: "Let scripts, provisioning tools and AI assistants work with Quisora."
weight: 140
---

This section is for scripts, tools and AI assistants that work with Quisora instead of a person in the console.

## What you can do here

- Let a script act as you: [personal API tokens](/docs/automation/api-tokens/)
- Give a tool its own credentials that outlive any one person: [service accounts](/docs/automation/service-accounts/)
- Keep users and groups in step with Entra ID or Okta: [provisioning with SCIM](/docs/automation/scim/)
- Let AI assistants sign in, or manage users for you: [MCP servers and self-registered apps](/docs/automation/mcp/)

## Which credential to use

Three kinds of automation can call Quisora, and each has its own credential:

- A **personal API token** lets a script act as you. It never has more access than you do.
- A **service account** belongs to the organization, not to a person. Use it for tools that must keep working when
  people leave.
- **MCP and self-registered apps** let AI assistants sign in as a user.

User and group provisioning from Entra ID or Okta (SCIM) runs through a token or a service account.

Everything the console does can also be done through the management API. Every Quisora server shows its API reference
at `/api-docs/`.
