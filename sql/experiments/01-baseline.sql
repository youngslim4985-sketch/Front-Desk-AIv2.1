-- Baseline workload
-- Purpose: establish normal PostgreSQL behavior before stress tests.

SELECT
    now() AS started_at,
    version();

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
);
