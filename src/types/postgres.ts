export type InvestigationModuleId =
  | 'overview'
  | 'unreleased_scaffold'
  | 'source_verification'
  | 'diagnostic_sql'
  | 'experimental_harness'
  | 'plpgsql_exceptions'
  | 'xid_subtransactions'
  | 'pgproc_overflow'
  | 'pg_subtrans_slru'
  | 'multixact_pressure'
  | 'pg17_slru_sizing'
  | 'concurrency_contention'
  | 'running_xacts_wal'
  | 'hot_standby_lag'
  | 'psql_width_alignment'
  | 'encoding_sqlstate_22p05'
  | 'reproducible_scripts';

export interface ModuleMetadata {
  id: InvestigationModuleId;
  number: number | string;
  title: string;
  shortTitle: string;
  category: 'Unreleased Pillars' | 'Core Subtransactions' | 'SLRU & MultiXact' | 'Concurrency & Standby' | 'Terminal & Encoding' | 'Overview & Scripts';
  tagline: string;
  badge?: string;
}

export interface SourceVerificationDoc {
  id: string;
  subsystem: 'Memory / PGPROC' | 'Storage / SLRU' | 'Lock Manager / MultiXact' | 'WAL / Replication' | 'Client / Encoding / Formatting';
  sourceFile: string;
  sourceFunctionOrStruct: string;
  cCode: string;
  summary: string;
  invariants: string[];
  mechanicsWalkthrough: string[];
  failureModes: string[];
  versionSpecifics: string;
}

export interface DiagnosticQuery {
  id: string;
  title: string;
  category: 'SLRU I/O & Buffers' | 'Subtransactions & Locks' | 'MultiXact & Wraparound' | 'Hot Standby & WAL' | 'Server GUCs & Configuration';
  targetVersion: string;
  sql: string;
  description: string;
  whyItMatters: string;
  columnsExplained: { name: string; type: string; meaning: string }[];
  alertCondition?: string;
  recommendedAction: string;
  sampleOutput: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
  };
}

export interface ExperimentalScenario {
  id: string;
  title: string;
  subsystem: string;
  description: string;
  workloadType: 'Subtransaction Storm' | 'MultiXact Contention' | 'SLRU Thrashing' | 'Replication Stall';
  setupSql: string;
  pgbenchScript: string;
  perfCommand: string;
  expectedBehaviorPg16: string;
  expectedBehaviorPg17: string;
  mitigationCode: string;
}

export interface UnreleasedMilestone {
  id: string;
  title: string;
  shortDescription: string;
  status: 'Complete' | 'Verified' | 'Interactive';
  deliverables: string[];
  linkedModuleId: InvestigationModuleId;
}

export interface SubtransactionNode {
  subxid: number;
  subtransId: number;
  parentXid: number;
  isReadWrite: boolean;
  savepointName: string;
  status: 'active' | 'committed' | 'aborted';
  depth: number;
  assignedPage: number;
  pageOffset: number;
  inPgProcCache: boolean;
}

export interface PgProcState {
  pid: number;
  xid: number;
  cachedSubxids: number[];
  overflowed: boolean;
  maxCachedLimit: number;
  activeSubxactCount: number;
}

export interface SlruBufferDescriptor {
  bufferId: number;
  pageNumber: number;
  isDirty: boolean;
  lruCount: number;
  ioInProgress: boolean;
  isLocked: boolean;
  lockedByPid?: number;
  slotEntriesCount: number;
}

export interface SlruCacheMetrics {
  totalBuffers: number;
  bufferHits: number;
  bufferMisses: number;
  diskReads: number;
  diskWrites: number;
  lockWaitMicroseconds: number;
  evictions: number;
  hitRatio: number;
}

export interface MultiXactMember {
  xid: number;
  lockMode: 'FOR SHARE' | 'FOR KEY SHARE' | 'FOR NO KEY UPDATE' | 'FOR UPDATE';
  status: 'active' | 'committed' | 'aborted';
}

export interface MultiXactEntry {
  multiXactId: number;
  offset: number;
  members: MultiXactMember[];
  pageOffset: number;
  membersPage: number;
}

export interface ConcurrencyMetricsPoint {
  timeSeconds: number;
  tps: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  slruLockWaitCount: number;
  cpuSysPercent: number;
  activeSessions: number;
  overflowSessions: number;
}

export interface RunningXactsWalRecord {
  lsn: string;
  xcnt: number;
  subxcnt: number;
  subxid_overflow: boolean;
  nextXid: number;
  oldestRunningXid: number;
  latestCompletedXid: number;
  activeTopXids: number[];
  cachedSubXids: number[];
  recordSizeBytes: number;
}

export interface StandbyState {
  primaryCurrentLsn: string;
  standbyReplayLsn: string;
  lagBytes: number;
  lagMilliseconds: number;
  isSnapshotValid: boolean;
  snapshotState: 'ready' | 'stalled_on_overflow' | 'recovering';
  stalledQueriesCount: number;
  maxStandbyDelayRemainingSec: number;
}

export interface PsqlQueryResult {
  command: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  executionTimeMs: number;
  notice?: string;
}

export interface EncodingConversionTest {
  inputString: string;
  inputBytesHex: string;
  sourceEncoding: string;
  targetEncoding: string;
  isValid: boolean;
  errorMessage?: string;
  sqlState?: string;
  convertedString?: string;
  sanitizedHex?: string;
}
