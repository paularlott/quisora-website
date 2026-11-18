---
title: "Access requests"
description: "Let people ask for access to a tenant for a while, and let an approver group decide."
weight: 75
---

People ask for access to a members-only tenant for a while. A member of an approver group says yes or no. The access
then ends by itself.

Approving gives the person an entry that ends ([access for a limited time](/docs/applications/timed-access/)). So
everything that happens when timed access ends happens here too: they are signed out of the tenant's applications, and
no token or SSH certificate outlives it.

What it is for:

- **Support access to a customer.** The customer's organization lets your support staff in through a
  [guest provider](/docs/sign-in/guest-accounts/). The provider's own tenant in your organization lets in only the
  people on its access list. Access to that tenant is access to the customer.
- **Your own tools.** An engineer asks for a production tools tenant for a few hours.

## Setting it up

An administrator sets it up for their own organization, on the **Groups** page.

1. Make or choose the group whose members **approve**, such as *On-call leads*. Edit it, and under
   **Access requests** turn on **Members approve access requests**.
2. Edit the group whose members may **ask**, such as *On-call*. Under **Access requests**, turn on **Members can
   request access**.
3. In **Approved by**, choose the approver group. Only groups that approve are listed.
4. Tick the lengths people may ask for: 1 hour, 4 hours, 8 hours, 1 day, 3 days, 1 week, 2 weeks or 1 month. With none
   ticked, all of them are offered.
5. If a bot should approve, turn on **Service accounts can approve** (see [through the API](#through-the-api)).

{{< screenshot name="app-request-group" alt="A group's settings with Members can request access, the approver group and the lengths people may ask for" class="max-w-2xl" >}}

People can ask for any members-only tenant of the organization: one whose **Who can sign in** is **Only users and
groups given access**.

Good to know:

- Only administrators can change who is in a group with either switch on. A manager can't add themselves, or anyone
  else, and approve their own way in.
- A group that approves can't be deleted while another group names it in **Approved by**.
- What a person gets on the tenant comes from the tenant's **defaults for new access**: on the tenant's page, the
  **Access** card's **Edit defaults** sets roles, tags and authorization details. Approved access always covers all of
  the tenant's applications.

## Asking for access

Members of a group that may ask see **Request access** in their account menu.

1. Open **Request access**, then choose **Request access** on that page.
2. Choose the tenant. Type the start of its name.
3. If your groups have more than one approver group, choose who to ask in **Request approval from**.
4. Choose how long, and say why: a ticket number and what you need to do.
5. Send it. The approvers get an email.

{{< screenshot name="app-request-ask" alt="The Request access dialog with the tenant, how long, and the reason" class="max-w-2xl" >}}

The same page lists your requests: waiting ones (you can cancel them), active ones (with their end, and **End now**),
and past ones.

{{< screenshot name="app-request-mine" alt="A person's own access requests: one waiting, one ended early and one denied" >}}

Good to know:

- You can't ask for a tenant you already have access to with no end.
- You can ask only once at a time for each tenant. Asking for a tenant you hold until a set time asks to extend it.
- A request nobody decides within a day lapses.
- One person may have 10 requests waiting at once.
- A guest from another organization asks in their own organization, not in the one they visit.

## Approving

Every member of a group that approves sees **Approvals** in their account menu. It lists the requests waiting for
them, oldest first, with who asked, for which tenant, how long and why.

1. Choose **Approve** or **Deny**. You can add a note, which the person sees.
2. Confirm it is you (your password and second factor, or a passkey), unless you did in the last 5 minutes.

{{< screenshot name="app-request-approvals" alt="The Approvals page: a waiting request, and the group's decisions with their filters" >}}

Nobody decides their own request: an approver who asked themselves sees it marked, for someone else to decide. A
guest from another organization never approves.

Approving gives access from now until the end of the length asked for:

- with no access yet, a new entry that ends, for all of the tenant's applications;
- with access until a set time, its end moves later (never earlier);
- with access that has no end, nothing changes, and the request says so.

The person gets an email either way.

Below the waiting list, **Your groups' decisions** shows what the group decided, whoever made the decision, newest
first. Filter it to **Active**, **Ended**, **Denied** or **All**, or search by the person's name or email, the tenant
or the reason. When access reaches its end, its request shows as **Expired**.

## Ending access early

Choose **End now** on the request. The access is removed at once, and the person is signed out of the tenant's
applications. These people can do it:

- the person themselves, on their **Request access** page;
- a member of the approver group, on **Approvals**;
- a service account allowed to decide the group's requests;
- an administrator.

If someone else ends it, the person gets an email.

{{< tip "warning" >}}
Use **End now** on the request, not the tenant's **Access** card. Removing the entry on the card takes the access away
too, but the request keeps showing **Active** until its end time. **End now** keeps the request, the emails and the
audit log in step. It still works if the entry is already gone.
{{< /tip >}}

## Emails

There are three emails, which each organization can change under [**Emails**](/docs/branding/emails/): **Access
request** (to the approvers), **Access request decided** and **Access ended** (to the person who asked).

## Through the API

- People can ask, list, cancel and end their own requests with a [personal API token](/docs/automation/api-tokens/)
  that holds the `access_requests` scope. A personal token never approves: it can't show a recent second factor.
- A bot approves or denies with a [service account](/docs/automation/service-accounts/) that holds
  `access_requests:approve`, for the groups where **Service accounts can approve** is on.
- Administrators list every request of the organization.

The calls are in the API reference at `/api-docs/`.

## Records and audit

The console's **Access requests** page lists every request of the organization: active, expired, ended early,
waiting, denied, cancelled and lapsed.

Closed requests are kept for 90 days. The server setting `limits.access_requests_kept_days` changes that, and
`limits.access_requests_waiting` changes how many requests one person may have waiting
([settings](/docs/running/settings/#limits-and-denied-addresses)).

The audit log keeps the full history:

| Event | When |
| --- | --- |
| `access_request.create` | Someone asked. |
| `access_request.approve`, `access_request.deny` | An approver decided. |
| `access_request.cancel` | The person cancelled a waiting request. |
| `access_request.lapse` | Nobody decided within a day. |
| `access_request.end` | Someone ended the access early. |
| `tenant.access.add`, `tenant.access.update`, `tenant.access.remove` | The access entry an approval or an early end changed, with the request's id and reason. |
