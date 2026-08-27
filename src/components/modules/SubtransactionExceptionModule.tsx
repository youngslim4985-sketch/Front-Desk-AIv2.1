import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Play, 
  CheckCircle2, 
  Layers, 
  Copy, 
  Check, 
  Flame, 
  ShieldCheck, 
  Zap, 
  Database,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { REPRODUCIBLE_BENCHMARK_SCRIPTS } from '../../data/researchData';

export const SubtransactionExceptionModule: React.FC = () => {
  const [batchSize, setBatchSize] = useState<number>(200);
  const [errorRatePercent, setErrorRatePercent] = useState<number>(10);
  const [isReadWrite, setIsReadWrite] = useState<boolean>(true);
  const [strategy, setStrategy] = useState<'antipattern' | 'on_conflict' | 'staging_table'>('antipattern');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Calculations based on strategy
  const errorCount = Math.round((batchSize * errorRatePercent) / 100);
  const successCount = batchSize - errorCount;

  const subxactsAllocated = strategy === 'antipattern' ? batchSize : 0;
  const xidsAllocated = strategy === 'antipattern' 
    ? (isReadWrite ? batchSize : 0) 
    : 1; // Set-based uses 1 top-level XID

  const pgProcOverflowed = subxactsAllocated > 64 && isReadWrite;
  const slruPagesTouched = Math.ceil((subxactsAllocated * 4) / 8192) || (strategy === 'antipattern' ? 1 : 0);
  
  // Simulated execution time in milliseconds
  const simulatedTimeMs = strategy === 'antipattern'
    ? (batchSize * 0.85 + (pgProcOverflowed ? (batchSize - 64) * 1.4 : 0)).toFixed(1)
    : (batchSize * 0.04 + 1.2).toFixed(1);

  return (
    <div className="space-y-8">
      
      {/* Title Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <AlertTriangle className="w-4 h-4" /> Investigation Module 01 & 02
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Row-by-Row PL/pgSQL Exception Handling & XID Subtransactions
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          PostgreSQL creates an internal <strong className="text-slate-200">Subtransaction (Savepoint)</strong> for every 
          single <code className="font-mono text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-xs">BEGIN ... EXCEPTION ... END</code> block. 
          When executing DML inside loops, this allocates a continuous stream of 32-bit transaction IDs (<code className="font-mono text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-xs">XIDs</code>), 
          exhausting the in-memory proc cache and forcing disk SLRU operations.
        </p>
      </div>

      {/* Interactive Ingestion Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Interactive Controls */}
        <div className="lg:col-span-5 space-y-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            Batch Ingest Configuration
          </h2>

          {/* Strategy Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 font-semibold block">
              Execution Strategy:
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                id="btn-strategy-antipattern"
                onClick={() => setStrategy('antipattern')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  strategy === 'antipattern'
                    ? 'border-rose-500/80 bg-rose-950/40 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" /> Anti-Pattern: PL/pgSQL LOOP + EXCEPTION
                  </span>
                  {strategy === 'antipattern' && <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Executes 1 Savepoint & SubXID per row inside a cursor loop.
                </p>
              </button>

              <button
                id="btn-strategy-onconflict"
                onClick={() => setStrategy('on_conflict')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  strategy === 'on_conflict'
                    ? 'border-emerald-500/80 bg-emerald-950/40 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Set-Based: INSERT ... ON CONFLICT
                  </span>
                  {strategy === 'on_conflict' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Single statement, 0 subtransactions, atomic 1 XID execution.
                </p>
              </button>
            </div>
          </div>

          {/* Batch Size Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Batch Rows:</span>
              <span className="text-sky-400 font-bold">{batchSize.toLocaleString()} rows</span>
            </div>
            <input
              id="input-batch-size"
              type="range"
              min="10"
              max="1000"
              step="10"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>10 rows</span>
              <span className="text-amber-400">64 (Overflow Limit)</span>
              <span>1,000 rows</span>
            </div>
          </div>

          {/* Conflict / Error Rate Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Duplicate / Conflict Rate:</span>
              <span className="text-amber-400 font-bold">{errorRatePercent}% ({errorCount} rows)</span>
            </div>
            <input
              id="input-error-rate"
              type="range"
              min="0"
              max="50"
              step="5"
              value={errorRatePercent}
              onChange={(e) => setErrorRatePercent(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* DML vs Read-Only Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800">
            <div>
              <span className="text-xs font-mono font-semibold text-slate-200 block">
                Operation Type (DML vs Read-Only)
              </span>
              <span className="text-[11px] text-slate-400">
                {isReadWrite ? 'Writes (INSERT/UPDATE) allocate 32-bit XIDs' : 'SELECT only assigns SubTransactionId (No XID)'}
              </span>
            </div>
            <button
              onClick={() => setIsReadWrite(!isReadWrite)}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                isReadWrite
                  ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                  : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isReadWrite ? 'Read-Write (DML)' : 'Read-Only'}
            </button>
          </div>

        </div>

        {/* Right: Real-time Telemetry & Breakdown */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Real-time Metrics Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                SubXacts Created
              </span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {subxactsAllocated.toLocaleString()}
              </div>
              <span className={`text-[10px] font-mono mt-0.5 block ${
                subxactsAllocated > 64 ? 'text-rose-400 font-semibold' : 'text-slate-500'
              }`}>
                {subxactsAllocated > 64 ? '> 64 Cache Limit!' : 'Within Cache'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                XIDs Consumed
              </span>
              <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                {xidsAllocated.toLocaleString()}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {strategy === 'antipattern' ? '1 per row' : '1 atomic top XID'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                PGPROC Cache
              </span>
              <div className="text-xl font-bold font-mono mt-1">
                {pgProcOverflowed ? (
                  <span className="text-rose-400">OVERFLOW</span>
                ) : (
                  <span className="text-emerald-400">NORMAL</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {pgProcOverflowed ? 'Fell back to SLRU' : 'Zero-lock in-memory'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Simulated Latency
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {simulatedTimeMs} ms
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {strategy === 'antipattern' ? '10x-20x slower' : 'High throughput'}
              </span>
            </div>

          </div>

          {/* Visual Execution Pipeline Trace */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white flex items-center justify-between">
              <span>Execution Pipeline Trace</span>
              <span className="text-[11px] font-normal text-slate-400">
                Top XID: 1000000 • SubXID Range: 1000001–{1000000 + xidsAllocated}
              </span>
            </h3>

            {strategy === 'antipattern' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 flex items-start gap-3">
                  <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-rose-300">Loop Iteration 1 to 64: </strong> 
                    Populates <code className="font-mono text-sky-300">PGPROC.subxids.xids[0..63]</code>. 
                    Lock-free fast-path visibility resolution.
                  </div>
                </div>

                {batchSize > 64 && (
                  <div className="p-3 rounded-lg bg-rose-900/40 border border-rose-600 flex items-start gap-3 animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-100 leading-relaxed">
                      <strong className="text-white">Loop Iteration 65 (The Cliff): </strong>
                      <code className="font-mono text-amber-300">PGPROC.subxids.overflowed</code> is set to <code className="font-mono text-rose-300">TRUE</code>.
                      All subsequent loop iterations and concurrent readers now call <code className="font-mono text-cyan-300">SubTransGetTopmostTransaction()</code>, 
                      causing massive <code className="font-mono text-rose-300">SubtransSLRULock</code> convoying!
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-8 gap-1.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[10px]">
                  {Array.from({ length: Math.min(batchSize, 32) }).map((_, idx) => {
                    const isCached = idx < 64;
                    return (
                      <div
                        key={idx}
                        className={`p-1.5 rounded text-center border truncate ${
                          isCached
                            ? 'bg-sky-950/60 border-sky-800/80 text-sky-300'
                            : 'bg-rose-950/80 border-rose-800 text-rose-300'
                        }`}
                        title={`Subxact #${idx + 1} (XID ${1000001 + idx})`}
                      >
                        #{idx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed space-y-1">
                  <p className="font-bold text-emerald-300">
                    Optimal Set-Based Execution (0 Subtransactions)
                  </p>
                  <p>
                    PostgreSQL processes all {batchSize} rows in a single C executor node (<code className="font-mono text-emerald-300">ModifyTable</code>). 
                    No savepoint stack allocations, no <code className="font-mono text-emerald-300">pg_subtrans</code> writes, and zero SLRU lock overhead.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Code Comparison Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bad Code */}
        <div className="rounded-xl bg-slate-900 border border-rose-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4" /> Anti-Pattern: Row-by-Row PL/pgSQL
            </span>
            <button
              onClick={() => handleCopy(REPRODUCIBLE_BENCHMARK_SCRIPTS.anti_pattern_plpgsql, 'bad')}
              className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
            >
              {copiedCode === 'bad' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode === 'bad' ? 'Copied' : 'Copy SQL'}
            </button>
          </div>
          <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {REPRODUCIBLE_BENCHMARK_SCRIPTS.anti_pattern_plpgsql}
          </pre>
        </div>

        {/* Good Code */}
        <div className="rounded-xl bg-slate-900 border border-emerald-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Recommended: Set-Based ON CONFLICT
            </span>
            <button
              onClick={() => handleCopy(REPRODUCIBLE_BENCHMARK_SCRIPTS.optimized_batch_sql, 'good')}
              className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
            >
              {copiedCode === 'good' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode === 'good' ? 'Copied' : 'Copy SQL'}
            </button>
          </div>
          <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {REPRODUCIBLE_BENCHMARK_SCRIPTS.optimized_batch_sql}
          </pre>
        </div>

      </div>

    </div>
  );
};
