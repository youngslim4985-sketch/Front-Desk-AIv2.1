import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  Sparkles,
} from 'lucide-react';
import { Appointment } from '../types';
import { api } from '../services/api';

interface AppointmentsPageProps {
  companyId: string;
  appointments: Appointment[];
  onAppointmentsUpdated: () => void;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({
  companyId,
  appointments,
  onAppointmentsUpdated,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [datetime, setDatetime] = useState('');

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !serviceName || !datetime) return;

    try {
      await api.createAppointment({
        companyId,
        customerId: `cust-${Date.now()}`,
        customerName,
        customerPhone: customerPhone || '+1 (555) 000-0000',
        serviceName,
        datetime,
        durationMinutes: 45,
        status: 'confirmed',
        bookedBy: 'manual',
        notes: 'Manually added by staff.',
      });

      onAppointmentsUpdated();
      setIsModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setServiceName('');
      setDatetime('');
    } catch (err) {
      console.error('Failed to create appointment:', err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.updateAppointmentStatus(id, newStatus);
      onAppointmentsUpdated();
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Appointments & Calendar Booking Schedule
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Appointments automatically scheduled by your AI Receptionist during phone calls, along with manual booking controls.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      </div>

      {/* Appointments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 hover:border-slate-300 transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-base">{apt.customerName}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold capitalize border ${
                  apt.status === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : apt.status === 'pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {apt.status}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <span>{apt.serviceName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{apt.datetime} ({apt.durationMinutes} mins)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{apt.customerPhone}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                {apt.bookedBy === 'ai_receptionist' ? '🤖 Booked by AI Receptionist' : '👤 Staff Booking'}
              </span>

              <div className="flex items-center gap-1">
                {apt.status !== 'confirmed' && (
                  <button
                    onClick={() => handleStatusChange(apt.id, 'confirmed')}
                    title="Mark Confirmed"
                    className="text-emerald-600 hover:bg-emerald-100 p-1 rounded"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                {apt.status !== 'cancelled' && (
                  <button
                    onClick={() => handleStatusChange(apt.id, 'cancelled')}
                    title="Cancel Appointment"
                    className="text-rose-600 hover:bg-rose-100 p-1 rounded"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Create New Appointment</h3>

            <form onSubmit={handleCreateAppointment} className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Customer Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Customer Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Service Requested</label>
                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Comprehensive Teeth Cleaning"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Date & Time</label>
                <input
                  type="text"
                  required
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  placeholder="e.g. 2026-08-10 02:00 PM EST"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-xs"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
