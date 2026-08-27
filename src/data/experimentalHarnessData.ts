import { ExperimentalScenario } from '../types/postgres';

export const EXPERIMENTAL_SCENARIOS: ExperimentalScenario[] = [
  {
    id: 'scenario_subxact_storm',
    title: 'Row-by-Row Exception Storm vs Batch Staging',
    subsystem: 'Subtransactions & SLRU (pg_subtrans)',
    workloadType: 'Subtransaction Storm',
    description: 'Compares a loop creating 250 nested subtransactions per transaction against a set-based INSERT ... ON CONFLICT DO NOTHING batch.',
    setupSql: `CREATE TABLE IF NOT EXISTS benchmark_events (
    id BIGSERIAL PRIMARY KEY,
    batch_id INT NOT NULL,
    dedup_uuid UUID UNIQUE NOT NULL,
    payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_bench_batch ON benchmark_events(batch_id);`,
    pgbenchScript: `\\set bid random(1, 10000)
-- Workload A: Anti-pattern loop creating 250 subxacts
DO $$
DECLARE i INT;
BEGIN
    FOR i IN 1..250 LOOP
        BEGIN
            INSERT INTO benchmark_events (batch_id, dedup_uuid, payload)
            VALUES (:bid, gen_random_uuid(), '{"status": "queued"}'::jsonb);
        EXCEPTION WHEN unique_violation THEN
            NULL;
        END;
    END LOOP;
END;
$$;`,
    perfCommand: `sudo perf record -g -F 99 -p $(pgrep -f "postgres:.*benchmark") -- sleep 15
sudo perf report -n --stdio | grep -E "SubTrans|LWLock|SimpleLru"`,
    expectedBehaviorPg16: 'TPS drops from 8,500 to ~140 TPS when concurrency exceeds 20. 85%+ CPU spent in SubTransGetTopmostTransaction and spinlocks.',
    expectedBehaviorPg17: 'With subtrans_buffers = 1024, cache misses drop significantly, achieving ~1,400 TPS (10x improvement over PG 16, though set-based is still 10x faster).',
    mitigationCode: `-- Mitigation: Single transaction, 0 subtransactions, 1 XID
INSERT INTO benchmark_events (batch_id, dedup_uuid, payload)
SELECT :bid, gen_random_uuid(), '{"status": "queued"}'::jsonb
FROM generate_series(1, 250)
ON CONFLICT (dedup_uuid) DO NOTHING;`,
  },
  {
    id: 'scenario_multixact_contention',
    title: 'Concurrent SELECT FOR SHARE Row-Lock Flooding',
    subsystem: 'MultiXact Engine (pg_multixact/members)',
    workloadType: 'MultiXact Contention',
    description: 'Drives 50 concurrent transactions locking the same parent records with SELECT FOR SHARE (simulating high-frequency foreign key validations).',
    setupSql: `CREATE TABLE IF NOT EXISTS parent_accounts (
    account_id INT PRIMARY KEY,
    account_name TEXT,
    balance NUMERIC(14,2)
);
INSERT INTO parent_accounts (account_id, account_name, balance)
SELECT i, 'Account ' || i, 1000.00 FROM generate_series(1, 100) i
ON CONFLICT (account_id) DO NOTHING;`,
    pgbenchScript: `\\set aid random(1, 20)
BEGIN;
SELECT balance FROM parent_accounts WHERE account_id = :aid FOR SHARE;
-- Hold lock for small simulated work
SELECT pg_sleep(0.005);
COMMIT;`,
    perfCommand: `sudo perf top -p $(pgrep -d',' -f "postgres:") --sort dso,symbol`,
    expectedBehaviorPg16: 'Heavy contention on MultiXactMemberControlLock with 32 fixed SLRU buffers. P99 latency spikes above 450ms.',
    expectedBehaviorPg17: 'With multixact_members_buffers = 1024, MultiXactMemberControlLock wait time decreases by 78%, keeping P99 latency under 45ms.',
    mitigationCode: `-- Mitigation: Use FOR KEY SHARE instead of FOR SHARE if only checking keys, or reduce hold time
BEGIN;
SELECT balance FROM parent_accounts WHERE account_id = :aid FOR KEY SHARE;
COMMIT;`,
  },
  {
    id: 'scenario_standby_stall',
    title: 'Hot Standby Snapshot Lag Under WAL subxid_overflow',
    subsystem: 'WAL / Streaming Replication (xl_running_xacts)',
    workloadType: 'Replication Stall',
    description: 'Executes subtransaction batch writers on the primary while streaming replication feeds a read-heavy reporting replica.',
    setupSql: `-- On primary:
CREATE TABLE IF NOT EXISTS replication_telemetry (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);`,
    pgbenchScript: `-- Run on Primary with -c 10 -j 2 -T 60
DO $$
DECLARE i INT;
BEGIN
    FOR i IN 1..100 LOOP
        BEGIN
            INSERT INTO replication_telemetry DEFAULT VALUES;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END;
$$;`,
    perfCommand: `# On Replica: Monitor snapshot creation waits
SELECT confl_snapshot, confl_lock FROM pg_stat_database_conflicts;`,
    expectedBehaviorPg16: 'Primary WAL writes xl_running_xacts with subxid_overflow = true. Replica read queries freeze waiting for next consistent snapshot, triggering query cancellations.',
    expectedBehaviorPg17: 'Same architectural WAL behavior: WAL record format remains strict. Resolution requires query rewriting on the primary to avoid subtransaction overflow.',
    mitigationCode: `-- Tune Replica postgresql.conf:
max_standby_streaming_delay = 30s
hot_standby_feedback = on`,
  },
];

export const DOCKER_COMPOSE_HARNESS = `# ============================================================================
# Docker Compose: Multi-Version PostgreSQL Subtransaction Benchmark Lab
# Spins up PostgreSQL 15, 16, and 17dev side-by-side with Prometheus monitoring
# ============================================================================
version: '3.8'

services:
  postgres15_legacy:
    image: postgres:15-alpine
    container_name: pg15_slru_lab
    environment:
      POSTGRES_DB: research_lab
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    command: >
      postgres 
      -c shared_buffers=512MB 
      -c max_connections=150
      -c track_io_timing=on
      -c track_functions=all
    ports:
      - "5415:5432"

  postgres16_baseline:
    image: postgres:16-alpine
    container_name: pg16_slru_lab
    environment:
      POSTGRES_DB: research_lab
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    command: >
      postgres 
      -c shared_buffers=512MB 
      -c max_connections=150
      -c track_io_timing=on
    ports:
      - "5416:5432"

  postgres17_optimized:
    image: postgres:17-alpine
    container_name: pg17_slru_lab
    environment:
      POSTGRES_DB: research_lab
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    command: >
      postgres 
      -c shared_buffers=512MB 
      -c max_connections=150
      -c subtrans_buffers=1024
      -c multixact_members_buffers=1024
      -c multixact_offsets_buffers=256
      -c track_io_timing=on
    ports:
      - "5417:5432"

  pgbench_runner:
    image: postgres:17-alpine
    container_name: pgbench_runner
    depends_on:
      - postgres16_baseline
      - postgres17_optimized
    entrypoint: ["/bin/sh", "-c", "echo 'pgbench container ready. Use docker exec to run benchmarks.' && sleep infinity"]
`;
