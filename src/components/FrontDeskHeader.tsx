import React, { useState } from 'react';
import {
  PhoneCall,
  Sparkles,
  Building2,
  ChevronDown,
  Terminal,
  Shield,
  Bot,
  Plus,
  ArrowRight,
  Activity,
  Layers,
} from 'lucide-react';
import { Company, PhoneConfig } from '../types';

interface FrontDeskHeaderProps {
  companies: Company[];
  selectedCompany: Company;
  phoneConfig: PhoneConfig | null;
  onSelectCompany: (company: Company) => void;
  onOpenCallModal: () => void;
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  onAddCompany: (data: { name: string; industry: string; aiPersonality: string }) => void;
}

export const FrontDeskHeader: React.FC<FrontDeskHeaderProps> = ({
  companies,
  selectedCompany,
  phoneConfig,
  onSelectCompany,
  onOpenCallModal,
  activeTab,
  onNavigateTab,
  onAddCompany,
}) => {
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newIndustry, setNewIndustry] = useState('Medical & Healthcare');
  const [newPersonality, setNewPersonality] = useState('warm_friendly');

  const handleCreateCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    onAddCompany({
      name: newCompanyName.trim(),
      industry: newIndustry,
      aiPersonality: newPersonality,
    });
    setNewCompanyName('');
    setIsAddModalOpen(false);
    setIsCompanyDropdownOpen(false);
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-lg backdrop-blur-md bg-slate-900/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div 
                className="flex items-center gap-2.5 cursor-pointer group"
                onClick={() => {
                  onNavigateTab('dashboard');
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                      Front-Desk<span className="text-emerald-400 font-mono font-semibold">AI</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Agent Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Autonomous AI Voice & Front Desk Operations
                  </p>
                </div>
              </div>

              {/* Multi-Tenant Business Switcher */}
              <div className="relative ml-2 sm:ml-4">
                <button
                  id="btn-company-switcher"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all shadow-xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold max-w-[140px] truncate">
                    {selectedCompany?.name || 'Select Business'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCompanyDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      Select Active Client Business
                    </div>
                    
                    <div className="max-h-56 overflow-y-auto py-1">
                      {companies.map((comp) => (
                        <button
                          key={comp.id}
                          onClick={() => {
                            onSelectCompany(comp);
                            setIsCompanyDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            selectedCompany?.id === comp.id
                              ? 'bg-emerald-950/60 text-emerald-300 font-semibold border-l-2 border-emerald-400'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="truncate">
                            <p className="truncate font-medium">{comp.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{comp.industry}</p>
                          </div>
                          {selectedCompany?.id === comp.id && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="p-2 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setIsAddModalOpen(true);
                          setIsCompanyDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-800/50 rounded-lg transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Business Line</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              
              {/* Test Drive Live Call Button */}
              <button
                id="btn-header-test-call"
                onClick={onOpenCallModal}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <PhoneCall className="w-4 h-4 text-emerald-200 animate-bounce" />
                <span className="hidden sm:inline">Test Drive AI Line</span>
                <span className="sm:hidden">Test Call</span>
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Modal: Add New Business Client */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Create New Business Tenant</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompanySubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Business / Practice Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Summit Physical Therapy"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Industry / Domain
                </label>
                <select
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="Medical & Healthcare">Medical & Healthcare</option>
                  <option value="Legal & Law Firm">Legal & Law Firm</option>
                  <option value="Dental & Orthodontics">Dental & Orthodontics</option>
                  <option value="Spa, Salon & Fitness">Spa, Salon & Fitness</option>
                  <option value="Home Services & Contractors">Home Services & Contractors</option>
                  <option value="Financial & Accounting">Financial & Accounting</option>
                  <option value="Real Estate & Property">Real Estate & Property</option>
                  <option value="Auto Repair & Dealership">Auto Repair & Dealership</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  AI Receptionist Persona
                </label>
                <select
                  value={newPersonality}
                  onChange={(e) => setNewPersonality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="warm_friendly">Warm & Empathetic (Healthcare / Wellness)</option>
                  <option value="formal_executive">Formal & Executive (Legal / Financial)</option>
                  <option value="concise_direct">Concise & Direct (Urgent Services / Contractors)</option>
                  <option value="energetic_welcoming">Energetic & Welcoming (Boutique / Fitness)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span>Provision Business</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
