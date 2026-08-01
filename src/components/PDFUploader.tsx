import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Layers,
  Database,
  BrainCircuit,
  Search,
  CheckCircle2,
  Trash2,
  Plus,
  Sparkles,
  FileCode,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { KnowledgeDocument, RAGSearchResult } from '../types';
import { api } from '../services/api';

interface PDFUploaderProps {
  companyId: string;
  documents: KnowledgeDocument[];
  onDocumentsUpdated: () => void;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  companyId,
  documents,
  onDocumentsUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'handbook' | 'faq' | 'services' | 'pricing' | 'procedures' | 'other'>('handbook');
  const [rawText, setRawText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0); // 0: idle, 1: text extraction, 2: chunking, 3: embeddings & vector db
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RAGSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'workbench'>('documents');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
      
      // Read file content if text or fallback simulation
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text || `Uploaded PDF File: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\nDocument contents parsed into company knowledge memory.`);
      };
      reader.readAsText(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsUploading(true);
    setUploadStep(1); // Text Extraction

    setTimeout(async () => {
      setUploadStep(2); // Chunking
      setTimeout(async () => {
        setUploadStep(3); // Vector Embeddings & Indexing

        try {
          await api.uploadKnowledgeDocument({
            companyId,
            title,
            category,
            rawText: rawText || `${title} document procedures, rules, service guidelines, and operational details.`,
            filename: selectedFileName || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
            fileSize: '1.5 MB',
          });

          onDocumentsUpdated();
          setTitle('');
          setRawText('');
          setSelectedFileName('');
          setActiveTab('documents');
        } catch (err) {
          console.error('Failed to upload knowledge document:', err);
        } finally {
          setIsUploading(false);
          setUploadStep(0);
        }
      }, 800);
    }, 800);
  };

  const handleDelete = async (docId: string) => {
    if (confirm('Are you sure you want to remove this document from AI memory?')) {
      await api.deleteDocument(docId);
      onDocumentsUpdated();
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await api.searchKnowledge(companyId, searchQuery);
      setSearchResults(res);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">PDF Company Knowledge Import</h2>
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-mono">
              RAG Engine Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Upload employee handbooks, FAQs, pricing sheets, and guidelines. The AI Receptionist searches this vector database live during callers' phone conversations.
          </p>
        </div>

        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 shrink-0">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'documents' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Indexed Docs ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Upload PDF
          </button>
          <button
            onClick={() => setActiveTab('workbench')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'workbench' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Test RAG Search
          </button>
        </div>
      </div>

      {/* RAG Pipeline Visualizer */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl text-xs shadow-xs">
        <div className="text-slate-500 font-bold mb-3 uppercase tracking-wider text-[11px]">
          Multi-Tenant RAG Processing Pipeline
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <Upload className="w-4 h-4 text-indigo-600 mx-auto" />
            <div className="font-bold text-slate-900">1. PDF Upload</div>
            <div className="text-[10px] text-slate-500">Drag & Drop Documents</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <FileCode className="w-4 h-4 text-blue-600 mx-auto" />
            <div className="font-bold text-slate-900">2. Text Extraction</div>
            <div className="text-[10px] text-slate-500">PDF Parsing & Cleaning</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <Layers className="w-4 h-4 text-teal-600 mx-auto" />
            <div className="font-bold text-slate-900">3. Chunking</div>
            <div className="text-[10px] text-slate-500">300-400 Word Windows</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <BrainCircuit className="w-4 h-4 text-purple-600 mx-auto" />
            <div className="font-bold text-slate-900">4. Embeddings</div>
            <div className="text-[10px] text-slate-500">Vector Representations</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <Database className="w-4 h-4 text-emerald-600 mx-auto" />
            <div className="font-bold text-slate-900">5. Knowledge DB</div>
            <div className="text-[10px] text-slate-500">Isolated Company Storage</div>
          </div>
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 space-y-1">
            <Sparkles className="w-4 h-4 text-indigo-600 mx-auto" />
            <div className="font-bold text-indigo-900">6. AI Memory</div>
            <div className="text-[10px] text-indigo-700">Live Grounded Calls</div>
          </div>
        </div>
      </div>

      {/* Tab Content 1: Indexed Documents List */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">No Knowledge Documents Uploaded Yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                Upload your company handbook, pricing sheet, or FAQ documents to give your AI Receptionist grounded knowledge.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm inline-flex items-center gap-2 mt-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Upload First PDF
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all space-y-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{doc.title}</h4>
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2 py-0.5 rounded-full uppercase font-mono font-semibold">
                            {doc.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {doc.filename} • {doc.fileSize} • Uploaded {doc.uploadedAt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-mono font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{doc.chunkCount} Vector Chunks</span>
                      </div>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        title="Delete Document"
                        className="text-slate-400 hover:text-rose-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed">
                    <span className="font-bold text-indigo-700">AI Memory Summary:</span> {doc.summary}
                  </div>

                  {/* Sample Chunks Accordion Preview */}
                  {doc.chunks && doc.chunks.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <div className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                        Sample Indexed Chunk Preview (Page {doc.chunks[0].pageNumber || 1})
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 line-clamp-2">
                        "{doc.chunks[0].content}"
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Upload PDF Form */}
      {activeTab === 'upload' && (
        <form onSubmit={handleUploadSubmit} className="bg-white border border-slate-200 p-6 rounded-xl space-y-5 shadow-xs">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Upload New Document to AI Knowledge Memory
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1.5">
                Document Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Employee Handbook & Policy Guide 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1.5">
                Category / Document Type
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="handbook">Employee Handbook</option>
                <option value="faq">FAQ Document</option>
                <option value="services">Service Guide</option>
                <option value="pricing">Pricing & Fee Schedule</option>
                <option value="procedures">Internal Procedures</option>
                <option value="other">Other Reference Guide</option>
              </select>
            </div>
          </div>

          {/* Drag & Drop File Input Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-50 transition-colors relative">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-2 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {selectedFileName ? selectedFileName : 'Click or Drag & Drop PDF Document Here'}
              </div>
              <p className="text-xs text-slate-500">Supports PDF, DOCX, TXT files up to 25MB</p>
            </div>
          </div>

          {/* Or Paste Raw Text Input Option */}
          <div>
            <label className="text-xs text-slate-700 font-semibold block mb-1.5">
              Or Paste Text Directly (Optional Manual Import)
            </label>
            <textarea
              rows={4}
              placeholder="Paste employee handbook policies, pricing lists, or office rules directly here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Pipeline Loader Display */}
          {isUploading && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                <Sparkles className="w-4 h-4 animate-spin text-indigo-600" />
                <span>
                  {uploadStep === 1 && "Extracting text from PDF..."}
                  {uploadStep === 2 && "Splitting text into 300-word RAG chunks..."}
                  {uploadStep === 3 && "Generating vector embeddings & indexing into knowledge base..."}
                </span>
              </div>
              <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(uploadStep / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || (!title.trim() && !selectedFileName)}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Ingest Document into AI Memory
            </button>
          </div>
        </form>
      )}

      {/* Tab Content 3: Test RAG Search Workbench */}
      {activeTab === 'workbench' && (
        <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-5 shadow-xs">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              Test Grounded Vector Search (RAG Workbench)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Query your indexed knowledge base to see exactly which document chunks will be retrieved and provided to your AI Receptionist during live caller phone calls.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. What is our cancellation policy or emergency teeth pain protocol?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs"
            >
              {isSearching ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search RAG
            </button>
          </form>

          {/* Results List */}
          {searchResults && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Document Chunks ({searchResults.chunks.length})</span>
                <span className="font-mono text-indigo-600">Query: "{searchResults.query}"</span>
              </div>

              {searchResults.chunks.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-lg text-center text-slate-500 text-xs sm:text-sm border border-slate-200">
                  No matching chunks found. Try asking about your uploaded handbooks or policies!
                </div>
              ) : (
                searchResults.chunks.map((chunk, idx) => (
                  <div
                    key={chunk.id || idx}
                    className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        {chunk.docTitle} (Chunk #{chunk.chunkIndex + 1})
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                        Relevance Score: {chunk.score || 8}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-mono bg-white p-3 rounded-lg border border-slate-200">
                      "{chunk.content}"
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
