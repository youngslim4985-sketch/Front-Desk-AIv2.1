# PostgreSQL pg_stat_slru Monitoring View

## Overview

Introduced in PostgreSQL 13, the `pg_stat_slru` view provides cumulative operational metrics for every SLRU cache in the database cluster.

---

## 1. Schema of pg_stat_slru

| Column Name | Type | Description |
|---|---|---|
| `name` | `text` | Name of the SLRU subsystem (`Subtrans`, `MultiXactMember`, `MultiXactOffset`, `Xact`, `Async`, `Predicate`, `CommitTs`, `Other`) |
| `blks_zeroed` | `bigint` | Number of blocks zeroed during initialization |
| `blks_hit` | `bigint` | Number of times a requested page was already present in the SLRU buffer pool |
| `blks_read` | `bigint` | Number of times a page had to be read from disk (cache miss) |
| `blks_written` | `bigint` | Number of dirty SLRU pages written out to disk |
| `blks_exists` | `bigint` | Number of times a block was checked for existence |
| `flushes` | `bigint` | Number of flush operations executed |
| `truncates` | `bigint` | Number of truncation operations executed |
| `stats_reset` | `timestamptz` | Timestamp when statistics were last reset |

---

## 2. Key Diagnostic Formulas

### 1. Cache Hit Ratio
$$\text{Hit Ratio (\%)} = \frac{\text{blks\_hit}}{\text{blks\_hit} + \text{blks\_read}} \times 100$$
- **Healthy system**: $\ge 99.5\%$
- **Degraded / Thrashing system**: $< 95.0\%$

### 2. Read-to-Hit Ratio (Miss Rate)
$$\text{Miss Rate (\%)} = \frac{\text{blks\_read}}{\text{blks\_hit} + \text{blks\_read}} \times 100$$

---

## 3. Standard SLRU Health Inspection Query

```sql
SELECT 
    name,
    blks_hit,
    blks_read,
    blks_written,
    blks_zeroed,
    flushes,
    truncates,
    CASE 
        WHEN (blks_hit + blks_read) = 0 THEN 100.00
        ELSE ROUND(blks_hit * 100.0 / (blks_hit + blks_read), 2)
    END AS hit_percentage,
    stats_reset
FROM pg_stat_slru
ORDER BY name;
```

---

## 4. Measuring Differential Impact in Benchmarks

To measure the exact SLRU impact of a single benchmark run:

```sql
-- 1. Reset SLRU statistics before experiment
SELECT pg_stat_reset_slru();

-- 2. Execute experiment workload
-- (e.g. 100,000 subtransactions or 50 concurrent locking sessions)

-- 3. Capture exact deltas
SELECT 
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN ('Subtrans', 'MultiXactMember', 'MultiXactOffset');
```
