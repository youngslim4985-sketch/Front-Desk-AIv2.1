# Experimental Hypotheses & Test Protocols

## Overview

This document specifies the exact experimental protocols, controls, independent/dependent variables, and measurement criteria for evaluating PostgreSQL subtransaction overflow, SLRU cache contention, MultiXact locking, and replica readiness.

---

## Experiment 1: Subtransaction Overflow Threshold (PGPROC Cache)

- **Hypothesis**: Creating $\le 64$ XID-bearing subtransactions keeps `PGPROC->subxids.overflowed = false`. The 65th subtransaction sets `overflowed = true` and triggers `pg_subtrans` disk/SLRU lookups for concurrent snapshot readers.
- **Independent Variable**: Number of nested `EXCEPTION` blocks with writes ($1, 32, 64, 65, 128, 1000$).
- **Dependent Variables**: `PGPROC` overflow flag (via GDB / probe), `pg_stat_slru.blks_read` on `Subtrans`, execution time of concurrent reader transactions.
- **Negative Control**: Top-level transaction executing equivalent writes with no subtransactions ($0$ `EXCEPTION` blocks).

---

## Experiment 2: SLRU Thrashing Under High Concurrency

- **Hypothesis**: Concurrent reader transactions evaluating rows written by overflowed subtransactions will cause cache eviction and thrashing in `pg_subtrans`, visible as low `hit_ratio` and high `IO:SLRURead` / `SubtransSLRU` wait events.
- **Independent Variable**: Concurrency level ($1, 10, 50, 100$ clients) and `subtransaction_buffers` size ($32$ vs $1024$).
- **Dependent Variables**: Query latency (P50, P95, P99), `pg_stat_slru.blks_read`, wait event distribution.
- **Control**: Same concurrency querying rows committed by standard top-level transactions.

---

## Experiment 3: MultiXact SLRU Cache Contention

- **Hypothesis**: High-concurrency `SELECT ... FOR SHARE` on a small set of rows generates millions of MultiXacts, overwhelming `MultiXactMember` and `MultiXactOffset` SLRU caches and causing `MultiXactMemberSLRU` wait locks.
- **Independent Variable**: Number of concurrent lock holders ($10, 50, 100$) and `multixact_member_buffers` ($16$ vs $512$).
- **Dependent Variables**: MultiXact allocation rate, `pg_stat_slru` hit ratio, lock acquisition latency.
- **Control**: `SELECT ... FOR SHARE` on disjoint rows (no shared MultiXact creation).

---

## Experiment 4: Standby Startup Snapshot Readiness

- **Hypothesis**: Starting a replica while the primary holds an active, overflowed subtransaction transaction ($> 64$ subXIDs) keeps the standby in `STANDBY_SNAPSHOT_PENDING`, rejecting read queries until the transaction terminates.
- **Independent Variable**: Primary transaction state (normal vs. overflowed subtransaction).
- **Dependent Variables**: Time to `STANDBY_SNAPSHOT_READY`, connection acceptance (`pg_isready`), replica recovery log messages.
- **Control**: Standby started while primary runs a long transaction without subtransaction overflow.

---

## Experiment 5: String Width / Formatting Independence

- **Hypothesis**: Querying and formatting wide Unicode strings, emojis, multiline cells, and untranslatable characters (`22P05`) in `psql` produces zero subtransactions and zero SLRU activity on the PostgreSQL server.
- **Independent Variable**: Text complexity in result set (ASCII vs UTF-8 ideographs vs multiline vs ZWJ sequences).
- **Dependent Variables**: Server-side XID generation count, `pg_stat_slru` deltas.
- **Expected Outcome**: Subtransaction count = 0, SLRU delta = 0 across all display test cases.
