---
title: "Backup and restore"
weight: 130
---

A backup is one compressed file of every record. Secrets stay sealed, and the file has an integrity check made with
the master key. A restore needs the key it was made with (the active one, or, for a backup from before a
[master key rotation](/docs/running/rotating-the-master-key/), the old one put in `server.previous_master_keys` for the restore), and
refuses an altered file before writing anything.

A backup is encrypted with a password (AES-256-GCM, the key derived by argon2id), not with the master key: a
master key exposure does not open old backups, and a stolen backup needs its password. Keep the password apart from
the backups.

A backup is refused (try again shortly) while the database holds a partition part-way through a copy from another
node, whether the server is running or not: a copy of a whole partition empties it first, and a catch-up cut short has
changed some of a write's records and not yet the others, so a backup of either would verify and restore without being
data the cluster ever held.

Back up a running server (any backend; the token is a super admin's API token with the `backup` scope):

```bash
QUISORA_ADMIN_TOKEN=qsr_… quisora backup --server https://id.example.com quisora.bak    # asks for the password twice
```

- The password (at least 12 characters) comes from `--password-file` (its first line), else from standard input when
  it is a pipe, else from the terminal. It is never a flag.

  ```bash
  quisora backup --server https://id.example.com --password-file /run/secrets/backup-password quisora.bak
  printf '%s\n' "$BACKUP_PASSWORD" | quisora backup --server https://id.example.com - > quisora.bak
  ```

- A backup is always encrypted: there is no unencrypted form. A stolen backup holds every account and audit event,
  and its secrets are only as safe as the master key that seals them, which is often kept nearby.
- `--server` sends the password over TLS and the server encrypts the stream; the download is checked with the
  password as it arrives.
- `GET /api/backup` needs the password in the `X-Backup-Password` header; without it, it answers 400.
- `quisora backup quisora.bak` without `--server` reads the configured store directly. On BadgerDB and SQLite, stop the node
  first.
- Every backend gives a point-in-time snapshot: the backup is consistent.
- **A backup holds one database snapshot open for its whole run**, and `--server` streams it to the client as it reads, so
  a large store or a slow downloader makes the run last minutes. For all that time the database cannot clean up what
  changed since: PostgreSQL keeps the old row versions (table and index bloat, until the snapshot ends and vacuum
  catches up), MySQL and MariaDB keep their undo log growing (history list length), and SQLite's WAL cannot be
  checkpointed past the snapshot, so the `-wal` file grows with every write. So:
  - take backups when traffic is lowest (the cron example below is at 02:30);
  - over a slow link (a backup machine far from the server, a throttled download), do not stream it: run
    `quisora backup quisora.bak` without `--server` on a host close to the database (it needs the same configuration,
    and on BadgerDB and SQLite the node stopped), then copy the finished file;
  - watch the database while one runs, and alert on it: the size of SQLite's `-wal` file, PostgreSQL's oldest
    transaction (`pg_stat_activity.xact_start`) and dead tuples, MySQL's history list length. A backup that takes
    noticeably longer than it used to is the first sign.

Quisora has no backup schedule of its own: run `quisora backup --server` from cron (or a systemd timer, or a
Kubernetes CronJob) on a machine that keeps the files away from the node, and alert when it fails. For example,
nightly at 02:30 with 30 days kept:

```bash
# /etc/cron.d/quisora-backup: the token and password files are readable by the backup user only
30 2 * * * backup QUISORA_ADMIN_TOKEN="$(cat /etc/quisora/backup-token)" quisora backup --server https://id.example.com --password-file /etc/quisora/backup-password /srv/backups/quisora-$(date +\%F).bak && find /srv/backups -name 'quisora-*.bak' -mtime +30 -delete
```

- The token is a super admin's API token with only the `backup` scope; give it an expiry and renew it.
- Try a restore now and then (into a scratch node, `quisora restore` on an empty data directory): a backup nobody has
  restored is a hope, not a backup.

Restore into an empty store:

```bash
quisora serve --restore-from quisora.bak      # or QUISORA_RESTORE_FROM; ignored once the store holds data
quisora restore quisora.bak                   # into the configured store, without serving
```

- An encrypted backup needs its password: `quisora restore` reads it as `quisora backup` does (`--password-file`, a
  pipe, or the terminal); `serve --restore-from` takes it from `server.restore_password` (`QUISORA_RESTORE_PASSWORD`).

- Ids and versions are kept, into any backend (a BadgerDB backup can go into PostgreSQL).
- The backup is checked as it is copied to a private file in the data directory (`quisora-restore-…`, as large as the
  backup file, removed when the restore ends; not `TMPDIR`, which may be a `tmpfs` held in memory), and the records are
  written from that copy: a file changed after the check is never what is restored. Leave room for it there. A copy an
  interrupted restore left is removed when the next one starts.
- A restore that fails part-way leaves `restore-incomplete` in the data directory. Empty the store before trying again.
- **A restore brings back the state of the backup's time**: refresh tokens and grants revoked since, sessions and
  API tokens ended since (the [emergency sign-out](/docs/security/emergency-sign-out/) counters go back too), passwords, second
  factors and passkeys changed or removed since, and accounts disabled since. Only an audit note (`backup.restore`)
  says it happened. After restoring a backup that is not from moments ago, sign everyone out
  ([`quisora sign-out --all --api-tokens`](/docs/security/emergency-sign-out/#from-the-command-line), or **System overview** →
  **Sign everyone out…** once it serves), and review the accounts and credentials changed since the backup was made.
  A forced restore over data (`--force`) brings back each record the store holds an older version of or no longer
  holds at all (a deletion whose tombstone has been purged included), so the same applies to it.
- **Clusters always restore into an empty cluster.**
  - Shared database: restore into the empty database, then start the nodes.
  - Gossip: restore into one node with an empty database (a restore never goes over data, nor on a node that already holds a
    data set) and start it, and start the others with empty databases. The restore writes the records as the first writes of
    their partitions, of a new data set, which the other nodes adopt and copy.
  - A restored node that meets a cluster of another data set exchanges nothing with it and refuses to serve ("another data set
    is in view").
- **Tenants that use [SSH certificates](/docs/ssh/) need steps after a restore from an older backup.** The backup holds
  the CA keys, certificate records and revocations as they were then, so a restore can republish a CA key that was removed
  since (and its private half), undo revocations made since, and know nothing of the certificates issued after the backup,
  which then cannot be revoked by serial. For each such tenant: rotate the user CA key (and the host key) immediately,
  remove the old keys, which makes the revocation list revoke them outright on every server that fetches it, re-revoke
  what was revoked since, and have everyone sign in again ([Backup and restore](/docs/ssh/revoking-and-rotating/#after-restoring-a-backup)).
