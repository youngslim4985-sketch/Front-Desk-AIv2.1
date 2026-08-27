import React, { useState } from 'react';
import { 
  HardDrive, 
  Layers, 
  RefreshCw, 
  Search, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  Lock, 
  Cpu, 
  Zap,
  Activity,
  FileCode
} from 'lucide-react';
import { postgresApi } from '../../services/postgresApi';
import { C_SOURCE_EXCERPTS } from '../../data/researchData';

export const PgSubtransSlruModule: React.FC = () => {
  // SLRU Simulation State
  const [bufferCount, setBufferCount] = useState<number>(32);
  const [lookupCount, setLookupCount] = useState<number>(500);
  const [distinctPages, setDistinctPages] = useState<number>(120);
  const [concurrency, setConcurrency] = useState<number>(16);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [slruResult, setSlruResult] = useState<any>(null);

  // Subtrans Calculator State
  const [queryXid, setQueryXid] = useState<number>(1048590);
  const rootParentXid = 1000000;

  // Subtrans page math
  const entriesPerPage = 2048; // 8192 / 4
  const calculatedPage = Math.floor(queryXid / entriesPerPage);
  const calculatedEntry = queryXid % entriesPerPage;
  const calculatedByteOffset = calculatedEntry * 4;

  const handleRunSlruSim = async () => {
    setIsSimulating(true);
    try {
      const res = await postgresApi.simulateSlru({
        bufferCount,
        lookups: lookupCount,
        distinctPages,
        concurrency,
      });
      setSlruResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <HardDrive className="w-4 h-4" /> Investigation Module 04 & 05
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          pg_subtrans Architecture & SLRU Cache Contention
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          The <code className="font-mono text-cyan-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_subtrans</code> subsystem 
          stores an array of parent transaction pointers for every subtransaction XID. Each 8KB disk page holds 
          <strong className="text-white"> 2,048 entries</strong>. PostgreSQL caches these pages using the SLRU (Simple LRU) engine, 
          guarded by heavy shared/exclusive <code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">SubtransSLRULock</code> primitives.
        </p>
      </div>

      {/* Part 1: Subtrans Page Calculator & Parent Resolver */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            pg_subtrans 8KB Disk Page & Slot Calculator
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Formula: Page = XID / 2048 • Entry = XID % 2048 • ByteOffset = Entry × 4
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-mono text-slate-300">Input SubTransaction ID (XID):</label>
            <input
              id="input-subtrans-xid"
              type="number"
              value={queryXid}
              onChange={(e) => setQueryXid(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="md:col-span-8 grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Calculated Page</span>
              <span className="text-base font-bold text-cyan-300 mt-0.5 block">Page {calculatedPage}</span>
              <span className="text-[10px] text-slate-400">File: pg_subtrans/{calculatedPage.toString(16).padStart(4, '0').toUpperCase()}</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Slot Entry Index</span>
              <span className="text-base font-bold text-sky-300 mt-0.5 block">Slot #{calculatedEntry}</span>
              <span className="text-[10px] text-slate-400">0 to 2047 inside page</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Byte Offset</span>
              <span className="text-base font-bold text-indigo-300 mt-0.5 block">+{calculatedByteOffset} bytes</span>
              <span className="text-[10px] text-slate-400">4-byte TransactionId</span>
            </div>
          </div>
        </div>

        {/* Recursive Traversal Trace */}
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            SubTransGetTopmostTransaction(SubXID: {queryXid}) Recursive Traversal Trace:
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 text-rose-300">
              SubXID: {queryXid}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2.5 py-1 rounded bg-amber-950 border border-amber-800 text-amber-300">
              Parent SubXID: {queryXid - 15} (Page {Math.floor((queryXid - 15) / 2048)})
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
              Root Top XID: {rootParentXid} (Page {Math.floor(rootParentXid / 2048)})
            </span>
          </div>
        </div>
      </div>

      {/* Part 2: Interactive SLRU Cache Simulator */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Interactive SLRU Buffer Cache Simulator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate buffer hit/miss dynamics, dirty page flushes, and SubtransControlLock contention.
            </p>
          </div>
          <button
            id="btn-run-slru-sim"
            onClick={handleRunSlruSim}
            disabled={isSimulating}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'Simulating...' : 'Run SLRU Simulation'}
          </button>
        </div>

        {/* Simulation Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">SLRU Buffers:</span>
              <span className="text-cyan-400 font-bold">{bufferCount} buffers ({bufferCount * 8} KB)</span>
            </div>
            <input
              type="range"
              min="8"
              max="512"
              step="8"
              value={bufferCount}
              onChange={(e) => setBufferCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>32 (PG &le; 16)</span>
              <span>128</span>
              <span>512 (PG 17+)</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Lookups:</span>
              <span className="text-white font-bold">{lookupCount} ops</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={lookupCount}
              onChange={(e) => setLookupCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Distinct Active Pages:</span>
              <span className="text-amber-400 font-bold">{distinctPages} pages</span>
            </div>
            <input
              type="range"
              min="20"
              max="300"
              step="10"
              value={distinctPages}
              onChange={(e) => setDistinctPages(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Concurrent Backends:</span>
              <span className="text-rose-400 font-bold">{concurrency} sessions</span>
            </div>
            <input
              type="range"
              min="1"
              max="64"
              step="1"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-rose-500"
            />
          </div>

        </div>

        {/* Live Simulation Results */}
        {slruResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Cache Hit Ratio</span>
                <span className={`text-xl font-bold font-mono mt-0.5 block ${
                  slruResult.metrics.hitRatio > 85 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {slruResult.metrics.hitRatio}%
                </span>
                <span className="text-[10px] text-slate-500">{slruResult.metrics.bufferHits} hits / {slruResult.lookups}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Cache Misses &amp; Reads</span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">
                  {slruResult.metrics.bufferMisses}
                </span>
                <span className="text-[10px] text-slate-500">{slruResult.metrics.diskReads} disk page reads</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">LRU Evictions</span>
                <span className="text-xl font-bold font-mono text-rose-400 mt-0.5 block">
                  {slruResult.metrics.evictions}
                </span>
                <span className="text-[10px] text-slate-500">{slruResult.metrics.diskWrites} dirty page flushes</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Lock Wait Penalty</span>
                <span className="text-xl font-bold font-mono text-indigo-400 mt-0.5 block">
                  {(slruResult.metrics.lockWaitMicroseconds / 1000).toFixed(2)} ms
                </span>
                <span className="text-[10px] text-slate-500">SubtransControlLock queue</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Throughput Verdict</span>
                <span className={`text-base font-bold font-mono mt-1 block ${
                  slruResult.metrics.hitRatio > 80 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {slruResult.metrics.hitRatio > 80 ? 'HEALTHY' : 'THRASHING'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {slruResult.metrics.hitRatio > 80 ? 'Minimal lock waits' : 'Severe lock convoy'}
                </span>
              </div>

            </div>

            {/* Visual Buffer Slot Matrix */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400 block font-semibold">
                SLRU Buffer Pool Slots ({slruResult.buffers.length} slots rendered):
              </span>
              <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[9px]">
                {slruResult.buffers.map((buf: any) => (
                  <div
                    key={buf.bufferId}
                    className={`p-1 rounded text-center border ${
                      buf.pageNumber === -1
                        ? 'bg-slate-900/30 border-slate-800 text-slate-600'
                        : buf.isDirty
                        ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                        : 'bg-cyan-950/80 border-cyan-700 text-cyan-200'
                    }`}
                    title={`Buffer [${buf.bufferId}]: Page ${buf.pageNumber} (${buf.isDirty ? 'Dirty' : 'Clean'})`}
                  >
                    <span className="block text-[8px] text-slate-500">[{buf.bufferId}]</span>
                    <span>P{buf.pageNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* C Code Reference */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-cyan-400" /> PostgreSQL Source: src/backend/access/transam/subtrans.c
          </span>
          <span className="text-[11px] font-mono text-slate-500">SubTransGetTopmostTransaction</span>
        </div>
        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {C_SOURCE_EXCERPTS.subtrans_c}
        </pre>
      </div>

    </div>
  );
};
