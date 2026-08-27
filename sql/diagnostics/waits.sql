-- Current PostgreSQL wait events

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
ORDER BY query_start;

-- SLRU-related waits:

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type IN ('LWLock', 'IO')
GROUP BY wait_event_type, wait_event
HAVING
    wait_event ILIKE '%SLRU%'
    OR wait_event ILIKE '%MultiXact%'
ORDER BY waiting_sessions DESC;
