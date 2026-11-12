---
title: "Automation"
linkTitle: "Automation"
description: "Let scripts, provisioning tools and AI assistants work with Quisora."
weight: 140
---

Three kinds of automation can call Quisora, and each has its own credential:

- A **personal API token** lets a script act as you. It never has more access than you do.
- A **service account** belongs to the organization, not to a person. Use it for tools that must keep working when
  people leave.
- **MCP and self-registered apps** let AI assistants sign in as a user.

User and group provisioning from Entra ID or Okta (SCIM) runs through a token or a service account.

Everything the console does can also be done through the management API. Every Quisora server shows its API reference
at `/api-docs/`.

## In this guide

- [Personal API tokens](/docs/automation/api-tokens/)
- [Service accounts](/docs/automation/service-accounts/)
- [Provisioning with SCIM](/docs/automation/scim/)
- [MCP servers and self-registered apps](/docs/automation/mcp/)
