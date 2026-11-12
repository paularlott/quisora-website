---
title: "Backups"
weight: 180
---

`quisora backup` and `GET /api/backup` write every live record with its version, generation and origin. Where the backend offers a
point-in-time view (BadgerDB: one read transaction; SQLite, PostgreSQL, MySQL and MariaDB: one read-only repeatable-read
transaction) the backup is a **consistent snapshot**. A backup is always encrypted with a password (AES-256-GCM in
authenticated chunks, the key derived from the password with argon2id; secrets inside stay sealed by the master key too): a truncated, reordered or altered file is refused before anything is restored. A remote download is checked for
completeness as it arrives. The remote download needs a super administrator's API token with the **`backup`** scope. Passwords,
the schedule and restoring: [Backup and restore](/docs/running/backup-and-restore/).
