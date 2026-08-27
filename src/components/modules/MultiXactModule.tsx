import React, { useState } from 'react';
import { 
  Lock, 
  Users, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight, 
  Layers, 
  Zap, 
  Key, 
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { postgresApi } from '../../services/postgresApi';

export const MultiXactModule: React.FC = () => {
  const [concurrentLockers, setConcurrentLockers] = useState<number>(5);
  const [rowKey, setRowKey] = useState<string>('customer_account_9482');
  const [lockType, setLockType] = useState<'FOR SHARE' | 'FOR KEY SHARE' | 'FOR NO KEY UPDATE'>('FOR SHARE');
  const [multiXactData, setMultiXactData] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await postgresApi.simulateMultiXact({
        concurrentLockers,
        rowKey,
        lockTypes: [lockType],
      });
      setMultiXactData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    handleSimulate();
  }, [concurrentLockers, lockType]);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-violet-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Lock className="w-4 h-4" /> Investigation Module 06
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          MultiXact Metadata Pressure, SLRU Buffers & Wraparound
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          When multiple concurrent transactions take shared locks on the same row (e.g. via <code className="font-mono text-violet-300 bg-slate-800 px-1 py-0.5 rounded text-xs">SELECT ... FOR SHARE</code>, 
          foreign key validation checks, or <code className="font-mono text-violet-300 bg-slate-800 px-1 py-0.5 rounded text-xs">FOR KEY SHARE</code>), 
          PostgreSQL cannot store multiple XIDs directly in the tuple header. It allocates a <strong className="text-white">MultiXactId</strong> 
          backed by <code className="font-mono text-cyan-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_multixact/offsets</code> and <code className="font-mono text-cyan-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_multixact/members</code>.
        </p>
      </div>

      {/* Interactive MultiXact Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            Shared Lock Concurrency Generator
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 font-semibold block">
              Target Row Primary Key:
            </label>
            <input
              type="text"
              value={rowKey}
              onChange={(e) => setRowKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Concurrent Shared Lockers:</span>
              <span className="text-violet-400 font-bold">{concurrentLockers} sessions</span>
            </div>
            <input
              type="range"
              min="2"
              max="24"
              value={concurrentLockers}
              onChange={(e) => setConcurrentLockers(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-violet-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>2 (Single MultiXact)</span>
              <span>10 (Medium)</span>
              <span>24 (High Pressure)</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 font-semibold block">
              Lock Mode Applied:
            </label>
            <div className="grid grid-cols-1 gap-2 font-mono text-xs">
              {(['FOR SHARE', 'FOR KEY SHARE', 'FOR NO KEY UPDATE'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLockType(mode)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    lockType === mode
                      ? 'border-violet-500 bg-violet-950/40 text-white font-bold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{mode}</span>
                    {lockType === mode && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Truncation / Vacuum Warning */}
          <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-900/50 space-y-1">
            <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              MultiXact Wraparound Vacuum Guard
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              When <code className="font-mono text-amber-300">MultiXactId</code> exceeds <code className="font-mono text-amber-300">autovacuum_multixact_freeze_max_age</code> (400M), 
              autovacuum runs emergency aggressive freezing, blocking DDL and consuming heavy I/O.
            </p>
          </div>

        </div>

        {/* Right: MultiXact Tuple Header & Member Mapping */}
        <div className="lg:col-span-7 space-y-4">
          
          {multiXactData && (
            <>
              {/* Tuple Header Representation */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-violet-400" />
                    Physical Heap Tuple Header (Row: {rowKey})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-violet-950 border border-violet-800 text-[10px] font-mono text-violet-300 font-bold">
                    HEAP_XMAX_IS_MULTI = 1
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Tuple t_xmin</span>
                    <span className="text-sm font-bold text-sky-400 mt-0.5 block">1029480</span>
                    <span className="text-[10px] text-slate-500">Creating XID</span>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Tuple t_xmax</span>
                    <span className="text-sm font-bold text-violet-400 mt-0.5 block">
                      MultiXactId {multiXactData.multiXactId}
                    </span>
                    <span className="text-[10px] text-slate-500">Points to MultiXact ID</span>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">t_infomask</span>
                    <span className="text-xs font-bold text-amber-300 mt-0.5 block truncate">0x1040 (IS_MULTI)</span>
                    <span className="text-[10px] text-slate-500">Flags MultiXact</span>
                  </div>
                </div>
              </div>

              {/* Offset & Members SLRU Mapping */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  SLRU Structure: pg_multixact/offsets &rarr; pg_multixact/members
                </h3>

                {/* Flow Diagram */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Step 1: Inspect Offsets SLRU</span>
                      <span className="text-sky-300 font-bold">
                        pg_multixact/offsets (Page {multiXactData.offsetsPage})
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase block">Resolved Member Array Offset</span>
                      <span className="text-emerald-400 font-bold">Offset #{multiXactData.offset}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase">
                        Step 2: Inspect Members SLRU (Page {multiXactData.membersPage})
                      </span>
                      <span className="text-[10px] text-violet-400">
                        {multiXactData.members.length} Active Member Lockers
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {multiXactData.members.map((m: any, idx: number) => (
                        <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <div className="flex justify-between text-slate-300 font-bold">
                            <span>XID: {m.xid}</span>
                            <span className="text-emerald-400">active</span>
                          </div>
                          <div className="text-[10px] text-violet-300 mt-0.5">
                            {m.lockMode}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
};
