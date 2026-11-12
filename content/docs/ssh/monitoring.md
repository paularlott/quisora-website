---
title: "Monitoring"
weight: 120
---

A server that has stopped fetching keeps its old list and, after a CA rotation, its old CA key, and only a failing check
shows it. Alert on both of these on every server (and client) that fetches:

- **The fetch service failing**: `systemctl is-failed quisora-ssh-fetch.service` (with the node exporter's systemd collector,
  `node_systemd_unit_state{name="quisora-ssh-fetch.service",state="failed"} == 1`). A failed run keeps the old files, and shows in
  `systemctl --failed` and in `journalctl -u quisora-ssh-fetch.service`.
- **The revocation list file getting old.** `fetch` writes the list whenever its bytes differ, which is nearly every
  run, so the file's modification time is the last successful fetch. Alert when it is older than 5 minutes:

  ```bash
  # succeeds only when the list was refreshed in the last 5 minutes (it fails when the file is missing, too)
  find /etc/ssh/quisora.krl -mmin -5 2>/dev/null | grep -q .
  ```

  Any check that reads a file's age does the same (Nagios, a cron job that pushes a metric, the textfile collector of
  the node exporter). The `curl` script of [Without the quisora binary](/docs/ssh/setting-up-an-ubuntu-server/#without-the-quisora-binary) touches the list
  when Quisora answers `304` (unchanged), so the same check works for it. A run that is given a list older than the one installed keeps the file as it is, so one such run
  can leave it a minute older; 5 minutes leaves room for that.

On Quisora's side, a revocation list that cannot be made is logged at error level (`oidc: making an SSH revocation
list`, with the organization and tenant) and answered `503`, and the servers go on with their old list meanwhile: alert on
that line.
