# PostgreSQL Subtransactions, MultiXact, SLRU Architecture & Hot-Standby Availability: Final Research Report

**Author / Project**: PostgreSQL Deep Core Architecture & Reliability Group  
**Target Engine**: PostgreSQL 14, 15, 16, 17, 18  
**Scope**: Source-level analysis, causal modeling, diagnostic instrumentation, and operational mitigation strategies.

---

## Executive Summary

This research report investigates the architectural mechanics and operational boundaries governing PostgreSQL subtransaction overflow, SLRU cache contention, MultiXact row locking, string display formatting, and hot-standby snapshot availability.

Key research conclusions:
1. **Separation of Concerns**: String width calculations (`ucs_wcwidth`, `pg_wcswidth`), cell formatting (`pg_wcssize`, `pg_wcsformat`), and multiline alignment operate exclusively in the client-side `psql` binary and create zero server-side subtransactions or SLRU activity.
2. **Subtransaction Overflow Mechanics**: In-memory caching of subtransaction IDs (`SubXID`s) in shared memory (`PGPROC->subxids`) is strictly capped at `PGPROC_MAX_CACHED_SUBXIDS = 64`. Creating > 64 XID-bearing subtransactions sets `overflowed = true`.
3. **Primary-Side Degradation**: Subtransaction overflow forces concurrent snapshot readers to resolve transaction parentage via `pg_subtrans` disk pages (`SubTransGetTopmostTransaction`). With default buffer pool sizes (32 buffers / 256 KB), high-concurrency read workloads suffer extreme cache thrashing (`IO:SLRURead`) and LWLock lock convoys (`SubtransSLRU`, `SubtransControlLock`).
4. **Standby Availability Block**: Streaming replication WAL records (`XLOG_RUNNING_XACTS`) log `subxid_overflow = true` whenever any backend has > 64 subxids. A recovering standby cannot construct a consistent initial snapshot while overflowed transactions are running, delaying `STANDBY_SNAPSHOT_READY` and causing a 100% read outage on newly starting replicas.
5. **MultiXact Contention**: Concurrent shared row locks (`SELECT ... FOR SHARE`) create MultiXacts that stress `pg_multixact/members` and `pg_multixact/offsets` SLRUs, causing `MultiXactMemberSLRU` wait events.
6. **PostgreSQL 17+ Mitigations**: PostgreSQL 17 introduces configurable buffer sizes (`subtransaction_buffers`, `multixact_member_buffers`, `multixact_offset_buffers`), mitigating disk I/O thrashing though not eliminating shared memory latch contention.

---

## Table of Contents

