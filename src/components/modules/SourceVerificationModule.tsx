import React, { useState } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  AlertOctagon, 
  Binary, 
  Layers, 
  Cpu, 
  HardDrive, 
  Lock, 
  Server,
  Terminal,
  BookOpen
} from 'lucide-react';
import { SOURCE_VERIFICATION_DOCS } from '../../data/researchData';
import { SourceVerificationDoc } from '../../types/postgres';

export const SourceVerificationModule: React.FC = () => {
  const [selectedDocId, setSelectedDocId] = useState<string>(SOURCE_VERIFICATION_DOCS[0].id);
  const [copied, setCopied] = useState<boolean>(false);
  const [filterSubsystem, setFilterSubsystem] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentDoc = SOURCE_VERIFICATION_DOCS.find((d) => d.id === selectedDocId) || SOURCE_VERIFICATION_DOCS[0];

  const subsystems = ['all', 'Memory / PGPROC', 'Storage / SLRU', 'Lock Manager / MultiXact', 'WAL / Replication'];

  const filteredDocs = SOURCE_VERIFICATION_DOCS.filter((doc) => {
    const matchesSubsystem = filterSubsystem === 'all' || doc.subsystem === filterSubsystem;
    const matchesSearch = searchQuery === '' || 
      doc.sourceFile.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.sourceFunctionOrStruct.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubsystem && matchesSearch;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentDoc.cCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <FileCode2 className="w-4 h-4" /> Source-Verification Documentation
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          PostgreSQL Engine C Source-Verification Hub
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
          Line-anchored proof of engine mechanics directly extracted from PostgreSQL C source files (<code className="text-indigo-300 font-mono text-xs">proc.h</code>, <code className="text-indigo-300 font-mono text-xs">subtrans.c</code>, <code className="text-indigo-300 font-mono text-xs">slru.c</code>, <code className="text-indigo-300 font-mono text-xs">multixact.c</code>, <code className="text-indigo-300 font-mono text-xs">xloginsert.h</code>).
        </p>
      </div>

      {/* Subsystem Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {subsystems.map((sub) => (
            <button
              key={sub}
              onClick={() => setFilterSubsystem(sub)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                filterSubsystem === sub
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {sub === 'all' ? 'All Subsystems' : sub}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search C structs, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Layout: File Selector + Deep-Dive Document */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Source Anchors List */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
            Verified Engine Anchors ({filteredDocs.length})
          </span>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-indigo-400 mb-1">
                    <span>{doc.subsystem}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-100 truncate">
                    {doc.sourceFunctionOrStruct}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 mt-0.5 truncate">
                    {doc.sourceFile}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Document Inspector */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {currentDoc.subsystem}
                </span>
                <h2 className="text-base font-bold text-white font-mono mt-0.5">
                  {currentDoc.sourceFunctionOrStruct}
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  File: {currentDoc.sourceFile}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                {currentDoc.versionSpecifics}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {currentDoc.summary}
            </p>
          </div>

          {/* C Code Window */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl">
            <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-300 font-semibold flex items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                C Engine Source Excerpt ({currentDoc.sourceFile})
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="font-mono text-xs text-slate-200 leading-relaxed">
                {currentDoc.cCode}
              </pre>
            </div>
          </div>

          {/* Core Invariants & Proofs */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Engine Invariants &amp; Architectural Guarantees
            </h3>
            <div className="space-y-2">
              {currentDoc.invariants.map((inv, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="font-mono leading-relaxed">{inv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Mechanics Walkthrough */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Runtime Execution Sequence
            </h3>
            <div className="space-y-2">
              {currentDoc.mechanicsWalkthrough.map((step, sIdx) => (
                <div key={sIdx} className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-lg border border-slate-800/60 font-mono leading-relaxed flex items-start gap-2">
                  <span className="text-indigo-400 font-bold shrink-0">{sIdx + 1}.</span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Failure Modes & Contention Bottlenecks */}
          <div className="rounded-xl bg-rose-950/20 border border-rose-900/40 p-5 space-y-3">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              Known Engine Bottlenecks &amp; Production Failure Modes
            </h3>
            <div className="space-y-2">
              {currentDoc.failureModes.map((fm, fIdx) => (
                <div key={fIdx} className="text-xs text-rose-200/90 bg-rose-950/40 p-3 rounded-lg border border-rose-800/40 leading-relaxed font-mono">
                  {fm}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
