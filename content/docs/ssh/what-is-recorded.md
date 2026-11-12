---
title: "What is recorded"
weight: 130
---

| Audit event | When |
| --- | --- |
| `ssh.settings.update` | The SSH settings changed (with the fields that changed). |
| `ssh.ca.create` | A CA key was made: when SSH was first enabled, or host certificates were turned on (the key, its purpose and fingerprint). |
| `ssh.ca.rotate` | A CA key was rotated (`immediate`, `scheduled` for the automatic one, and the keys it retires). |
| `ssh.ca.remove` | A CA key was removed. |
| `ssh.cert.issue` | A user certificate was issued: the person, `serial`, `principals`, `fingerprint`, `valid_before`, `via` (`cli` or `account`) and `amr`. |
| `ssh.cert.refused` | A certificate was refused, with the `reason`, the tenant and `via`. At most one per person, tenant and reason a minute (`detail.suppressed` counts the others). |
| `ssh.cert.revoke` | A certificate was revoked: by hand (`serial`, `key_id`, and by whom), or by the system when the list found it revoked for a lost access (`access_removed`, `principals_changed`, `role_not_allowed`) or the sign-in it was issued under was ended (`sign_in_ended`), with the `reason`. |
| `ssh.host.issue` | A host certificate was issued, with who signed it, `serial`, `principals`, `valid_before` and `key_id`. |
| `ssh.host.refused` | A host certificate was refused (`host_certs_off`, `no_host_key`, `bad_key`, `bad_principals`, `pattern`, `bad_ttl`). Throttled like `ssh.cert.refused`. |

The reasons of `ssh.cert.refused` are `not_enabled`, `no_user_key`, `wrong_client`, `mfa_required`, `auth_too_old`,
`method_not_allowed`, `user_unusable`, `session_ended`, `app_unavailable`, `no_access`, `privileged`, `bad_key`,
`no_principals`, `too_many`, `bad_principal` and `bad_ttl`. The refusals have the outcome `failure`. A run of
`mfa_required` or `no_access` from one person is usually a person who needs help. Each certificate records the session
epoch and sign-out stamp of the sign-in that asked for it, which is how `session_ended`, `sessions_ended` and `signed_out`
are decided. What Quisora cannot record is a login on a server: that is in sshd's log, which names the certificate by key
id and serial.
