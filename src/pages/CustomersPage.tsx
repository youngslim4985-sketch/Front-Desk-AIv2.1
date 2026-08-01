import React from 'react';
import { Users, Phone, Mail, Calendar, Smile, Meh, Frown, MessageSquare } from 'lucide-react';
import { Customer } from '../types';

interface CustomersPageProps {
  customers: Customer[];
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ customers }) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Customer Directory & Call History CRM
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Centralized directory of callers, total interactions, sentiment metrics, and staff notes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((cust) => (
          <div key={cust.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 hover:border-slate-300 transition-all shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-base">{cust.name}</span>
              <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-mono font-semibold">
                {cust.callCount} Calls
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 font-mono">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{cust.phone}</span>
              </div>
              {cust.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cust.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Call: {cust.lastCallAt}</span>
              </div>
            </div>

            {cust.notes && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-indigo-700">Notes:</span> {cust.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
