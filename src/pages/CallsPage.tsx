import React, { useState } from 'react';
import {
  PhoneCall,
  Search,
  Filter,
  Smile,
  Meh,
  Frown,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { CallLog } from '../types';
import { CallTimeline } from '../components/CallTimeline';

interface CallsPageProps {
  calls: CallLog[];
  selectedCall: CallLog | null;
  onSelectCall: (call: CallLog | null) => void;
  onOpenTestCall: () => void;
}

export const CallsPage: React.FC<CallsPageProps> = ({
  calls,
  selectedCall,
  onSelectCall,
  onOpenTestCall,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.customerPhone.includes(searchQuery) ||
      call.intentDetected.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'booked' && call.appointmentBooked) ||
      (filterStatus === 'transferred' && call.status === 'transferred') ||
      (filterStatus === 'negative' && call.sentiment === 'negative');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-indigo-400" />
            Call History & Transcript Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Review detailed conversation logs, RAG knowledge groundings cited during spoken calls, and automated appointment scheduling events.
          </p>
        </div>

        <button
          onClick={onOpenTestCall}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs shrink-0"
        >
          <PhoneCall className="w-4 h-4" />
          Test Call AI Receptionist
        </button>
      </div>

      {/* Main Layout: Call List vs Selected Call Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Call List (5 cols or full if no selection) */}
        <div className={`space-y-4 ${selectedCall ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by caller name, phone, or intent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
            >
              <option value="all">All Call Logs</option>
              <option value="booked">Booked Appointment</option>
              <option value="transferred">Transferred to Human</option>
              <option value="negative">Negative Sentiment</option>
            </select>
          </div>

          {/* Call Items Cards */}
          <div className="space-y-3">
            {filteredCalls.map((call) => {
              const isSelected = selectedCall?.id === call.id;
              return (
                <div
                  key={call.id}
                  onClick={() => onSelectCall(call)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{call.customerName}</span>
                    <span className="font-mono text-xs text-slate-500">{call.timestamp}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-600 font-semibold">{call.intentDetected}</span>
                    <span className="font-mono text-slate-500">
                      {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {call.appointmentBooked && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold">
                        Appointment Confirmed
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono capitalize border ${
                        call.status === 'completed'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {call.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Call Inspector Drawer */}
        {selectedCall && (
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => onSelectCall(null)}
                className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>

            <CallTimeline call={selectedCall} />
          </div>
        )}
      </div>
    </div>
  );
};
