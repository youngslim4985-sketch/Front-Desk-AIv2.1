import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Phone,
  Volume2,
  PhoneCall,
  Calendar,
  Users,
  FolderTree,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export type FrontDeskTab =
  | 'dashboard'
  | 'knowledge'
  | 'phone'
  | 'settings'
  | 'calls'
  | 'appointments'
  | 'customers'
  | 'architecture';

interface FrontDeskNavigationProps {
  activeTab: FrontDeskTab;
  onSelectTab: (tab: FrontDeskTab) => void;
  documentCount?: number;
  callCount?: number;
  appointmentCount?: number;
}

export const FrontDeskNavigation: React.FC<FrontDeskNavigationProps> = ({
  activeTab,
  onSelectTab,
  documentCount = 0,
  callCount = 0,
  appointmentCount = 0,
}) => {
  const navItems = [
    {
      id: 'dashboard' as FrontDeskTab,
      label: 'Operational Hub',
      icon: <LayoutDashboard className="w-4 h-4" />,
      tagline: 'Live status & daily KPI overview',
    },
    {
      id: 'knowledge' as FrontDeskTab,
      label: 'PDF Knowledge Base',
      icon: <BookOpen className="w-4 h-4" />,
      badge: documentCount > 0 ? `${documentCount} docs` : undefined,
      tagline: 'RAG grounding & document ingestion',
    },
    {
      id: 'phone' as FrontDeskTab,
      label: 'Phone & Line Setup',
      icon: <Phone className="w-4 h-4" />,
      tagline: 'Number provisioning & call routing',
    },
    {
      id: 'settings' as FrontDeskTab,
      label: 'Voice & Personality',
      icon: <Volume2 className="w-4 h-4" />,
      tagline: 'ElevenLabs voice & business policies',
    },
    {
      id: 'calls' as FrontDeskTab,
      label: 'Call Transcripts',
      icon: <PhoneCall className="w-4 h-4" />,
      badge: callCount > 0 ? `${callCount}` : undefined,
      tagline: 'Grounded dialogue & sentiment logs',
    },
    {
      id: 'appointments' as FrontDeskTab,
      label: 'Appointments',
      icon: <Calendar className="w-4 h-4" />,
      badge: appointmentCount > 0 ? `${appointmentCount}` : undefined,
      tagline: 'AI booked schedules & calendar',
    },
    {
      id: 'customers' as FrontDeskTab,
      label: 'Customer CRM',
      icon: <Users className="w-4 h-4" />,
      tagline: 'Caller directory & interaction history',
    },
    {
      id: 'architecture' as FrontDeskTab,
      label: 'Architecture & Docs',
      icon: <FolderTree className="w-4 h-4" />,
      tagline: 'Monorepo layout & API specifications',
    },
  ];

  return (
    <aside className="w-full lg:w-72 bg-slate-900/90 border-r border-slate-800 p-3 lg:p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Front Desk Operations Group */}
      <div className="flex flex-col gap-1">
        <div className="px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Receptionist Operations
        </div>

        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-frontdesk-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all group ${
                  isActive
                    ? 'bg-emerald-950/70 text-white border border-emerald-500/40 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className={`mt-0.5 shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                        isActive
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/60'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-tight mt-0.5">
                    {item.tagline}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-auto pt-3 border-t border-slate-800 flex flex-col gap-1">
        <div className="px-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Voice RAG</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500">v2.4.0</span>
        </div>
        <div className="px-2 text-[10px] text-slate-500 font-mono">
          Gemini 3.6 Flash & ElevenLabs Engine
        </div>
      </div>

    </aside>
  );
};
