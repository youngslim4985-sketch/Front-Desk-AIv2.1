import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Terminal, 
  Download, 
  Flame, 
  ShieldCheck, 
  Play, 
  Sliders, 
  Layers,
  BookOpen
} from 'lucide-react';
import { REPRODUCIBLE_BENCHMARK_SCRIPTS } from '../../data/researchData';

export const BenchmarkHubModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sql_antipattern' | 'sql_optimized' | 'bash_harness' | 'pg17_conf'>('sql_antipattern');
  const [copied, setCopied] = useState<boolean>(false);

  const scripts = {
    sql_antipattern: {
      title: 'Anti-Pattern PL/pgSQL Script (Row-by-Row Exception)',
      filename: 'anti_pattern_subxact.sql',
      code: REPRODUCIBLE_BENCHMARK_SCRIPTS.anti_pattern_plpgsql,
      desc: 'Creates a row-by-row subtransaction loop that blows past the 64-subxact PGPROC cache and forces SLRU disk thrashing.',
    },
    sql_optimized: {
      title: 'Optimized Batch Staging Ingestion Pattern',
      filename: 'optimized_batch_staging.sql',
      code: REPRODUCIBLE_BENCHMARK_SCRIPTS.optimized_batch_sql,
      desc: 'Uses UNNEST / temporary staging table with bulk INSERT ... ON CONFLICT DO NOTHING to consume exactly 1 XID for 10,000 rows.',
    },
    bash_harness: {
      title: 'Reproducible pgbench & perf Profiling Harness',
      filename: 'reproduce_slru_storm.sh',
      code: REPRODUCIBLE_BENCHMARK_SCRIPTS.pgbench_stress_script,
      desc: 'Full automated bash script initializing a test DB, launching 40 concurrent readers and 5 subxact writers, and capturing perf call stacks.',
    },
    pg17_conf: {
      title: 'PostgreSQL 17+ SLRU Tuning Configuration',
      filename: 'postgresql17_slru.conf',
      code: REPRODUCIBLE_BENCHMARK_SCRIPTS.pg17_conf_tuning,
      desc: 'High-performance postgresql.conf settings allocating 1024 subtrans and multixact buffers for high-concurrency workloads.',
    },
  };

  const currentScript = scripts[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentScript.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([currentScript.code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = currentScript.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <BookOpen className="w-4 h-4" /> Research Verification Suite
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Reproducible Benchmark Scripts &amp; Profiling Harnesses
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          All research claims in this workbench are 100% reproducible on local bare-metal, VM, or containerized PostgreSQL clusters. 
          Use these ready-to-run <code className="font-mono text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pgbench</code> scripts, 
          perf profiling commands, and staging SQL templates to test your systems.
        </p>
      </div>

      {/* Script Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {(Object.keys(scripts) as (keyof typeof scripts)[]).map((tabKey) => {
          const item = scripts[tabKey];
          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs transition-all flex items-center gap-2 ${
                activeTab === tabKey
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              {item.filename}
            </button>
          );
        })}
      </div>

      {/* Active Script Viewer */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        
        {/* Card Header */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              {currentScript.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentScript.desc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-5 bg-slate-950 overflow-x-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed">
            {currentScript.code}
          </pre>
        </div>

      </div>

      {/* Step-by-Step Profiling Guide */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          Step-by-Step Production Profiling Guide (Linux perf)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-amber-400 font-bold">1. Find Active Backend PID</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Query <code className="text-slate-300">pg_stat_activity</code> for the writer session executing the batch ingestion loop.
            </p>
            <div className="p-2 rounded bg-slate-900 text-[10px] text-slate-300">
              SELECT pid FROM pg_stat_activity WHERE query LIKE '%ingest%';
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-sky-400 font-bold">2. Capture perf Call Stack</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Record 10 seconds of CPU call stacks to inspect SLRU lock acquisition overhead.
            </p>
            <div className="p-2 rounded bg-slate-900 text-[10px] text-slate-300">
              sudo perf record -g -p &lt;PID&gt; -- sleep 10
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-emerald-400 font-bold">3. Identify Bottleneck Functions</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Verify if CPU is dominated by <code className="text-rose-400">LWLockAcquire</code> and <code className="text-rose-400">SubTransGetTopmostTransaction</code>.
            </p>
            <div className="p-2 rounded bg-slate-900 text-[10px] text-slate-300">
              sudo perf report -n --stdio
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
