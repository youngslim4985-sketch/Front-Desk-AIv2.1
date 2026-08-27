import React, { useState } from 'react';
import { 
  FileText, 
  AlertTriangle, 
  Layers, 
  HardDrive, 
  ShieldAlert, 
  CheckCircle2, 
  Zap, 
  Binary, 
  FileCode
} from 'lucide-react';
import { C_SOURCE_EXCERPTS } from '../../data/researchData';

export const RunningXactsModule: React.FC = () => {
  const [topXidCount, setTopXidCount] = useState<number>(12);
  const [subXidCount, setSubXidCount] = useState<number>(85);

  const maxCachedSubXids = 64;
  const isOverflowed = subXidCount > maxCachedSubXids;

  // WAL record size calculation
  // Base struct header is 28 bytes + (xcnt * 4) + (subxcnt * 4)
  const recordedSubXids = isOverflowed ? maxCachedSubXids : subXidCount;
  const baseHeaderBytes = 28;
  const payloadBytes = baseHeaderBytes + (topXidCount * 4) + (recordedSubXids * 4);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-orange-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4" /> Investigation Module 09
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          RUNNING_XACTS WAL Overflow &amp; Checkpoint Record Overhead
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          PostgreSQL periodically logs <code className="font-mono text-orange-300 bg-slate-800 px-1 py-0.5 rounded text-xs">xl_running_xacts</code> records 
          into the Write-Ahead Log (WAL) during checkpoints and standby logging. When any active transaction creates &gt;64 subxacts, 
          PostgreSQL truncates the subxid list and writes <code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">subxid_overflow = TRUE</code>, 
          causing Hot-Standby replicas to lose fine-grained subtransaction tracking.
        </p>
      </div>

      {/* Interactive WAL Record Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            Transaction Pool Configurator
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Active Top-Level XIDs (xcnt):</span>
              <span className="text-sky-400 font-bold">{topXidCount} transactions</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={topXidCount}
              onChange={(e) => setTopXidCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Active SubXIDs (subxcnt):</span>
              <span className={`font-bold ${isOverflowed ? 'text-rose-400' : 'text-emerald-400'}`}>
                {subXidCount} subxacts {isOverflowed ? '(OVERFLOW)' : ''}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              value={subXidCount}
              onChange={(e) => setSubXidCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0</span>
              <span className="text-amber-400 font-bold">64 (Limit)</span>
              <span>250</span>
            </div>
          </div>

          {/* Overflow Consequence Notice */}
          <div className={`p-4 rounded-lg border space-y-1.5 text-xs ${
            isOverflowed 
              ? 'bg-rose-950/30 border-rose-900/60 text-slate-300' 
              : 'bg-emerald-950/30 border-emerald-900/60 text-slate-300'
          }`}>
            <span className={`font-mono font-bold flex items-center gap-1.5 ${
              isOverflowed ? 'text-rose-300' : 'text-emerald-300'
            }`}>
              {isOverflowed ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isOverflowed ? 'Standby Invalidation Flag Set' : 'Clean Snapshot Possible'}
            </span>
            <p className="text-[11px] leading-relaxed">
              {isOverflowed
                ? 'Because subxid_overflow = true, standby replicas receiving this WAL record cannot determine complete active subxact membership, delaying consistent snapshot construction.'
                : 'Standby replicas can instantly construct a clean snapshot from the full list of top XIDs and subXIDs.'}
            </p>
          </div>

        </div>

        {/* Right: Decoded WAL Record Binary Inspector */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Binary className="w-4 h-4 text-orange-400" />
                Decoded xl_running_xacts WAL Record
              </span>
              <span className="text-xs font-mono text-slate-400">
                Size: <strong className="text-white">{payloadBytes}</strong> bytes
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">xcnt (Top XIDs)</span>
                <span className="text-sm font-bold text-sky-400 mt-0.5 block">{topXidCount}</span>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">subxcnt (Logged SubXIDs)</span>
                <span className="text-sm font-bold text-orange-400 mt-0.5 block">
                  {recordedSubXids} <span className="text-[10px] text-slate-500 font-normal">of {subXidCount}</span>
                </span>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">subxid_overflow</span>
                <span className={`text-sm font-bold mt-0.5 block ${
                  isOverflowed ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  {isOverflowed ? 'TRUE' : 'FALSE'}
                </span>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">nextXid</span>
                <span className="text-xs font-bold text-slate-300 mt-0.5 block">1095820</span>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">oldestRunningXid</span>
                <span className="text-xs font-bold text-slate-300 mt-0.5 block">1094000</span>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">latestCompletedXid</span>
                <span className="text-xs font-bold text-slate-300 mt-0.5 block">1095819</span>
              </div>
            </div>

            {/* Binary Array Breakdown */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">
                Payload Array: TransactionId xids[] ({topXidCount + recordedSubXids} elements)
              </span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: topXidCount }).map((_, idx) => (
                  <span key={`top-${idx}`} className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 text-[10px]">
                    TopXID_{idx + 1}
                  </span>
                ))}
                {Array.from({ length: Math.min(recordedSubXids, 20) }).map((_, idx) => (
                  <span key={`sub-${idx}`} className="px-1.5 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-300 text-[10px]">
                    SubXID_{idx + 1}
                  </span>
                ))}
                {recordedSubXids > 20 && (
                  <span className="px-1.5 py-0.5 text-slate-500 text-[10px]">
                    +{recordedSubXids - 20} more...
                  </span>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* C Source Header */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-orange-400" /> PostgreSQL Source: src/include/access/transam/xloginsert.h
          </span>
          <span className="text-[11px] font-mono text-slate-500">struct xl_running_xacts</span>
        </div>
        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {C_SOURCE_EXCERPTS.running_xacts_h}
        </pre>
      </div>

    </div>
  );
};
