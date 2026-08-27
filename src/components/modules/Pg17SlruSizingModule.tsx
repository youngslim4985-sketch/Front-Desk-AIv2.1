import React, { useState } from 'react';
import { 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Zap, 
  Layers, 
  HardDrive, 
  TrendingUp, 
  BarChart3,
  FileCode
} from 'lucide-react';
import { REPRODUCIBLE_BENCHMARK_SCRIPTS } from '../../data/researchData';

export const Pg17SlruSizingModule: React.FC = () => {
  const [sharedBuffersGb, setSharedBuffersGb] = useState<number>(32);
  const [subtransBuffers, setSubtransBuffers] = useState<number>(1024);
  const [mxactMembersBuffers, setMxactMembersBuffers] = useState<number>(1024);
  const [copiedConf, setCopiedConf] = useState<boolean>(false);

  // Auto-calculated buffer size in MB
  const subtransSizeMb = ((subtransBuffers * 8) / 1024).toFixed(1);
  const mxactMembersSizeMb = ((mxactMembersBuffers * 8) / 1024).toFixed(1);
  const totalSlruMb = (((subtransBuffers + mxactMembersBuffers + 512 + 1024) * 8) / 1024).toFixed(1);

  const handleCopy = () => {
    navigator.clipboard.writeText(REPRODUCIBLE_BENCHMARK_SCRIPTS.pg17_conf_tuning);
    setCopiedConf(true);
    setTimeout(() => setCopiedConf(false), 2000);
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Sliders className="w-4 h-4" /> Investigation Module 07
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          PostgreSQL 17 SLRU Buffer Sizing & Configuration Overhaul
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          For over two decades through PostgreSQL 16, SLRU buffer sizes were hardcoded in C source headers (<code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">NUM_SUBTRANS_BUFFERS = 32</code>, 
          giving only <strong>256 KB</strong> of RAM). PostgreSQL 17 revolutionized this by introducing configurable GUC parameters 
          (<code className="font-mono text-emerald-300 bg-slate-800 px-1 py-0.5 rounded text-xs">subtrans_buffers</code>, <code className="font-mono text-emerald-300 bg-slate-800 px-1 py-0.5 rounded text-xs">multixact_members_buffers</code>) 
          and auto-sizing heuristics based on <code className="font-mono text-sky-300 bg-slate-800 px-1 py-0.5 rounded text-xs">shared_buffers</code>.
        </p>
      </div>

      {/* Comparison Matrix: PG 16 vs PG 17 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Legacy PG 16 */}
        <div className="rounded-xl bg-slate-900 border border-rose-900/40 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> PostgreSQL 14, 15, 16 (Legacy)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
              Hardcoded C Constants
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">NUM_SUBTRANS_BUFFERS:</span>
              <span className="text-rose-400 font-bold">32 buffers (256 KB)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">NUM_MXACTMEMBERS_BUFFERS:</span>
              <span className="text-rose-400 font-bold">16 buffers (128 KB)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">NUM_MXACTOFFSETS_BUFFERS:</span>
              <span className="text-rose-400 font-bold">8 buffers (64 KB)</span>
            </div>
          </div>

          <div className="rounded bg-rose-950/30 border border-rose-900/40 p-3 text-xs text-slate-300 leading-relaxed">
            <strong className="text-rose-300">Consequence: </strong>
            Even on servers with 512 GB of RAM, subtransactions were constrained to 256 KB of SLRU cache. 
            Under 50+ concurrent clients, SLRU cache hit ratio collapsed to &lt;20%.
          </div>
        </div>

        {/* Modern PG 17 */}
        <div className="rounded-xl bg-slate-900 border border-emerald-900/40 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> PostgreSQL 17+ (Modern)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              Dynamic &amp; Auto-Sized
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">subtrans_buffers:</span>
              <span className="text-emerald-400 font-bold">128 to 8,192 (1MB–64MB)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">multixact_members_buffers:</span>
              <span className="text-emerald-400 font-bold">64 to 8,192 (512KB–64MB)</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">multixact_offsets_buffers:</span>
              <span className="text-emerald-400 font-bold">32 to 2,048 (256KB–16MB)</span>
            </div>
          </div>

          <div className="rounded bg-emerald-950/30 border border-emerald-900/40 p-3 text-xs text-slate-300 leading-relaxed">
            <strong className="text-emerald-300">Consequence: </strong>
            SLRU buffer pools can now hold hundreds of thousands of active subtransaction parent pointers in RAM, 
            eliminating disk thrashing and maintaining &gt;99% cache hit ratio under high load.
          </div>
        </div>

      </div>

      {/* Interactive PG 17 Sizing Calculator */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-5 shadow-sm">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          PostgreSQL 17+ SLRU Sizing Calculator & Recommendations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">shared_buffers Pool:</span>
              <span className="text-sky-400 font-bold">{sharedBuffersGb} GB</span>
            </div>
            <input
              type="range"
              min="4"
              max="128"
              step="4"
              value={sharedBuffersGb}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSharedBuffersGb(val);
                setSubtransBuffers(Math.min(val * 32, 2048));
                setMxactMembersBuffers(Math.min(val * 32, 2048));
              }}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">subtrans_buffers:</span>
              <span className="text-emerald-400 font-bold">{subtransBuffers} ({subtransSizeMb} MB)</span>
            </div>
            <input
              type="range"
              min="128"
              max="4096"
              step="128"
              value={subtransBuffers}
              onChange={(e) => setSubtransBuffers(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">multixact_members_buffers:</span>
              <span className="text-violet-400 font-bold">{mxactMembersBuffers} ({mxactMembersSizeMb} MB)</span>
            </div>
            <input
              type="range"
              min="128"
              max="4096"
              step="128"
              value={mxactMembersBuffers}
              onChange={(e) => setMxactMembersBuffers(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-violet-500 cursor-pointer"
            />
          </div>

        </div>

        {/* Total Memory Allocation Callout */}
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-mono text-slate-400">Total SLRU Cache RAM Allocation:</span>
            <div className="text-lg font-bold font-mono text-white">
              {totalSlruMb} MB <span className="text-xs text-slate-500 font-normal">(&lt; 0.1% of {sharedBuffersGb} GB shared_buffers)</span>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            {copiedConf ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedConf ? 'Copied to Clipboard' : 'Copy postgresql.conf snippet'}
          </button>
        </div>

      </div>

      {/* postgresql.conf Snippet Box */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-emerald-400" /> Production Tuning: postgresql.conf (PostgreSQL 17+)
          </span>
        </div>
        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {REPRODUCIBLE_BENCHMARK_SCRIPTS.pg17_conf_tuning}
        </pre>
      </div>

    </div>
  );
};
