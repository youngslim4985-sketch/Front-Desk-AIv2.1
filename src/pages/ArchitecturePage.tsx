import React, { useState } from 'react';
import {
  FolderTree,
  FileCode,
  Folder,
  ChevronRight,
  ChevronDown,
  Layers,
  Cpu,
  Database,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface RepoItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  content?: string;
  children?: RepoItem[];
}

const REPO_TREE: RepoItem[] = [
  {
    name: 'apps',
    path: 'apps',
    type: 'folder',
    description: 'Monorepo Application Services',
    children: [
      {
        name: 'api',
        path: 'apps/api',
        type: 'folder',
        description: 'Express REST API & Gemini AI Service Agent Engine',
        children: [
          {
            name: 'server.js',
            path: 'apps/api/src/server.js',
            type: 'file',
            description: 'Main Express Server entry point with Vite middleware & Gemini client initialization.',
            content: `import express from 'express';\nimport { GoogleGenAI } from '@google/genai';\n\nconst app = express();\nconst ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });\n\napp.listen(3000, () => console.log("Front-Desk-AI API Server listening on port 3000"));`,
          },
          {
            name: 'knowledge.routes.js',
            path: 'apps/api/src/routes/knowledge.routes.js',
            type: 'file',
            description: 'Routes for PDF ingestion, document chunking, vector embeddings, and RAG search.',
            content: `router.post('/upload', knowledgeController.uploadAndIngestPDF);\nrouter.post('/search', knowledgeController.searchRAGChunks);`,
          },
          {
            name: 'calls.routes.js',
            path: 'apps/api/src/routes/calls.routes.js',
            type: 'file',
            description: 'Live call turn simulation with grounded Gemini system prompts and function calling.',
            content: `router.post('/simulate', callController.simulateCallTurn);`,
          },
        ],
      },
      {
        name: 'web',
        path: 'apps/web',
        type: 'folder',
        description: 'React + Vite Frontend Platform',
        children: [
          {
            name: 'App.jsx',
            path: 'apps/web/src/App.jsx',
            type: 'file',
            description: 'Main React layout with multi-tenant company switcher and live call simulator.',
          },
          {
            name: 'PhoneSetup.jsx',
            path: 'apps/web/src/components/PhoneSetup.jsx',
            type: 'file',
            description: '3-mode phone configuration wizard (Existing, Forwarding, AI Number creation).',
          },
          {
            name: 'PDFUploader.jsx',
            path: 'apps/web/src/components/PDFUploader.jsx',
            type: 'file',
            description: 'PDF ingestion pipeline & grounded vector search workbench.',
          },
        ],
      },
    ],
  },
  {
    name: 'packages',
    path: 'packages',
    type: 'folder',
    description: 'Shared Core Packages & AI Agent Modules',
    children: [
      {
        name: 'agents',
        path: 'packages/agents',
        type: 'folder',
        description: 'Gemini Receptionist Agent Prompts & Tool Handlers',
        children: [
          {
            name: 'receptionist/agent.js',
            path: 'packages/agents/receptionist/agent.js',
            type: 'file',
            description: 'Grounded receptionist agent handler with schedule_appointment and transfer_to_human tools.',
            content: `export const receptionistTools = [\n  { name: "schedule_appointment", description: "Books a customer appointment" },\n  { name: "transfer_to_human", description: "Escalates urgent calls to human supervisor" }\n];`,
          },
        ],
      },
      {
        name: 'rag',
        path: 'packages/rag',
        type: 'folder',
        description: 'Chunking, Text Extraction, Vector Embeddings & Similarity Search',
        children: [
          {
            name: 'chunking.js',
            path: 'packages/rag/ingestion/chunking.js',
            type: 'file',
            description: 'Splits raw document text into 300-word windows with 50-word overlaps.',
            content: `export function chunkText(text, chunkSize = 300) {\n  // Split text into coherent vector chunks\n}`,
          },
          {
            name: 'vector-search.js',
            path: 'packages/rag/retrieval/vector-search.js',
            type: 'file',
            description: 'Cosine similarity vector matching across company document embeddings.',
          },
        ],
      },
      {
        name: 'phone',
        path: 'packages/phone',
        type: 'folder',
        description: 'Twilio / Telnyx SIP Call Router & Number Validation',
        children: [
          {
            name: 'call-router.js',
            path: 'packages/phone/call-router.js',
            type: 'file',
            description: 'Bridges PSTN phone calls to Gemini Live / Flash API with real-time audio streams.',
          },
        ],
      },
    ],
  },
  {
    name: 'docs',
    path: 'docs',
    type: 'folder',
    description: 'Product & Technical Documentation',
    children: [
      {
        name: 'product-overview.md',
        path: 'docs/product-overview.md',
        type: 'file',
        description: 'Overview of Front-Desk-AI multi-tenant architecture and features.',
        content: `# Front-Desk-AI v2 Platform Overview\n\nFront-Desk-AI is a multi-tenant AI receptionist platform where every business creates its own customized telephone AI assistant grounded in uploaded PDF documents.`,
      },
      {
        name: 'rag-pipeline.md',
        path: 'docs/rag-pipeline.md',
        type: 'file',
        description: 'PDF ingestion, chunking, embedding, and Gemini grounding specifications.',
      },
    ],
  },
];

