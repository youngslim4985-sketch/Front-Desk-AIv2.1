import React from 'react';
import {
  PhoneCall,
  Clock,
  User,
  Bot,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { CallLog } from '../types';

interface CallTimelineProps {
  call: CallLog;
}

export const CallTimeline: React.FC<CallTimelineProps> = ({ call }) => {
  return (
    <div className="space-y-6">
      {/* Call Header Card */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-lg">{call.customerName}</h3>
              <span className="font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                {call.customerPhone}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Call Log ID: {call.id} • {call.timestamp}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize font-mono border ${
                call.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : call.status === 'transferred'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {call.status}
            </span>

            {/* Sentiment Badge */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 border ${
                call.sentiment === 'positive'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : call.sentiment === 'negative'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {call.sentiment === 'positive' && <Smile className="w-3.5 h-3.5 text-emerald-600" />}
              {call.sentiment === 'neutral' && <Meh className="w-3.5 h-3.5 text-slate-500" />}
              {call.sentiment === 'negative' && <Frown className="w-3.5 h-3.5 text-rose-600" />}
              <span className="capitalize">{call.sentiment} Sentiment</span>
            </span>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 block font-medium">Call Duration</span>
            <span className="font-semibold text-slate-900 font-mono">
              {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
            </span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Intent Detected</span>
            <span className="font-semibold text-indigo-600">{call.intentDetected}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Appointment Booked</span>
            <span className={`font-semibold ${call.appointmentBooked ? 'text-emerald-700' : 'text-slate-500'}`}>
              {call.appointmentBooked ? 'Yes (Confirmed)' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Topics Discussed</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {call.keyTopics.map((topic, i) => (
                <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Timeline */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="w-4 h-4 text-indigo-600" />
          Full Spoken Call Transcript & RAG Grounding Log
        </h4>

        <div className="space-y-4 pt-2">
          {call.transcript.map((msg) => {
            const isReceptionist = msg.sender === 'receptionist';
            return (
              <div key={msg.id} className="flex gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isReceptionist
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {isReceptionist ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      {isReceptionist ? 'AI Receptionist' : call.customerName}
                    </span>
                    <span className="text-slate-400 font-mono">{msg.timestamp}</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 leading-relaxed">
                    {msg.text}
                  </div>

                  {/* RAG Sources Callout */}
                  {msg.ragSourcesUsed && msg.ragSourcesUsed.length > 0 && (
                    <div className="bg-indigo-50/60 border border-indigo-200 p-2.5 rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-indigo-800 font-semibold">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>RAG Knowledge Source Cited</span>
                      </div>
                      {msg.ragSourcesUsed.map((src, i) => (
                        <p key={i} className="text-slate-700 text-[11px] font-mono">
                          [{src.docTitle}]: "{src.snippet}"
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Tool Call Execution Banner */}
                  {msg.toolCallExecuted && (
                    <div className="bg-emerald-50/60 border border-emerald-200 p-2.5 rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tool Executed: {msg.toolCallExecuted.toolName}</span>
                      </div>
                      <p className="text-emerald-900 text-[11px] font-mono font-medium">
                        {msg.toolCallExecuted.result}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
