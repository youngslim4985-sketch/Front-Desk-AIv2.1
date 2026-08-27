# PostgreSQL Transaction, SLRU, MultiXact & Hot-Standby Research

A controlled research and benchmarking repository for investigating PostgreSQL
subtransaction overflow, SLRU behavior, MultiXact pressure, MVCC visibility,
and hot-standby snapshot availability.

The repository separates:

1. Source-level PostgreSQL behavior
2. Diagnostic instrumentation
3. Controlled experiments
4. Benchmark results
5. Causal interpretation
6. Application-level implications

The primary research question is:

> Under what realistic workloads can excessive subtransactions, MultiXact
> activity, and SLRU pressure produce measurable performance degradation or
> delay read availability on PostgreSQL standbys?

---

## Research boundary

This project investigates several mechanisms that must not be conflated.

### Mechanism A — Width and formatting

PostgreSQL/psql display-width processing includes:

- `ucs_wcwidth`
- `pg_wcswidth`
- `pg_wcssize`
- `pg_wcsformat`
- multibyte character handling
- control-character expansion
- multiline cell formatting
- Unicode display-width calculation

These mechanisms concern textual representation and table alignment.

They do **not** inherently create PostgreSQL subtransactions.

### Mechanism B — Subtransactions

PL/pgSQL exception handling can create subtransactions.

A workload such as:

```text
FOR each row
    BEGIN
        process row
    EXCEPTION
        WHEN others THEN
            record error
    END
```

can generate many subtransactions inside one top-level transaction.

PostgreSQL maintains a limited per-backend cache of subtransaction IDs.

The commonly relevant implementation threshold is:

```text
PGPROC_MAX_CACHED_SUBXIDS = 64
```

Exceeding that threshold is a cache overflow condition, not a transaction failure.

### Mechanism C — pg_subtrans / SLRU

When subtransaction information cannot be represented entirely in the backend's cached subtransaction-ID array, PostgreSQL may need to resolve subtransaction ancestry through pg_subtrans.

This introduces additional SLRU activity.

The project measures:

- SLRU reads
- SLRU hits
- SLRU writes
- SLRU wait events
- query latency
- transaction duration
- concurrency effects

### Mechanism D — MultiXact

MultiXacts represent multiple transaction members associated with a tuple, particularly compatible row-lock combinations.

The relevant SLRU structures include:

- pg_multixact/offsets
- pg_multixact/members

PostgreSQL 17+ exposes configurable cache sizes for these structures.

The project measures:

- MultiXactMember
- MultiXactOffset
- blks_hit
- blks_read
- MultiXact-related wait events
- concurrent locking behavior

### Mechanism E — Hot standby

Subtransaction overflow can affect snapshot information used during recovery.

A newly recovering standby may need additional transaction-state information before it can safely accept read-only queries.

The project therefore distinguishes:

```text
WAL replay progress
        !=
hot-standby query availability
```

The research does not assume that replication lag automatically means hot-standby unavailability.

---

## Research questions

### RQ1 — Subtransaction overhead

What is the performance cost of repeatedly creating subtransactions inside one top-level transaction?

### RQ2 — Cache overflow

What changes once the backend exceeds its cached subtransaction-ID capacity?

### RQ3 — SLRU behavior

Does subtransaction overflow measurably increase pg_subtrans SLRU activity?

### RQ4 — Concurrent impact

Can one backend's subtransaction-heavy transaction measurably affect unrelated concurrent sessions?

### RQ5 — MultiXact behavior

How do concurrent row locks affect MultiXact SLRU cache utilization and wait events?

### RQ6 — PostgreSQL 17+ cache tuning

Can increasing:

- subtransaction_buffers
- multixact_member_buffers
- multixact_offset_buffers

reduce measured SLRU pressure?

### RQ7 — Standby availability

Under what conditions can subtransaction overflow delay hot-standby query availability?

### RQ8 — Combined workload

Does a realistic workload combining text processing, exception handling, row locking, and replication produce a measurable interaction between these mechanisms?

---

## Core causal model

The primary causal chain under investigation is:

