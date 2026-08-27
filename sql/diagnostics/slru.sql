-- SLRU cache statistics
-- PostgreSQL 17+

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    blks_zeroed,
    truncates,
    stats_reset
FROM pg_stat_slru
ORDER BY name;

-- MultiXact-focused view:

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    ROUND(
        100.0 * blks_hit /
        NULLIF(blks_hit + blks_read, 0),
        2
    ) AS hit_pct,
    stats_reset
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;
