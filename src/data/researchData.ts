import { ModuleMetadata } from '../types/postgres';

export { UNRELEASED_ROADMAP_HEADER, UNRELEASED_MILESTONES } from './unreleasedData';
export { SOURCE_VERIFICATION_DOCS } from './sourceVerificationData';
export { DIAGNOSTIC_SQL_SUITE } from './diagnosticSqlData';
export { EXPERIMENTAL_SCENARIOS, DOCKER_COMPOSE_HARNESS } from './experimentalHarnessData';

export const MODULE_METADATA_LIST: ModuleMetadata[] = [
  {
    id: 'overview',
    number: '00',
    title: 'Research Architecture & System Map',
    shortTitle: 'System Map',
    category: 'Overview & Scripts',
    tagline: 'High-level mapping of PostgreSQL subtransaction lifecycle, storage engines, and crash points.',
    badge: 'Research Scaffold',
  },
  {
    id: 'unreleased_scaffold',
    number: '★',
    title: 'Unreleased Research Manifesto & Scaffold',
    shortTitle: 'Unreleased Roadmap',
    category: 'Unreleased Pillars',
    tagline: 'Master release specification covering initial scaffold, source proofs, diagnostic SQL, and harness.',
    badge: 'Unreleased v1.0',
  },
  {
    id: 'source_verification',
    number: '01',
    title: 'Source-Verification Documentation',
    shortTitle: 'Source Verification',
    category: 'Unreleased Pillars',
    tagline: 'Direct C source code proofs, structs, algorithms, and invariants from proc.h, subtrans.c, slru.c.',
    badge: 'C Code Proofs',
  },
  {
    id: 'diagnostic_sql',
    number: '02',
    title: 'Production Diagnostic SQL Suite',
    shortTitle: 'Diagnostic SQL',
    category: 'Unreleased Pillars',
    tagline: 'Zero-overhead catalog queries for pg_stat_slru, lock convoys, overflow sessions, and wraparound.',
    badge: 'Ready-to-Run SQL',
  },
  {
    id: 'experimental_harness',
    number: '03',
    title: 'Experimental Reproduction Harness',
    shortTitle: 'Benchmark Harness',
    category: 'Unreleased Pillars',
    tagline: 'Automated pgbench scripts, multi-version Docker Compose lab, Linux perf profilers, and live simulator.',
    badge: 'Lab Benchmark',
  },
  {
    id: 'plpgsql_exceptions',
    number: '04',
    title: 'Row-by-Row PL/pgSQL Exception Handling',
    shortTitle: 'PL/pgSQL Exceptions',
    category: 'Core Subtransactions',
    tagline: 'How implicit savepoints inside LOOP blocks trigger subtransaction storms and catastrophic slowdowns.',
    badge: 'Anti-Pattern',
  },
  {
    id: 'xid_subtransactions',
    number: '05',
    title: 'XID-Bearing Subtransaction Creation',
    shortTitle: 'XID SubXacts',
    category: 'Core Subtransactions',
    tagline: 'Read-only vs DML savepoints, 32-bit transaction ID epoch consumption, and tree hierarchies.',
  },
  {
    id: 'pgproc_overflow',
    number: '06',
    title: 'PGPROC_MAX_CACHED_SUBXIDS (64) Overflow',
    shortTitle: 'PGPROC 64 Overflow',
    category: 'Core Subtransactions',
    tagline: 'The critical 64-subxact cliff in proc.h: from zero-lock memory array to high-contention SLRU lookups.',
    badge: 'Critical Cliff',
  },
  {
    id: 'pg_subtrans_slru',
    number: '07',
    title: 'pg_subtrans Architecture & SLRU Cache Contention',
    shortTitle: 'pg_subtrans & SLRU',
    category: 'SLRU & MultiXact',
    tagline: '8KB page structure, recursive parent pointer traversal, and SubtransSLRULock convoying.',
  },
  {
    id: 'multixact_pressure',
    number: '08',
    title: 'MultiXact Metadata Pressure & Wraparound',
    shortTitle: 'MultiXact Pressure',
    category: 'SLRU & MultiXact',
    tagline: 'Row share locks, pg_multixact offsets/members allocation, SLRU locks, and emergency freeze vacuums.',
  },
  {
    id: 'pg17_slru_sizing',
    number: '09',
    title: 'PostgreSQL 17 SLRU Buffer Sizing Overhaul',
    shortTitle: 'PG 17 SLRU Sizing',
    category: 'SLRU & MultiXact',
    tagline: 'Evolution from hardcoded 32 buffers (256KB) to configurable dynamic SLRU pools in PG 17+.',
    badge: 'PG 17+ GUCs',
  },
  {
    id: 'concurrency_contention',
    number: '10',
    title: 'Concurrent-Session Performance & Lock Convoys',
    shortTitle: 'Concurrency & Locks',
    category: 'Concurrency & Standby',
    tagline: 'How 1 subtransaction-heavy session destroys the throughput of 50 completely innocent reader sessions.',
    badge: 'Performance Impact',
  },
  {
    id: 'running_xacts_wal',
    number: '11',
    title: 'RUNNING_XACTS WAL Overflow & Bloat',
    shortTitle: 'RUNNING_XACTS WAL',
    category: 'Concurrency & Standby',
    tagline: 'xl_running_xacts WAL record overhead, subxid_overflow flag, and checkpoint write amplification.',
  },
  {
    id: 'hot_standby_lag',
    number: '12',
    title: 'Hot-Standby Snapshot Readiness & Replica Lag',
    shortTitle: 'Hot-Standby Lag',
    category: 'Concurrency & Standby',
    tagline: 'Replication stream stalls, snapshot construction delays, and max_standby_streaming_delay cancellations.',
  },
  {
    id: 'psql_width_alignment',
    number: '13',
    title: 'psql Output Width, Alignment & Pager Behavior',
    shortTitle: 'psql Formatting & TTY',
    category: 'Terminal & Encoding',
    tagline: 'Deep dive into psql formatting engine: \\x auto, border styles, unicode lines, and wide catalog inspection.',
  },
  {
    id: 'encoding_sqlstate_22p05',
    number: '14',
    title: 'Encoding, Character Sets & SQLSTATE 22P05',
    shortTitle: 'Encoding & 22P05',
    category: 'Terminal & Encoding',
    tagline: 'Client vs server encoding mismatches, byte validation, untranslatable_character error cascades.',
  },
  {
    id: 'reproducible_scripts',
    number: '15',
    title: 'Reproducible Benchmark Scripts & Playbook',
    shortTitle: 'Benchmark Scripts',
    category: 'Overview & Scripts',
    tagline: 'Ready-to-run pgbench, psql, and Docker scripts to reproduce every single bottleneck on real Postgres instances.',
    badge: 'Copy & Run',
  },
];

