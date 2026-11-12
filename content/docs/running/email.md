---
title: "Email"
weight: 150
---

With `mail.smtp_host` set, invitations, password resets and address confirmations are emailed. Without it nothing is
emailed: administrators share invitation links themselves, and there is no self-service password reset. What the emails
say and look like is set per organization, over the primary organization's defaults: [Email templates](/docs/branding/emails/). An
organization's administration (its administrators, managers and service accounts) has it email at most 300 invitations
and verification links an hour to the addresses it enters, then 429 ([Email templates](/docs/branding/emails/#limits)). "Forgot your
password?" sends an account at most 5 reset emails an hour for the requests of one address, and 20 an hour in all:
anyone who knows the address can ask for a reset, but cannot use up the owner's own requests from another address, nor
flood the inbox. The form answers the same either way.

Email is queued in the store before the request that sends it answers, as the sending node's own ([Queued work](/docs/running/settings/#queued-work)),
sealed with the master key (messages carry single-use links). A message SMTP does not take is retried after 1, 5, 30
and 120 minutes, then given up and logged (`mail delivery failed, giving up`). A restart, or a crash, keeps the queue:
the node sends what is left when it is back (a message whose sending was cut short by the crash may go out twice).
When the master keys change (a start with new keys, or a reload) each node re-seals its own queue with the active key
before it reports that key, so a rotation reported complete leaves no queued message needing the old key. A message
sealed under a key that is not configured (one removed too early, or a node that was down during the rotation started
without it) is kept and logged, and sent once that key is put back in `previous_master_keys`. Each node holds at most
10,000 messages, of which one organization may have 2,500; past that, new ones (of that organization) are refused with
an error. Messages go out 8 at a time, at most 2 of them for one organization, each over a connection of its own: an
organization's burst (thousands of invitations, or password resets asked for address after address) fills only its
share, and the other organizations' messages go out beside its backlog rather than behind it. All organizations share
the one SMTP server, though: when it is slow or down every organization's mail waits alike. A message whose sign-in
code or link has expired by the time its turn comes is dropped, not sent (`mail not sent: what it carries expired while
it was queued`), so mail SMTP takes again after an outage is what still works. Watch `quisora_mail_queued`: growing
means SMTP is not taking mail.
