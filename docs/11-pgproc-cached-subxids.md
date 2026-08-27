# PGPROC Shared Memory & PGPROC_MAX_CACHED_SUBXIDS

## Overview

In PostgreSQL, active backend state is maintained in shared memory structures defined in `src/include/storage/proc.h`.

Each backend has an associated `PGPROC` structure that tracks running transaction IDs and a fixed-size cache for subtransaction IDs.

---

## 1. The PGPROC SubXID Cache Definition

From `src/include/storage/proc.h`:

```c
#define PGPROC_MAX_CACHED_SUBXIDS 64

struct PGPROC
{
    /* ... */
    TransactionId xid;              /* Top-level XID, or InvalidTransactionId */
    TransactionId xmin;             /* Oldest running transaction */

    /*
     * Subtransaction details. A backend can cache up to
     * PGPROC_MAX_CACHED_SUBXIDS subxids in shared memory.
     */
    PGXACT      *pgxact;            /* Pointer to primary process array */
    
    struct
    {
        int         count;          /* Number of valid entries in subxids[] */
        bool        overflowed;     /* True if backend has > 64 subxids */
        TransactionId subxids[PGPROC_MAX_CACHED_SUBXIDS];
    } subxids;
};
```

---

## 2. In-Memory SubXID Caching Mechanism

```text
Backend Process Shared Memory State (PGPROC)
+-------------------------------------------------------+
| Top-Level XID: 20450                                  |
| subxids.overflowed: FALSE                             |
| subxids.count: 3                                      |
| subxids.subxids[]: [20451, 20452, 20453, 0, 0, ... ]  |
+-------------------------------------------------------+
```

When another backend takes an MVCC snapshot (`GetSnapshotData` in `src/backend/storage/ipc/procarray.c`), it inspects all active backends:
1. It copies active top-level XIDs into `snapshot->xip[]`.
2. If `subxids.overflowed == false`, it copies all `subxids.subxids[]` directly into `snapshot->subxip[]`.
3. Because all subXIDs are copied directly from the `PGPROC` array into the snapshot, checking tuple visibility requires only a binary search in memory. No disk or SLRU lookups are performed.

---

## 3. Cache Overflow Condition

When a transaction creates its 65th XID-bearing subtransaction:

```c
/*
 * SubTransSetParent() or PushTransaction() in backend
 */
if (MyProc->subxids.count < PGPROC_MAX_CACHED_SUBXIDS)
{
    MyProc->subxids.subxids[MyProc->subxids.count++] = subxid;
}
else
{
    MyProc->subxids.overflowed = true;
    /* Subxid cannot be cached in shared memory array */
}
```

```text
Backend Process Shared Memory State (PGPROC) — OVERFLOWED
+-------------------------------------------------------+
| Top-Level XID: 20450                                  |
| subxids.overflowed: TRUE  <--- OVERFLOW FLAG SET      |
| subxids.count: 64                                     |
| (65th+ subXIDs can NOT fit into PGPROC array)         |
+-------------------------------------------------------+
```

---

## 4. Consequences of Subxid Overflow

When `subxids.overflowed == true`:
1. `GetSnapshotData()` cannot capture the complete set of subtransactions in `snapshot->subxip[]`.
2. `snapshot->suboverflowed` is set to `true`.
3. When any reader backend evaluates the visibility of a tuple modified by an uncommitted or committed subtransaction, it cannot determine the top-level parent XID from memory alone.
4. The reader backend is forced to execute `SubTransGetTopmostTransaction()` to traverse the on-disk/SLRU hierarchy in `pg_subtrans`.
