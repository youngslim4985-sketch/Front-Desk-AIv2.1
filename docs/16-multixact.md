# MultiXact Mechanics, Row Locking & SLRU Storage

## Overview

In PostgreSQL, multiple transactions can simultaneously hold compatible row-level locks on the same tuple (e.g., multiple transactions executing `SELECT ... FOR SHARE` or `FOR KEY SHARE`).

Because a tuple header's `t_xmax` field can store only a single 32-bit identifier, PostgreSQL creates a synthetic identifier called a **MultiXactId** (MultiXact) to represent the group of locking transactions.

---

## 1. MultiXact Data Structures (`multixact.c`)

MultiXacts are tracked using two distinct SLRU subsystems:

1. **`pg_multixact/offsets` (`MultiXactOffset`)**:
   - Maps each `MultiXactId` to an offset index inside the members file.
   - Entry size: 4 bytes (`MultiXactOffset`).
   - Page capacity: $8192 / 4 = 2,048 \text{ offsets per page}$.

2. **`pg_multixact/members` (`MultiXactMember`)**:
   - Stores the individual `TransactionId`s and lock mode flags (`MultiXactMemberStatus`) comprising the MultiXact.
   - Entry size: 8 bytes (`TransactionId` + 4-byte flag / padding).
   - Page capacity: $8192 / 8 = 1,024 \text{ members per page}$.

```text
Tuple Header (t_xmax = MultiXactId 45000, HEAP_XMAX_IS_MULTI set)
        |
        v
pg_multixact/offsets [MultiXactId 45000]
        |
        +---> Member Array Offset: 120,400
                    |
                    v
pg_multixact/members [Offset 120,400 .. 120,402]
        +---> Transaction 1001 (FOR SHARE)
        +---> Transaction 1002 (FOR SHARE)
        +---> Transaction 1003 (FOR KEY SHARE)
```

---

## 2. MultiXact Creation Lifecycle

When a new transaction acquires a compatible lock on a tuple already locked by another active transaction:

```c
/*
 * MultiXactIdCreate in src/backend/access/transam/multixact.c
 */
MultiXactId
MultiXactIdCreate(TransactionId xid1, MultiXactStatus status1,
                  TransactionId xid2, MultiXactStatus status2)
{
    /* 1. Allocate new MultiXactId from counter */
    /* 2. Write starting member offset into MultiXactOffset SLRU */
    /* 3. Write members (xid1, xid2) into MultiXactMember SLRU */
    /* 4. Update tuple header t_xmax = new_multi */
}
```

---

## 3. High-Concurrency MultiXact Pressure

When thousands of transactions concurrently acquire `FOR SHARE` locks on hot rows (or foreign key validation locks):
- Millions of MultiXacts are created rapidly.
- `MultiXactOffset` and `MultiXactMember` SLRU pages advance rapidly.
- Small default buffer pools (16 buffers for members, 8 buffers for offsets in PostgreSQL <= 16) suffer constant cache thrashing.
- Every reader inspecting row visibility or lock status must read `pg_multixact` pages from disk.

---

## 4. MultiXact vs. Subtransaction Comparison

| Feature | Subtransactions (`pg_subtrans`) | MultiXacts (`pg_multixact`) |
|---|---|---|
| **Trigger** | Savepoints, PL/pgSQL `EXCEPTION` | Concurrent shared row locks (`FOR SHARE`, FK checks) |
| **SLRU Count** | 1 SLRU (`Subtrans`) | 2 SLRUs (`MultiXactOffset`, `MultiXactMember`) |
| **In-Memory Cache** | 64 entries in `PGPROC` | Small backend local cache (`mxact.c`) |
| **Standby Impact** | Sets `subxid_overflow` flag, delays snapshots | Replayed via WAL, visible in recovery |
| **Wrap-around Risk** | Cleaned up on commit/abort | Requires emergency autovacuum freeze (`vacuum_multixact_freeze_min_age`) |
