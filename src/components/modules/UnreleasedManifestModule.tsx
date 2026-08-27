import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  FileCode2, 
  Search, 
  Flame, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  Cpu,
  GitBranch,
  Terminal,
  Activity
} from 'lucide-react';
import { InvestigationModuleId } from '../../types/postgres';
import { UNRELEASED_ROADMAP_HEADER, UNRELEASED_MILESTONES } from '../../data/researchData';

interface UnreleasedManifestModuleProps {
  onSelectModule: (id: InvestigationModuleId) => void;
  selectedPgVersion: number;
}

export const UnreleasedManifestModule: React.FC<UnreleasedManifestModuleProps> = ({
  onSelectModule,
  selectedPgVersion,
}) => {
  return (
    <div className="space-y-8">
      
      {/* Hero Header */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {UNRELEASED_ROADMAP_HEADER.versionTag}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Source-Audited PG 14–17
            </span>
            <span className="text-xs font-mono text-slate-400 ml-auto hidden sm:inline">
              Updated: {UNRELEASED_ROADMAP_HEADER.lastUpdated}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {UNRELEASED_ROADMAP_HEADER.releaseName}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-4xl">
            {UNRELEASED_ROADMAP_HEADER.abstract}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectModule('source_verification')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs font-mono flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <FileCode2 className="w-4 h-4" />
              Explore C Source Proofs
            </button>
            <button
              onClick={() => onSelectModule('diagnostic_sql')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs font-mono flex items-center gap-2 transition-all"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              Diagnostic SQL Suite
            </button>
            <button
              onClick={() => onSelectModule('experimental_harness')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs font-mono flex items-center gap-2 transition-all"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              Experimental Harness
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Pillars Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Four Foundational Research Pillars
            </h2>
            <p className="text-xs text-slate-400">
              Verified specifications, diagnostic queries, and laboratory harnesses across the PostgreSQL storage and transaction engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {UNRELEASED_MILESTONES.map((milestone, idx) => (
            <div
              key={milestone.id}
              className="group rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-5 transition-all shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded">
                    PILLAR 0{idx + 1}
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {milestone.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {milestone.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {milestone.shortDescription}
                </p>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    Key Deliverables:
                  </span>
                  <ul className="space-y-1">
                    {milestone.deliverables.map((del, dIdx) => (
                      <li key={dIdx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <span className="flex-1">{del}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onSelectModule(milestone.linkedModuleId)}
                  className="text-xs font-mono font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 group-hover:translate-x-1 transition-all"
                >
                  Open Module <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Subsystem Research Coverage Matrix */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          Engine Research Coverage Matrix (PG 14 vs 15 vs 16 vs 17)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80">
                <th className="p-3">Engine Subsystem</th>
                <th className="p-3">Source Anchor</th>
                <th className="p-3">PG 14–16 Behavior</th>
                <th className="p-3 text-emerald-400">PG 17+ Modern Overhaul</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-white">PGPROC Subxid Cache</td>
                <td className="p-3 text-indigo-400">src/include/storage/proc.h</td>
                <td className="p-3 text-amber-300">64 entries fixed in shared mem</td>
                <td className="p-3 text-slate-400">Unchanged (64 entries preserved)</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-white">pg_subtrans SLRU Buffers</td>
                <td className="p-3 text-indigo-400">src/backend/access/transam/slru.c</td>
                <td className="p-3 text-rose-300">32 fixed buffers (256 KB)</td>
                <td className="p-3 text-emerald-300 font-bold">subtrans_buffers (up to 8192 / 64MB)</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-white">MultiXact Member Buffers</td>
                <td className="p-3 text-indigo-400">src/backend/access/transam/multixact.c</td>
                <td className="p-3 text-rose-300">16 fixed buffers (128 KB)</td>
                <td className="p-3 text-emerald-300 font-bold">multixact_members_buffers GUC</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-white">RUNNING_XACTS WAL Format</td>
                <td className="p-3 text-indigo-400">src/include/access/xloginsert.h</td>
                <td className="p-3 text-slate-300">subxid_overflow bitfield</td>
                <td className="p-3 text-slate-300">subxid_overflow bitfield preserved</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-white">Hot Standby Snapshot Delay</td>
                <td className="p-3 text-indigo-400">src/backend/storage/ipc/standby.c</td>
                <td className="p-3 text-amber-300">Stalls until top XID completes</td>
                <td className="p-3 text-amber-300">Stalls until top XID completes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