export const C_SOURCE_EXCERPTS = {
  proc_h: `/*
 * src/include/storage/proc.h
 *
 * Each backend process (PGPROC) has a fixed-size in-memory array
 * to cache up to PGPROC_MAX_CACHED_SUBXIDS active subtransactions.
 */
#define PGPROC_MAX_CACHED_SUBXIDS 64

typedef struct PGPROC
{
    /* ... other fields ... */
    TransactionId xid;              /* top-level transaction ID, or InvalidTransactionId */
    
    /* Subtransaction cache */
    struct
    {
        int             count;      /* number of valid entries in subxids[] */
        bool            overflowed; /* TRUE if cache exceeded PGPROC_MAX_CACHED_SUBXIDS */
        TransactionId   xids[PGPROC_MAX_CACHED_SUBXIDS];
    } subxids;
} PGPROC;`,

  subtrans_c: `/*
 * src/backend/access/transam/subtrans.c
 *
 * SubTransGetTopmostTransaction() walks the parent pointers stored in
 * pg_subtrans SLRU pages until finding the root parent XID.
 */
TransactionId
SubTransGetTopmostTransaction(TransactionId xid)
{
    TransactionId parentXid = xid;
    TransactionId previousXid = xid;

    /* Loop until we reach the root top-level transaction */
    while (TransactionIdIsValid(parentXid))
    {
        previousXid = parentXid;
        if (SubTransGetParent(parentXid, &parentXid))
            continue;
        break;
    }

    return previousXid;
}

/*
 * Reading a page from pg_subtrans requires acquiring SubtransSLRULock
 * (or SubtransControlLock) in shared mode.
 */
static int
SubTransGetParent(TransactionId xid, TransactionId *parent)
{
    int         pageno = TransactionIdToPage(xid);   /* xid / 2048 */
    int         entryno = TransactionIdToEntry(xid);  /* xid % 2048 */
    int         slotno;
    TransactionId *ptr;

    /* Heavy lock acquisition on SLRU buffer pool */
    slotno = SimpleLruReadPage(SubTransCtl, pageno, true, xid);
    ptr = (TransactionId *) SubTransCtl->shared->page_buffer[slotno];
    ptr += entryno;
    *parent = *ptr;

    return TransactionIdIsValid(*parent);
}`,

  slru_c: `/*
 * src/backend/access/transam/slru.c
 *
 * In PostgreSQL 16 and earlier:
 * NUM_SUBTRANS_BUFFERS = 32 (hardcoded 32 * 8KB = 256KB).
 *
 * In PostgreSQL 17+:
 * Configurable via subtrans_buffers (default auto-sized or up to 8192).
 */
int
SimpleLruReadPage(SlruCtl ctl, int pageno, bool write_ok, TransactionId xid)
{
    /* 1. Acquire ControlLock */
    LWLockAcquire(ctl->shared->ControlLock, LW_SHARED);

    /* 2. Check if page is already in SLRU cache buffers */
    for (int slotno = 0; slotno < ctl->shared->num_buffers; slotno++)
    {
        if (ctl->shared->page_number[slotno] == pageno &&
            ctl->shared->page_status[slotno] != SLRU_PAGE_EMPTY)
        {
            /* Cache HIT - update LRU counter and release lock */
            ctl->shared->page_lru_count[slotno] = ++ctl->shared->cur_lru_count;
            LWLockRelease(ctl->shared->ControlLock);
            return slotno;
        }
    }

    /* Cache MISS: Upgrade to exclusive lock to evict & read from disk */
    LWLockRelease(ctl->shared->ControlLock);
    LWLockAcquire(ctl->shared->ControlLock, LW_EXCLUSIVE);
    
    /* Find victim buffer (lowest LRU count) and flush if dirty */
    /* Read 8KB page from pg_subtrans disk file into victim buffer */
    /* ... */
}`,

  running_xacts_h: `/*
 * src/include/access/transam/xloginsert.h & standby.h
 *
 * xl_running_xacts is written into WAL periodically by Checkpointer
 * or WalWriter for Hot Standby snapshot reconstruction.
 */
typedef struct xl_running_xacts
{
    int         xcnt;              /* # of active top-level transaction IDs */
    int         subxcnt;           /* # of subtransaction IDs */
    bool        subxid_overflow;   /* TRUE if ANY active proc overflowed 64 subxacts */
    TransactionId nextXid;         /* next XID to be assigned */
    TransactionId oldestRunningXid;/* oldest active XID */
    TransactionId latestCompletedXid;
    
    TransactionId xids[FLEXIBLE_ARRAY_MEMBER]; /* top XIDs followed by subXIDs */
} xl_running_xacts;`,
};

