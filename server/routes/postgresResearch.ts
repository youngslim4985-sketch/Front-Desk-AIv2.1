import { Router, Request, Response } from 'express';

export const postgresResearchRouter = Router();

// 1. Simulate Subtransaction Tree & PGPROC Cache State
postgresResearchRouter.post('/simulate-subxacts', (req: Request, res: Response) => {
  const {
    count = 100,
    isReadWrite = true,
    initialXid = 1000000,
    pgProcCacheLimit = 64,
  } = req.body;

  const total = Math.min(Math.max(Number(count) || 10, 1), 2000);
  const nodes = [];
  const cachedSubxids: number[] = [];
  let overflowed = false;
  let currentXid = Number(initialXid);

  for (let i = 1; i <= total; i++) {
    const subxid = isReadWrite ? currentXid + i : 0;
    const assignedPage = Math.floor((isReadWrite ? subxid : i) / 2048);
    const pageOffset = ((isReadWrite ? subxid : i) % 2048) * 4;

    const inCache = i <= pgProcCacheLimit;
    if (inCache && isReadWrite) {
      cachedSubxids.push(subxid);
    } else if (i > pgProcCacheLimit && isReadWrite) {
      overflowed = true;
    }

    nodes.push({
      subxid: isReadWrite ? subxid : `SubXact-${i} (No XID)`,
      subtransId: i,
      parentXid: i === 1 ? currentXid : (isReadWrite ? currentXid + i - 1 : `SubXact-${i - 1}`),
      isReadWrite,
      savepointName: `sp_${i}`,
      status: i % 17 === 0 ? 'aborted' : 'committed',
      depth: (i % 8) + 1,
      assignedPage,
      pageOffset,
      inPgProcCache: inCache,
    });
  }

  res.json({
    topLevelXid: currentXid,
    subxactCount: total,
    isReadWrite,
    pgProc: {
      pid: 48192,
      xid: currentXid,
      cachedSubxids,
      overflowed,
      maxCachedLimit: pgProcCacheLimit,
      activeSubxactCount: total,
    },
    sampleNodes: nodes.slice(0, 120),
    stats: {
      overflowed,
      fastPathLookupsPossible: !overflowed,
      slruLookupsRequired: overflowed,
      totalXidsConsumed: isReadWrite ? total : 0,
      subtransPagesRequired: Math.ceil(total / 2048) || 1,
    },
  });
});

// 2. SLRU Cache Simulation
postgresResearchRouter.post('/simulate-slru', (req: Request, res: Response) => {
  const {
    bufferCount = 32, // e.g. 32 in PG16 vs 1024 in PG17
    lookups = 500,
    distinctPages = 150,
    concurrency = 16,
  } = req.body;

  const numBuffers = Math.max(8, Math.min(Number(bufferCount) || 32, 2048));
  const numLookups = Math.max(50, Math.min(Number(lookups) || 500, 5000));
  const pagesRange = Math.max(10, Math.min(Number(distinctPages) || 150, 5000));

  // Initialize simulated SLRU buffer pool
  const buffers = Array.from({ length: numBuffers }, (_, i) => ({
    bufferId: i,
    pageNumber: -1,
    isDirty: false,
    lruCount: 0,
    ioInProgress: false,
    isLocked: false,
    slotEntriesCount: 0,
  }));

  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let diskReads = 0;
  let diskWrites = 0;
  let lockWaitMicroseconds = 0;
  let lruTick = 0;

  for (let i = 0; i < numLookups; i++) {
    // Skewed Zipfian-style distribution
    const pageToFind = Math.floor(Math.pow(Math.random(), 2) * pagesRange);
    lruTick++;

    // Find in buffers
    const existingIndex = buffers.findIndex((b) => b.pageNumber === pageToFind);

    if (existingIndex !== -1) {
      // Hit!
      hits++;
      buffers[existingIndex].lruCount = lruTick;
      // Slight lock wait for shared ControlLock under concurrency
      lockWaitMicroseconds += Math.random() * (concurrency > 10 ? 12 : 2);
    } else {
      // Miss! Needs exclusive lock + victim selection
      misses++;
      diskReads++;
      lockWaitMicroseconds += Math.random() * (concurrency * 85) + 40;

      // Find victim (lowest lruCount or empty)
      let victimIndex = buffers.findIndex((b) => b.pageNumber === -1);
      if (victimIndex === -1) {
        let minLru = Infinity;
        victimIndex = 0;
        for (let b = 0; b < buffers.length; b++) {
          if (buffers[b].lruCount < minLru) {
            minLru = buffers[b].lruCount;
            victimIndex = b;
          }
        }
        evictions++;
        if (buffers[victimIndex].isDirty) {
          diskWrites++;
        }
      }

      buffers[victimIndex].pageNumber = pageToFind;
      buffers[victimIndex].isDirty = Math.random() < 0.25;
      buffers[victimIndex].lruCount = lruTick;
      buffers[victimIndex].slotEntriesCount = Math.floor(Math.random() * 1500) + 200;
    }
  }

  const hitRatio = Number(((hits / numLookups) * 100).toFixed(2));

  res.json({
    bufferCount: numBuffers,
    lookups: numLookups,
    metrics: {
      totalBuffers: numBuffers,
      bufferHits: hits,
      bufferMisses: misses,
      diskReads,
      diskWrites,
      lockWaitMicroseconds: Math.round(lockWaitMicroseconds),
      evictions,
      hitRatio,
    },
    buffers: buffers.slice(0, 64),
  });
});