```text
Repeated error handling
        |
        v
Many XID-bearing subtransactions
        |
        v
Subtransaction cache overflow
        |
        +--------------------+
        |                    |
        v                    v
pg_subtrans lookups       Overflowed
        |                 transaction state
        v                    |
SLRU activity               v
        |              Snapshot/recovery
        v                consequences
Concurrent visibility
work / contention
```

A separate MultiXact chain is:

```text
Concurrent compatible row locks
        |
        v
MultiXact creation
        |
        +-----------------------+
        |                       |
        v                       v
Offset metadata          Member metadata
        |                       |
        v                       v
MultiXactOffset          MultiXactMember
SLRU cache               SLRU cache
        |                       |
        +-----------+-----------+
                    |
                    v
             Cache pressure /
             synchronization
                    |
                    v
              Query latency
```

The project must not combine these chains without empirical evidence.

---

## Experimental philosophy

Every performance claim should be supported by a comparison.

At minimum, experiments should include:

1. Baseline
2. Treatment
3. Negative control
4. Representative concurrency
5. Repeat measurements
6. Recorded PostgreSQL version
7. Recorded configuration
8. Recorded hardware/runtime environment

Avoid drawing conclusions from a single benchmark run.

---

## Primary measurements

Experiments should capture as many of the following as practical:

### Transaction metrics

- transaction duration
- transaction count
- subtransaction count
- subtransaction overflow state
- commit/rollback behavior

### SLRU metrics

- blks_hit
- blks_read
- blks_written
- statistics reset time

### Wait metrics

- SubtransSLRU
- SubtransControlLock
- MultiXactMemberSLRU
- MultiXactOffsetSLRU
- MultiXactMemberBuffer
- MultiXactOffsetBuffer
- IO:SLRURead

Exact wait-event names may differ across PostgreSQL versions and should be verified against the server being tested.

### Replication metrics

- WAL position
- replay position
- replay lag
- recovery state
- hot-standby readiness
- connection availability
- snapshot state

### Query metrics

- execution time
- latency distribution
- throughput
- rows processed
- errors/rejections

---

## Safety boundary

All stress experiments must run only against:

- local PostgreSQL instances
- disposable containers
- dedicated test databases
- explicitly authorized infrastructure

Never run the stress harness against a production database unless the environment has been explicitly approved for load testing.

See SECURITY.md.

---

## Repository structure

```text
.
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
├── Makefile
├── docker-compose.yml
├── .gitignore
│
├── docs/
│   ├── ...
│
├── sql/
│   ├── diagnostics/
│   ├── experiments/
│   └── schema/
│
├── scripts/
├── config/
├── tests/
├── references/
├── benchmarks/
└── results/
```

The documentation directory contains the source verification, causal model, hypothesis matrix, experiment definitions, and final research report.

The SQL directory contains diagnostic queries, experiment workloads, and result schemas.

Scripts provide orchestration and repeatable benchmark execution.

---

## Status

Current project status:

```text
Source/model research:        ~95–97%
Experimental validation:      Pending
Controlled reproduction:      Pending
Replication reproduction:     Pending
Final conclusions:            Pending
```

The high theoretical confidence does not imply that the performance or availability hypotheses have been empirically demonstrated.

The remaining work is primarily measurement.

---

## Non-goals

This project does not attempt to:

- modify PostgreSQL internals
- establish universal performance numbers
- claim that every EXCEPTION block causes serious degradation
- claim that every subtransaction overflow causes replica outage
- treat SLRU cache misses as automatically pathological
- treat replication lag as equivalent to standby unavailability
- combine unrelated PostgreSQL mechanisms without evidence

---

## Reproducibility

Record the following for every experiment:

- PostgreSQL version
- Operating system
- CPU
- RAM
- Storage type
- shared_buffers
- work_mem
- maintenance_work_mem
- max_connections
- subtransaction_buffers
- multixact_member_buffers
- multixact_offset_buffers
- synchronous_commit
- fsync
- wal_level
- max_wal_senders
- hot_standby
- experiment duration
- concurrency
- dataset size

Where possible, store raw measurements in the repository's results structure rather than reporting only derived averages.

---

## License

This project is released under the MIT License.

See LICENSE.
