# RUNNING_XACTS WAL Records & Hot Standby Snapshot Construction

## Overview

In PostgreSQL streaming replication, a standby node in recovery relies on `XLOG_RUNNING_XACTS` records emitted periodically by the primary node to construct initial consistent snapshots and track running transactions.

This document details the struct definition, overflow bitfield, snapshot state transitions, and hot-standby readiness conditions.

---

## 1. The xl_running_xacts Structure (`standby.h` / `xloginsert.h`)

From `src/include/storage/standby.h`:

```c
typedef struct xl_running_xacts
{
    int             xcnt;           /* # of top-level XIDs */
    int             subxcnt;        /* # of subtransaction XIDs */
    bool            subxid_overflow;/* Has any backend overflowed subxids? */
    TransactionId   nextXid;        /* Next XID to be assigned */
    TransactionId   oldestRunningXid;/* Oldest XID still running */
    TransactionId   latestCompletedXid;/* Highest committed/aborted XID */

    TransactionId   xids[FLEXIBLE_ARRAY_MEMBER];
} xl_running_xacts;
```

---

## 2. Emission of RUNNING_XACTS Records

The primary's background checkpointer or WAL writer periodically logs `XLOG_RUNNING_XACTS` (at least every `checkpoint_timeout` or 15 seconds):

```c
/* LogStandbySnapshot() in src/backend/storage/ipc/standby.c */
xl_running_xacts *RunningXacts = GetRunningTransactionData();
```

During array collection:
1. All active top-level transaction IDs are added to `RunningXacts->xids[]`.
2. All non-overflowed subtransaction IDs are collected into `RunningXacts->xids[]`.
3. If **any active backend** has `subxids.overflowed == true`, `RunningXacts->subxid_overflow` is set to `true`.
4. When `subxid_overflow == true`, subtransaction IDs from overflowed backends cannot be listed in the record.

---

## 3. Standby Snapshot Reconstruction

On the standby during startup or replication replay (`src/backend/storage/ipc/standby.c`):

```text
Standby Starts Recovery
        |
        v
Replays WAL Records until first XLOG_RUNNING_XACTS
        |
        v
Check: Is RunningXacts->subxid_overflow == TRUE?
   |
   +---> NO (false):
   |        Standby knows all running XIDs & subXIDs exactly.
   |        Transitions immediately to STANDBY_SNAPSHOT_READY.
   |        Standby can immediately accept READ-ONLY queries!
   |
   +---> YES (true):
            Standby cannot identify which subtransactions belong to which transactions.
            Standby CANNOT create a valid initial snapshot.
            Standby must wait until:
              1. All overflowed top-level transactions commit/abort, OR
              2. A subsequent XLOG_RUNNING_XACTS arrives with subxid_overflow == false.
```

---

## 4. Operational Implications for Standby Availability

```text
Timeline on Standby Replica:
+-----------------------------------------------------------------------------------+
| 00:00 - Standby starts replay                                                     |
| 00:05 - Replays XLOG_RUNNING_XACTS: subxid_overflow = TRUE (Long-running batch)    |
|         -> Standby stays in STANDBY_SNAPSHOT_PENDING                               |
|         -> Client read queries fail with:                                         |
|            "FATAL: the database system is not yet accepting connections"          |
| 00:30 - Long-running batch on primary completes & commits                         |
| 00:31 - Next XLOG_RUNNING_XACTS logged: subxid_overflow = FALSE                   |
| 00:32 - Standby reaches STANDBY_SNAPSHOT_READY -> Accepts read traffic!           |
+-----------------------------------------------------------------------------------+
```

### Distinction: Replication Lag vs. Snapshot Availability
- **Replication Lag (WAL Replay)**: The standby may be replaying WAL with near-zero millisecond lag.
- **Snapshot Availability**: Because of `subxid_overflow == true`, the standby cannot construct a safe MVCC snapshot, delaying read connectivity until the primary's overflowed transactions terminate.
