---
title: "Verifying callers"
description: "Let your support team confirm that the person on a phone call is really the account holder."
weight: 35
---

When someone phones your support team and says "I'm Alan", how does the agent know? Asking for a password or the
answer to a security question is risky: anyone who learns it can use it again, and a scammer can talk an agent round.

Caller verification gives the agent a better way. The agent starts a verification and reads a six-digit code to the
caller. The caller opens their own account, enters the code, sees who is asking, and confirms it is them with their
passkey or second factor. The agent's screen then shows **Confirmed**.

Why it helps:

- **Nothing secret is said on the phone.** The code works once, for that one person, for 5 minutes.
- **Nothing is sent to the caller.** No link and no email. They go to their own account on the address they already
  know, so nobody can send them to a look-alike page.
- **The caller sees who is really asking.** Entering the code shows them the agent's name and email, the organization,
  and why. If that's not who they think they are talking to, they can say so.

## Setting it up

A **super admin** turns it on, one organization at a time.

1. Make a group for the people who verify callers, such as *Customer support*, and add the agents to it. These people
   are called **agents**.
2. Open **Organizations** and edit the organization.
3. Under **Caller verification**, turn on **Agents can verify callers**.
4. In **Agent groups**, type the group's name and choose it. You can add more than one group.
5. Choose **Save changes**.

{{< screenshot name="verify-settings" alt="The Edit organization dialog with Caller verification: Agents can verify callers on, the Customer support agent group, and the switch that lets the primary organization's agents verify this organization's people" class="max-w-2xl" >}}

Agents verify the people of their own organization. While the switch is on, only administrators can change who is in
an agent group. Managers can't add themselves or anyone else.

**Let the primary organization's agents verify this organization's people** is offered in every organization except
the primary one. Turn it on if your own support team, in the primary organization, also supports this organization's
people. Only the primary organization's agents can ever verify people of another organization.

Once it is on, people who can be verified see **Verify a call** in their account menu. Agents also see
**Verify a caller** at the top of theirs.

## Verifying a caller

This is the agent's side.

1. Open the account menu and choose **Verify a caller**.
2. If you are an agent of the primary organization and another organization lets you verify its people, choose the
   **Organization** first. It starts as your own.
3. In **Person**, type the start of the caller's name, username or email, and choose them.
4. Under **Who called?**, choose **They called us** or **We called them**. Only call people on the number held for
   their account, never a number the caller gives you.
5. Optionally fill in **Why**, such as the ticket you are talking about. The caller sees it.
6. Choose **Start verification**.

{{< screenshot name="verify-caller-start" alt="The Verify a caller page with Alan Turing chosen, They called us selected and a reason filled in" >}}

7. Read the code to the caller. Tell them to open **Verify a call** in their account menu. The page shows the address
   too.

{{< screenshot name="verify-caller-waiting" alt="Verify a caller while waiting: the six-digit code to read out, how long it works, and today's verifications below with each result" >}}

The page shows the answer as soon as the caller gives it:

| Result | What it means |
| --- | --- |
| **Waiting** | The caller has not answered yet. The code works for 5 minutes. |
| **Confirmed** | The caller entered the code and confirmed it is them with a passkey or second factor. If their account has neither, they confirmed with their password alone, and the page says so. |
| **Not them** | The caller entered the code and chose **Not me**. Treat the call with suspicion. |
| **Ran out** | Nobody entered the code in time. Start again if you need to. |
| **Cancelled** | You stopped it. |

**Your verifications today** lists the ones you started, with the newest first. A waiting one has **Open** and
**Cancel**.

If you reload the page, the waiting verification comes back with its code. In another browser it comes back without
the code: cancel it and start a new one if the caller hasn't got it.

An agent can't verify themselves, or a super admin. Each agent can start up to 60 verifications an hour.

## Verifying a call

This is the caller's side: someone on a call with your support team.

1. Open the account menu and choose **Verify a call**.
2. Look at **Verifying you now**. It shows who has started a verification for you, from which organization, and why.
   It never shows the code. If someone on the phone asks you for a code and nobody shows here, they didn't start a
   verification.
3. Enter the six digits you were given. They are checked as soon as all six are in.

{{< screenshot name="verify-call-enter" alt="The Verify a call page: Grace Hopper of Acme Corporation is verifying you now, the boxes for the code, and the Who verified you list" >}}

4. Check what the page shows: who is asking, from where, who placed the call (such as "You called Acme
   Corporation"), and why.
5. Read the warning. Only confirm if you are on a call with that person right now, and the call went the way the page
   says.
6. Choose **Yes, it's me**. You may be asked for your passkey or second factor first, unless you used it in the last 5
   minutes. Or choose **Not me** if it isn't your call, and the agent sees **Not them**.

{{< screenshot name="verify-call-ask" alt="Is this you? Who is asking, from which organization, who placed the call and why, a warning, and the buttons Yes, it's me and Not me" >}}

After 5 wrong codes in 10 minutes, the page stops taking codes for a while.

**Who verified you**, lower on the same page, lists everyone who asked to verify you: who, from where, when, and what
came of it. If you see one you don't recognise, tell the organization it came from.

## From a CRM or helpdesk

Your CRM or helpdesk can have its own **Verify** button that does what the page does. It always acts as the agent, so
the caller sees the agent's own name. A service account can't verify callers.

There are two ways to connect it:

- **The agent's personal API token** with the `call_verify` scope. Agents see **Verify callers as you** when they make
  a token on their account page. The CRM keeps one token for each agent. See [API tokens](/docs/automation/api-tokens/).
- **The agent signs in to the CRM through Quisora.** The CRM asks for the organization's caller verification API as a
  resource, and calls it with the agent's own short-lived token. The organization's overview lists that address under
  **Addresses** as **Caller verification API (for CRMs)** while caller verification is on. Add the same address under
  **Resources** on the CRM's application in Quisora, as for an [MCP client](/docs/automation/mcp/).

The calls are in the API reference at `/api-docs/` on your server.

## What it proves, and what it doesn't

A confirmed verification means the person on the call was signed in to that account and confirmed it is them with
what the account signs in with. It says nothing more about who they are in the world than the account itself does.

**Watch for the relayed code.** A scammer can phone your customer pretending to be you, while also phoning your support
team pretending to be the customer. When your agent reads the code, the scammer passes it to the real customer, who
enters it.

**Who called?** catches this. Your agent records that the "customer" called them. So the real customer's page says
"You called Acme Corporation", but they know they were the one who was called. The warning tells them to choose
**Not me**. And because agents only call out on the number held for the account, a scammer can't be on the end of a
call your team makes.

Even so, treat a verification as one piece of evidence, not the only one, before anything that can't be undone.

## Records and audit

Quisora keeps each verification for 30 days, so the caller's **Who verified you** goes back that far. The agent's
page lists today's. The [audit log](/docs/running/audit-log/) keeps the full history in both organizations, the
agent's and the caller's:

| Event | When |
| --- | --- |
| `call_verify.start` | An agent started a verification. With the reason, if one was given. |
| `call_verify.confirm` | The caller confirmed it is them. `detail.second_factor` says whether with a passkey or second factor. |
| `call_verify.deny` | The caller chose **Not me**. |
| `call_verify.cancel` | The agent cancelled it. |

For SOC 2 evidence, see [SOC 2 with Quisora and VictoriaLogs](/docs/security/soc2/).
