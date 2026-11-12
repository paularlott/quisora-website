---
title: "The primary organization"
weight: 80
---

The primary organization is the first one, made by `quisora bootstrap`, and it never changes. Its id is made at that
bootstrap, like any other (each installation's is its own), and kept in its record, which marks it as the primary one:
every node reads it from the database it shares or the data set it copies, and a backup carries it, so a restored
server keeps the same primary organization, with the same id. A node that does not know it yet (not set up, or a new
gossip node still copying) is not ready. Its sign-in page is `/o/<id>/login` (what `https://<public_url>/` redirects
to; `/o/primary/login` by its name works too, until it is renamed) and its issuer `<public_url>/o/<id>`. Super
admins belong to it, and the server's emergency sign-out counters are kept on it. When its super admins are all gone, `quisora invite
--break-glass --super-admin` (above) recovers access.
