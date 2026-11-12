---
title: "What keeps working, without an operator"
weight: 100
---

With 3 nodes (with 5, read "up to two"):

| Situation | What happens |
| --- | --- |
| One node down | The other two are a majority: they take over its partitions and keep writing and serving. Until they have (about 7 s) its partitions' writes wait or answer 503 (their reads too, past the owner timeout); the writes waiting are capped per partition, so the other organizations are unaffected. |
| It returns with its data | It catches up by sequence and rejoins on its own. |
| It returns with its data lost (a new disk) | It copies from the other two and rejoins on its own. |
| It was away longer than tombstones are kept | It copies the partitions it cannot catch up by sequence, on its own. |
| Every node restarts | They promise and catch up among themselves: no `force-start`. |
| Two nodes impaired at once (one down, another lost its data) | The survivor cannot know whether it misses committed writes: an operator accepts that with `quisora force-start`. |
| Losing the data of two nodes at once | What only they held is gone; restore from a backup. |
