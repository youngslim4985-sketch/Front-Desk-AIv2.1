# Research Boundary

## Purpose

Define what this investigation is and is not attempting to establish.

## Included

The investigation covers:

- PostgreSQL string encoding/conversion behavior
- SQLSTATE `22P05`
- Unicode display-width calculations
- psql output formatting
- multiline cell alignment
- PL/pgSQL exception handling
- subtransaction creation
- subtransaction-cache overflow
- `PGPROC_MAX_CACHED_SUBXIDS`
- `pg_subtrans`
- SLRU caches
- MultiXact metadata
- MultiXact SLRU contention
- `RUNNING_XACTS`
- hot-standby snapshot construction
- replica read availability
- relevant PostgreSQL monitoring instrumentation

## Explicit Separation

The display-width path and transaction-management path are separate mechanisms.

### Display-width path

```text
input string
    |
    v
encoding / character decoding
    |
    v
ucs_wcwidth()
    |
    v
pg_wcswidth()
pg_wcssize()
pg_wcsformat()
    |
    v
psql table formatting
```

### Transaction path

```text
PL/pgSQL exception handling
    |
    v
subtransactions
    |
    v
subtransaction cache
    |
    v
overflow
    |
    v
pg_subtrans / SLRU
    |
    v
MVCC visibility / snapshot processing
    |
    v
possible standby implications
```

## What Has Not Been Established

The investigation does not currently establish that:

- Unicode width calculation creates subtransactions;
- psql formatting directly causes MultiXacts;
- pg_wcs*() functions directly cause replica outages;
- every subtransaction overflow produces measurable production degradation;
- every overflowed transaction prevents an existing replica from serving reads;
- increasing SLRU cache sizes removes overflow;
- a theoretical interaction is automatically an exploitable vulnerability.

## Required Standard

Any proposed connection between independent mechanisms requires a reproducible workload demonstrating the connection.
