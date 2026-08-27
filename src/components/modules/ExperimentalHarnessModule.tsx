import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  Play, 
  Layers, 
  Sliders, 
  Activity, 
  FileCode, 
  Cpu, 
  HardDrive, 
  Server,
  RefreshCw,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { 
  EXPERIMENTAL_SCENARIOS, 
  DOCKER_COMPOSE_HARNESS, 
  REPRODUCIBLE_BENCHMARK_SCRIPTS 
} from '../../data/researchData';
import { ExperimentalScenario } from '../../types/postgres';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

export const ExperimentalHarnessModule: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(EXPERIMENTAL_SCENARIOS[0].id);
  const [activeTab, setActiveTab] = useState<'scenario' | 'interactive_sim' | 'docker_compose' | 'perf_profiler'>('scenario');
  const [copied, setCopied] = useState<string | null>(null);

  // Interactive Live Simulator State
  const [simConcurrency, setSimConcurrency] = useState<number>(30);
  const [simSubxactDepth, setSimSubxactDepth] = useState<number>(120);
  const [simSlruBuffers, setSimSlruBuffers] = useState<number>(32); // 32 = PG <= 16 default, 1024 = PG 17+
  const [simWorkloadType, setSimWorkloadType] = useState<'antipattern_loop' | 'optimized_batch'>('antipattern_loop');

  const currentScenario = EXPERIMENTAL_SCENARIOS.find((s) => s.id === selectedScenarioId) || EXPERIMENTAL_SCENARIOS[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate Simulation Data Points
  const simulationData = useMemo(() => {
    const points = [];
    const maxClients = 60;
    
    for (let c = 5; c <= maxClients; c += 5) {
      if (simWorkloadType === 'optimized_batch') {
        // Flat high performance
        const tps = Math.round(9000 - (c * 25) + (Math.random() * 80));
        const p99 = Math.round(1.5 + (c * 0.12));
        const hitRatio = 99.9;
        points.push({ concurrency: c, tps, p99, hitRatio });
      } else {
        // Anti-pattern subxacts
        const overflow = simSubxactDepth > 64;
        const bufferFactor = simSlruBuffers / 32; // 1x for 32 buffers, 32x for 1024 buffers
        
        let tps = 0;
        let p99 = 0;
        let hitRatio = 0;

        if (!overflow) {
          tps = Math.round(6000 - (c * 40));
          p99 = Math.round(4 + (c * 0.5));
          hitRatio = 98.5;
        } else {
          // Severe drop under overflow & small buffers
          if (simSlruBuffers <= 32) {
            // PG 16 style collapse
            tps = Math.max(40, Math.round(3500 / (1 + (c * 0.45) * (simSubxactDepth / 50))));
            p99 = Math.round(15 + (c * 18.5) * (simSubxactDepth / 60));
            hitRatio = Math.max(45, Math.round(92 - (c * 0.8) - (simSubxactDepth * 0.1)));
          } else {
            // PG 17 with large buffers
            tps = Math.round(2800 / (1 + (c * 0.08)));
            p99 = Math.round(8 + (c * 2.1));
            hitRatio = Math.min(97.5, Math.round(96 - (c * 0.15)));
          }
        }

        points.push({ concurrency: c, tps, p99, hitRatio });
      }
    }
    return points;
  }, [simConcurrency, simSubxactDepth, simSlruBuffers, simWorkloadType]);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Flame className="w-4 h-4" /> Experimental Reproduction Harness
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          PostgreSQL Laboratory Benchmark &amp; Stress Testing Harness
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Comprehensive, reproducible experimental testbeds to simulate subtransaction storms, MultiXact concurrency pressure, and Hot Standby replication delays on actual PostgreSQL instances.
        </p>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('scenario')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
            activeTab === 'scenario'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Reproduction Scenarios ({EXPERIMENTAL_SCENARIOS.length})
        </button>

        <button
          onClick={() => setActiveTab('interactive_sim')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
            activeTab === 'interactive_sim'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-sky-400" />
          Interactive SLRU Load Simulator
        </button>

        <button
          onClick={() => setActiveTab('docker_compose')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
            activeTab === 'docker_compose'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Server className="w-4 h-4 text-emerald-400" />
          Multi-Version Docker Compose Lab
        </button>

        <button
          onClick={() => setActiveTab('perf_profiler')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
            activeTab === 'perf_profiler'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4 text-rose-400" />
          Linux perf &amp; eBPF Profiler Guide
        </button>
      </div>

      {/* Tab 1: Reproduction Scenarios */}
      {activeTab === 'scenario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Scenario Selector */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
              Experimental Scenarios
            </span>
            <div className="space-y-2">
              {EXPERIMENTAL_SCENARIOS.map((s) => {
                const isSelected = selectedScenarioId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScenarioId(s.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-amber-400 mb-1">
                      {s.workloadType}
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-100">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {s.subsystem}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Scenario Inspector */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Summary */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {currentScenario.workloadType}
                  </span>
                  <h2 className="text-base font-bold text-white font-mono mt-0.5">
                    {currentScenario.title}
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                  {currentScenario.subsystem}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {currentScenario.description}
              </p>
            </div>

            {/* DDL & Setup SQL */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-semibold flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  1. Setup SQL &amp; Schema Initialization
                </span>
                <button
                  onClick={() => handleCopy(currentScenario.setupSql, 'setup')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  {copied === 'setup' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied === 'setup' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                {currentScenario.setupSql}
              </pre>
            </div>

            {/* pgbench Workload */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-semibold flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  2. pgbench Stress Test Script
                </span>
                <button
                  onClick={() => handleCopy(currentScenario.pgbenchScript, 'pgbench')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  {copied === 'pgbench' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied === 'pgbench' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 font-mono text-xs text-amber-300 overflow-x-auto">
                {currentScenario.pgbenchScript}
              </pre>
            </div>

            {/* Expected Results: PG 16 vs PG 17 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                <span className="text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  PostgreSQL 14–16 Bottleneck (32 Buffers)
                </span>
                <p className="text-xs text-rose-200/90 font-mono leading-relaxed">
                  {currentScenario.expectedBehaviorPg16}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
                <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  PostgreSQL 17+ Optimized (1024 Buffers)
                </span>
                <p className="text-xs text-emerald-200/90 font-mono leading-relaxed">
                  {currentScenario.expectedBehaviorPg17}
                </p>
              </div>
            </div>

            {/* Mitigation Code */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-400 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Production Mitigation Pattern
                </span>
                <button
                  onClick={() => handleCopy(currentScenario.mitigationCode, 'mitigation')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  {copied === 'mitigation' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied === 'mitigation' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
                {currentScenario.mitigationCode}
              </pre>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Interactive SLRU Load Simulator */}
      {activeTab === 'interactive_sim' && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Dynamic In-Browser Workload &amp; SLRU Buffer Simulator
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              
              {/* Workload Ingestion Pattern */}
              <div className="space-y-2">
                <label className="text-slate-300 font-bold block">
                  Workload Pattern:
                </label>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setSimWorkloadType('antipattern_loop')}
                    className={`px-3 py-2 rounded-lg text-left transition-all ${
                      simWorkloadType === 'antipattern_loop'
                        ? 'bg-rose-950/80 border border-rose-600 text-rose-200 font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    1. PL/pgSQL Exception Loop (Subxact Storm)
                  </button>
                  <button
                    onClick={() => setSimWorkloadType('optimized_batch')}
                    className={`px-3 py-2 rounded-lg text-left transition-all ${
                      simWorkloadType === 'optimized_batch'
                        ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-200 font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    2. Set-based INSERT ... ON CONFLICT
                  </button>
                </div>
              </div>

              {/* Subtransaction Depth */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-slate-300 font-bold">Subxacts per Batch:</label>
                  <span className={`font-bold ${simSubxactDepth > 64 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {simSubxactDepth} {simSubxactDepth > 64 ? '(OVERFLOW)' : '(CACHED)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="300"
                  value={simSubxactDepth}
                  onChange={(e) => setSimSubxactDepth(Number(e.target.value))}
                  disabled={simWorkloadType === 'optimized_batch'}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500">
                  {simSubxactDepth > 64 ? 'Exceeds 64-slot PGPROC limit -> Forces disk SLRU traversal' : 'Fits in in-memory PGPROC cache'}
                </p>
              </div>

              {/* SLRU Buffer Size (PG 16 vs PG 17) */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-slate-300 font-bold">SLRU Buffer Pool Size:</label>
                  <span className="text-sky-400 font-bold">
                    {simSlruBuffers} ({simSlruBuffers * 8} KB)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSimSlruBuffers(32)}
                    className={`py-1.5 rounded text-xs font-mono transition-all ${
                      simSlruBuffers === 32
                        ? 'bg-rose-900/70 text-white border border-rose-600 font-bold'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    PG &le; 16 (32 Buffers)
                  </button>
                  <button
                    onClick={() => setSimSlruBuffers(1024)}
                    className={`py-1.5 rounded text-xs font-mono transition-all ${
                      simSlruBuffers === 1024
                        ? 'bg-emerald-900/70 text-white border border-emerald-600 font-bold'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    PG 17+ (1024 Buffers)
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Telemetry Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Throughput (TPS) */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  System Throughput (TPS) vs Concurrency
                </span>
                <span className="text-[11px] font-mono text-slate-400">Higher is better</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="concurrency" stroke="#94a3b8" label={{ value: 'Concurrent Sessions', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }} />
                    <Line type="monotone" dataKey="tps" name="Transactions / Sec (TPS)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: P99 Latency (ms) */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-rose-400" />
                  Tail Latency (P99 ms) vs Concurrency
                </span>
                <span className="text-[11px] font-mono text-slate-400">Lower is better</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="concurrency" stroke="#94a3b8" label={{ value: 'Concurrent Sessions', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }} />
                    <Line type="monotone" dataKey="p99" name="P99 Latency (ms)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 3: Docker Compose Lab */}
      {activeTab === 'docker_compose' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Side-by-Side Multi-Version PostgreSQL Testbed (PG 15 vs 16 vs 17)
              </h2>
              <button
                onClick={() => handleCopy(DOCKER_COMPOSE_HARNESS, 'docker')}
                className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                {copied === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'docker' ? 'Copied' : 'Copy docker-compose.yml'}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Launch this Docker Compose stack to test your workloads against PostgreSQL 15, PostgreSQL 16 (legacy 32 SLRU buffers), and PostgreSQL 17 (1024 subtrans buffers) simultaneously on separate ports.
            </p>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
            <pre className="p-5 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
              {DOCKER_COMPOSE_HARNESS}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Linux perf Profiler Guide */}
      {activeTab === 'perf_profiler' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-rose-400" />
              Linux Kernel &amp; Userspace SLRU Lock Profiling Guide
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              When subtransactions overflow the 64-cache limit, CPU profiles become dominated by shared memory locking functions. Follow these commands to generate flamegraphs and call-stack reports on Linux hosts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-amber-400">
                1. Capture 20s CPU Profile with DWARF Call-Stacks
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 text-xs font-mono text-slate-200 overflow-x-auto">
{`# Attach to all postgres worker backends
sudo perf record -F 99 -a -g \\
  -p $(pgrep -d',' -f "postgres:.*") \\
  -- sleep 20`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-sky-400">
                2. Generate Text Call-Graph Hierarchy
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 text-xs font-mono text-slate-200 overflow-x-auto">
{`# Report functions consuming highest CPU time
sudo perf report --stdio -n \\
  --sort comm,dso,symbol \\
  | head -n 40`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-emerald-400">
                3. Trace eBPF SubTrans Traversal Rate
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 text-xs font-mono text-slate-200 overflow-x-auto">
{`# Count invocations of SubTransGetParent
sudo bpftrace -e '
  uprobe:/usr/lib/postgresql/16/bin/postgres:SubTransGetParent {
    @calls[comm] = count();
  }'`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-rose-400">
                4. Key Signature of SLRU Storm to Look For
              </span>
              <p className="text-xs font-mono text-slate-300 leading-relaxed">
                If the following symbols account for &gt;40% of samples, your cluster is suffering an SLRU subtransaction lock storm:
                <br /><code className="text-rose-400">• SubTransGetTopmostTransaction</code>
                <br /><code className="text-rose-400">• SimpleLruReadPage</code>
                <br /><code className="text-rose-400">• LWLockAcquire / LWLockRelease</code>
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
