import React from 'react';
import { 
  Database, 
  Layers, 
  Cpu, 
  HardDrive, 
  Lock, 
  Sliders, 
  Activity, 
  FileText, 
  Server, 
  Terminal, 
  Binary, 
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  GitCommit,
  ExternalLink
} from 'lucide-react';
import { InvestigationModuleId } from '../../types/postgres';

interface ArchitectureOverviewModuleProps {
  onSelectModule: (id: InvestigationModuleId) => void;
  selectedPgVersion: number;
}

export const ArchitectureOverviewModule: React.FC<ArchitectureOverviewModuleProps> = ({
  onSelectModule,
  selectedPgVersion,
}) => {
  const steps = [
    {
      num: '01',
      id: 'plpgsql_exceptions' as InvestigationModuleId,
      title: 'Row-by-Row Exception Loops',
      category: 'Client / PLpgSQL',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      desc: 'Each BEGIN ... EXCEPTION block inside a loop implicitly creates a subtransaction savepoint.',
      impact: 'Creates thousands of nested subtransactions per top-level transaction.',
      accent: 'border-amber-500/40 bg-amber-950/20',
    },
    {
      num: '02',
      id: 'xid_subtransactions' as InvestigationModuleId,
      title: 'XID Allocation & SubXacts',
      category: 'Transaction Manager',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      desc: 'DML operations inside the savepoint force PostgreSQL to allocate a real 32-bit TransactionId.',
      impact: 'Consumes XID epoch space rapidly and registers in pg_subtrans.',
      accent: 'border-indigo-500/40 bg-indigo-950/20',
    },
    {
      num: '03',
      id: 'pgproc_overflow' as InvestigationModuleId,
      title: 'PGPROC 64 Cache Overflow',
      category: 'Memory (proc.h)',
      icon: <Cpu className="w-5 h-5 text-rose-400" />,
      desc: 'PGPROC holds at most 64 subxids in memory. Subxact #65 flips subxids.overflowed = TRUE.',
      impact: 'Bypasses zero-lock in-memory visibility fast-path. Forces SLRU disk lookup.',
      accent: 'border-rose-500/40 bg-rose-950/20',
    },
    {
      num: '04',
      id: 'pg_subtrans_slru' as InvestigationModuleId,
      title: 'pg_subtrans & SLRU Contention',
      category: 'SLRU Cache Engine',
      icon: <HardDrive className="w-5 h-5 text-cyan-400" />,
      desc: 'SLRU pages hold 2048 parent XID pointers. Readers must acquire SubtransSLRULock.',
      impact: 'Lock convoying: 1 writer with 500 subxids blocks 50 concurrent readers.',
      accent: 'border-cyan-500/40 bg-cyan-950/20',
    },
    {
      num: '05',
      id: 'multixact_pressure' as InvestigationModuleId,
      title: 'MultiXact Shared Locking',
      category: 'MultiXact Engine',
      icon: <Lock className="w-5 h-5 text-violet-400" />,
      desc: 'Multiple SELECT FOR SHARE locks create MultiXactIds in offsets & members SLRU pages.',
      impact: 'MultiXactMemberControlLock contention and emergency wraparound vacuum.',
      accent: 'border-violet-500/40 bg-violet-950/20',
    },
    {
      num: '06',
      id: 'pg17_slru_sizing' as InvestigationModuleId,
      title: 'PostgreSQL 17 SLRU Buffers',
      category: 'PG 17 Overhaul',
      icon: <Sliders className="w-5 h-5 text-emerald-400" />,
      desc: 'PG 17 makes subtrans_buffers & multixact_members_buffers configurable (no longer 32 fixed).',
      impact: 'Allows scaling SLRU pools from 256KB to 64MB+, preventing thrashing.',
      accent: 'border-emerald-500/40 bg-emerald-950/20',
    },
    {
      num: '07',
      id: 'concurrency_contention' as InvestigationModuleId,
      title: 'Concurrent Session Collapse',
      category: 'System Throughput',
      icon: <Activity className="w-5 h-5 text-amber-500" />,
      desc: 'Innocent SELECT queries experience SubtransSLRULock wait events in pg_stat_activity.',
      impact: 'Throughput drops from 10,000 TPS to <100 TPS while CPU context switches spike.',
      accent: 'border-amber-500/40 bg-amber-950/20',
    },
    {
      num: '08',
      id: 'running_xacts_wal' as InvestigationModuleId,
      title: 'RUNNING_XACTS WAL Overflow',
      category: 'WAL & Checkpointer',
      icon: <FileText className="w-5 h-5 text-orange-400" />,
      desc: 'xl_running_xacts WAL records mark subxid_overflow = true and bloat record size.',
      impact: 'Primary checkpoint write amplification and standbys receive incomplete subxid lists.',
      accent: 'border-orange-500/40 bg-orange-950/20',
    },
    {
      num: '09',
      id: 'hot_standby_lag' as InvestigationModuleId,
      title: 'Hot-Standby Snapshot Delay',
      category: 'Replication / Standby',
      icon: <Server className="w-5 h-5 text-red-400" />,
      desc: 'Standby StartupProcess cannot construct consistent snapshots when subxid_overflow is true.',
      impact: 'Replica lag spikes, snapshot build stalls, and query cancellations occur.',
      accent: 'border-red-500/40 bg-red-950/20',
    },
    {
      num: '10',
      id: 'psql_width_alignment' as InvestigationModuleId,
      title: 'psql TTY Formatting Engine',
      category: 'Diagnostics & Terminal',
      icon: <Terminal className="w-5 h-5 text-teal-400" />,
      desc: 'Formatting wide system tables (pg_stat_slru, pg_locks) using \\x auto and unicode borders.',
      impact: 'Critical for on-call triage and visualizing wide engine diagnostic outputs.',
      accent: 'border-teal-500/40 bg-teal-950/20',
    },
    {
      num: '11',
      id: 'encoding_sqlstate_22p05' as InvestigationModuleId,
      title: 'Encoding & SQLSTATE 22P05',
      category: 'Data Ingestion / Encoding',
      icon: <Binary className="w-5 h-5 text-pink-400" />,
      desc: 'Byte validation failures (untranslatable_character) cascade into row-by-row exception loops.',
      impact: 'Trigger point that initiates the entire subtransaction avalanche.',
      accent: 'border-pink-500/40 bg-pink-950/20',
    },
  ];

  return (
    <div className="space-y-8">
      
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 text-xs font-mono">
            <Database className="w-3.5 h-3.5" /> PostgreSQL Systems Research Suite
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Subtransaction Lifecycle & Engine Contention Investigation
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            In PostgreSQL, a single innocent <code className="font-mono text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">EXCEPTION</code> block 
            inside a loop can trigger a cascade across 9 core storage subsystems: exceeding the <code className="font-mono text-rose-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">PGPROC (64)</code> in-memory 
            array, flooding <code className="font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">pg_subtrans</code> SLRU buffers, causing <code className="font-mono text-red-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">SubtransSLRULock</code> convoying, 
            and destabilizing Hot-Standby read replicas.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectModule('unreleased_scaffold')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Database className="w-4 h-4" /> Unreleased Research Pillars <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectModule('source_verification')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <GitCommit className="w-4 h-4 text-cyan-400" /> C Source Verification
            </button>
            <button
              onClick={() => onSelectModule('diagnostic_sql')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Terminal className="w-4 h-4 text-emerald-400" /> Diagnostic SQL
            </button>
            <button
              onClick={() => onSelectModule('experimental_harness')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-amber-400" /> Experimental Harness
            </button>
          </div>
        </div>
      </div>

      {/* Interactive System Flow Map */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            11-Step Cascade Architecture Map
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Selected PG Version: <span className="text-sky-400 font-bold">v{selectedPgVersion}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step) => (
            <div
              key={step.id}
              onClick={() => onSelectModule(step.id)}
              className={`rounded-xl border p-5 transition-all cursor-pointer group hover:scale-[1.01] hover:shadow-lg ${step.accent}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shadow-inner">
                    {step.icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Step {step.num} • {step.category}
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                      {step.title}
                    </h3>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>

              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                {step.desc}
              </p>

              <div className="rounded bg-slate-950/70 p-2 border border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Failure Mode: </span>
                {step.impact}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PostgreSQL 16 vs 17 Architectural Comparison Callout */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          The PostgreSQL 17 SLRU Milestone
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/40 space-y-2">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold font-mono uppercase">
              <ShieldAlert className="w-4 h-4" /> PostgreSQL 14 / 15 / 16 (Legacy)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              SLRU buffers are hardcoded in C source (<code className="font-mono text-rose-300">NUM_SUBTRANS_BUFFERS = 32</code>).
              Total cache size is strictly fixed at <strong>256 KB</strong> (32 pages × 8KB). Once subtransactions exceed this tiny pool under concurrency, 
              intense disk thrashing and <code className="font-mono text-rose-300">SubtransSLRULock</code> queue stalls occur.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold font-mono uppercase">
              <CheckCircle2 className="w-4 h-4" /> PostgreSQL 17+ (Modern)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              SLRU buffer pools are fully configurable via <code className="font-mono text-emerald-300">subtrans_buffers</code> and <code className="font-mono text-emerald-300">multixact_members_buffers</code> 
              (sizing up to 8192 buffers / 64MB). Auto-sizing based on <code className="font-mono text-emerald-300">shared_buffers</code> keeps hit ratio &gt;99% under heavy subtransaction loads.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
