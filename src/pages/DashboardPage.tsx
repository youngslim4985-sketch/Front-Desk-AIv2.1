import React from 'react';
import {
  PhoneCall,
  Calendar,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Phone,
  Settings,
  Bot,
  UserCheck,
  ArrowUpRight,
  ShieldCheck,
  Smile,
  ChevronRight,
} from 'lucide-react';
import { Company, PhoneConfig, CallLog, Appointment, KnowledgeDocument } from '../types';

interface DashboardPageProps {
  company: Company;
  phoneConfig: PhoneConfig;
  calls: CallLog[];
  appointments: Appointment[];
  documents: KnowledgeDocument[];
  onNavigateTab: (tab: string) => void;
  onOpenTestCall: () => void;
  onSelectCall: (call: CallLog) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  company,
  phoneConfig,
  calls,
  appointments,
  documents,
  onNavigateTab,
  onOpenTestCall,
  onSelectCall,
}) => {
  const totalCalls = calls.length;
  const bookedCount = appointments.filter((a) => a.bookedBy === 'ai_receptionist').length;
  const positiveSentimentPercent = totalCalls > 0
    ? Math.round((calls.filter((c) => c.sentiment === 'positive').length / totalCalls) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm text-white">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono font-medium">
              Live AI Receptionist Active
            </span>
            <span className="text-xs text-slate-400 font-mono">{phoneConfig.phoneNumber}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {company.name} Operational Hub
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Your grounded AI Receptionist is actively taking calls, answering customer inquiries using {documents.length} uploaded PDF documents, and scheduling appointments automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenTestCall}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all"
          >
            <Sparkles className="w-4 h-4 animate-spin text-emerald-200" />
            <PhoneCall className="w-4 h-4" />
            <span>Test Drive AI Line</span>
          </button>

          <button
            onClick={() => onNavigateTab('knowledge')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-3.5 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Upload PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Calls Handled</span>
            <PhoneCall className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">{totalCalls}</span>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> 100% AI Handled
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Zero missed calls across all business hours.</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Appointments Booked</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">{bookedCount}</span>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">Auto-Scheduled</span>
          </div>
          <p className="text-[11px] text-slate-500">Directly booked into calendar during phone calls.</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Caller Satisfaction</span>
            <Smile className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">{positiveSentimentPercent}%</span>
            <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-medium">Positive / Neutral</span>
          </div>
          <p className="text-[11px] text-slate-500">Based on sentiment analysis of call transcripts.</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Indexed Knowledge Docs</span>
            <BookOpen className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">{documents.length}</span>
            <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-medium">PDF RAG Grounded</span>
          </div>
          <p className="text-[11px] text-slate-500">Vector chunks searched live during conversations.</p>
        </div>
      </div>

      {/* Main Grid: Recent Calls & Agent Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Calls Feed (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Customer Phone Calls</h3>
              <p className="text-xs text-slate-500">Click any call to inspect transcripts, RAG sources, and tool execution.</p>
            </div>
            <button
              onClick={() => onNavigateTab('calls')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All Logs
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {calls.slice(0, 5).map((call) => (
              <div
                key={call.id}
                onClick={() => {
                  onSelectCall(call);
                  onNavigateTab('calls');
                }}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{call.customerName}</span>
                      <span className="text-xs text-slate-500 font-mono">{call.customerPhone}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="text-indigo-600 font-medium">{call.intentDetected}</span>
                      <span>•</span>
                      <span>{call.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {call.appointmentBooked && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-full font-medium">
                      Booked
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">
                    {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Receptionist Status Card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-600" />
                Agent Status & Settings
              </h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-0.5">
                <div className="text-slate-500 font-medium text-[11px]">Active Personality Profile</div>
                <div className="font-bold text-slate-900 capitalize text-sm">
                  {company.aiPersonality.replace('_', ' ')}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-0.5">
                <div className="text-slate-500 font-medium text-[11px]">Dedicated Phone Number</div>
                <div className="font-mono font-bold text-emerald-700 text-sm">
                  {phoneConfig.phoneNumber}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-0.5">
                <div className="text-slate-500 font-medium text-[11px]">Spoken Greeting Script</div>
                <p className="text-slate-700 italic">"{company.customGreeting}"</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('settings')}
              className="w-full bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-200 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Customize Personality & Greeting
            </button>
          </div>

          {/* Upcoming Appointments Card */}
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Upcoming Booked Appointments
              </h3>
              <button
                onClick={() => onNavigateTab('appointments')}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                View Calendar
              </button>
            </div>

            <div className="space-y-2.5">
              {appointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-0.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{apt.customerName}</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                      {apt.status}
                    </span>
                  </div>
                  <div className="text-slate-800 font-medium">{apt.serviceName}</div>
                  <div className="text-slate-500 font-mono text-[11px]">{apt.datetime}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
