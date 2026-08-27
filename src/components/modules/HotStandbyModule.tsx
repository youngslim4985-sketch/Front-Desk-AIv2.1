import React, { useState } from 'react';
import { 
  Server, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight, 
  Zap, 
  Activity, 
  Clock, 
  Database,
  Flame
} from 'lucide-react';

export const HotStandbyModule: React.FC = () => {
  const [subxactOverflowOnPrimary, setSubxactOverflowOnPrimary] = useState<boolean>(true);
  const [replicationDelayMs, setReplicationDelayMs] = useState<number>(450);
  const [maxStandbyDelaySec, setMaxStandbyDelaySec] = useState<number>(30);
  const [activeStandbyQueries, setActiveStandbyQueries] = useState<number>(18);

  // Standby Snapshot State calculations
  const isSnapshotStalled = subxactOverflowOnPrimary;
  const simulatedLagBytes = isSnapshotStalled ? 148200000 : 124000;
  const simulatedLagMs = isSnapshotStalled ? replicationDelayMs * 3.5 : replicationDelayMs;
  const canceledQueries = isSnapshotStalled ? Math.round(activeStandbyQueries * 0.35) : 0;

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-red-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Server className="w-4 h-4" /> Investigation Module 10
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Hot-Standby Snapshot Readiness &amp; Replica Lag Contention
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Physical streaming replication standbys build running snapshots directly from WAL records. 
          When the primary server generates <code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">xl_running_xacts</code> with 
          <code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">subxid_overflow = true</code>, the standby 
          <strong className="text-white"> cannot construct consistent read snapshots</strong>, stalling readers and causing 
          <code className="font-mono text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-xs">max_standby_streaming_delay</code> query cancellations.
        </p>
      </div>

      {/* Primary vs Standby Pipeline Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls */}
        <div className="lg:col-span-4 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            Replication Parameters
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 font-semibold block">
              Primary Subxact Overflow State:
            </label>
            <button
              onClick={() => setSubxactOverflowOnPrimary(!subxactOverflowOnPrimary)}
              className={`w-full p-3 rounded-lg border text-left font-mono text-xs transition-all ${
                subxactOverflowOnPrimary
                  ? 'bg-rose-950/60 border-rose-700 text-white'
                  : 'bg-emerald-950/60 border-emerald-700 text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {subxactOverflowOnPrimary ? 'OVERFLOW ACTIVE (>64 subxacts)' : 'CLEAN (<=64 subxacts)'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${subxactOverflowOnPrimary ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {subxactOverflowOnPrimary ? 'xl_running_xacts subxid_overflow = true' : 'xl_running_xacts clean'}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Active Read Queries on Standby:</span>
              <span className="text-sky-400 font-bold">{activeStandbyQueries} queries</span>
            </div>
            <input
              type="range"
              min="2"
              max="50"
              value={activeStandbyQueries}
              onChange={(e) => setActiveStandbyQueries(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">max_standby_streaming_delay:</span>
              <span className="text-amber-400 font-bold">{maxStandbyDelaySec}s</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              value={maxStandbyDelaySec}
              onChange={(e) => setMaxStandbyDelaySec(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
            />
          </div>

        </div>

        {/* Pipeline Architecture Visualization */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Primary Node Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-sky-400" /> Primary Node (Read-Write)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                  LSN: 0/1A94B20
                </span>
              </div>
              <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs space-y-1 text-slate-300">
                <div>Active Transactions: 24</div>
                <div className={subxactOverflowOnPrimary ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  Subxact Status: {subxactOverflowOnPrimary ? 'Overflowing PGPROC array' : 'Healthy'}
                </div>
                <div className="text-slate-500 text-[10px]">Writing WAL stream to replication socket...</div>
              </div>
            </div>

            {/* Standby Node Box */}
            <div className={`p-4 rounded-xl border space-y-3 transition-all ${
              isSnapshotStalled
                ? 'bg-rose-950/20 border-rose-800/80 shadow-md ring-1 ring-rose-500/20'
                : 'bg-emerald-950/20 border-emerald-800/80 shadow-md'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-red-400" /> Standby Replica (Hot Standby)
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isSnapshotStalled ? 'bg-rose-900 text-rose-200' : 'bg-emerald-900 text-emerald-200'
                }`}>
                  {isSnapshotStalled ? 'SNAPSHOT STALLED' : 'HEALTHY READY'}
                </span>
              </div>
              <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Replication Lag:</span>
                  <span className={isSnapshotStalled ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {simulatedLagMs.toFixed(0)} ms ({(simulatedLagBytes / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Snapshot Build:</span>
                  <span className={isSnapshotStalled ? 'text-amber-400' : 'text-emerald-400'}>
                    {isSnapshotStalled ? 'Deferred (Overflow Flag)' : 'Immediate'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Canceled Reader Queries:</span>
                  <span className={canceledQueries > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    {canceledQueries} queries
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Standby Query Cancellation Warning */}
          {isSnapshotStalled && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-700/80 flex items-start gap-3 shadow-md">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-200 space-y-1">
                <p className="font-bold text-rose-300 font-mono">
                  ERROR: canceling statement due to conflict with recovery
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Because WAL replay cannot resolve snapshot consistency without holding back replication, 
                  PostgreSQL cancels reader queries exceeding <code className="font-mono text-amber-300">max_standby_streaming_delay</code> ({maxStandbyDelaySec}s).
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
