# pg_subtrans SLRU Storage & SubTransGetTopmostTransaction

## Overview

`pg_subtrans` is an SLRU (Simple Least Recently Used) storage subsystem located in `$PGDATA/pg_subtrans`.

Its purpose is to record a mapping from every subtransaction ID to its parent transaction ID, allowing PostgreSQL to resolve transaction ancestry during visibility checks.

---

## 1. Storage Layout & Mapping

Each subtransaction ID maps to a 4-byte `TransactionId` representing its immediate parent.

- **Page Size**: Standard PostgreSQL page (8,192 bytes / 8 KB).
- **Entries per Page**: $8192 \text{ bytes} / 4 \text{ bytes per entry} = 2,048 \text{ entries per page}$.
- **Page Calculation**: $\text{pageno} = \text{xid} / 2048$.
- **Offset Calculation**: $\text{entry} = \text{xid} \pmod{2048}$.

```text
XID (Subtransaction ID)
        |
        v
[ Page Number = XID / 2048 ] ---> SimpleLruReadPage(SubTransCtl, pageno)
        |
        v
[ Entry Offset = (XID % 2048) * 4 ] ---> Read 32-bit Parent TransactionId
```

---

## 2. Parent Resolution Algorithm (`subtrans.c`)

From `src/backend/access/transam/subtrans.c`:

```c
/*
 * SubTransGetTopmostTransaction
 *
 * Find topmost parent XID for a given subtransaction XID.
 */
TransactionId
SubTransGetTopmostTransaction(TransactionId xid)
{
    TransactionId parentXid = xid;
    TransactionId previousXid = xid;

    while (TransactionIdIsValid(parentXid))
    {
        previousXid = parentXid;
        if (TransactionIdEquals(parentXid, MyProc->xid))
            break;

        /* Look up parent in pg_subtrans SLRU */
        parentXid = SubTransGetParent(parentXid);
    }

    Assert(TransactionIdIsValid(previousXid));
    return previousXid;
}
```

```c
/*
 * SubTransGetParent
 */
TransactionId
SubTransGetParent(TransactionId xid)
{
    int         pageno = TransactionIdToPage(xid);
    int         entryno = TransactionIdToEntry(xid);
    int         slotno;
    TransactionId *ptr;
    TransactionId parent;

    /* Acquire shared lock on SLRU buffer pool */
    LWLockAcquire(SubtransControlLock, LW_SHARED);

    slotno = SimpleLruReadPage_ReadOnly(SubTransCtl, pageno, xid);
    ptr = (TransactionId *) SubTransCtl->shared->page_buffer[slotno];
    ptr += entryno;
    parent = *ptr;

    LWLockRelease(SubtransControlLock);

    return parent;
}
```

---

## 3. The SLRU Bottleneck (PG 14–16 vs PG 17+)

### PostgreSQL 14–16 Bottleneck:
- Fixed at **32 SLRU buffers** (256 KB total memory) for `SubTransCtl`.
- Protected by a single shared lock (`SubtransControlLock` or individual SLRU partition locks).
- Under high concurrency with overflowed subtransactions, dozens of backends simultaneously read `pg_subtrans` pages to verify tuple visibility.
- 32 pages are evicted repeatedly (buffer thrashing), forcing synchronous physical disk reads (`IO:SLRURead`) and causing severe lock convoys on `SubtransSLRULock`.

### PostgreSQL 17+ Modern Configuration:
- Introduced the `subtransaction_buffers` GUC parameter.
- Allows tuning `pg_subtrans` buffer pool from default (32) up to **8,192 buffers (64 MB)**.
- Prevents disk I/O thrashing, though lock contention during rapid concurrent tree traversals can still occur.

---

## 4. Monitoring SLRU Performance

Querying `pg_stat_slru` reveals subtransaction SLRU health:

```sql
SELECT 
    name,
    blks_hit,
    blks_read,
    blks_written,
    blks_exists,
    ROUND(blks_hit * 100.0 / NULLIF(blks_hit + blks_read, 0), 2) AS hit_ratio
FROM pg_stat_slru
WHERE name = 'Subtrans';
```

A dropping `hit_ratio` (< 98%) or surging `blks_read` indicates active SLRU cache misses caused by subtransaction overflows.
