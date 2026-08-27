# PostgreSQL SLRU (Simple Least Recently Used) Architecture

## Overview

The SLRU (Simple LRU) subsystem (`src/backend/access/transam/slru.c`) is a lightweight paging mechanism used by PostgreSQL to manage append-mostly transaction metadata that cannot fit entirely in general shared memory buffers.

---

## 1. Active SLRU Subsystems in PostgreSQL

PostgreSQL manages several distinct SLRU caches:

| SLRU Name | Directory in `$PGDATA` | Purpose | Typical Buffer Count (PG 16) | Buffer GUC (PG 17+) |
|---|---|---|---|---|
| `CLOG` / `Xact` | `pg_xact/` | Transaction commit/abort status | 128 | `transaction_buffers` (internal) |
| `Subtrans` | `pg_subtrans/` | Subtransaction to parent XID mapping | 32 | `subtransaction_buffers` |
| `MultiXactMember` | `pg_multixact/members/` | Member transaction IDs per MultiXact | 16 | `multixact_member_buffers` |
| `MultiXactOffset` | `pg_multixact/offsets/` | Offsets into member SLRU per MultiXact | 8 | `multixact_offset_buffers` |
| `Async` | `pg_notify/` | `LISTEN` / `NOTIFY` message queue | 8 | `notify_buffers` |
| `Predicate` | `pg_serial/` | Serializable isolation tracking (SSI) | 64 | `predicate_lock_buffers` |

---

## 2. SLRU Page Structure & Buffer Slots

Each SLRU instance maintains a fixed ring of buffer slots in shared memory (`SlruSharedData`):

```text
+---------------------------------------------------------------+
|                      SLRU Shared Memory Pool                   |
+---------------+---------------+---------------+---------------+
| Slot 0 (8 KB) | Slot 1 (8 KB) | Slot 2 (8 KB) | Slot 3 (8 KB) |
| Page # 104    | Page # 105    | Page # 106    | Page # 107    |
| Dirty: false  | Dirty: true   | Dirty: false  | Dirty: false  |
+---------------+---------------+---------------+---------------+
| Slot 4 (8 KB) | Slot 5 (8 KB) | ...           | Slot N (8 KB) |
+---------------------------------------------------------------+
```

### Buffer Access Algorithm (`SimpleLruReadPage`):
1. Lock SLRU control lock (`LWLockAcquire(SlruCtl->ControlLock, LW_SHARED)`).
2. Check if requested `pageno` is already present in a buffer slot.
   - **HIT**: Mark slot as recently used, increment `pg_stat_slru.blks_hit`, return buffer pointer.
3. If not present (**MISS**):
   - Upgrade lock to `LW_EXCLUSIVE`.
   - Find candidate victim slot using LRU clock-sweep.
   - If victim slot is dirty: write page to disk (`SimpleLruWritePage`, increment `blks_written`).
   - Read requested page from disk into slot (`read()`, increment `blks_read`).
   - Return buffer pointer.

---

## 3. The Pathological Eviction Cycle (Thrashing)

When multiple concurrent sessions query rows created by overflowed subtransactions:

```text
Session 1 queries row from SubXID 200,000 (Page 97)
  -> Loads Page 97 into Slot 0

Session 2 queries row from SubXID 800,000 (Page 390)
  -> Evicts Slot 0, loads Page 390 into Slot 0

Session 3 queries row from SubXID 200,000 (Page 97)
  -> Evicts Slot 0, reads Page 97 from disk again! (IO:SLRURead)
```

With only 32 buffers in `pg_subtrans`, rapid context switching across a wide range of subtransactions triggers an I/O storm and lock convoy on `SubtransControlLock`.

---

## 4. PostgreSQL 17 Tuning Improvements

PostgreSQL 17 introduced explicit GUCs to resize SLRU buffer pools without recompiling PostgreSQL:

```ini
# postgresql.conf (PostgreSQL 17+)
subtransaction_buffers = 1024      # 8 MB (default is 32 / 256 KB)
multixact_member_buffers = 512     # 4 MB (default is 16 / 128 KB)
multixact_offset_buffers = 256     # 2 MB (default is 8 / 64 KB)
```

Resizing buffers reduces disk read I/O misses, though CPU-level latch synchronization under extreme concurrency remains.
