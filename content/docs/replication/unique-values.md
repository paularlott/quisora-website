---
title: "Unique values"
weight: 70
---

A unique value is checked by the owner, against its committed data, in the partition of the record. Every unique value
is scoped to one organization: it starts with the organization's id, or is an id of one organization's record (users,
groups, tenant names, providers, identities, link tokens), and so it lives in the one partition that holds the
organization's records. Two organizations may therefore hold the same value. A tenant's **resource indicator**
(`<organization id>/res/<canonical uri>`) is unique within its organization only: the same API or MCP server address
may be registered by tenants of two organizations (a token's `iss` says whose it is). A passkey's credential id is
unique per user (`<user id>/<credential id>`). Nothing is unique across organizations, so no unique value is looked
up without an organization, and no write ever needs the partitions of two organizations: an organization is one
partition's data, with one owner that commits its writes, much like a replicated MariaDB primary per organization
whose data the other nodes replicate. A transaction that would write in more than one partition is refused
(`store.ErrBadTx`), and a write that would change a stored record's partition is refused (`store.ErrBadRecord`: a
record never moves).

A transaction may also **assert** a record of its partition (`store.Op.Assert`): the record must be live at the
version the writer read, or the transaction is refused (`store.ErrStale`) and writes nothing; the record itself is not
written. The partition's owner prepares the partition's changes one at a time, each against what the ones before it
committed, so it checks the assertion in the partition's order: a write of the asserted record is either before the
transaction (which it then refuses) or after it, never between the version read and the commit. Transactions that
only assert one record do not conflict with each other over it (a single database checks the assertion inside its
transaction: Badger detects a conflict on what the transaction read, a SQL server database share-locks the row (which a multi-primary cluster such as Galera does not enforce between
its writers: [Shared database](/docs/running/clustering/#shared-database)),
SQLite has one writer). An assertion names a record that exists (version 0 is refused): a SQL server database has no
row to lock for one that does not. Its outcome is its transaction's writes': a retried transaction whose writes are
found stored is answered as done, and a resubmission after a lost reply checks its assertions again as they then
stand.

A unique value of any length is accepted: a value longer than 512 characters (or one that looks like a hash) is
indexed by its SHA-256 (`store.UniqueIndexKey`), the same on every backend, and the record keeps the value itself.
