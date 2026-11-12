---
title: "Reference"
weight: 160
---

| | |
| --- | --- |
| Discovery | `GET /o/<org id>/ssh/<tenant>` (JSON: `issuer`, `enabled`, `client_id`, the OAuth endpoints, `sign_endpoint`, `user_ca_endpoint`, `known_hosts_endpoint`, `krl_endpoint`, `host_sign_endpoint`, `cert_ttl`, `max_auth_age`, `host_certs`, `host_patterns`, `acr_values`). `<tenant>` is the tenant's id or name: use the id. |
| Caching of the GETs | All four carry an `ETag`, and a request whose `If-None-Match` names it gets `304` with no body. The revocation list, `ca.pub` and `known_hosts` are `Cache-Control: no-cache` (the list's ETag changes only when what it revokes does); the discovery document is `public, max-age=60`. |
| User CA keys | `GET …/ssh/<tenant>/ca.pub` (`text/plain`; one `ssh-ed25519 AAAA… quisora:<org>/<tenant>:user:<key id>` per published key) |
| Host CA lines | `GET …/ssh/<tenant>/known_hosts` (`@cert-authority <patterns> ssh-ed25519 AAAA… quisora:<org>/<tenant>:host:<key id>`; empty unless host certificates are on) |
| Revocation list | `GET …/ssh/<tenant>/krl` (`application/octet-stream`, an OpenSSH KRL; version is the unix time it was made; `503` when it cannot be made) |
| Sign a user certificate | `POST …/ssh/<tenant>/sign` with `Authorization: Bearer <access token of the SSH application>` (the CLI uses bearer tokens; a DPoP-bound token is accepted too) and `{"public_key": "…", "principals": […], "ttl": seconds}`; answers `certificate`, `serial`, `key_id`, `principals`, `valid_after`, `valid_before`. Errors `401 invalid_token`, `403 access_denied`, `400 invalid_request`, `429 slow_down` |
| Management API | `GET`, `PATCH /api/orgs/{org}/tenants/{id}/ssh`; `POST …/ssh/rotate`; `DELETE …/ssh/keys/{key}`; `GET …/ssh/certificates`; `POST …/ssh/certificates/{cert}/revoke`; `POST …/ssh/host-certificates` (scope `ssh:host`) |
| Account page | `GET /o/<org id>/api-internal/account/ssh`, `POST …/account/ssh/sign` (`{"tenant_id", "public_key"}`), `POST …/account/ssh/certificates/{id}/revoke` (session and CSRF token) |
| Scopes | `ssh` (settings, keys, certificates), `ssh:host` (sign host certificates only) |
| Settings JSON | `enabled`, `cert_ttl`, `max_auth_age`, `principal_username`, `principal_groups`, `principal_roles`, `permit_pty`, `permit_user_rc`, `permit_port_forwarding`, `permit_agent_forwarding`, `permit_x11_forwarding`, `source_addresses`, `allow_privileged`, `rotation_days`, `host_certs`, `host_ttl_days`, `host_patterns` (and `client_id`, read only) |
| Principals | `<username>`, `group:<group name>`, `role:<role>`; the name part 1 to 64 of `A-Za-z0-9._@-` |
| CLI | `quisora ssh login <url> [--device] [--no-browser] [--no-agent] [--key <path>] [--principal …] [--ttl …]`, `status`, `logout [<url>]`, `host-sign <url> <host public key file> [--principal …] [--ttl <days>] [--auth-method auto\|post\|basic]`, `fetch <url> [--ca-file …] [--krl-file …] [--known-hosts-file …]` |
| `fetch` defaults | `--ca-file /etc/ssh/quisora_user_ca.pub`, `--krl-file /etc/ssh/quisora.krl`, `--known-hosts-file` not written; an empty value leaves a file alone |
| Key id | user `<username>@<org name>/<user id>`, host `host:<first name>@<org name>`; serials are random 64-bit numbers |
| Validity | from 5 minutes before signing; to the lifetime, never past the account's end date |
| Revocation timing | list kept 30 s per node, not cached by clients; servers fetch every minute |
| CA key rotation | user key: published at once, signs in 7 days, old one published 25 h more; host key: signs at once. A removed key is revoked by the list for 24 h 10 min (user) or 365 days 10 min (host). |
| Limits | 100 unexpired user certificates per user and tenant (revoked ones count); 20 signs a minute per person, 60 per address; 60 account-page revocations a minute per person; 16 000 fetch units a minute per address and tenant |
| Stored | `ssh_ca_keys` (CA keys, private halves sealed with the master key; a removed key stays as a tombstone) and `ssh_certificates` (until an hour after they expire) |
