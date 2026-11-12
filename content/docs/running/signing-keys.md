---
title: "Signing keys"
weight: 30
---

Tokens are signed with ES256 by default (`tokens.signing_alg`; `EdDSA` is a little faster where every relying party
supports it). A new key is made every `tokens.key_rotation_days` (30 by default; 0 rotates by hand only) by the
housekeeping leader (in a cluster, one node at a time: `leader` in `GET /api/cluster`). It is published in the JWKS at once and signs 15 minutes later, so relying parties already know
it; the previous key stays published until the tokens it signed have expired, then it is removed.

Super admins see the keys on the **System overview**: each key's state (signing, next, previous) and when it
starts signing, stops and is removed. **Rotate now** makes a key that signs at once; tokens signed before keep working
until they expire. When a key may have been exposed, rotate, then **Remove** on the old key: the tokens it signed
stop verifying here at once, and in applications once they fetch the key set again (applications get new tokens
through their refresh tokens; nobody is signed out). The key that signs now cannot be removed. The same is
`GET /api/keys`, `POST /api/keys/rotate` and `DELETE /api/keys/{id}`.