// 3. Concurrency Stress Test Simulation
postgresResearchRouter.post('/simulate-concurrency', (req: Request, res: Response) => {
  const {
    readersCount = 30,
    subxactWritersCount = 5,
    subxactsPerBatch = 200,
    pgVersion = 16,
    durationSteps = 20,
  } = req.body;

  const readers = Number(readersCount) || 30;
  const writers = Number(subxactWritersCount) || 5;
  const subxacts = Number(subxactsPerBatch) || 200;
  const version = Number(pgVersion) || 16;
  const isPg17 = version >= 17;

  const points = [];
  const hasOverflow = subxacts > 64 && writers > 0;

  for (let t = 1; t <= Number(durationSteps); t++) {
    // Base healthy throughput
    const baseHealthyTps = readers * 350 + writers * 45;
    
    // Contention penalty factor
    let tps = baseHealthyTps;
    let p50 = 1.2;
    let p95 = 4.5;
    let p99 = 8.0;
    let slruLockWaits = 0;
    let cpuSys = 8;

    if (hasOverflow) {
      if (!isPg17) {
        // PG <= 16 with 32 buffers: catastrophic collapse
        const severity = Math.min((writers * subxacts) / 100, 30);
        tps = Math.max(baseHealthyTps / (1 + severity * 1.8) + (Math.random() * 20 - 10), 35);
        p50 = 12 + severity * 4;
        p95 = 65 + severity * 18;
        p99 = 220 + severity * 45;
        slruLockWaits = Math.round(writers * subxacts * (12 + Math.random() * 8));
        cpuSys = Math.min(55 + severity * 1.2, 92);
      } else {
        // PG 17+ with 1024 buffers: buffer hit ratio stays high, lock contention is much milder
        const severity = Math.min((writers * subxacts) / 1000, 5);
        tps = Math.max(baseHealthyTps / (1 + severity * 0.25) + (Math.random() * 50 - 25), 4500);
        p50 = 1.8 + severity * 0.4;
        p95 = 6.2 + severity * 1.1;
        p99 = 15.0 + severity * 2.5;
        slruLockWaits = Math.round(writers * (subxacts / 10) * (1.5 + Math.random()));
        cpuSys = 14 + severity * 1.5;
      }
    }

    points.push({
      timeSeconds: t * 2,
      tps: Math.round(tps),
      p50LatencyMs: Number(p50.toFixed(2)),
      p95LatencyMs: Number(p95.toFixed(2)),
      p99LatencyMs: Number(p99.toFixed(2)),
      slruLockWaitCount: slruLockWaits,
      cpuSysPercent: Number(cpuSys.toFixed(1)),
      activeSessions: readers + writers,
      overflowSessions: hasOverflow ? writers : 0,
    });
  }

  res.json({
    config: {
      readersCount: readers,
      subxactWritersCount: writers,
      subxactsPerBatch: subxacts,
      pgVersion: version,
      hasOverflow,
    },
    timeseries: points,
    summary: {
      avgTps: Math.round(points.reduce((acc, p) => acc + p.tps, 0) / points.length),
      avgP99Latency: Number((points.reduce((acc, p) => acc + p.p99LatencyMs, 0) / points.length).toFixed(2)),
      totalSlruWaits: points.reduce((acc, p) => acc + p.slruLockWaitCount, 0),
    },
  });
});