export const ArchitecturePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RepoItem>(
    REPO_TREE[0].children![0].children![0]
  );
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    apps: true,
    'apps/api': true,
    packages: true,
    'packages/agents': true,
    'packages/rag': true,
  });
  const [copied, setCopied] = useState(false);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (items: RepoItem[]) => {
    return (
      <div className="space-y-1 font-mono text-xs pl-2">
        {items.map((item) => {
          if (item.type === 'folder') {
            const isOpen = openFolders[item.path];
            return (
              <div key={item.path} className="space-y-1">
                <div
                  onClick={() => toggleFolder(item.path)}
                  className="flex items-center gap-2 py-1 px-2 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-700 select-none font-medium"
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  <Folder className="w-4 h-4 text-indigo-600 fill-indigo-50" />
                  <span className="font-bold text-slate-900">{item.name}</span>
                </div>
                {isOpen && item.children && (
                  <div className="pl-4 border-l border-slate-200 ml-2">
                    {renderTree(item.children)}
                  </div>
                )}
              </div>
            );
          } else {
            const isSelected = selectedFile?.path === item.path;
            return (
              <div
                key={item.path}
                onClick={() => setSelectedFile(item)}
                className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Front-Desk-AI v2 Repository Inspector</h2>
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-mono font-semibold">
              Monorepo Architecture
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Explore the clean multi-tenant modular codebase structure supporting Company Customization, PDF RAG Ingestion, and Telephony Integration.
          </p>
        </div>
      </div>

      {/* Main Grid: Code File Tree & Code Preview Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Repository Tree (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              <span>Project Structure (`Front-Desk-AI/`)</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-semibold">v2.0</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
            {renderTree(REPO_TREE)}
          </div>
        </div>

        {/* Right Column: File Inspector & Code Preview (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base font-mono">{selectedFile.name}</h3>
              <p className="text-xs text-slate-500 font-mono">{selectedFile.path}</p>
            </div>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg border border-slate-200 font-mono font-semibold">
              Source Module
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-indigo-700">Module Description:</div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {selectedFile.description || 'Module component providing core platform features.'}
            </p>
          </div>

          {/* Sample Source Code Box */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Source Code Snippet Preview
            </div>
            <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
              {selectedFile.content || `// Module source implementation for ${selectedFile.name}\nimport { GoogleGenAI } from '@google/genai';\n\nexport const moduleHandler = async (req, res) => {\n  // Production grounded handler logic\n};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