export const REPRODUCIBLE_BENCHMARK_SCRIPTS = {
  anti_pattern_plpgsql: `-- ============================================================================
-- ANTI-PATTERN: Row-by-Row PL/pgSQL Exception Handling (Subtransaction Storm)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_events (
    event_id BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    idempotency_key UUID UNIQUE NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Anti-pattern function: 10,000 subtransactions per batch call!
CREATE OR REPLACE FUNCTION ingest_events_bad(p_events JSONB)
RETURNS INT AS $$
DECLARE
    v_item JSONB;
    v_inserted INT := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        BEGIN
            -- Each iteration creates an implicit SAVEPOINT
            -- Executing DML consumes an XID and records in pg_subtrans
            INSERT INTO customer_events(customer_id, idempotency_key, payload)
            VALUES (
                (v_item->>'customer_id')::INT,
                (v_item->>'idempotency_key')::UUID,
                v_item
            );
            v_inserted := v_inserted + 1;
        EXCEPTION
            WHEN unique_violation THEN
                -- Catch duplicate and swallow.
                -- Causes subxid overflow after 64 iterations!
                NULL;
            WHEN others THEN
                RAISE WARNING 'Unexpected error on item %: %', v_item, SQLERRM;
        END;
    END LOOP;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;`,

  optimized_batch_sql: `-- ============================================================================
-- OPTIMIZATION 1: Set-based ON CONFLICT (0 Subtransactions, 1 XID)
-- ============================================================================
CREATE OR REPLACE FUNCTION ingest_events_fast(p_events JSONB)
RETURNS INT AS $$
DECLARE
    v_inserted INT;
BEGIN
    WITH raw_data AS (
        SELECT 
            (x->>'customer_id')::INT AS customer_id,
            (x->>'idempotency_key')::UUID AS idempotency_key,
            x AS payload
        FROM jsonb_array_elements(p_events) AS x
    ),
    ins AS (
        INSERT INTO customer_events(customer_id, idempotency_key, payload)
        SELECT customer_id, idempotency_key, payload
        FROM raw_data
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_inserted FROM ins;
    
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;`,

  pgbench_stress_script: `#!/usr/bin/env bash
# ============================================================================
# Reproducible pgbench stress test demonstrating SubtransSLRULock collapse
# ============================================================================

cat << 'EOF' > /tmp/bad_subxact.sql
\\set cid random(1, 100000)
DO $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..250 LOOP
        BEGIN
            INSERT INTO customer_events (customer_id, idempotency_key, payload)
            VALUES (
                :cid,
                gen_random_uuid(),
                '{"test": true}'::jsonb
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END;
$$;
EOF

cat << 'EOF' > /tmp/innocent_reader.sql
SELECT count(*) FROM customer_events WHERE customer_id = random(1, 100000);
EOF

echo "==> Running 40 concurrent sessions (35 readers, 5 subxact writers)..."
# In PostgreSQL <= 16 with 32 SLRU buffers: Readers will experience heavy SubtransSLRULock waits!
# Monitor with: SELECT wait_event_type, wait_event, count(*) FROM pg_stat_activity GROUP BY 1,2;
`,

  pg17_conf_tuning: `# ============================================================================
# PostgreSQL 17+ SLRU Buffer Tuning in postgresql.conf
# ============================================================================
# In PG 16 and older: fixed at 32 buffers (256 KB)
# In PG 17+: Configurable!

# Subtransaction SLRU buffers (default auto: ~128 to 2048 depending on shared_buffers)
subtrans_buffers = 1024         # 1024 * 8KB = 8 MB cache for subxact parent pointers

# MultiXact SLRU buffers
multixact_offsets_buffers = 256 # 2 MB
multixact_members_buffers = 1024 # 8 MB

# Transaction status (commit log) buffers
xact_buffers = 1024            # 8 MB

# Commit timestamp buffers (if track_commit_timestamp = on)
commit_timestamp_buffers = 128
`,
};