// 4. MultiXact Metadata Simulation
postgresResearchRouter.post('/simulate-multixact', (req: Request, res: Response) => {
  const {
    concurrentLockers = 4,
    rowKey = 'customer_record_9482',
    lockTypes = ['FOR SHARE', 'FOR KEY SHARE', 'FOR SHARE'],
  } = req.body;

  const membersCount = Math.max(2, Math.min(Number(concurrentLockers) || 4, 32));
  const multiXactId = 184920;
  const offset = 4820;

  const members = Array.from({ length: membersCount }, (_, i) => ({
    xid: 104000 + i * 3,
    lockMode: (lockTypes[i % lockTypes.length] || 'FOR SHARE') as any,
    status: 'active' as const,
  }));

  const offsetsPage = Math.floor(multiXactId / (8192 / 4));
  const membersPage = Math.floor(offset / (8192 / 8));

  res.json({
    rowKey,
    multiXactId,
    offset,
    offsetsPage,
    membersPage,
    members,
    xminXmaxInfo: {
      tupleHeader: 'HEAP_XMAX_IS_MULTI | HEAP_KEYS_UPDATED',
      xmaxRawValue: multiXactId,
      explanation: 'Tuple header xmax points to MultiXactId 184920 instead of a single XID. Readers must inspect pg_multixact/members to evaluate visibility.',
    },
    risks: {
      wraparoundDistance: 2147483648 - multiXactId,
      freezeMaxAge: 400000000,
      slruContentionRisk: membersCount > 10 ? 'HIGH (MultiXactMemberControlLock)' : 'MODERATE',
    },
  });
});

// 5. Encoding & SQLSTATE 22P05 Tester
postgresResearchRouter.post('/test-encoding', (req: Request, res: Response) => {
  const {
    inputString = 'Alex M\u00f6ller \x80 Invalid \x00',
    sourceEncoding = 'UTF-8',
    targetEncoding = 'LATIN1',
  } = req.body;

  const rawStr = String(inputString || '');
  let isValid = true;
  let sqlState: string | undefined = undefined;
  let errorMessage: string | undefined = undefined;
  let sanitizedHex = '';

  const hexBytes = Array.from(Buffer.from(rawStr, 'utf-8'))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  // Test null byte rejection in postgres text
  if (rawStr.includes('\0') || rawStr.includes('\\0') || rawStr.includes('\\x00')) {
    isValid = false;
    sqlState = '22021';
    errorMessage = 'ERROR: invalid byte sequence for encoding "UTF8": 0x00 (SQLSTATE 22021 - character not in repertoire)';
  } else if (rawStr.includes('\x80') || rawStr.includes('€') && targetEncoding === 'LATIN1') {
    isValid = false;
    sqlState = '22P05';
    errorMessage = `ERROR: character with byte sequence 0xe2 0x82 0xac in encoding "UTF8" has no equivalent in encoding "${targetEncoding}" (SQLSTATE 22P05 - untranslatable_character)`;
  }

  // Sanitization
  const cleaned = rawStr.replace(/\0/g, '').replace(/[\x80-\xFF]/g, (ch) => `?`);
  sanitizedHex = Array.from(Buffer.from(cleaned, 'utf-8'))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  res.json({
    inputString: rawStr,
    inputBytesHex: hexBytes,
    sourceEncoding,
    targetEncoding,
    isValid,
    sqlState,
    errorMessage,
    convertedString: isValid ? rawStr : undefined,
    sanitizedString: cleaned,
    sanitizedHex,
    remediation: [
      'Use convert_from(decode(..., \'hex\'), \'UTF-8\') with NULL byte strip',
      'Validate client encoding using SHOW client_encoding; SET client_encoding = \'UTF8\';',
      'Pre-sanitize row-by-row batch streams before invoking PL/pgSQL savepoints to avoid triggering exception handlers and subxact cascades.',
    ],
  });
});

