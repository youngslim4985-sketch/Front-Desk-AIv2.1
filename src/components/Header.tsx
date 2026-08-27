import React from 'react';
import { 
  Database, 
  Terminal, 
  FileCode2, 
  Flame, 
  Sparkles,
  GitFork,
  Activity,
  Layers
} from 'lucide-react';
import { InvestigationModuleId } from '../types/postgres';

interface HeaderProps {
  activeModule: InvestigationModuleId;
  onSelectModule: (id: InvestigationModuleId) => void;
  selectedPgVersion: number;
  onSelectPgVersion: (ver: number) => void;
  onOpenTerminalModal: () => void;
  onOpenScriptsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onSelectModule,
  selectedPgVersion,
  onSelectPgVersion,
  onOpenTerminalModal,
  onOpenScriptsModal,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-lg backdrop-blur-md bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectModule('overview')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-amber-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Database className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  PostgreSQL <span className="text-sky-400 font-mono text-sm font-semibold">Engine Lab</span>
                </span>
                <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  Internals Research
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Subtransactions, SLRU, MultiXact, RUNNING_XACTS, & Hot-Standby
              </p>
            </div>
          </div>

          {/* Controls & Quick Actions */}
          <div className="flex items-center gap-3">
            
            {/* Version Switcher */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-1">
              <span className="text-xs font-mono text-slate-400 px-2 flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5 text-sky-400" /> PG:
              </span>
              <div className="flex items-center gap-1">
                {[14, 15, 16, 17].map((ver) => (
                  <button
                    key={ver}
                    id={`btn-pg-version-${ver}`}
                    onClick={() => onSelectPgVersion(ver)}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-all ${
                      selectedPgVersion === ver
                        ? ver === 17
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                          : 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                    title={ver === 17 ? 'PostgreSQL 17+ (Configurable SLRU Buffers)' : `PostgreSQL ${ver} (Legacy 32 SLRU Buffers)`}
                  >
                    v{ver}{ver === 17 ? '★' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Unreleased Roadmap / Manifest Trigger */}
            <button
              id="btn-open-unreleased-manifest"
              onClick={() => onSelectModule('unreleased_scaffold')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all shadow-sm ${
                activeModule === 'unreleased_scaffold'
                  ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                  : 'bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border-indigo-700/50'
              }`}
              title="View Unreleased Research Scaffold & Milestones"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Unreleased v1.0</span>
            </button>

            {/* Quick psql Terminal Trigger */}
            <button
              id="btn-open-psql-terminal"
              onClick={onOpenTerminalModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors shadow-sm"
              title="Open Interactive psql Terminal"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">psql Shell</span>
            </button>

            {/* Quick Benchmark Scripts Trigger */}
            <button
              id="btn-open-reproducible-scripts"
              onClick={onOpenScriptsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/50 hover:bg-indigo-800/70 text-indigo-200 border border-indigo-700/60 text-xs font-medium transition-colors shadow-sm"
              title="Get Reproducible Scripts"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Reproduce (SQL/Bash)</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
