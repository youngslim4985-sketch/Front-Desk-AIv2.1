import React from 'react';
import { 
  InvestigationModuleId, 
  ModuleMetadata 
} from '../types/postgres';
import { 
  MODULE_METADATA_LIST 
} from '../data/researchData';
import { 
  Layers, 
  AlertTriangle, 
  Cpu, 
  HardDrive, 
  Lock, 
  Sliders, 
  Activity, 
  FileText, 
  Server, 
  Terminal, 
  Binary, 
  Code,
  Map,
  Sparkles,
  FileCode2,
  Search,
  Flame
} from 'lucide-react';

interface NavigationProps {
  activeModuleId: InvestigationModuleId;
  onSelectModule: (id: InvestigationModuleId) => void;
}

const MODULE_ICONS: Record<InvestigationModuleId, React.ReactNode> = {
  overview: <Map className="w-4 h-4 text-sky-400" />,
  unreleased_scaffold: <Sparkles className="w-4 h-4 text-indigo-400" />,
  source_verification: <FileCode2 className="w-4 h-4 text-cyan-400" />,
  diagnostic_sql: <Search className="w-4 h-4 text-emerald-400" />,
  experimental_harness: <Flame className="w-4 h-4 text-amber-400" />,
  plpgsql_exceptions: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  xid_subtransactions: <Layers className="w-4 h-4 text-indigo-400" />,
  pgproc_overflow: <Cpu className="w-4 h-4 text-rose-400" />,
  pg_subtrans_slru: <HardDrive className="w-4 h-4 text-cyan-400" />,
  multixact_pressure: <Lock className="w-4 h-4 text-violet-400" />,
  pg17_slru_sizing: <Sliders className="w-4 h-4 text-emerald-400" />,
  concurrency_contention: <Activity className="w-4 h-4 text-amber-500" />,
  running_xacts_wal: <FileText className="w-4 h-4 text-orange-400" />,
  hot_standby_lag: <Server className="w-4 h-4 text-red-400" />,
  psql_width_alignment: <Terminal className="w-4 h-4 text-teal-400" />,
  encoding_sqlstate_22p05: <Binary className="w-4 h-4 text-pink-400" />,
  reproducible_scripts: <Code className="w-4 h-4 text-blue-400" />,
};

export const Navigation: React.FC<NavigationProps> = ({
  activeModuleId,
  onSelectModule,
}) => {
  const categories = [
    'Unreleased Pillars',
    'Overview & Scripts',
    'Core Subtransactions',
    'SLRU & MultiXact',
    'Concurrency & Standby',
    'Terminal & Encoding',
  ] as const;

  return (
    <aside className="w-full lg:w-72 bg-slate-900/90 border-r border-slate-800 p-3 lg:p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Category Grouping */}
      {categories.map((cat) => {
        const modules = MODULE_METADATA_LIST.filter((m) => m.category === cat);
        if (modules.length === 0) return null;

        return (
          <div key={cat} className="flex flex-col gap-1">
            <div className="px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              {cat}
            </div>

            <div className="flex flex-col gap-1">
              {modules.map((mod) => {
                const isActive = activeModuleId === mod.id;
                return (
                  <button
                    key={mod.id}
                    id={`nav-module-${mod.id}`}
                    onClick={() => onSelectModule(mod.id)}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all group ${
                      isActive
                        ? 'bg-slate-800 text-white border border-sky-500/30 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {MODULE_ICONS[mod.id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold truncate">
                          {mod.number !== '00' && mod.number !== '12' ? `${mod.number}. ` : ''}
                          {mod.shortTitle}
                        </span>
                        {mod.badge && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium shrink-0 ${
                            mod.badge.includes('Critical') || mod.badge.includes('Anti')
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                              : mod.badge.includes('PG 17')
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                          }`}>
                            {mod.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 leading-tight mt-0.5">
                        {mod.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Quick Summary Footnote */}
      <div className="mt-auto pt-3 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
        <p className="flex items-center justify-between">
          <span>Engine Focus:</span>
          <span className="text-sky-400 font-semibold">Postgres v14–v17</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          12 Interactive Research Vectors
        </p>
      </div>

    </aside>
  );
};
