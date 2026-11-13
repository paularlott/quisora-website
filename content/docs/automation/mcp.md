---
title: "MCP servers and self-registered apps"
description: "Let AI assistants sign in to Quisora, and let Quisora's own MCP server manage users for managers."
weight: 40
---

AI clients (Claude, ChatGPT, IDE assistants) connect to MCP servers on behalf of a user. Quisora is the sign-in
server for those MCP servers, and the AI client registers itself instead of an administrator setting it up. Each
organization is its own sign-in server, with the issuer `https://id.example.com/o/<organization id>`.

Quisora supports both ways a client registers itself:

- **Client ID metadata documents**: the client's ID is an https address serving a small JSON description of it.
- **Dynamic client registration**: the client posts its details to the organization's `/oauth/register` address.

Quisora also runs an MCP server of its own: [see below](#quisoras-own-mcp-server).

## Setting it up for an MCP server

1. In the tenant the MCP server's users sign in through, open **Sign-in rules**. Turn on **Allow self-registered
   apps** and add the MCP server's address under **Resources**, exactly as the MCP server names itself (for example
   `https://mcp.example.com/mcp`). A resource must be https and belongs to one tenant of the organization.
2. On the MCP server:
   - publish `/.well-known/oauth-protected-resource` with your resource address and the organization's issuer as
     the authorization server;
   - answer a request with no valid token with `401` and a `WWW-Authenticate: Bearer resource_metadata="..."` header
     pointing at that document;
   - check each access token: verify the JWT yourself against the organization's `/o/<organization id>/oauth/jwks`
     (issuer, audience and expiry), or introspect it as a confidential client of the same organization that has
     **May introspect every token of the organization** turned on.

The AI client then finds Quisora from the protected resource document, registers itself and signs the user in.

## What applies to self-registered apps

- The tenant that owns the resource decides who may sign in, with which methods, and whether a second factor is
  needed. A request without a resource, or for a resource whose tenant does not allow self-registered apps, is
  refused.
- They are public clients with PKCE, and may ask for `openid`, `profile`, `email` and `offline_access` only.
- Redirect URIs must be https, `localhost` or loopback, or a private-use scheme named after a domain the app owns.
- Consent is always asked, with a warning that the organization has not verified the app.
- Turning off **Allow self-registered apps** or removing the resource stops the apps' refresh tokens at once.
  An MCP server that verifies JWTs itself accepts an access token until it expires (10 minutes by default).
- A registration nobody signs in with is removed after a day, and registration is rate limited per address.
- An organization holds at most 10,000 apps nobody has used yet. At that limit, a new registration removes one of them
  at random, so a flood can't stop others registering. Apps people use are never removed.

## Seeing and removing them

The organization lists its **Self-registered apps**, with where each sends sign-ins, how many users have access and
when it was last used. **Revoke** ends every user's access to it and removes it. A user also sees each app under
**Connected apps** on their account page and can remove it there.

## Quisora's own MCP server

An AI client signed in by a manager or administrator can look up and manage the organization's users and groups for
them. Each organization's server is at `https://id.example.com/o/<organization id>/mcp`. It is off until a super
admin turns it on.

### Turning it on

1. **Switch it on for the organization.** A super admin edits the organization on the **Organizations** page and
   turns on **MCP server** under **AI assistants**. The organization's overview then shows the address under
   **Addresses**.
2. **Choose who may sign AI clients in.** In a tenant's **Sign-in rules**, turn on **Allow self-registered apps** and
   add the address under **Resources**.

Then give the address to the AI client (in Claude, add it as a custom connector). The person signs in and approves
it on a consent page that warns the client will manage the organization as them. They need a passkey or
authenticator code, as for the admin console.

To keep MCP off for every organization, start the server with `--disable-mcp` (`server.disable_mcp = true`).
Turning the switch off stops the server at once, for clients already signed in too.

### Who may use it, and what it can do

- **Managers and up only**, and only with a second-factor sign-in.
- **As the person who signed in.** Their role decides what they may see and change, exactly as in the console.
- **No more than a personal API token.** Changes that need a recent re-authentication (disabling an administrator,
  inviting another manager, removing someone's password, authenticator or passkey) are refused, and the client cannot
  make API tokens.
- **In the audit log**, under the person's name, with the client noted as `app`.
- **No sign-in links.** Invitations are emailed to the user, never given to the AI client.

| Tool | What it does |
| --- | --- |
| `search_users` | Finds users by the start of a username, email address or name, a tag, or a role |
| `get_user` | A user's profile, status, groups and sign-in methods |
| `list_user_sessions` | A user's signed-in browser sessions |
| `list_groups` | The groups, with their number of members |
| `list_group_members` | A group's members |
| `query_audit_log` | The audit log, filtered by name, action, outcome and time |
| `create_user` | Creates a user, optionally emailing an invitation |
| `enable_user` | Enables a disabled user |
| `add_group_member` | Adds a user to a group |
| `disable_user` | Disables a user, with a reason |
| `remove_group_member` | Removes a user from a group |
| `send_invitation` | Emails a user a new invitation |
| `sign_out_user` | Ends all of a user's sessions |

Changing roles, deleting anything, locking accounts, and applications, tenants, providers and settings are left to the
console on purpose.
