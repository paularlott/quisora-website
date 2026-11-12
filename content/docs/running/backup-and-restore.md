---
title: "Backup and restore"
description: "Take encrypted backups from a running server, schedule them, and restore into an empty store."
weight: 60
---

A backup is one compressed file of every record. It is always encrypted with a password you choose (at least 12
characters), not with the master key, so a stolen master key does not open old backups and a stolen backup needs its
password. Keep the password apart from the backups. Secrets inside stay sealed with the master key, so a restore also
needs the key the backup was made with. For a backup from before a
[master key rotation](/docs/running/rotating-the-master-key/), put the old key in `server.previous_master_keys` for the
restore. A restore refuses an altered file before writing anything.

## Taking a backup

Back up a running server on any backend. The token is a super admin's API token with the `backup` scope:

```bash
QUISORA_ADMIN_TOKEN=qsr_... quisora backup --server https://id.example.com quisora.bak
```

The password comes from `--password-file` (its first line), else from standard input when it is a pipe, else the
terminal prompt. It is never a flag.

```bash
quisora backup --server https://id.example.com --password-file /run/secrets/backup-password quisora.bak
```

- The backup is a consistent point-in-time snapshot. A backup is refused (try again shortly) while the database is part
  way through copying data from another node.
- `quisora backup quisora.bak` without `--server` reads the configured store directly. On BadgerDB and SQLite, stop the
  node first.
- A backup holds one snapshot open for its whole run, and `--server` streams it as it reads. On a large store or a slow
  link this can take minutes, during which the database cannot clean up behind it (more disk on PostgreSQL, MySQL and
  MariaDB, a growing `-wal` file on SQLite). So take backups when traffic is lowest. Over a slow link, run `quisora backup`
  without `--server` on a host close to the database and copy the finished file. A backup that takes noticeably longer
  than before is the first warning.

### Scheduling

Quisora has no schedule of its own. Run `quisora backup --server` from cron, a systemd timer or a Kubernetes CronJob on
a machine that keeps the files away from the node, and alert when it fails. For example, nightly at 02:30 with 30 days
kept:

```bash
# /etc/cron.d/quisora-backup: the token and password files are readable by the backup user only
30 2 * * * backup QUISORA_ADMIN_TOKEN="$(cat /etc/quisora/backup-token)" quisora backup --server https://id.example.com --password-file /etc/quisora/backup-password /srv/backups/quisora-$(date +\%F).bak && find /srv/backups -name 'quisora-*.bak' -mtime +30 -delete
```

Give the token an expiry and renew it. Try a restore now and then, into a scratch node: a backup nobody has restored is
a hope, not a backup.

## Restoring

Restore into an empty store:

```bash
quisora serve --restore-from quisora.bak      # or QUISORA_RESTORE_FROM; ignored once the store holds data
quisora restore quisora.bak                   # into the configured store, without serving
```

- `quisora restore` reads the password as `quisora backup` does. `serve --restore-from` takes it from
  `server.restore_password` (`QUISORA_RESTORE_PASSWORD`).
- Ids and versions are kept, into any backend.
- The backup is checked as it is copied to a private file in the data directory, as large as the backup, so leave room
  there. It is removed when the restore ends.
- A restore that fails part way leaves `restore-incomplete` in the data directory. Empty the store before trying again.

{{< tip "warning" >}}
A restore brings back the state of the backup's time: refresh tokens and sessions revoked since, passwords, second
factors and passkeys changed since, and accounts disabled since. After restoring a backup that is not from moments
ago, sign everyone out
([`quisora sign-out --all --api-tokens`](/docs/security/emergency-sign-out/#from-the-command-line), or **Sign everyone
out…** on the System page once it serves), and review the accounts changed since the backup.
{{< /tip >}}

### Clusters

Clusters always restore into an empty cluster.

- **Shared database:** restore into the empty database, then start the nodes.
- **Gossip:** restore into one node with an empty database and start it. Start the others with empty databases and they
  copy from it. A restored node that meets a cluster with other data refuses to serve ("another data set is in view").

### Tenants that use SSH certificates

A backup holds CA keys, certificate records and revocations as they were then. After restoring an older one, for each
such tenant rotate the user CA key (and the host key) at once, remove the old keys, re-revoke what was revoked since, and
have everyone sign in again ([Revoking and rotating](/docs/ssh/revoking-and-rotating/)).
