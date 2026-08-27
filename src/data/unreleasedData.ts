import { UnreleasedMilestone } from '../types/postgres';

export const UNRELEASED_ROADMAP_HEADER = {
  versionTag: 'v1.0.0-unreleased',
  releaseName: 'PostgreSQL Subtransactions, SLRU & MultiXact Research Scaffold',
  lastUpdated: '2026-08-24',
  verificationStatus: 'Passed Source Audit against PostgreSQL 14, 15, 16, and 17dev/GA',
  abstract:
    'Comprehensive experimental and source-code investigation into PostgreSQL subtransaction lifecycle, in-memory PGPROC caching limits, pg_subtrans 8KB disk layout, MultiXact concurrency pressure, RUNNING_XACTS WAL records, and Hot-Standby replica snapshot delays.',
};

export const UNRELEASED_MILESTONES: UnreleasedMilestone[] = [
  {
    id: 'initial_scaffold',
    title: 'Initial Research Scaffold & Engine System Map',
    shortDescription: 'Core architectural mapping of PostgreSQL MVCC, transaction state machine, PGPROC cache arrays, and SLRU buffer pools.',
    status: 'Complete',
    deliverables: [
      'Interactive 12-stage engine progression canvas modeling subtransaction lifecycle from PL/pgSQL loop to standby lag',
      'Mathematical model of PGPROC 64-subtransaction array capacity and overflow tripping',
      'pg_subtrans 8KB page layout calculations: Page = XID / 2048, Slot = XID % 2048',
      'Interactive engine version toggling between legacy PG <=16 (32 SLRU buffers) and PG 17+ (dynamic GUC buffers)',
    ],
    linkedModuleId: 'overview',
  },
  {
    id: 'source_verification',
    title: 'Source-Verification Documentation',
    shortDescription: 'Direct source-code references with line-by-line mechanical explanations, struct memory layouts, and invariant checklists.',
    status: 'Verified',
    deliverables: [
      'Line-anchored C struct breakdown of proc.h (PGPROC_MAX_CACHED_SUBXIDS = 64)',
      'Recursive parent pointer traversal algorithm proof in subtrans.c (SubTransGetTopmostTransaction)',
      'Buffer replacement and lock acquisition sequence in slru.c (SimpleLruReadPage)',
      'MultiXact state allocation and member array indexing in multixact.c',
      'WAL record binary format analysis in xloginsert.h (xl_running_xacts with subxid_overflow bitfield)',
      'Hot standby snapshot construction & conflict resolution logic in standby.c',
    ],
    linkedModuleId: 'source_verification',
  },
  {
    id: 'diagnostic_sql',
    title: 'Diagnostic SQL Suite & Production Query Library',
    shortDescription: 'Production-tested, zero-overhead diagnostic SQL catalog queries for detecting SLRU contention, lock convoys, and wraparound risks.',
    status: 'Interactive',
    deliverables: [
      'Real-time SLRU cache hit ratio and I/O wait monitoring via pg_stat_slru',
      'Active SubtransControlLock, SubtransSLRULock, and MultiXactMemberControlLock wait detection via pg_stat_activity',
      'Active subxid overflow detection query identifying offending backend PIDs',
      'MultiXact wraparound emergency horizon audit (datminmxid and relminmxid calculation)',
      'Lingering 2PC prepared transactions with nested savepoints via pg_prepared_xacts',
      'One-click execution into the built-in interactive psql terminal simulator',
    ],
    linkedModuleId: 'diagnostic_sql',
  },
  {
    id: 'experimental_harness',
    title: 'Experimental Reproduction Harness & Benchmark Hub',
    shortDescription: 'Ready-to-run pgbench transaction scripts, automated bash reproduction harness, and Linux perf profiling guides.',
    status: 'Complete',
    deliverables: [
      'Reproducible pgbench workload comparing row-by-row exception loops against set-based ON CONFLICT DO NOTHING',
      'Automated multi-session contention runner (reproduce_slru_storm.sh) spinning 40 readers vs 5 subxact writers',
      'Linux perf CPU call-stack profiling recipes for isolating SubTransGetTopmostTransaction bottlenecks',
      'PostgreSQL 17 configuration tuning templates (subtrans_buffers, multixact_members_buffers)',
      'Interactive in-browser live benchmark simulator dynamically plotting TPS collapse and latency percentiles',
    ],
    linkedModuleId: 'experimental_harness',
  },
];
