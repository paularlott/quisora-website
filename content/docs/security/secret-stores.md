---
title: "Secrets in Vault or 1Password"
description: "Keep keys and passwords out of the configuration file by naming them in a secret store."
weight: 20
---

Any secret setting can name its value in HashiCorp Vault (or OpenBao) or 1Password instead of holding it. The
configuration file then holds only references, and keys can be rotated in the store.

The secret settings are `server.master_key` and `server.previous_master_keys`, `cluster.key` and
`cluster.previous_keys`, `cluster.notify.key`, the database DSNs and passwords, the SMTP password,
`storage.badgerdb.encryption_key`, `server.restore_password`, `metrics.token`, and a VictoriaLogs URL with
credentials in it.

## References

| Reference | Store |
| --- | --- |
| `op://<vault>/<item>/<field>` | 1Password: the field of an item, by name or id |
| `op://<vault>/<item>/<section>/<field>` | 1Password: a field in a section of the item |
| `vault://<path>#<field>` | Vault: the API path after `/v1/` (KV version 1 or 2), field `value` when none is named |

Every other value is the value itself, so references and plain values mix freely. In a KV version 2 mount the path
has `data/` after the mount name: the secret the Vault CLI calls `secret/quisora` is
`vault://secret/data/quisora#master_key`.

```toml
[server]
master_key = "vault://secret/data/quisora#master_key"
previous_master_keys = ["vault://secret/data/quisora#previous_master_key"]

[storage.postgres]
dsn = "op://Infra/Quisora PostgreSQL/dsn"

[secrets.vault]
address = "https://vault.internal:8200"
token_file = "/etc/quisora/vault-token"   # or token = "..."; or AppRole: role_id, secret_id or secret_id_file
# namespace = "admin/quisora"             # Vault Enterprise
# ca_file = "/etc/quisora/internal-ca.pem"

[secrets.onepassword]
connect_url = "https://op-connect.internal:8080"   # 1Password Connect
connect_token_file = "/etc/quisora/op-connect-token"
# service_account_token = "ops_..."       # a service account instead of Connect (see below)
```

Use `https` (with `ca_file` for a private CA). Plain `http` works for a store on the same host, but the keys then
cross the network unencrypted, and `serve` warns at every start.

## When they are read

Every command that runs against the server reads the references it needs when it starts, and `serve` refuses to
start if a store cannot be read. Values are kept in memory only.

## Reloading

A reload reads the master keys and cluster keys from their stores again and switches to them. Either send **SIGHUP**
to a node, or use **Read secret stores now** on the console's **System overview** (super admins). Every node runs it,
checking first and changing nothing unless all can. Nodes sharing a database are reached through `cluster.notify`;
without it, reload each node with SIGHUP.

A store that cannot be read fails the reload and leaves the keys as they were. The other settings (DSNs, the SMTP
password, the BadgerDB key) are read at start-up only.

## Rotating the master key in the store

The [usual steps](/docs/running/rotating-the-master-key/), each an edit in the store followed by a reload:

1. Put the new key in the previous key's field (keeping the old one as the master key), then reload.
2. Swap them: the new key as the master key, the old one as the previous key, then reload.
3. Once the rotation status says `complete`, empty the previous key's field and reload.

An empty field means no key, so the previous key's field can stay in the configuration between rotations. The cluster
key rotates the same way ([rotating the cluster key](/docs/running/clustering/#rotating-the-cluster-key)).

## The stores' own credentials

They go in the configuration file, in a file it names (`*_file`: the file's first line), or in the environment
(`QUISORA_VAULT_TOKEN`, `QUISORA_ONEPASSWORD_CONNECT_TOKEN`).

- Keep those files, and any configuration file that holds a secret, readable only by Quisora's user (`chmod 600`).
  Every command warns about one others can read.
- Prefer Vault AppRole with a short token lifetime to a long-lived token.
- Give the Vault token, 1Password service account or Connect token read access to Quisora's items only.

## 1Password service accounts

1Password service accounts talk to 1Password's servers over the internet, and only builds with the `onepassword` tag
include them: `task build-1password`, the `quisora-1password-...` release binaries, or
an image you build yourself with `docker build --build-arg GO_TAGS=onepassword -t paularlott/quisora:1password .`
(about 15 MB larger). Any other build reads 1Password through a
Connect server you run and refuses a service account token with a message saying so. Vault and Connect can both run
on your own network.
