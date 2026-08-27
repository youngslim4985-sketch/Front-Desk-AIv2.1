# Source Verification Ledger

| ID | Claim | Primary source | Status |
|---|---|---|---|
| SRC-001 | `PGPROC_MAX_CACHED_SUBXIDS` controls cached subtransaction IDs | PostgreSQL source | VERIFIED |
| SRC-002 | Subtransaction cache overflow is distinct from transaction failure | PostgreSQL source/docs | VERIFIED |
| SRC-003 | `pg_subtrans` maps subtransaction IDs to parent XIDs | PostgreSQL source | VERIFIED |
| SRC-004 | `pg_subtrans` is not WAL-replicated state | PostgreSQL recovery/source | VERIFIED |
| SRC-005 | Overflow affects snapshot construction | PostgreSQL source/docs | VERIFIED |
| SRC-006 | `RUNNING_XACTS` communicates transaction state during WAL recovery | PostgreSQL source | VERIFIED |
| SRC-007 | Overflowed transaction state can delay hot-standby availability | PostgreSQL docs/source | VERIFIED |
| SRC-008 | `Subtrans` is an SLRU | PostgreSQL source/docs | VERIFIED |
| SRC-009 | MultiXact uses separate offset/member structures | PostgreSQL source/docs | VERIFIED |
| SRC-010 | PostgreSQL 17 introduced configurable SLRU buffer sizing | PostgreSQL documentation/source | VERIFIED |
| SRC-011 | `pg_stat_slru` exposes SLRU activity counters | PostgreSQL documentation | VERIFIED |
| SRC-012 | `pg_stat_activity` exposes wait events | PostgreSQL documentation | VERIFIED |
| SRC-013 | `pg_wcssize()` performs multiline display-width measurement | PostgreSQL source | VERIFIED |
| SRC-014 | `pg_wcsformat()` formats measured wide-character lines | PostgreSQL source | VERIFIED |
| SRC-015 | Width processing does not itself create subtransactions | PostgreSQL source/code-path analysis | VERIFIED |
| SRC-016 | Per-row PL/pgSQL `EXCEPTION` creates subtransaction overhead | PostgreSQL docs/source | VERIFIED |
