import React, { useState } from 'react';
import { 
  Cpu, 
  AlertOctagon, 
  CheckCircle2, 
  Layers, 
  Zap, 
  HardDrive, 
  Lock, 
  ArrowRight,
  Code2,
  FileCode
} from 'lucide-react';
import { C_SOURCE_EXCERPTS } from '../../data/researchData';

export const PgProcOverflowModule: React.FC = () => {
  const [subxactCount, setSubxactCount] = useState<number>(65);
  const [baseXid, setBaseXid] = useState<number>(1050000);

  const maxCached = 64;
  const isOverflowed = subxactCount > maxCached;
  const cachedEntries = Array.from({ length: Math.min(subxactCount, maxCached) }, (_, i) => baseXid + i + 1);
  const overflowCount = Math.max(0, subxactCount - maxCached);

  return (
    <div className="space-y-8">
      
      {/* Title Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Cpu className="w-4 h-4" /> Investigation Module 03
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          PGPROC_MAX_CACHED_SUBXIDS (64) Overflow & Memory Layout
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Inside PostgreSQL's shared memory architecture, each active backend process is represented by a <code className="font-mono text-sky-300 bg-slate-800 px-1 py-0.5 rounded text-xs">PGPROC</code> structure. 
          To optimize tuple visibility checks, PostgreSQL allocates a fixed-size in-memory array of exactly 
          <strong className="text-white"> 64 TransactionIds</strong>. Exceeding 64 subtransactions triggers an immediate, irreversible fallback to disk SLRU lookups.
        </p>
      </div>

      {/* Interactive Control & Status Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls */}
        <div className="lg:col-span-4 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            PGPROC Array Controller
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Active Subxacts:</span>
              <span className={`font-bold ${isOverflowed ? 'text-rose-400' : 'text-emerald-400'}`}>
                {subxactCount} subtransactions
              </span>
            </div>
            <input
              id="slider-subxact-count"
              type="range"
              min="1"
              max="200"
              value={subxactCount}
              onChange={(e) => setSubxactCount(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1</span>
              <span className="text-amber-400 font-bold">64 (Limit)</span>
              <span>65 (Overflow)</span>
              <span>200</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSubxactCount(32)}
              className="flex-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700"
            >
              Safe (32)
            </button>
            <button
              onClick={() => setSubxactCount(64)}
              className="flex-1 px-2.5 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 text-[11px] font-mono text-amber-300 border border-amber-800/80 font-bold"
            >
              Limit (64)
            </button>
            <button
              onClick={() => setSubxactCount(65)}
              className="flex-1 px-2.5 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-[11px] font-mono text-rose-300 border border-rose-800 font-bold animate-pulse"
            >
              Cliff (65)
            </button>
            <button
              onClick={() => setSubxactCount(120)}
              className="flex-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700"
            >
              Heavy (120)
            </button>
          </div>

          {/* Struct State Inspector */}
          <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-2 font-mono text-xs">
            <span className="text-[10px] uppercase text-slate-500 font-bold block">
              PGPROC Struct State (PID 48192)
            </span>
            <div className="flex justify-between">
              <span className="text-slate-400">MyProc-&gt;xid:</span>
              <span className="text-sky-400">{baseXid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MyProc-&gt;subxids.count:</span>
              <span className="text-white">{cachedEntries.length} / 64</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">MyProc-&gt;subxids.overflowed:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                isOverflowed
                  ? 'bg-rose-900/80 text-rose-200 border border-rose-600 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {isOverflowed ? 'TRUE (OVERFLOW)' : 'FALSE (HEALTHY)'}
              </span>
            </div>
          </div>
        </div>

        {/* 64-Slot Memory Matrix Visualizer */}
        <div className="lg:col-span-8 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              In-Memory Cache Slots: TransactionId subxids.xids[64]
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Occupied: <strong className="text-white">{cachedEntries.length}</strong> / 64
            </span>
          </div>

          {/* 64-Grid Layout */}
          <div className="grid grid-cols-8 sm:grid-cols-8 md:grid-cols-16 gap-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[9px]">
            {Array.from({ length: 64 }).map((_, idx) => {
              const isFilled = idx < subxactCount;
              const xidVal = isFilled ? baseXid + idx + 1 : null;
              return (
                <div
                  key={idx}
                  className={`p-1 rounded text-center border transition-all ${
                    isFilled
                      ? 'bg-sky-950/80 border-sky-700 text-sky-200 shadow-sm'
                      : 'bg-slate-900/30 border-slate-800/50 text-slate-600'
                  }`}
                  title={isFilled ? `Slot [${idx}]: SubXID ${xidVal}` : `Slot [${idx}]: Empty`}
                >
                  <span className="block text-[8px] text-slate-500">[{idx}]</span>
                  <span className="font-semibold">{isFilled ? 'XID' : '—'}</span>
                </div>
              );
            })}
          </div>

          {/* Overflow Tray */}
          {isOverflowed && (
            <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-800/70 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-rose-300 font-bold flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  Overflow Queue: {overflowCount} subtransactions spilled to pg_subtrans SLRU!
                </span>
                <span className="text-[10px] text-rose-400 bg-rose-900/60 px-2 py-0.5 rounded font-bold">
                  SLOW PATH ACTIVE
                </span>
              </div>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {Array.from({ length: Math.min(overflowCount, 16) }).map((_, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700 text-rose-200">
                    SubXID #{65 + idx} ({baseXid + 65 + idx})
                  </span>
                ))}
                {overflowCount > 16 && (
                  <span className="px-2 py-0.5 text-rose-400 font-bold">
                    + {overflowCount - 16} more...
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Fast-Path vs Slow-Path Execution Resolution Branch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fast Path */}
        <div className={`p-5 rounded-xl border transition-all ${
          !isOverflowed 
            ? 'bg-emerald-950/20 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20' 
            : 'bg-slate-900/50 border-slate-800 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Fast-Path Resolution (Count &le; 64)
            </span>
            {!isOverflowed && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            When another transaction or snapshot checks visibility of a SubXID, PostgreSQL scans the in-memory array 
            <code className="font-mono text-emerald-300"> MyProc-&gt;subxids.xids</code> directly.
          </p>
          <ul className="text-xs text-slate-400 space-y-1 font-mono">
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Lock Acquisition: <strong className="text-slate-200">0 Locks (Zero contention)</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Disk / SLRU I/O: <strong className="text-slate-200">0 I/O Operations</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Visibility Check Time: <strong className="text-emerald-300">&lt; 20 nanoseconds</strong>
            </li>
          </ul>
        </div>

        {/* Slow Path */}
        <div className={`p-5 rounded-xl border transition-all ${
          isOverflowed 
            ? 'bg-rose-950/30 border-rose-500/80 shadow-md ring-1 ring-rose-500/30' 
            : 'bg-slate-900/50 border-slate-800 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Slow-Path SLRU Traversal (Count &gt; 64)
            </span>
            {isOverflowed && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/80 text-rose-200 font-bold animate-pulse">
                ACTIVE (CLIFF TRIPPED)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            Because the array overflowed, the backend cannot trust the cache. Every single visibility check calls 
            <code className="font-mono text-rose-300"> SubTransGetTopmostTransaction()</code>, acquiring shared LWLock on SLRU.
          </p>
          <ul className="text-xs text-slate-400 space-y-1 font-mono">
            <li className="flex items-center gap-2">
              <span className="text-rose-400">✗</span> Lock Required: <strong className="text-rose-300">SubtransSLRULock / SubtransControlLock</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-rose-400">✗</span> SLRU Page Buffer Scans: <strong className="text-rose-300">Multiple SLRU slot lookups</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-rose-400">✗</span> Visibility Check Time: <strong className="text-rose-300">10–500 microseconds (convoying)</strong>
            </li>
          </ul>
        </div>

      </div>

      {/* C Source Code Excerpt */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-sky-400" /> PostgreSQL Source: src/include/storage/proc.h
          </span>
          <span className="text-[11px] font-mono text-slate-500">Core Engine Definition</span>
        </div>
        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {C_SOURCE_EXCERPTS.proc_h}
        </pre>
      </div>

    </div>
  );
};
