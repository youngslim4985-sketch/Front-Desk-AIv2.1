# Hot Standby Recovery, Snapshot Construction & Read Availability

## Overview

A PostgreSQL replica operating in Hot Standby mode allows read-only queries while continuously replaying Write-Ahead Log (WAL) streams from the primary.

This document examines the exact conditions required for a standby to accept client connections and construct valid MVCC snapshots.

---

## 1. Hot Standby State Machine (`standby.c`)

When a PostgreSQL replica starts recovery:

```text
       [ STARTUP ]
            |
            v
[ STANDBY_INITIAL_SNAPSHOT ] ----> Waiting for WAL replay to reach consistent point
            |
            v
[ STANDBY_SNAPSHOT_PENDING ] ----> Waiting for safe XLOG_RUNNING_XACTS record
            |
            +---> If record has subxid_overflow = true:
            |        STAY IN PENDING STATE
            |        (Connections rejected with FATAL error)
            |
            +---> If record has subxid_overflow = false:
                     TRANSITION TO READY STATE
            |
            v
[ STANDBY_SNAPSHOT_READY ]   ----> Standby accepts read connections & executes queries
```

---

## 2. Source Walkthrough: Snapshot Read Condition

In `src/backend/storage/ipc/standby.c`:

```c
/*
 * StandbyReleaseOldXids
 *
 * Check whether we can advance standby snapshot state
 */
void
StandbyReleaseOldXids(TransactionId oldestActiveXID)
{
    /* Check if snapshot is ready */
    if (!standbyState == STANDBY_SNAPSHOT_READY)
    {
        /*
         * If subxids overflowed on primary, we cannot build a complete
         * running transactions array until all overflowed transactions finish.
         */
        if (runningXacts->subxid_overflow)
        {
            elog(DEBUG2, "standby snapshot pending: primary subxids overflowed");
            return; /* Cannot mark snapshot ready */
        }

        standbyState = STANDBY_SNAPSHOT_READY;
        elog(LOG, "consistent recovery state reached - standby accepts read-only connections");
    }
}
```

---

## 3. Availability Failure Mode: Delayed Startup Read Readiness

### The Scenario:
1. Primary starts a long-running batch job (e.g. 2-hour data migration).
2. The batch uses per-row `EXCEPTION` handling, generating > 64 subtransactions and setting `overflowed = true`.
3. A standby node is restarted, or a new replica is provisioned from basebackup.
4. The replica replays WAL up to the current position in seconds.
5. The replica checks `XLOG_RUNNING_XACTS`: because the batch is still running on primary, `subxid_overflow` is `true`.
6. **Result**: The replica remains in `STANDBY_SNAPSHOT_PENDING` for 2 hours until the primary batch commits, completely blocking read-replica traffic.

---

## 4. Distinction Between Existing Standby vs. Recovering Standby

| Replica State | Behavior During Primary Subxid Overflow | Read Query Impact |
|---|---|---|
| **Already Running Standby (`STANDBY_SNAPSHOT_READY`)** | Continues serving reads; handles overflow lookups via local `pg_subtrans` cache. | Slight latency increase during visibility checks if SLRU thrashes. |
| **Newly Starting Standby (`STANDBY_SNAPSHOT_PENDING`)** | Cannot initialize first snapshot; rejects all incoming client connections. | **100% Read Outage** until primary overflowed transactions complete. |
