import React, { useState } from 'react';
import {
  Bot,
  PhoneCall,
  Settings,
  BookOpen,
  Calendar,
  Users,
  Phone,
  BarChart3,
  FolderTree,
  Plus,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { Company } from '../types';

interface HeaderProps {
  companies: Company[];
  activeCompany: Company;
  onSelectCompany: (company: Company) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCallSimulator: () => void;
  onOpenCreateCompanyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  activeCompany,
  onSelectCompany,
  activeTab,
  setActiveTab,
  onOpenCallSimulator,
  onOpenCreateCompanyModal,
}) => {
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, badge: 'Live' },
    { id: 'calls', label: 'Call History', icon: PhoneCall },
    { id: 'knowledge', label: 'PDF Knowledge Base', icon: BookOpen },
    { id: 'phone', label: 'Phone Setup', icon: Phone },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Company Settings', icon: Settings },
    { id: 'architecture', label: 'v2 Architecture', icon: FolderTree },
  ];

  return (
    <>
      {/* Desktop Sidebar Navigation (lg:flex) */}
      <aside className="hidden lg:flex w-60 bg-[#0F172A] border-r border-slate-800 text-slate-300 flex-col shrink-0 min-h-screen sticky top-0 h-screen select-none z-30">
        {/* Sidebar Brand Header */}
        <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-500/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                Front-Desk AI
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 font-mono">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Receptionist SaaS</p>
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          <div>
            <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Platform Navigation
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-500 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer - AI Receptionist Live Line Widget */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>AI Agent Ready</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Gemini 2.5</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono font-medium truncate">
              {activeCompany.name}
            </div>
            <button
              onClick={onOpenCallSimulator}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Call Line</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Top Header Bar for Desktop & Mobile */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 sm:px-6 shadow-xs flex-1">
        {/* Left: Mobile Menu Toggle & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm hidden sm:inline">
              Console
            </span>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <span className="font-bold text-slate-900 text-sm capitalize">
              {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
            </span>
          </div>
        </div>

        {/* Right: Company Selector & Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Company Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCompanyMenu(!showCompanyMenu)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold transition-all shadow-xs"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="max-w-[130px] sm:max-w-[180px] truncate font-medium">
                {activeCompany.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showCompanyMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in duration-150">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Business Profile
                </div>
                <div className="divide-y divide-slate-100 my-1">
                  {companies.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => {
                        onSelectCompany(comp);
                        setShowCompanyMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${
                        comp.id === activeCompany.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium text-slate-900 truncate">{comp.name}</div>
                        <div className="text-[11px] text-slate-500">{comp.industry}</div>
                      </div>
                      {comp.id === activeCompany.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="pt-1.5 px-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowCompanyMenu(false);
                      onOpenCreateCompanyModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register New Company
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Test Drive Button Header Trigger */}
          <button
            onClick={onOpenCallSimulator}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test Call Line</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation (lg:hidden) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-xs flex">
          <div className="w-64 bg-[#0F172A] text-slate-300 flex flex-col h-full p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="font-bold text-white text-sm">Front-Desk AI v2</div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-500'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-indigo-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