// 6. Interactive psql Command Simulator
postgresResearchRouter.post('/psql-exec', (req: Request, res: Response) => {
  const { command = 'SELECT * FROM pg_stat_slru;' } = req.body;
  const trimmed = String(command || '').trim();

  const startTime = Date.now();

  if (trimmed.toLowerCase().includes('pg_stat_slru')) {
    res.json({
      command: trimmed,
      columns: ['name', 'blks_zeroed', 'blks_hit', 'blks_read', 'blks_written', 'blks_exists', 'flushes', 'truncates'],
      rows: [
        ['subtrans', 42, 948201, 84210, 1940, 12, 104, 88],
        ['multixact_members', 18, 482100, 29100, 410, 4, 32, 12],
        ['multixact_offsets', 8, 510920, 14200, 120, 2, 16, 12],
        ['clog', 120, 4820194, 3940, 12840, 84, 840, 4],
        ['commit_timestamp', 0, 0, 0, 0, 0, 0, 0],
      ],
      rowCount: 5,
      executionTimeMs: 1.42,
      notice: 'SLRU statistics from pg_stat_slru system view.',
    });
    return;
  }

  if (trimmed.toLowerCase().includes('pg_stat_activity') || trimmed.toLowerCase().includes('wait_event')) {
    res.json({
      command: trimmed,
      columns: ['pid', 'usename', 'application_name', 'wait_event_type', 'wait_event', 'state', 'query_sample'],
      rows: [
        [48102, 'app_worker', 'batch_ingest', 'LWLock', 'SubtransSLRULock', 'active', 'INSERT INTO customer_events...'],
        [48103, 'app_worker', 'batch_ingest', 'LWLock', 'SubtransControlLock', 'active', 'INSERT INTO customer_events...'],
        [48104, 'app_reader', 'analytics_svc', 'LWLock', 'SubtransSLRULock', 'active', 'SELECT count(*) FROM customer_events WHERE...'],
        [48105, 'app_reader', 'web_api', 'LWLock', 'SubtransSLRULock', 'active', 'SELECT * FROM accounts WHERE id = 4920...'],
        [48106, 'postgres', 'psql', 'None', null, 'active', 'SELECT pid, wait_event_type, wait_event FROM pg_stat_activity...'],
      ],
      rowCount: 5,
      executionTimeMs: 2.15,
      notice: 'Demonstrating SubtransSLRULock lock convoying across active sessions.',
    });
    return;
  }

  if (trimmed.toLowerCase().includes('show subtrans_buffers') || trimmed.toLowerCase().includes('show')) {
    res.json({
      command: trimmed,
      columns: ['name', 'setting', 'unit', 'description'],
      rows: [
        ['subtrans_buffers', '1024', '8kB', 'Sets the number of shared memory buffers for subtransactions (PostgreSQL 17+).'],
        ['multixact_members_buffers', '512', '8kB', 'Sets the number of shared memory buffers for MultiXact members.'],
        ['multixact_offsets_buffers', '256', '8kB', 'Sets the number of shared memory buffers for MultiXact offsets.'],
        ['shared_buffers', '16384', '8kB', 'Sets the number of shared memory buffers used by the database server.'],
      ],
      rowCount: 4,
      executionTimeMs: 0.85,
    });
    return;
  }

  // Default generic query result
  res.json({
    command: trimmed,
    columns: ['schemaname', 'relname', 'seq_scan', 'seq_tup_read', 'idx_scan', 'n_tup_ins', 'n_tup_upd', 'n_tup_del'],
    rows: [
      ['public', 'customer_events', 142, 894020, 482019, 120400, 4200, 0],
      ['public', 'orders', 42, 184000, 892014, 54200, 8900, 120],
      ['public', 'accounts', 12, 42000, 1948200, 1200, 3400, 0],
    ],
    rowCount: 3,
    executionTimeMs: Number((Date.now() - startTime + Math.random() * 3 + 1).toFixed(2)),
  });
});
