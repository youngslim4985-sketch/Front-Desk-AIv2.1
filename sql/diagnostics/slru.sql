-- SLRU cache health
SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    flushes,
    truncates,
    stats_reset
FROM pg_stat_slru
ORDER BY name;

