import React, { useState } from 'react';
import { 
  Search, 
  Terminal, 
  Copy, 
  Check, 
  Play, 
  AlertTriangle, 
  HelpCircle, 
  Layers, 
  Sliders, 
  HardDrive, 
  Lock, 
  Server,
  Activity,
  CheckCircle2,
  Table
} from 'lucide-react';
import { DIAGNOSTIC_SQL_SUITE } from '../../data/researchData';
import { DiagnosticQuery } from '../../types/postgres';

interface DiagnosticSqlModuleProps {
  onOpenTerminalWithQuery?: (sql: string) => void;
}

export const DiagnosticSqlModule: React.FC<DiagnosticSqlModuleProps> = ({
  onOpenTerminalWithQuery,
}) => {
  const [selectedQueryId, setSelectedQueryId] = useState<string>(DIAGNOSTIC_SQL_SUITE[0].id);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [executedResults, setExecutedResults] = useState<boolean>(true);

  const categories = ['all', 'SLRU I/O & Buffers', 'Subtransactions & Locks', 'MultiXact & Wraparound', 'Hot Standby & WAL', 'Server GUCs & Configuration'];

  const currentQuery = DIAGNOSTIC_SQL_SUITE.find((q) => q.id === selectedQueryId) || DIAGNOSTIC_SQL_SUITE[0];

  const filteredQueries = DIAGNOSTIC_SQL_SUITE.filter((q) => {
    const matchesCat = categoryFilter === 'all' || q.category === categoryFilter;
    const matchesSearch = searchQuery === '' || 
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.sql.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(currentQuery.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Terminal className="w-4 h-4" /> Diagnostic SQL Suite
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Production PostgreSQL Diagnostic &amp; Catalog Query Suite
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Zero-overhead, real-time diagnostic queries to identify subtransaction storms, SLRU cache thrashing (<code className="text-emerald-300 font-mono text-xs">pg_stat_slru</code>), lock convoys (<code className="text-emerald-300 font-mono text-xs">SubtransSLRULock</code>), and MultiXact wraparound risks.
        </p>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Queries' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter diagnostic SQL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Grid: Query Navigator + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left List of Queries */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
            Diagnostic Queries ({filteredQueries.length})
          </span>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredQueries.map((q) => {
              const isSelected = selectedQueryId === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueryId(q.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 mb-1">
                    <span>{q.category}</span>
                    <span className="text-slate-400">{q.targetVersion}</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-100">
                    {q.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {q.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Query Details & Execution */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {currentQuery.category}
                </span>
                <h2 className="text-base font-bold text-white font-mono mt-0.5">
                  {currentQuery.title}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                Target: {currentQuery.targetVersion}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {currentQuery.description}
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <span className="font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" /> Why This Query Matters:
              </span>
              <p className="leading-relaxed">
                {currentQuery.whyItMatters}
              </p>
            </div>
          </div>

          {/* SQL Editor Window */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl">
            <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-300 font-semibold flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                PostgreSQL Catalog SQL Statement
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy SQL'}
                </button>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="font-mono text-xs text-emerald-300 leading-relaxed">
                {currentQuery.sql}
              </pre>
            </div>
          </div>

          {/* Column Dictionary Table */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Table className="w-4 h-4 text-sky-400" />
              Result Column Dictionary &amp; Engine Meaning
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950">
                    <th className="p-2.5">Column</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Diagnostic Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {currentQuery.columnsExplained.map((col, cIdx) => (
                    <tr key={cIdx} className="hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-emerald-300">{col.name}</td>
                      <td className="p-2.5 text-slate-400">{col.type}</td>
                      <td className="p-2.5 text-slate-300 font-sans text-xs">{col.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Result Preview */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Live Simulated Query Output Preview
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {currentQuery.sampleOutput.rows.length} rows returned (0.84ms)
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 p-3">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    {currentQuery.sampleOutput.columns.map((col) => (
                      <th key={col} className="p-2 font-semibold text-slate-300">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {currentQuery.sampleOutput.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/50">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2">
                          {cell === null ? (
                            <span className="text-slate-600">NULL</span>
                          ) : typeof cell === 'number' ? (
                            <span className="text-sky-300">{cell}</span>
                          ) : typeof cell === 'boolean' ? (
                            <span className={cell ? 'text-emerald-400' : 'text-rose-400'}>{String(cell)}</span>
                          ) : (
                            <span>{String(cell)}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommended Action & Alert Conditions */}
          <div className="rounded-xl bg-amber-950/20 border border-amber-900/40 p-5 space-y-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Operational Alert Threshold &amp; Recommended Action
            </h3>
            {currentQuery.alertCondition && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs font-mono text-amber-200">
                <span className="font-bold">Alert Rule: </span> {currentQuery.alertCondition}
              </div>
            )}
            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              <span className="text-amber-400 font-bold">Action Plan: </span>
              {currentQuery.recommendedAction}
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
