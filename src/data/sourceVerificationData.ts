import { SourceVerificationDoc } from '../types/postgres';

export const SOURCE_VERIFICATION_DOCS: SourceVerificationDoc[] = [
  {
    id: 'proc_h_subxid_cache',
    subsystem: 'Memory / PGPROC',
    sourceFile: 'src/include/storage/proc.h',
    sourceFunctionOrStruct: 'struct PGPROC & PGPROC_MAX_CACHED_SUBXIDS',
    cCode: `/*
 * src/include/storage/proc.h
 * Line ~120 in PostgreSQL 14 - 17
 */
#define PGPROC_MAX_CACHED_SUBXIDS 64

typedef struct PGPROC
{
    /* ... process latch, wait status, lock queues ... */
    TransactionId xid;              /* top-level transaction ID, or InvalidTransactionId */
    
    /* Subtransaction cache */
    struct
    {
        int             count;      /* number of valid entries in subxids[] */
        bool            overflowed; /* TRUE if cache exceeded PGPROC_MAX_CACHED_SUBXIDS */
        TransactionId   xids[PGPROC_MAX_CACHED_SUBXIDS];
    } subxids;

    /* ... other fields ... */
} PGPROC;`,
    summary: 'Each connected backend process has a private PGPROC struct in shared memory with a fixed array of 64 TransactionIds. This allows other sessions to check transaction visibility without acquiring any shared SLRU locks.',
    invariants: [
      'Invariant 1: subxids.count <= 64 at all times.',
      'Invariant 2: When subxids.count == 64 and a 65th subxid is allocated, subxids.overflowed MUST be set to TRUE.',
      'Invariant 3: Once subxids.overflowed == TRUE, it remains TRUE until the entire top-level transaction completes (Commit/Abort).',
      'Invariant 4: If subxids.overflowed == FALSE, the linear scan of subxids.xids[] is guaranteed complete and authoritative.',
    ],
    mechanicsWalkthrough: [
      '1. A backend starts a transaction (top XID assigned).',
      '2. Inside the transaction, SAVEPOINT s1 or BEGIN ... EXCEPTION creates a subtransaction.',
      '3. Upon the first write (DML), SubTransAssignChild(xid, subxid) assigns a subxid.',
      '4. If subxids.count < 64: the subxid is appended to MyProc->subxids.xids[count++]. No SLRU lock is needed by readers examining snapshot visibility.',
      '5. If subxids.count == 64: MyProc->subxids.overflowed is set to TRUE. The subxid is written ONLY to pg_subtrans SLRU pages on disk/cache.',
    ],
    failureModes: [
      'Visibility Check Degradation: Any concurrent reader evaluating a tuple modified by an overflowed transaction CANNOT rely on MyProc->subxids.xids[] and must query pg_subtrans via SimpleLruReadPage().',
      'Lock Contention: Simultaneous readers acquire SubtransControlLock / SubtransSLRULock, causing severe lock convoying.',
    ],
    versionSpecifics: 'The hardcoded constant PGPROC_MAX_CACHED_SUBXIDS = 64 has remained unchanged from PostgreSQL 8.0 up through PostgreSQL 17 to preserve small cache-line footprint per PGPROC struct.',
  },
  {
    id: 'subtrans_c_traversal',
    subsystem: 'Storage / SLRU',
    sourceFile: 'src/backend/access/transam/subtrans.c',
    sourceFunctionOrStruct: 'SubTransGetTopmostTransaction() & SubTransGetParent()',
    cCode: `/*
 * src/backend/access/transam/subtrans.c
 */
#define SUBTRANS_XACTS_PER_PAGE (BLCKSZ / sizeof(TransactionId)) /* 8192 / 4 = 2048 */

#define TransactionIdToPage(xid)    ((xid) / (TransactionId) SUBTRANS_XACTS_PER_PAGE)
#define TransactionIdToEntry(xid)   ((xid) % (TransactionId) SUBTRANS_XACTS_PER_PAGE)

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

static int
SubTransGetParent(TransactionId xid, TransactionId *parent)
{
    int         pageno = TransactionIdToPage(xid);
    int         entryno = TransactionIdToEntry(xid);
    int         slotno;
    TransactionId *ptr;

    /* Lock the SLRU buffer pool (SubtransControlLock in shared mode) */
    slotno = SimpleLruReadPage(SubTransCtl, pageno, true, xid);
    ptr = (TransactionId *) SubTransCtl->shared->page_buffer[slotno];
    ptr += entryno;
    *parent = *ptr;

    return TransactionIdIsValid(*parent);
}`,
    summary: 'The pg_subtrans engine maintains an array of parent XID pointers. Because each 8KB page stores 2048 4-byte TransactionIds, resolving a deeply nested subtransaction requires recursively following pointers through SLRU buffer pages.',
    invariants: [
      'Invariant 1: For any top-level transaction XID, its entry in pg_subtrans is InvalidTransactionId (0).',
      'Invariant 2: For any subtransaction SubXID, its entry in pg_subtrans points directly to its immediate parent XID.',
      'Invariant 3: Reading or writing a pg_subtrans page requires holding SubTransCtl->shared->ControlLock.',
    ],
    mechanicsWalkthrough: [
      '1. Snapshot visibility logic calls SubTransGetTopmostTransaction(subxid).',
      '2. SubTransGetParent computes pageno = subxid / 2048 and entryno = subxid % 2048.',
      '3. SimpleLruReadPage searches the in-memory SLRU buffer descriptors.',
      '4. If buffer is cached: LRU timestamp is bumped, pointer is read, lock is released.',
      '5. If buffer is missing (cache miss): exclusive lock is taken, victim page is evicted (flushed if dirty), and 8KB block is read from disk pg_subtrans/XXXX.',
      '6. The loop repeats until parentXid == InvalidTransactionId.',
    ],
    failureModes: [
      'Deep Nesting Amplification: A subtransaction at nesting depth N requires N consecutive SLRU page lookups.',
      'SLRU Thrashing: If concurrent transactions span more than the available SLRU buffer slots, continuous disk I/O evictions occur under exclusive lock.',
    ],
    versionSpecifics: 'In PG <= 16, SubTransCtl buffer pool size was hardcoded to NUM_SUBTRANS_BUFFERS = 32. In PG 17, buffer pool size is configurable via subtrans_buffers.',
  },
  {
    id: 'slru_c_buffer_management',
    subsystem: 'Storage / SLRU',
    sourceFile: 'src/backend/access/transam/slru.c',
    sourceFunctionOrStruct: 'SimpleLruReadPage() & SlruSharedData',
    cCode: `/*
 * src/backend/access/transam/slru.c
 */
typedef struct SlruSharedData
{
    LWLock             *ControlLock;
    int                 num_buffers;
    
    /* Buffer status arrays */
    int                *page_number;
    SlruPageStatus     *page_status;
    bool               *page_dirty;
    int                *page_lru_count;
    LWLockPadded       *buffer_locks;
    
    char              **page_buffer;
    int                 cur_lru_count;
} SlruSharedData;

int
SimpleLruReadPage(SlruCtl ctl, int pageno, bool write_ok, TransactionId xid)
{
    /* 1. Acquire shared ControlLock */
    LWLockAcquire(ctl->shared->ControlLock, LW_SHARED);

    /* 2. Fast search across SLRU buffer slots */
    for (int slotno = 0; slotno < ctl->shared->num_buffers; slotno++)
    {
        if (ctl->shared->page_number[slotno] == pageno &&
            ctl->shared->page_status[slotno] != SLRU_PAGE_EMPTY)
        {
            ctl->shared->page_lru_count[slotno] = ++ctl->shared->cur_lru_count;
            LWLockRelease(ctl->shared->ControlLock);
            return slotno;
        }
    }

    /* Cache MISS: Upgrade to exclusive ControlLock to find victim slot & read disk */
    LWLockRelease(ctl->shared->ControlLock);
    LWLockAcquire(ctl->shared->ControlLock, LW_EXCLUSIVE);
    
    /* ... select victim by lowest page_lru_count, flush if dirty, read block from disk ... */
}`,
    summary: 'The SLRU (Simple Least Recently Used) subsystem provides lightweight paging for transactional metadata (subtrans, multixact, clog, commit_ts). It uses a centralized ControlLock for buffer allocation and LRU tracking.',
    invariants: [
      'Invariant 1: All buffer slot lookups in an SLRU pool must be synchronized under ControlLock.',
      'Invariant 2: In PG <= 16, num_buffers for subtrans was fixed at 32 (256KB total capacity).',
      'Invariant 3: A page miss releases shared ControlLock and re-acquires exclusive ControlLock, allowing race conditions that require re-checking slot status.',
    ],
    mechanicsWalkthrough: [
      '1. Requesting backend acquires shared ControlLock.',
      '2. Iterates over num_buffers (e.g. 32 slots). If matching page number found, updates cur_lru_count and returns.',
      '3. If not found, exclusive lock taken: iterates to find oldest slot, flushes dirty page to filesystem if necessary, issues synchronous read() syscall for the 8KB file segment.',
      '4. Buffer marked SLRU_PAGE_VALID, lock downgraded/released.',
    ],
    failureModes: [
      'Centralized ControlLock Bottleneck: Under high concurrency, hundreds of backends contending for ControlLock create massive CPU spinlock / futex wait storms.',
      'I/O Latency Spikes: Synchronous disk reads while holding exclusive ControlLock block all other sessions from even checking cached pages.',
    ],
    versionSpecifics: 'PostgreSQL 17 commit 7d79b9a introduced configurable SLRU buffer sizes via GUCs: subtrans_buffers, multixact_offsets_buffers, multixact_members_buffers, and xact_buffers.',
  },
  {
    id: 'multixact_c_locks',
    subsystem: 'Lock Manager / MultiXact',
    sourceFile: 'src/backend/access/transam/multixact.c',
    sourceFunctionOrStruct: 'MultiXactIdCreate() & MultiXactMemberControlLock',
    cCode: `/*
 * src/backend/access/transam/multixact.c
 */
MultiXactId
MultiXactIdCreate(TransactionId xid1, MultiXactStatus status1,
                  TransactionId xid2, MultiXactStatus status2)
{
    MultiXactId     multi;
    MultiXactOffset offset;

    /* Acquire MultiXactGenLock to allocate new MultiXactId */
    LWLockAcquire(MultiXactGenLock, LW_EXCLUSIVE);
    multi = GetNewMultiXactId();
    LWLockRelease(MultiXactGenLock);

    /* Write members array to MultiXactMember SLRU pages */
    LWLockAcquire(MultiXactMemberControlLock, LW_EXCLUSIVE);
    offset = RecordNewMultiXact(multi, members, nmembers);
    LWLockRelease(MultiXactMemberControlLock);

    return multi;
}`,
    summary: 'When multiple transactions concurrently hold shared locks (e.g. SELECT FOR SHARE or foreign key checks) on the same row, PostgreSQL replaces the tuple xmax with a MultiXactId, stored across two SLRUs: pg_multixact/offsets and pg_multixact/members.',
    invariants: [
      'Invariant 1: HEAP_XMAX_IS_MULTI bit in t_infomask signifies that xmax is a MultiXactId rather than a single TransactionId.',
      'Invariant 2: MultiXactId creation requires sequential writes to both offsets and members SLRU caches.',
      'Invariant 3: MultiXact IDs wrap around at 2^32, requiring emergency autovacuum freeze (autovacuum_multixact_freeze_max_age).',
    ],
    mechanicsWalkthrough: [
      '1. Session 1 locks row: sets xmax = XID1 with LOCK_ONLY.',
      '2. Session 2 requests FOR SHARE: sees existing xmax, calls MultiXactIdCreate(XID1, XID2).',
      '3. MultiXactGenLock assigns new MultiXactId (e.g. 50001).',
      '4. MultiXactMemberControlLock serializes writing XID1 and XID2 into pg_multixact/members at given offset.',
      '5. Tuple xmax updated to 50001 and HEAP_XMAX_IS_MULTI set.',
    ],
    failureModes: [
      'MultiXactMemberControlLock Stalls: Intense foreign key checks or explicit FOR SHARE queries bottleneck on SLRU member writes.',
      'Emergency Wraparound Outages: Rapid MultiXact ID burn forces aggressive autovacuum, risking database shutdown if vacuum falls behind.',
    ],
    versionSpecifics: 'PG 17 allows tuning multixact_offsets_buffers and multixact_members_buffers to eliminate SLRU thrashing during concurrent row-locking bursts.',
  },
  {
    id: 'xloginsert_h_running_xacts',
    subsystem: 'WAL / Replication',
    sourceFile: 'src/include/access/xloginsert.h & src/backend/storage/ipc/standby.c',
    sourceFunctionOrStruct: 'struct xl_running_xacts & LogStandbySnapshot()',
    cCode: `/*
 * src/include/access/xloginsert.h
 */
typedef struct xl_running_xacts
{
    int         xcnt;              /* # of active top-level XIDs */
    int         subxcnt;           /* # of active subxids */
    bool        subxid_overflow;   /* TRUE if ANY active proc overflowed 64 subxacts */
    TransactionId nextXid;         /* next XID to be assigned */
    TransactionId oldestRunningXid;/* oldest active XID */
    TransactionId latestCompletedXid;
    
    TransactionId xids[FLEXIBLE_ARRAY_MEMBER]; /* array of top XIDs + subXIDs */
} xl_running_xacts;`,
    summary: 'Checkpointer and WalWriter periodically write xl_running_xacts records into the WAL stream so Hot Standby replicas can construct snapshots for read-only queries without waiting for a full checkpoint.',
    invariants: [
      'Invariant 1: If any running backend has subxids.overflowed == TRUE, the WAL record sets subxid_overflow = TRUE.',
      'Invariant 2: When subxid_overflow == TRUE, subxcnt is omitted/truncated in the WAL record to prevent giant multi-megabyte WAL records.',
      'Invariant 3: A Hot Standby replica CANNOT construct a valid snapshot if subxid_overflow is TRUE until all current transactions complete.',
    ],
    mechanicsWalkthrough: [
      '1. Primary backend runs batch with >64 subtransactions -> MyProc->subxids.overflowed becomes TRUE.',
      '2. WalWriter captures running transactions and sets xl_running_xacts.subxid_overflow = TRUE.',
      '3. Record is shipped via streaming replication to Standby.',
      '4. Standby startup process reads WAL record: because subxid_overflow is TRUE, Standby cannot determine which subxacts are active.',
      '5. Standby marks snapshot state as incomplete / stalled.',
      '6. Standby read queries trying to obtain a snapshot must wait or cancel once max_standby_streaming_delay expires.',
    ],
    failureModes: [
      'Standby Query Cancellation: Read queries on replica fail with ERROR: canceling statement due to conflict with recovery.',
      'Replication Delay Spikes: Standby snapshot creation stalls, increasing perceived query latency on read replicas.',
    ],
    versionSpecifics: 'Consistent across PostgreSQL 12 - 17. The subxid_overflow flag in WAL is a fundamental safeguard against unbounded WAL record bloat.',
  },
];
