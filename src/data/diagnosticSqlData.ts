import { DiagnosticQuery } from '../types/postgres';

export const DIAGNOSTIC_SQL_SUITE: DiagnosticQuery[] = [
  {
    id: 'query_slru_cache_stats',
    title: 'SLRU Cache Hit Ratio & Disk I/O Stall Monitor',
    category: 'SLRU I/O & Buffers',
    targetVersion: 'PostgreSQL 13+',
    sql: `SELECT 
    name AS slru_name,
    blks_read,
    blks_written,
    blks_exists,
    flushes,
    truncates,
    CASE 
        WHEN (blks_read + blks_exists) = 0 THEN 100.00
        ELSE ROUND(100.0 * blks_exists / (blks_read + blks_exists), 2)
    END AS cache_hit_ratio_pct
FROM pg_stat_slru
ORDER BY blks_read DESC;`,
    description: 'Inspects cache hits vs synchronous disk reads across all SLRU buffer pools (subtrans, multixact_offset, multixact_member, clog, commit_timestamp).',
    whyItMatters: 'If subtrans or multixact_member shows low cache hit ratio (<95%) and high blks_read, your workload is constantly evicting 8KB SLRU pages, stalling transactions on disk reads under exclusive lock.',
    columnsExplained: [
      { name: 'slru_name', type: 'text', meaning: 'SLRU engine name (subtrans, multixact_offset, multixact_member, clog)' },
      { name: 'blks_read', type: 'bigint', meaning: 'Total 8KB disk page reads (cache misses)' },
      { name: 'blks_written', type: 'bigint', meaning: 'Total 8KB dirty page flushes to disk' },
      { name: 'blks_exists', type: 'bigint', meaning: 'Total in-memory page lookups (cache hits)' },
      { name: 'cache_hit_ratio_pct', type: 'numeric', meaning: 'Percentage of page requests served directly from RAM' },
    ],
    alertCondition: 'cache_hit_ratio_pct < 90.0 AND blks_read > 1000',
    recommendedAction: 'In PG 17+, increase subtrans_buffers and multixact_members_buffers in postgresql.conf. In PG <= 16, eliminate row-by-row EXCEPTION loops in PL/pgSQL.',
    sampleOutput: {
      columns: ['slru_name', 'blks_read', 'blks_written', 'blks_exists', 'flushes', 'cache_hit_ratio_pct'],
      rows: [
        ['subtrans', 489210, 18420, 1205940, 120, 71.14],
        ['multixact_member', 89200, 4210, 890400, 45, 90.89],
        ['clog', 1240, 520, 4592000, 12, 99.97],
        ['multixact_offset', 450, 80, 450200, 8, 99.90],
      ],
    },
  },
  {
    id: 'query_active_slru_waits',
    title: 'Real-Time Subtrans / MultiXact Lock Wait Convoy Detection',
    category: 'Subtransactions & Locks',
    targetVersion: 'PostgreSQL 9.6+',
    sql: `SELECT 
    pid,
    usename,
    client_addr,
    wait_event_type,
    wait_event,
    state,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - state_change))::numeric, 2) AS wait_duration_sec,
    LEFT(query, 80) AS query_preview
FROM pg_stat_activity
WHERE wait_event IN (
    'SubtransControlLock', 
    'SubtransSLRULock', 
    'MultiXactMemberControlLock',
    'MultiXactOffsetControlLock'
)
ORDER BY state_change ASC;`,
    description: 'Detects all active backend sessions currently stalled waiting to acquire SLRU shared/exclusive control locks.',
    whyItMatters: 'Seeing multiple sessions in SubtransSLRULock or SubtransControlLock indicates an active lock convoy where 1 writer with thousands of subxacts is paralyzing concurrent readers.',
    columnsExplained: [
      { name: 'pid', type: 'integer', meaning: 'PostgreSQL backend process ID' },
      { name: 'wait_event', type: 'text', meaning: 'Exact internal lock being contested (SubtransSLRULock, etc.)' },
      { name: 'wait_duration_sec', type: 'numeric', meaning: 'Seconds the session has been frozen waiting for the lock' },
      { name: 'query_preview', type: 'text', meaning: 'SQL text being executed' },
    ],
    alertCondition: 'Count of active waiting sessions > 5 for > 2 seconds',
    recommendedAction: 'Terminate or optimize the batch writer session. Check if application code is using nested savepoints in long transactions.',
    sampleOutput: {
      columns: ['pid', 'usename', 'wait_event_type', 'wait_event', 'state', 'wait_duration_sec', 'query_preview'],
      rows: [
        [18492, 'app_worker', 'LWLock', 'SubtransSLRULock', 'active', 4.82, 'SELECT count(*) FROM orders WHERE customer_id = 49102;'],
        [18501, 'api_reader', 'LWLock', 'SubtransSLRULock', 'active', 4.79, 'SELECT * FROM inventory WHERE sku = $1;'],
        [18515, 'api_reader', 'LWLock', 'SubtransControlLock', 'active', 4.65, 'SELECT balance FROM accounts WHERE user_id = $1;'],
        [18302, 'etl_batch', 'Lock', 'transactionid', 'active', 12.10, 'SELECT ingest_events_bad($1);'],
      ],
    },
  },
  {
    id: 'query_overflowed_subxacts',
    title: 'Active Subtransaction Depth & Overflow Identification',
    category: 'Subtransactions & Locks',
    targetVersion: 'PostgreSQL 10+',
    sql: `SELECT 
    a.pid,
    a.usename,
    a.backend_type,
    a.state,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - a.xact_start))::numeric, 2) AS xact_age_sec,
    l.locktype,
    l.mode,
    l.granted,
    LEFT(a.query, 100) AS active_query
FROM pg_stat_activity a
JOIN pg_locks l ON a.pid = l.pid
WHERE a.backend_type = 'client backend'
  AND a.state = 'active'
  AND a.xact_start IS NOT NULL
  AND l.locktype = 'transactionid'
ORDER BY xact_age_sec DESC;`,
    description: 'Pinpoints long-running transactions holding transaction IDs and actively participating in subtransaction generation.',
    whyItMatters: 'Long-running write transactions that generate subtransactions prevent vacuum from advancing OldestXmin and force all other sessions to inspect old pg_subtrans pages.',
    columnsExplained: [
      { name: 'pid', type: 'integer', meaning: 'Backend process ID' },
      { name: 'xact_age_sec', type: 'numeric', meaning: 'Duration of the top-level open transaction' },
      { name: 'active_query', type: 'text', meaning: 'Current SQL statement in the active transaction' },
    ],
    alertCondition: 'xact_age_sec > 300 (5 minutes) for batch write transactions',
    recommendedAction: 'Break large batches into smaller chunks or use batch staging tables without exception loops.',
    sampleOutput: {
      columns: ['pid', 'usename', 'state', 'xact_age_sec', 'locktype', 'granted', 'active_query'],
      rows: [
        [18302, 'etl_batch', 'active', 482.15, 'transactionid', true, 'CALL process_daily_refunds_batch(100000);'],
        [19022, 'app_worker', 'active', 312.40, 'transactionid', true, 'INSERT INTO audit_log SELECT ... FROM staging_data;'],
      ],
    },
  },
  {
    id: 'query_multixact_wraparound',
    title: 'MultiXact ID Age & Wraparound Proximity Monitor',
    category: 'MultiXact & Wraparound',
    targetVersion: 'PostgreSQL 9.4+',
    sql: `SELECT 
    d.datname,
    mxid_age(d.datminmxid) AS current_multixact_age,
    current_setting('autovacuum_multixact_freeze_max_age')::bigint AS autovacuum_freeze_max_age,
    ROUND(
        100.0 * mxid_age(d.datminmxid) / current_setting('autovacuum_multixact_freeze_max_age')::bigint, 
        2
    ) AS pct_towards_autovacuum_freeze,
    2147483648 - mxid_age(d.datminmxid) AS mxids_until_wraparound_shutdown
FROM pg_database d
WHERE d.datallowconn
ORDER BY current_multixact_age DESC;`,
    description: 'Tracks the distance between the oldest active MultiXactId in the database (datminmxid) and emergency wraparound limits.',
    whyItMatters: 'If MultiXact age reaches autovacuum_multixact_freeze_max_age, PostgreSQL triggers aggressive anti-wraparound vacuums across all tables, locking write operations and consuming heavy I/O.',
    columnsExplained: [
      { name: 'datname', type: 'name', meaning: 'Database name' },
      { name: 'current_multixact_age', type: 'integer', meaning: 'Number of MultiXactIds consumed since oldest unvacuumed table' },
      { name: 'pct_towards_autovacuum_freeze', type: 'numeric', meaning: 'Percentage threshold towards forced freeze vacuum' },
      { name: 'mxids_until_wraparound_shutdown', type: 'bigint', meaning: 'Remaining MultiXactIds before server emergency halt' },
    ],
    alertCondition: 'pct_towards_autovacuum_freeze > 75.0',
    recommendedAction: 'Schedule VACUUM FREEZE during off-peak hours on the oldest tables. Reduce unnecessary SELECT FOR SHARE concurrency.',
    sampleOutput: {
      columns: ['datname', 'current_multixact_age', 'autovacuum_freeze_max_age', 'pct_towards_autovacuum_freeze', 'mxids_until_wraparound_shutdown'],
      rows: [
        ['production_db', 245900120, 400000000, 61.48, 1901583528],
        ['analytics_db', 1240050, 400000000, 0.31, 2146243598],
      ],
    },
  },
  {
    id: 'query_standby_conflicts',
    title: 'Hot Standby Snapshot Conflict & Delay Monitor',
    category: 'Hot Standby & WAL',
    targetVersion: 'PostgreSQL 10+',
    sql: `SELECT 
    datname,
    confl_snapshot AS snapshot_conflicts_total,
    confl_lock AS lock_conflicts_total,
    confl_deadlock AS deadlock_conflicts_total,
    confl_bufferpin AS bufferpin_conflicts_total
FROM pg_stat_database_conflicts
WHERE datname IS NOT NULL
ORDER BY confl_snapshot DESC;`,
    description: 'Measures query cancellations and stalls on read-only Hot Standby replicas caused by snapshot invalidation from primary WAL stream.',
    whyItMatters: 'When primary transactions overflow 64 subxacts, xl_running_xacts WAL records omit subxact arrays (subxid_overflow = true). Replicas cannot build complete snapshots, causing confl_snapshot increments and query drops.',
    columnsExplained: [
      { name: 'datname', type: 'name', meaning: 'Database name on replica' },
      { name: 'snapshot_conflicts_total', type: 'bigint', meaning: 'Queries cancelled due to snapshot recovery conflicts' },
      { name: 'lock_conflicts_total', type: 'bigint', meaning: 'Queries cancelled due to exclusive relation locks from WAL' },
    ],
    alertCondition: 'snapshot_conflicts_total increasing rapidly over 5-minute window',
    recommendedAction: 'Increase max_standby_streaming_delay on standby or configure hot_standby_feedback = on. Eliminate primary subxact storms.',
    sampleOutput: {
      columns: ['datname', 'snapshot_conflicts_total', 'lock_conflicts_total', 'deadlock_conflicts_total', 'bufferpin_conflicts_total'],
      rows: [
        ['production_replica', 1420, 85, 2, 14],
        ['reporting_replica', 980, 42, 0, 8],
      ],
    },
  },
  {
    id: 'query_slru_guc_audit',
    title: 'Server SLRU & Transaction Memory Sizing Audit',
    category: 'Server GUCs & Configuration',
    targetVersion: 'PostgreSQL 14 - 17',
    sql: `SELECT 
    name,
    setting,
    unit,
    context,
    short_desc
FROM pg_settings
WHERE name IN (
    'subtrans_buffers',
    'multixact_offsets_buffers',
    'multixact_members_buffers',
    'xact_buffers',
    'shared_buffers',
    'max_connections',
    'autovacuum_multixact_freeze_max_age'
)
ORDER BY name;`,
    description: 'Verifies current SLRU buffer configurations and identifies whether the instance supports PG 17 dynamic tuning.',
    whyItMatters: 'Confirms whether subtrans_buffers is present (PG 17+) and checks memory allocation against max_connections.',
    columnsExplained: [
      { name: 'name', type: 'text', meaning: 'PostgreSQL configuration parameter name' },
      { name: 'setting', type: 'text', meaning: 'Current runtime value' },
      { name: 'unit', type: 'text', meaning: 'Unit (8kB, MB, etc.)' },
      { name: 'context', type: 'text', meaning: 'Postmaster restart vs reload required' },
    ],
    alertCondition: 'subtrans_buffers missing on PG <= 16 with high concurrency',
    recommendedAction: 'Plan upgrade to PostgreSQL 17 to unlock subtrans_buffers and multixact_members_buffers tuning.',
    sampleOutput: {
      columns: ['name', 'setting', 'unit', 'context', 'short_desc'],
      rows: [
        ['autovacuum_multixact_freeze_max_age', '400000000', null, 'postmaster', 'Multixact age at which to autovacuum a table to prevent wraparound'],
        ['max_connections', '200', null, 'postmaster', 'Sets the maximum number of concurrent connections'],
        ['multixact_members_buffers', '1024', '8kB', 'postmaster', 'Sets the number of shared memory buffers for multixact members'],
        ['multixact_offsets_buffers', '256', '8kB', 'postmaster', 'Sets the number of shared memory buffers for multixact offsets'],
        ['shared_buffers', '1048576', '8kB', 'postmaster', 'Sets the number of shared memory buffers used by the server'],
        ['subtrans_buffers', '1024', '8kB', 'postmaster', 'Sets the number of shared memory buffers for subtransactions'],
        ['xact_buffers', '512', '8kB', 'postmaster', 'Sets the number of shared memory buffers for transaction status'],
      ],
    },
  },
];
