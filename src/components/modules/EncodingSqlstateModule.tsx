import React, { useState, useEffect } from 'react';
import { 
  Binary, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  FileCode,
  Flame
} from 'lucide-react';
import { postgresApi } from '../../services/postgresApi';

export const EncodingSqlstateModule: React.FC = () => {
  const [inputString, setInputString] = useState<string>('Alex M\u00f6ller \u20ac Test \x00');
  const [sourceEncoding, setSourceEncoding] = useState<string>('UTF-8');
  const [targetEncoding, setTargetEncoding] = useState<string>('LATIN1');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await postgresApi.testEncoding({
        inputString,
        sourceEncoding,
        targetEncoding,
      });
      setTestResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    handleTest();
  }, [inputString, sourceEncoding, targetEncoding]);

  const presetStrings = [
    { label: 'Clean UTF-8', val: 'Hello World 2026' },
    { label: 'Euro Symbol in LATIN1 (22P05)', val: 'Price: 50 \u20ac' },
    { label: 'Embedded Null Byte (22021)', val: 'Data\\x00Injection' },
    { label: 'Multi-lingual Diacritics', val: 'François Müller - Tokyo 東京' },
  ];

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-pink-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Binary className="w-4 h-4" /> Investigation Module 12
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          Encoding, Character Sets &amp; SQLSTATE 22P05 (untranslatable_character)
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Encoding failures are the <strong className="text-white">primary root trigger</strong> that initiates subtransaction storms in production. 
          When client pipelines encounter untranslatable bytes (<code className="font-mono text-pink-300 bg-slate-800 px-1 py-0.5 rounded text-xs">SQLSTATE 22P05</code>) 
          or invalid UTF-8 sequences (<code className="font-mono text-rose-300 bg-slate-800 px-1 py-0.5 rounded text-xs">SQLSTATE 22021</code>), 
          row-by-row exception handlers fire continuously, multiplying subtransactions and locking SLRU caches.
        </p>
      </div>

      {/* Interactive Encoding Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Input Parameters */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-pink-400" />
            Character Stream Configurator
          </h2>

          {/* Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Sample String Presets:</label>
            <div className="flex flex-wrap gap-1.5">
              {presetStrings.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputString(p.val)}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white hover:border-pink-500/50 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300 font-semibold">Input String:</label>
            <input
              type="text"
              value={inputString}
              onChange={(e) => setInputString(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Client Encoding:</label>
              <select
                value={sourceEncoding}
                onChange={(e) => setSourceEncoding(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-lg p-2 font-mono text-xs focus:outline-none"
              >
                <option value="UTF-8">UTF-8</option>
                <option value="LATIN1">LATIN1 (ISO-8859-1)</option>
                <option value="WIN1252">WIN1252</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Target Encoding:</label>
              <select
                value={targetEncoding}
                onChange={(e) => setTargetEncoding(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-lg p-2 font-mono text-xs focus:outline-none"
              >
                <option value="LATIN1">LATIN1 (ISO-8859-1)</option>
                <option value="UTF-8">UTF-8</option>
                <option value="ASCII">ASCII</option>
              </select>
            </div>
          </div>

          {/* The Root Cascade Explanation */}
          <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-900/50 space-y-1.5">
            <span className="text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              The Ingestion Disaster Chain
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1 Invalid Byte &rarr; <code className="font-mono text-pink-300">SQLSTATE 22P05</code> &rarr; PL/pgSQL Exception Catch &rarr; Subtransaction Allocation &rarr; <code className="font-mono text-rose-300">PGPROC (64)</code> Overflow &rarr; <code className="font-mono text-rose-300">SubtransSLRULock</code> Lock Convoy.
            </p>
          </div>

        </div>

        {/* Diagnostic Results */}
        <div className="lg:col-span-7 space-y-4">
          
          {testResult && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Binary className="w-4 h-4 text-pink-400" /> Byte Inspection &amp; SQLSTATE Validation
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  testResult.isValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}>
                  {testResult.isValid ? 'VALID SEQUENCE' : `ERROR ${testResult.sqlState || '22P05'}`}
                </span>
              </div>

              {/* Raw Byte Sequence */}
              <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Raw Byte Stream (Hex):</span>
                <div className="text-sky-300 break-all">{testResult.inputBytesHex || '00'}</div>
              </div>

              {/* Error Output if Invalid */}
              {!testResult.isValid && (
                <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800 space-y-1 font-mono text-xs">
                  <div className="text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> PostgreSQL Runtime Exception:
                  </div>
                  <div className="text-rose-200 text-[11px] leading-relaxed pl-5">
                    {testResult.errorMessage}
                  </div>
                </div>
              )}

              {/* Remediation Pipeline */}
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40 space-y-2">
                <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Recommended Pre-Sanitization Pattern
                </span>
                <ul className="text-xs text-slate-300 space-y-1 font-mono text-[11px]">
                  {testResult.remediation.map((rem: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 mt-0.5">&bull;</span>
                      <span>{rem}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
