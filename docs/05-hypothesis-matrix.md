# Hypothesis Matrix

| ID | Hypothesis | Mechanism | Status | Required Evidence |
|---|---|---|---|---|
| H1 | `pg_wcswidth()` can produce incorrect/limited width results for complex grapheme clusters | Unicode width calculation | Source verified | Targeted Unicode tests |
| H2 | `pg_wcssize()` correctly handles multiline cells and control expansion according to its implementation | psql formatting | Source verified | Formatting tests |
| H3 | Per-row PL/pgSQL `EXCEPTION` blocks create substantial subtransaction overhead | PL/pgSQL | Source verified / empirical pending | Benchmark |
| H4 | More than 64 relevant cached subtransactions causes cache overflow | PGPROC cache | Source verified | Reproduction |
| H5 | Overflow increases `pg_subtrans` lookup activity | MVCC | Source verified / empirical pending | `pg_stat_slru` + workload |
| H6 | Overflow can increase latency in concurrent sessions | SLRU/MVCC | Empirical pending | Concurrent benchmark |
| H7 | MultiXact metadata pressure can produce MultiXact SLRU waits | MultiXact | Source verified / empirical pending | Lock benchmark |
| H8 | Larger PostgreSQL 17 SLRU caches reduce metadata-cache misses | SLRU | Empirical pending | Before/after benchmark |
| H9 | Overflowed transaction state can delay hot-standby query readiness during recovery | RUNNING_XACTS | Source verified / empirical pending | Replica experiment |
| H10 | A realistic application workload can combine string processing and subtransaction pressure | Cross-mechanism | Empirical pending | Integrated workload |

## Interpretation

"Source verified" means the mechanism is supported by source/documentation analysis.

"Empirical pending" means runtime behavior still requires controlled measurement.

No hypothesis should be promoted to a confirmed operational finding solely from source analysis.
