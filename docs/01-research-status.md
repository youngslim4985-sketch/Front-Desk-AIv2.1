# Research Status

## Current Status

Research/model-building phase: approximately 95–97% complete.

Overall investigation, including empirical validation: approximately 70–80% complete.

The theoretical/source-analysis phase has established the major mechanisms involved:

- PostgreSQL encoding conversion and SQLSTATE `22P05`
- `ucs_wcwidth()` and Unicode display-width calculation
- `pg_wcswidth()`
- `pg_wcssize()`
- `pg_wcsformat()`
- psql multiline alignment
- control-character expansion
- PL/pgSQL subtransactions
- `PGPROC_MAX_CACHED_SUBXIDS`
- subtransaction-cache overflow
- `pg_subtrans`
- SLRU behavior
- MultiXact metadata
- MultiXact SLRU caches
- `RUNNING_XACTS`
- hot-standby snapshot construction
- replica availability implications
- PostgreSQL wait events
- `pg_stat_slru`
- PostgreSQL 17 SLRU cache configuration

## Remaining Work

The remaining work is primarily empirical.

### Priority experiments

1. Generate more than 64 XID-bearing subtransactions inside one top-level transaction.
2. Measure `Subtrans` SLRU activity.
3. Measure WAL generation.
4. Measure backend wait events.
5. Introduce concurrent MultiXact pressure.
6. Measure `MultiXactMember` and `MultiXactOffset` activity.
7. Correlate `IO:SLRURead` and MultiXact-related LWLock waits.
8. Test existing hot-standby query latency.
9. Test standby startup/recovery while overflowed transaction state exists.
10. Run negative controls without subtransaction pressure.
11. Compare all measurements against baseline.
12. Determine whether the mechanisms interact under a realistic workload.

## Research Boundary

The investigation currently treats the following as independent mechanisms unless experimental evidence establishes a causal connection:

1. Display-width/alignment behavior.
2. Encoding conversion behavior.
3. Subtransaction/cache behavior.
4. MultiXact/SLRU behavior.
5. Hot-standby snapshot behavior.

The width functions do not themselves create subtransactions.

Any relationship between the width-processing path and subtransaction/replica behavior must therefore be demonstrated through a realistic workload rather than inferred from source proximity.

## Evidence Standard

A mechanism should not be classified as an application-level availability risk until:

- the behavior is reproducible;
- the relevant PostgreSQL instrumentation changes;
- the timing is measurable;
- a negative control isolates the suspected cause; and
- the causal chain is consistent with PostgreSQL source behavior.

## Current Conclusion

The source-level model is substantially complete.

The investigation now moves from:

> "What does PostgreSQL do?"

to:

> "Under what workload does this behavior become operationally significant?"
