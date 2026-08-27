import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  RotateCcw, 
  Settings2, 
  Check, 
  Layers, 
  Sparkles,
  Search,
  Maximize2
} from 'lucide-react';
import { postgresApi } from '../../services/postgresApi';
import { PsqlQueryResult } from '../../types/postgres';

export const PsqlTerminalModule: React.FC = () => {
  const [commandInput, setCommandInput] = useState<string>('SELECT * FROM pg_stat_slru;');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [borderStyle, setBorderStyle] = useState<0 | 1 | 2>(2);
  const [lineStyle, setLineStyle] = useState<'unicode' | 'ascii'>('unicode');
  const [formatMode, setFormatMode] = useState<'aligned' | 'wrapped' | 'csv' | 'unaligned'>('aligned');
  const [terminalWidth, setTerminalWidth] = useState<'compact' | 'normal' | 'wide'>('normal');
  const [history, setHistory] = useState<{ query: string; result: PsqlQueryResult | null; rawError?: string }[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const presetQueries = [
    { label: 'pg_stat_slru (SLRU Cache Stats)', sql: 'SELECT * FROM pg_stat_slru;' },
    { label: 'pg_stat_activity (Lock Convoys)', sql: "SELECT pid, usename, wait_event_type, wait_event, state FROM pg_stat_activity WHERE wait_event_type = 'LWLock';" },
    { label: 'PG 17 Sizing GUCs', sql: "SHOW subtrans_buffers;" },
    { label: 'User Tables Activity', sql: 'SELECT schemaname, relname, seq_scan, idx_scan FROM pg_stat_user_tables;' },
  ];

  const handleExecute = async (cmdToRun?: string) => {
    const cmd = cmdToRun || commandInput;
    if (!cmd.trim()) return;

    // Handle psql meta-commands locally
    const trimmed = cmd.trim();
    if (trimmed === '\\x' || trimmed === '\\x on') {
      setIsExpanded(true);
      setHistory((prev) => [...prev, { query: cmd, result: { command: cmd, columns: ['status'], rows: [['Expanded display is on.']], rowCount: 1, executionTimeMs: 0.1 } }]);
      return;
    }
    if (trimmed === '\\x off') {
      setIsExpanded(false);
      setHistory((prev) => [...prev, { query: cmd, result: { command: cmd, columns: ['status'], rows: [['Expanded display is off.']], rowCount: 1, executionTimeMs: 0.1 } }]);
      return;
    }
    if (trimmed === '\\pset border 0') { setBorderStyle(0); return; }
    if (trimmed === '\\pset border 1') { setBorderStyle(1); return; }
    if (trimmed === '\\pset border 2') { setBorderStyle(2); return; }

    setIsExecuting(true);
    try {
      const res = await postgresApi.executePsql({ command: cmd });
      setHistory((prev) => [...prev, { query: cmd, result: res }]);
    } catch (err: any) {
      setHistory((prev) => [...prev, { query: cmd, result: null, rawError: err.message || 'Execution error' }]);
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    if (history.length === 0) {
      handleExecute('SELECT * FROM pg_stat_slru;');
    }
  }, []);

  // Format tabular output
  const renderTable = (result: PsqlQueryResult) => {
    if (!result || !result.columns || result.columns.length === 0) {
      return <div className="text-slate-500 font-mono text-xs">(0 rows)</div>;
    }

    // Expanded (\x) display
    if (isExpanded) {
      return (
        <div className="space-y-4 font-mono text-xs text-slate-200">
          {result.rows.map((row, rIdx) => (
            <div key={rIdx} className="border-t border-slate-800 pt-2 space-y-1">
              <div className="text-sky-400 font-bold">-[ RECORD {rIdx + 1} ]------------------------------------</div>
              {result.columns.map((col, cIdx) => (
                <div key={cIdx} className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 text-slate-400 text-right pr-2 truncate">{col}</span>
                  <span className="col-span-8 text-white font-medium">| {String(row[cIdx] ?? '')}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="text-slate-500 text-[11px]">({result.rowCount} rows) • Time: {result.executionTimeMs} ms</div>
        </div>
      );
    }

    // CSV format
    if (formatMode === 'csv') {
      return (
        <pre className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
          {result.columns.join(',') + '\n'}
          {result.rows.map((r) => r.join(',')).join('\n')}
        </pre>
      );
    }

    // Standard Aligned / Unicode Table
    return (
      <div className="overflow-x-auto font-mono text-xs">
        <table className={`w-full text-left ${borderStyle === 2 ? 'border-collapse' : ''}`}>
          <thead>
            <tr className="border-b border-slate-700 text-sky-300">
              {result.columns.map((col, idx) => (
                <th key={idx} className="px-3 py-1.5 font-bold uppercase tracking-wider text-[11px]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {result.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-800/40">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                    {cell === null ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-2 text-slate-500 text-[11px] flex items-center justify-between border-t border-slate-800/60 mt-2">
          <span>({result.rowCount} rows)</span>
          <span>Time: {result.executionTimeMs} ms</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-teal-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Terminal className="w-4 h-4" /> Investigation Module 11
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          PostgreSQL psql Formatting, Width &amp; Alignment Engine
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Diagnostic inspection of internal tables (<code className="font-mono text-teal-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_stat_slru</code>, 
          <code className="font-mono text-teal-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_locks</code>, <code className="font-mono text-teal-300 bg-slate-800 px-1 py-0.5 rounded text-xs">pg_stat_activity</code>) 
          often produces tables with dozens of columns. Mastering <code className="font-mono text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-xs">\x auto</code> (expanded mode), 
          <code className="font-mono text-sky-300 bg-slate-800 px-1 py-0.5 rounded text-xs">\pset format</code>, and unicode border settings is critical for incident diagnosis.
        </p>
      </div>

      {/* Preset Quick Queries */}
      <div className="flex flex-wrap gap-2">
        {presetQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCommandInput(q.sql);
              handleExecute(q.sql);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 text-teal-400" />
            {q.label}
          </button>
        ))}
      </div>

      {/* Terminal Shell Container */}
      <div className="rounded-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono">
        
        {/* Terminal Titlebar */}
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs text-slate-400 font-semibold ml-2">
              psql (PostgreSQL 17.2, server 17.2)
            </span>
          </div>

          {/* psql Format Toggles */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
                isExpanded ? 'bg-amber-950 border-amber-700 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Toggle expanded record formatting (\x)"
            >
              \x {isExpanded ? 'ON' : 'OFF'}
            </button>

            <select
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as any)}
              className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-0.5 text-[11px] focus:outline-none"
            >
              <option value="aligned">format: aligned</option>
              <option value="wrapped">format: wrapped</option>
              <option value="csv">format: csv</option>
              <option value="unaligned">format: unaligned</option>
            </select>

            <button
              onClick={() => setHistory([])}
              className="p-1 text-slate-400 hover:text-white"
              title="Clear terminal history"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Output Area */}
        <div className="p-5 space-y-6 max-h-[500px] overflow-y-auto bg-slate-950/95">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="text-slate-500">postgres=#</span>
                <span className="text-white font-bold">{item.query}</span>
              </div>
              {item.rawError && (
                <div className="text-rose-400 text-xs pl-4 border-l-2 border-rose-500">
                  {item.rawError}
                </div>
              )}
              {item.result && (
                <div className="pl-2 pt-1">
                  {item.result.notice && (
                    <div className="text-xs text-amber-300/80 mb-2">
                      NOTICE: {item.result.notice}
                    </div>
                  )}
                  {renderTable(item.result)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Command Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 pl-2">postgres=#</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            placeholder="Type SQL or \x, \pset border 0, etc..."
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-slate-600"
          />
          <button
            onClick={() => handleExecute()}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-mono font-bold flex items-center gap-1 transition-colors"
          >
            <Play className="w-3 h-3" /> Run
          </button>
        </div>

      </div>

    </div>
  );
};
