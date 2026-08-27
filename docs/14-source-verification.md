# PostgreSQL Source Code Verification Matrix

## Overview

This document provides exact C source file paths, structs, functions, and line references in the PostgreSQL codebase for all mechanisms analyzed in this research.

---

## 1. Source Reference Table

| Mechanism | Source File | Key Symbols / Functions | Implementation Notes |
|---|---|---|---|
| **Encoding Conversion** | `src/backend/utils/mb/mbutils.c` | `report_untranslatable_char()` | Emits `ERRCODE_UNTRANSLATABLE_CHARACTER` (`22P05`) |
| **Character Width** | `src/bin/psql/mbprint.c` | `ucs_wcwidth()`, `pg_wcswidth()` | Unicode binary search intervals for wide & combining chars |
| **psql Cell Size** | `src/bin/psql/mbprint.c` | `pg_wcssize()`, `pg_wcsformat()` | Line breaking, tab stop expansion, format flags |
| **Multiline Grid** | `src/bin/psql/print.c` | `printTable()`, `printTableInit()` | Multi-pass column width & row height terminal layout |
| **PL/pgSQL Exception** | `src/pl/plpgsql/src/pl_exec.c` | `exec_stmt_block()` | Calls `BeginInternalSubTransaction()` on exception blocks |
| **SubXID Shared Cache** | `src/include/storage/proc.h` | `PGPROC_MAX_CACHED_SUBXIDS`, `PGPROC` | 64-entry fixed array in shared memory per backend |
| **SubXID Overflow** | `src/backend/storage/ipc/procarray.c` | `GetSnapshotData()` | Sets `snapshot->suboverflowed = true` when > 64 subxids |
| **SLRU Parent Lookup** | `src/backend/access/transam/subtrans.c` | `SubTransGetTopmostTransaction()` | Traverses `pg_subtrans` SLRU disk pages on overflow |
| **SLRU Cache Engine** | `src/backend/access/transam/slru.c` | `SimpleLruReadPage()`, `SimpleLruWritePage()` | Manages buffer slots, page replacement, LRU eviction |
| **MultiXact Engine** | `src/backend/access/transam/multixact.c` | `MultiXactIdCreate()`, `GetMultiXactIdMembers()` | MultiXact members and offset SLRU page management |
| **WAL Running Transactions** | `src/backend/storage/ipc/standby.c` | `LogStandbySnapshot()`, `GetRunningTransactionData()` | Populates `xl_running_xacts` and `subxid_overflow` flag |
| **Standby Snapshot State** | `src/backend/storage/ipc/standby.c` | `StandbyReleaseOldXids()`, `ResolveRecoveryConflictWithSnapshot()` | Delays `STANDBY_SNAPSHOT_READY` if `subxid_overflow` is true |
| **SLRU Monitoring** | `src/backend/utils/activity/pgstat_slru.c` | `pgstat_count_slru_page_hit()`, `pg_stat_slru` | Tracks `blks_hit`, `blks_read`, `blks_written` per SLRU |

---

## 2. Structural Breakdown: Client vs. Server vs. Storage

```text
+-------------------------------------------------------------------------------+
| CLIENT LAYER (psql / libpq)                                                   |
| - src/bin/psql/mbprint.c (ucs_wcwidth, pg_wcswidth, pg_wcssize, pg_wcsformat) |
| - src/bin/psql/print.c (printTable, grid layout, multiline cell alignment)    |
+-------------------------------------------------------------------------------+
                                     |  SQL Queries / Text protocol
                                     v
+-------------------------------------------------------------------------------+
| SERVER ENGINE (Backend Process)                                               |
| - src/pl/plpgsql/src/pl_exec.c (exec_stmt_block, BeginInternalSubTransaction)  |
| - src/backend/storage/ipc/procarray.c (GetSnapshotData, PGPROC subxids check) |
+-------------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------------+
| STORAGE & SLRU SUBSYSTEM (Shared Memory & Disk)                               |
| - src/backend/access/transam/subtrans.c (pg_subtrans, parent XID resolution)  |
| - src/backend/access/transam/slru.c (SimpleLru buffer eviction & page locks)  |
| - src/backend/access/transam/multixact.c (MultiXactMember/Offset SLRU)        |
+-------------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------------+
| REPLICATION & STANDBY (WAL Stream)                                            |
| - src/backend/storage/ipc/standby.c (xl_running_xacts, subxid_overflow)       |
| - Standby snapshot recovery state machine                                     |
+-------------------------------------------------------------------------------+
```

---

## 3. Verification Summary

1. **Width processing** is isolated to the client binary `psql` (`src/bin/psql/`).
2. **Subtransactions** are created in the language handler (`src/pl/plpgsql/`) and tracked in server memory (`src/include/storage/proc.h`).
3. **SLRU thrashing** occurs in the storage layer (`src/backend/access/transam/`).
4. **Standby delay** occurs during WAL snapshot interpretation (`src/backend/storage/ipc/standby.c`).

Each mechanism is physically and architecturally decoupled in the PostgreSQL codebase.
