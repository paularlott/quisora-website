---
title: "The model in one paragraph"
weight: 10
---

The data is split into **64 partitions**, a constant of the format. Every record has a **partition key**: the
organization's id for everything an organization owns, a record's own id for the independent single-record kinds
(locks, replay values), and nothing (partition 0, the global data) for organizations, signing keys and
the like. The key is hashed to a partition (`partition.PartitionOf`: partition 0 for no key, else 1 to 63). Every
partition has one **owner** node at a time, chosen by the library from the nodes that are ready (rendezvous hashing,
with the next ranks as fallbacks). **Every change to a record goes to the owner of its partition**, which checks it
against its committed data, gives it the partition's next sequence number, sends it to every node, and **commits** it
(applies it, answers, makes it visible) once a **majority of the configured cluster** has stored it durably. Every
node keeps a copy of every partition and reads from it. When an owner is lost, another node asks a majority to
promise it the partition (an *epoch*), which fences the old owner and tells the new one about every write that may
have been committed; a write whose outcome nobody knows is settled one way or the other, exactly once.

Because there is exactly one writer per partition at a time, and a write is visible only once a majority has it, there
are no conflicting writes to merge: nothing here depends on clocks for ordering, and nothing is resolved after the
fact.
