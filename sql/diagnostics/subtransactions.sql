-- Backend subtransaction state

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.state,
    a.xact_start,
    now() - a.xact_start AS xact_age,
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_activity AS a
CROSS JOIN LATERAL
    pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.xact_start IS NOT NULL
ORDER BY
    s.subxact_overflow DESC,
    s.subxact_count DESC;

-- Focus only on overflowed backends:

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.xact_start,
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_activity AS a
CROSS JOIN LATERAL
    pg_stat_get_backend_subxact(a.pid) AS s
WHERE s.subxact_overflow
ORDER BY a.xact_start;
