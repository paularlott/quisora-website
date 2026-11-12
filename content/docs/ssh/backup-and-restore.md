---
title: "Backup and restore"
weight: 110
---

A backup holds the CA keys, the certificate records and the tenants' settings as they were when it was made. Restoring an
**older** backup therefore:

- can **republish a CA key that was removed since** (the tombstone is gone, the key is published again, and its private
  half is in the backup), so servers trust it again and the certificates it signed work again until they expire;
- **undoes revocations made since**: certificates revoked by hand, and the lost accesses written down, come back to
  life, and users removed, disabled or taken out of groups since come back as they were;
- **has no record of the certificates issued after the backup**: they are not on any list and cannot be revoked by serial,
  and work until they expire on servers that trust the key that signed them.

After a restore, for every tenant that uses SSH:

1. **Rotate the CA keys immediately** (user key, and the host key if host certificates are on).
2. **Remove the old keys**, all of them that were published before the restore. The list then revokes them outright, and
   with them every certificate they signed, whether or not Quisora knows it.
3. **Re-revoke** what was revoked since the backup (certificates, disabled users), and check the access lists and group
   memberships.
4. Everyone signs in again for a new certificate; re-sign the hosts and refresh the clients' `known_hosts` after a host key
   rotation.
