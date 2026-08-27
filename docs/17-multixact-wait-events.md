# MultiXact & SLRU Wait Events in PostgreSQL

## Overview

When SLRU caches experience contention or disk I/O bottlenecks, backend processes report distinct wait events in `pg_stat_activity` and `pg_wait_events`.

This document inventories the wait events associated with subtransactions and MultiXact operations.

---

## 1. SLRU Wait Event Taxonomy

SLRU wait events fall into two primary wait types:
1. **`LWLock` (Lightweight Lock)**: Contentions on shared memory buffer descriptors, buffer mapping, or SLRU control structures.
2. **`IO`**: Time spent waiting on synchronous kernel filesystem reads or writes (`read()`, `write()`, `fsync()`).

---

## 2. Inventory of Wait Events

| Wait Event Name | Wait Type | SLRU Component | Description / Trigger Condition |
|---|---|---|---|
| `SubtransSLRU` | `LWLock` | `pg_subtrans` | Backend waiting to access the `pg_subtrans` SLRU shared buffer pool. |
| `SubtransControlLock` | `LWLock` | `pg_subtrans` | Backend waiting to acquire exclusive or shared lock to manipulate subtrans pages. |
| `MultiXactMemberSLRU` | `LWLock` | `pg_multixact/members` | Contention on shared memory buffers holding MultiXact member arrays. |
| `MultiXactOffsetSLRU` | `LWLock` | `pg_multixact/offsets` | Contention on shared memory buffers holding MultiXact offset pointers. |
| `MultiXactMemberBuffer` | `LWLock` | `pg_multixact/members` | Backend waiting for an individual buffer slot in the member SLRU pool. |
| `MultiXactOffsetBuffer` | `LWLock` | `pg_multixact/offsets` | Backend waiting for an individual buffer slot in the offset SLRU pool. |
| `SLRURead` / `IO:SLRURead` | `IO` | All SLRUs | Synchronous physical disk read waiting for an SLRU page to be loaded from disk. |
| `SLRUWrite` / `IO:SLRUWrite` | `IO` | All SLRUs | Synchronous physical disk write flushing dirty SLRU page to disk. |
| `SLRUFlush` / `IO:SLRUFlush` | `IO` | All SLRUs | Waiting for SLRU checkpoint or truncation sync to complete. |

---

## 3. Diagnostic Query: Monitoring Live SLRU Wait Events

```sql
SELECT 
    pid,
    usename,
    client_addr,
    wait_event_type,
    wait_event,
    state,
    query_start,
    now() - query_start AS query_duration,
    query
FROM pg_stat_activity
WHERE wait_event_type IN ('LWLock', 'IO')
  AND (wait_event LIKE '%SLRU%' OR wait_event LIKE '%Subtrans%' OR wait_event LIKE '%MultiXact%')
ORDER BY query_duration DESC;
```

---

## 4. Interpretation Guide

- **High `IO:SLRURead`**: Indicates buffer pool size is too small for the active working set; pages are constantly being evicted and re-read from disk.
- **High `SubtransSLRU` / `SubtransControlLock`**: Indicates multiple backends are simultaneously traversing subtransaction ancestry hierarchies.
- **High `MultiXactMemberSLRU`**: Indicates extreme contention on shared row locks (e.g. hundreds of concurrent transactions locking the same primary or foreign key parent rows).
