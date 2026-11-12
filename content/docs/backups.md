---
title: Backups and restore
description: Take encrypted backups of a running server, and restore them.
weight: 60
---

A backup is one file holding every record in Quisora. It is always encrypted with a password you choose, so a stolen backup is no use without it. Keep the password apart from the backups.

## Taking a backup

Backups come from a running server. You need a super admin's [API token](/docs/api-tokens/) with the `backup` scope.

```bash
export QUISORA_ADMIN_TOKEN=qsr_...
quisora backup --server https://id.example.com quisora.bak
```

Quisora asks for the password twice. It must be at least 12 characters. For a script, read it from a file instead:

```bash
quisora backup --server https://id.example.com \
  --password-file /etc/quisora/backup-password quisora.bak
```

The backup is a consistent snapshot, whichever database you use.

## Every night

Quisora has no backup schedule of its own. Use cron, a systemd timer or a Kubernetes CronJob on another machine. This keeps 30 days of nightly backups:

```bash
# /etc/cron.d/quisora-backup
30 2 * * * backup QUISORA_ADMIN_TOKEN="$(cat /etc/quisora/backup-token)" quisora backup --server https://id.example.com --password-file /etc/quisora/backup-password /srv/backups/quisora-$(date +\%F).bak && find /srv/backups -name 'quisora-*.bak' -mtime +30 -delete
```

Backup tokens expire within 30 days, so renew yours on a schedule too.

## Restoring

A restore goes into an empty store. Quisora checks the whole file before it writes anything.

```bash
quisora restore quisora.bak
```

Or restore when a fresh server starts:

```bash
export QUISORA_RESTORE_PASSWORD='...'
quisora serve --restore-from quisora.bak
```

You also need the master key the backup was made with. A backup from one database can go into another, for example from BadgerDB into PostgreSQL.

{{< tip "warning" >}}
A restore brings back everything as it was when the backup was made, including sessions and passwords changed since. After restoring an older backup, sign everyone out: **System overview**, then **Sign everyone out**.
{{< /tip >}}

## Test it

Try a restore now and then, into a spare server. A backup nobody has restored is a hope, not a backup.

## More

The [full backup guide](https://github.com/paularlott/quisora/blob/main/docs/RUNNING.md#backup-and-restore) covers large stores, clusters and SSH certificates after a restore.