1. [Architectural Framework & Research Boundary](#1-architectural-framework--research-boundary)
2. [Display Width & Encoding Subsystem Analysis](#2-display-width--encoding-subsystem-analysis)
3. [Subtransaction Lifecycle & PGPROC Cache Overflow](#3-subtransaction-lifecycle--pgproc-cache-overflow)
4. [pg_subtrans SLRU Storage & Concurrency Bottlenecks](#4-pg_subtrans-slru-storage--concurrency-bottlenecks)
5. [MultiXact Locking Mechanics & SLRU Pressure](#5-multixact-locking-mechanics--slru-pressure)
6. [Hot Standby Snapshot Construction & Availability Impacts](#6-hot-standby-snapshot-construction--availability-impacts)
7. [PostgreSQL 17+ Cache Configuration & Tuning](#7-postgresql-17-cache-configuration--tuning)
8. [Diagnostic Instrumentation & Monitoring (pg_stat_slru)](#8-diagnostic-instrumentation--monitoring-pg_stat_slru)
9. [Application Anti-Patterns & Remediation Guidelines](#9-application-anti-patterns--remediation-guidelines)
10. [Conclusion & Summary Matrix](#10-conclusion--summary-matrix)

---

## 1. Architectural Framework & Research Boundary

The PostgreSQL architecture clearly delineates between client-side formatting, execution language runtimes, storage engines, and replication streams:

```text
[ Client Application / psql ]
         |  Text Protocol / SQL Queries
         v
[ PL/pgSQL Engine / Execution ] ---> Generates Subtransactions on EXCEPTION
         |
         v
[ Shared Memory (PGPROC / ProcArray) ] ---> In-memory SubXID array (Max 64)
         |
         +---> [ SLRU Storage Subsystem ] (pg_subtrans, pg_multixact)
         |
         v
[ WAL Writer & Streaming Replication ] ---> XLOG_RUNNING_XACTS (subxid_overflow)
```

---

## 2. Display Width & Encoding Subsystem Analysis

### 2.1 Unicode Measurement (`src/bin/psql/mbprint.c`)
The `psql` client formats output using `ucs_wcwidth()` and `pg_wcswidth()`. These routines evaluate character display widths using binary search intervals over standard Unicode tables. 
- Wide characters (CJK, fullwidth ASCII) return width 2.
- Combining marks, zero-width joiners (`U+200D`), and non-spacing accents return width 0.
- Normal Latin, digits, and halfwidth katakana return width 1.
- Unprintable control codes return -1.

### 2.2 Encoding Errors (SQLSTATE `22P05`)
When the server encounters invalid or unmappable byte sequences during `convert_from()` or client-to-server transcoding, `report_untranslatable_char()` raises `ERRCODE_UNTRANSLATABLE_CHARACTER` (`22P05`). 

**Crucial Finding**: This error is a standard execution exception. It only generates subtransactions when intercepted by a PL/pgSQL `EXCEPTION` block.

---

## 3. Subtransaction Lifecycle & PGPROC Cache Overflow

### 3.1 PL/pgSQL Exception Blocks
Every PL/pgSQL block containing an `EXCEPTION` clause invokes `BeginInternalSubTransaction()` before executing statements. If no errors occur, `ReleaseCurrentSubTransaction()` commits the subtransaction. If an exception is caught, `RollbackAndReleaseCurrentSubTransaction()` rolls it back.

### 3.2 The 64-SubXID Threshold
In `src/include/storage/proc.h`, PostgreSQL defines:
```c
#define PGPROC_MAX_CACHED_SUBXIDS 64
```
Each backend's `PGPROC` structure maintains a 64-slot array `subxids.subxids[]`.
- If a transaction creates $\le 64$ subtransactions with XIDs, all subXIDs fit in memory.
- When the 65th XID-bearing subtransaction is created, `subxids.overflowed` is set to `true`.

---

## 4. pg_subtrans SLRU Storage & Concurrency Bottlenecks

### 4.1 Storage Mapping
`pg_subtrans` maps each subtransaction ID to its parent transaction ID (4 bytes per entry, 2,048 entries per 8 KB page).

### 4.2 Visibility Check Degradation
When a snapshot reader backend takes a snapshot during subtransaction overflow:
1. `GetSnapshotData()` observes `subxids.overflowed == true` and sets `snapshot->suboverflowed = true`.
2. When evaluating tuple visibility for tuples written by subtransactions, the reader cannot rely on the in-memory snapshot.
3. The reader must call `SubTransGetTopmostTransaction()`, acquiring `SubtransControlLock` and reading `pg_subtrans` pages.
4. With the default 32 SLRU buffers (256 KB), concurrent readers rapidly evict each other's pages, resulting in severe `IO:SLRURead` disk waits and high query latency spikes (P99 latency increases of 10x–50x).

---

## 5. MultiXact Locking Mechanics & SLRU Pressure

MultiXacts represent multiple concurrent compatible row locks (`SELECT ... FOR SHARE`, `KEY SHARE`).
- MultiXact offsets are stored in `pg_multixact/offsets` (default 8 buffers).
- MultiXact members and lock statuses are stored in `pg_multixact/members` (default 16 buffers).
- Under high concurrency on hot rows, rapid allocation of MultiXact IDs exhausts these tiny buffer pools, producing high `MultiXactMemberSLRU` and `MultiXactOffsetSLRU` contention.

---

## 6. Hot Standby Snapshot Construction & Availability Impacts

### 6.1 Snapshot Readiness State Machine
On a standby replica, read-only queries are blocked until the replica achieves `STANDBY_SNAPSHOT_READY`.

### 6.2 Standby Blocking Condition
The primary periodically logs `XLOG_RUNNING_XACTS` records. If any backend on the primary has `subxids.overflowed == true`, the WAL record sets `subxid_overflow = true`.

When a recovering standby reads an `XLOG_RUNNING_XACTS` record with `subxid_overflow == true`:
- The standby cannot determine which subXIDs are active.
- It **refuses to initialize the running transaction snapshot** and remains in `STANDBY_SNAPSHOT_PENDING`.
- All incoming read connections are terminated with:  
  `FATAL: the database system is not yet accepting connections`.
- This outage persists until all overflowed transactions on the primary commit or abort.

---

## 7. PostgreSQL 17+ Cache Configuration & Tuning

PostgreSQL 17 addresses SLRU buffer exhaustion by introducing configurable GUC parameters:

| GUC Parameter | Default Size | Recommended Tuning (High Concurrency) | Memory Consumption |
|---|---|---|---|
| `subtransaction_buffers` | 32 (256 KB) | 1024 to 4096 | 8 MB to 32 MB |
| `multixact_member_buffers` | 16 (128 KB) | 512 to 2048 | 4 MB to 16 MB |
| `multixact_offset_buffers` | 8 (64 KB) | 256 to 1024 | 2 MB to 8 MB |

Increasing these buffers eliminates `IO:SLRURead` disk thrashing. However, it does not prevent the standby snapshot availability block caused by `subxid_overflow`.

---

## 8. Diagnostic Instrumentation & Monitoring (pg_stat_slru)

Database administrators should continuously monitor SLRU performance via `pg_stat_slru`:

```sql
SELECT 
    name,
    blks_hit,
    blks_read,
    blks_written,
    ROUND(blks_hit * 100.0 / NULLIF(blks_hit + blks_read, 0), 2) AS hit_ratio
FROM pg_stat_slru
WHERE name IN ('Subtrans', 'MultiXactMember', 'MultiXactOffset');
```

- **Healthy State**: `hit_ratio` $\ge 99.8\%$, `blks_read` near zero.
- **Pathological State**: `hit_ratio` $< 95\%$, rapid accumulation of `blks_read` and `IO:SLRURead` wait events in `pg_stat_activity`.

---

## 9. Application Anti-Patterns & Remediation Guidelines

### 9.1 The Anti-Pattern: Per-Row Exceptions in Loops
```sql
-- DANGEROUS ANTI-PATTERN: DO NOT USE IN PRODUCTION
FOR r IN SELECT * FROM raw_records LOOP
    BEGIN
        INSERT INTO target_table VALUES (r.*);
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO error_log VALUES (r.id, SQLERRM);
    END;
END LOOP;
```

### 9.2 Remediation 1: Set-Based Conflict Handling
```sql
-- RECOMMENDED: Zero Subtransactions, Maximum Performance
INSERT INTO target_table
SELECT * FROM raw_records
ON CONFLICT (id) DO NOTHING;
```

### 9.3 Remediation 2: Batch-Level Transaction Scopes
Process data in external client batches (e.g. 500 rows per transaction) using application-level retry loops rather than PL/pgSQL subtransactions.

---

## 10. Conclusion & Summary Matrix

| Mechanism | Primary Impact | Standby Impact | Root Cause | Best Remediation |
|---|---|---|---|---|
| **Display Width** | None (Client-side) | None | Terminal cell alignment | Standard psql formatting |
| **Encoding (22P05)** | None (Error state) | None | Invalid character bytes | Pre-sanitize input data |
| **Subtrans Overflow** | High query latency / SLRU thrashing | Delays standby snapshot ready | > 64 exception blocks with writes | Replace with `ON CONFLICT` or batching |
| **MultiXact Pressure** | MultiXact SLRU contention | Replayed via WAL | Thousands of concurrent `FOR SHARE` locks | Avoid shared locks on hot lookup rows |
| **SLRU Buffer Exhaustion** | Synchronous disk I/O (`IO:SLRURead`) | Local cache misses | 32-buffer default pool | Increase `subtransaction_buffers` in PG 17+ |

**Final Statement**: While PostgreSQL 17 provides valuable SLRU buffer sizing controls, eliminating per-row PL/pgSQL `EXCEPTION` subtransactions at the application layer remains the only comprehensive solution for preventing both primary-side performance degradation and standby read-availability outages.
