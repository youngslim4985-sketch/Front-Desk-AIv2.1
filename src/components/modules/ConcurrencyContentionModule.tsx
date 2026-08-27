import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Users, 
  Flame, 
  TrendingDown, 
  Zap, 
  AlertTriangle, 
  ShieldCheck,
  Lock,
  Cpu
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { postgresApi } from '../../services/postgresApi';

interface ConcurrencyContentionModuleProps {
  selectedPgVersion: number;
}

export const ConcurrencyContentionModule: React.FC<ConcurrencyContentionModuleProps> = ({
  selectedPgVersion,
}) => {
  const [readersCount, setReadersCount] = useState<number>(35);
  const [writersCount, setWritersCount] = useState<number>(5);
  const [subxactsPerBatch, setSubxactsPerBatch] = useState<number>(250);
  const [version, setVersion] = useState<number>(selectedPgVersion || 16);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<any>(null);

  // Sync version if prop changes
  useEffect(() => {
    setVersion(selectedPgVersion);
  }, [selectedPgVersion]);

  const handleRunBenchmark = async () => {
    setIsSimulating(true);
    try {
      const res = await postgresApi.simulateConcurrency({
        readersCount,
        subxactWritersCount: writersCount,
        subxactsPerBatch,
        pgVersion: version,
        durationSteps: 20,
      });
      setBenchmarkData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    handleRunBenchmark();
  }, [readersCount, writersCount, subxactsPerBatch, version]);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-amber-500 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Activity className="w-4 h-4" /> Investigation Module 08
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Concurrent-Session Performance & SubtransSLRULock Convoys
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          The true danger of subtransaction overflow is not just the slow worker itself—it is the 
          <strong className="text-white"> catastrophic lock convoy effect</strong>. When 5 batch workers create &gt;64 subtransactions, 
          dozens of completely innocent read-only SELECT queries freeze waiting on <code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">SubtransSLRULock</code>.
        </p>
      </div>

      {/* Benchmark Control Bar */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Multi-Session Workload Matrix
          </h2>
          <button
            onClick={handleRunBenchmark}
            disabled={isSimulating}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'Running...' : 'Re-run Benchmark'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Innocent Readers:</span>
              <span className="text-sky-400 font-bold">{readersCount} sessions</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              value={readersCount}
              onChange={(e) => setReadersCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">SubXact Writers:</span>
              <span className="text-rose-400 font-bold">{writersCount} sessions</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              value={writersCount}
              onChange={(e) => setWritersCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-rose-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">SubXacts per Batch:</span>
              <span className={`font-bold ${subxactsPerBatch > 64 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {subxactsPerBatch} {subxactsPerBatch > 64 ? '(Overflow)' : '(In-Cache)'}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={subxactsPerBatch}
              onChange={(e) => setSubxactsPerBatch(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Engine Version:</span>
              <span className="text-emerald-400 font-bold">PG {version} {version >= 17 ? '(Modern)' : '(Legacy 32 buf)'}</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              {[15, 16, 17].map((v) => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={`flex-1 py-1 rounded text-center transition-all ${
                    version === v
                      ? v === 17
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  v{v}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Real-time Telemetry Dashboard */}
      {benchmarkData && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Average Throughput</span>
              <div className={`text-2xl font-bold font-mono mt-1 ${
                benchmarkData.summary.avgTps > 2000 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {benchmarkData.summary.avgTps.toLocaleString()} TPS
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {benchmarkData.summary.avgTps > 2000 ? 'Normal operations' : 'Throughput collapsed!'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">p99 Query Latency</span>
              <div className={`text-2xl font-bold font-mono mt-1 ${
                benchmarkData.summary.avgP99Latency < 20 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {benchmarkData.summary.avgP99Latency} ms
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {benchmarkData.summary.avgP99Latency < 20 ? 'Sub-20ms SLA' : 'Massive tail latency spike'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">SubtransSLRULock Waits</span>
              <div className={`text-2xl font-bold font-mono mt-1 ${
                benchmarkData.summary.totalSlruWaits > 500 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {benchmarkData.summary.totalSlruWaits.toLocaleString()}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {benchmarkData.summary.totalSlruWaits > 500 ? 'Lock convoying active' : 'Zero lock contention'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Active Status</span>
              <div className="text-base font-bold font-mono mt-2">
                {benchmarkData.config.hasOverflow ? (
                  version >= 17 ? (
                    <span className="text-emerald-300">Resilient (PG17)</span>
                  ) : (
                    <span className="text-rose-400 animate-pulse">COLLAPSED (PG16)</span>
                  )
                ) : (
                  <span className="text-emerald-400">Normal (No Overflow)</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                {readersCount + writersCount} total sessions
              </span>
            </div>

          </div>

          {/* Recharts Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TPS Line Chart */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>System Throughput Over Time (TPS)</span>
                <span className="text-sky-400 text-[11px] font-normal">{readersCount} Readers + {writersCount} Writers</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={benchmarkData.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="timeSeconds" unit="s" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="tps" name="Transactions / Sec" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latency Percentiles Chart */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Latency Distribution (p50 / p95 / p99 ms)</span>
                <span className="text-rose-400 text-[11px] font-normal">SubtransSLRULock Impact</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={benchmarkData.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="timeSeconds" unit="s" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="p50LatencyMs" name="p50 (ms)" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p95LatencyMs" name="p95 (ms)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p99LatencyMs" name="p99 (ms)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Wait Event Breakdown Call Stack */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              PostgreSQL Call Stack &amp; Lock Convoy Bottleneck
            </h3>
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">1.</span>
                <span>exec_simple_query() / portal-&gt;run()</span>
                <span className="text-slate-500 text-[10px]">-- Client executes simple SELECT</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="text-slate-500">2.</span>
                <span>HeapTupleSatisfiesMVCC()</span>
                <span className="text-slate-500 text-[10px]">-- Checks tuple visibility against snapshot</span>
              </div>
              <div className="flex items-center gap-2 pl-8">
                <span className="text-slate-500">3.</span>
                <span>TransactionIdIsInProgress(xid)</span>
                <span className="text-slate-500 text-[10px]">-- Checks if xid is currently running</span>
              </div>
              <div className="flex items-center gap-2 pl-12 text-rose-300 font-bold">
                <span className="text-rose-500">4.</span>
                <span>SubTransGetTopmostTransaction(xid)</span>
                <span className="text-rose-400 text-[10px]">[Triggered because subxids.overflowed = TRUE]</span>
              </div>
              <div className="flex items-center gap-2 pl-16 text-rose-400 font-bold">
                <span className="text-rose-500">5.</span>
                <span>LWLockAcquire(SubtransControlLock, LW_SHARED)</span>
                <span className="text-rose-400 text-[10px] bg-rose-950/80 px-2 py-0.5 rounded">[BLOCKED: CONVOY QUEUE]</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
