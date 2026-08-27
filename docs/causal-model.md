# Comprehensive Causal Model: Subtransactions, SLRUs, MultiXacts & Standbys

## Overview

This document presents the unified causal graph connecting PostgreSQL client formatting, SQLSTATE error generation, PL/pgSQL subtransactions, shared memory buffer mechanics, SLRU storage, and streaming replication snapshot availability.

---

## 1. Unified Architectural Causal Graph

```text
+-------------------------------------------------------------------------------+
| LAYER 1: CLIENT STRING & FORMATTING SUBSYSTEM (psql / libpq)                  |
|                                                                               |
|   Unicode Text Input                                                          |
|         |                                                                     |
|         v                                                                     |
|   ucs_wcwidth() / pg_wcswidth()                                               |
|         |                                                                     |
|         v                                                                     |
|   pg_wcssize() / pg_wcsformat()                                               |
|         |                                                                     |
|         v                                                                     |
|   psql Multiline Table Grid Rendering (Client-Side Display Only)               |
|                                                                               |
|   [ NO SERVER XIDS ] [ NO SUBTRANSACTIONS ] [ NO SLRU ACCESS ]                |
+-------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------+
| LAYER 2: APPLICATION & PL/pgSQL EXCEPTION HANDLING                            |
|                                                                               |
|   Data Ingestion / Processing Loop                                            |
|         |                                                                     |
|         +---> Encoding Conversion Failure (SQLSTATE 22P05 / 22021)            |
|         |                                                                     |
|         v                                                                     |
|   PL/pgSQL Block with EXCEPTION Clause                                        |
|         |                                                                     |
|         v                                                                     |
|   BeginInternalSubTransaction()                                               |
|         |                                                                     |
|         +---> Write / DML Statement in Handler -> Allocates Real SubXID       |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| LAYER 3: SHARED MEMORY & PGPROC SUBXID CACHE                                  |
|                                                                               |
|   SubXID count <= 64 ?                                                        |
|         |                                                                     |
|         +--- YES ---> Cached in PGPROC->subxids[] (Fast In-Memory Snapshot)   |
|         |                                                                     |
|         +--- NO (count > 64)                                                  |
|                   |                                                           |
|                   v                                                           |
|             PGPROC->subxids.overflowed = TRUE                                 |
+-------------------------------------------------------------------------------+
                   |                                           |
                   | (Concurrent MVCC Readers)                 | (WAL Emission)
                   v                                           v
+------------------------------------+    +------------------------------------+
| LAYER 4: STORAGE & SLRU CACHE      |    | LAYER 5: REPLICATION & HOT STANDBY |
|                                    |    |                                    |
|   GetSnapshotData():               |    |   LogStandbySnapshot():            |
|   snapshot->suboverflowed = TRUE   |    |   xl_running_xacts with:           |
|         |                          |    |   subxid_overflow = TRUE           |
|         v                          |    |         |                          |
|   SubTransGetTopmostTransaction()  |    |         v                          |
|         |                          |    |   Standby Replays WAL              |
|         v                          |    |         |                          |
|   pg_subtrans SLRU Traversal       |    |         v                          |
|         |                          |    |   Snapshot Construction Check:     |
|   (32 Buffer Pool Thrashing)       |    |   subxid_overflow == TRUE?         |
|         |                          |    |         |                          |
|         +---> Cache Misses (blks_read)  |         +---> Standby Stays in:    |
|         +---> IO:SLRURead Waits    |    |               STANDBY_SNAPSHOT_    |
|         +---> SubtransSLRU LWLocks |    |               PENDING              |
|         +---> P99 Latency Spikes   |    |         |                          |
+------------------------------------+    |         v                          |
                                          |   Client Connections Rejected:     |
                                          |   "FATAL: not accepting conn"      |
                                          +------------------------------------+
```

---

## 2. MultiXact Row-Locking Causal Path

```text
Concurrent SELECT ... FOR SHARE / FK Checks on Hot Rows
        |
        v
MultiXactId Allocation (MultiXactIdCreate)
        |
        +---> Writes to pg_multixact/offsets (Offset SLRU)
        |
        +---> Writes to pg_multixact/members (Member SLRU)
        |
        v
Buffer Cache Saturation (16 Member Buffers / 8 Offset Buffers)
        |
        v
MultiXactMemberSLRU / MultiXactOffsetSLRU LWLock Waits
        |
        v
High Query Latency / Transaction Pipeline Stalls
```

---

## 3. Key Findings from the Causal Model

1. **Isolation of String Formatting**: Formatting errors and terminal alignment logic in `psql` operate strictly in user-space client processes.
2. **The Root of Subtransaction Degradation**: Per-row `EXCEPTION` blocks in loops create subtransactions. If these subtransactions perform writes, they allocate XIDs and trigger `PGPROC` cache overflow at > 64 subxids.
3. **The Two Distinct Degradation Vectors**:
   - **Performance Vector**: Concurrent visibility lookups in `pg_subtrans` exhaust the 32-buffer SLRU pool, leading to `IO:SLRURead` disk thrashing and `SubtransControlLock` LWLock convoys.
   - **Availability Vector**: Primary WAL records with `subxid_overflow = true` delay snapshot readiness on newly recovering standby replicas, causing a total read-availability block until primary transactions finish.
