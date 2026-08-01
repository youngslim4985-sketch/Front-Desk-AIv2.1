import React, { useState } from 'react';
import {
  Phone,
  PhoneForwarded,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  MessageSquare,
  Clock,
  ArrowRight,
  Settings,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { PhoneConfig, PhoneMode } from '../types';
import { api } from '../services/api';

interface PhoneSetupProps {
  companyId: string;
  phoneConfig: PhoneConfig;
  onConfigUpdated: () => void;
  onOpenTestCall: () => void;
}

export const PhoneSetup: React.FC<PhoneSetupProps> = ({
  companyId,
  phoneConfig,
  onConfigUpdated,
  onOpenTestCall,
}) => {
  const [mode, setMode] = useState<PhoneMode>(phoneConfig.mode || 'ai_generated');
  const [areaCode, setAreaCode] = useState(phoneConfig.areaCode || '555');
  const [forwardingNumber, setForwardingNumber] = useState(phoneConfig.forwardingNumber || '+1 (555) 019-2834');
  const [isTransferEnabled, setIsTransferEnabled] = useState(phoneConfig.isTransferEnabled);
  const [afterHoursAiEnabled, setAfterHoursAiEnabled] = useState(phoneConfig.afterHoursAiEnabled);
  const [smsConfirmationEnabled, setSmsConfirmationEnabled] = useState(phoneConfig.smsConfirmationEnabled);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleModeSelect = async (newMode: PhoneMode) => {
    setMode(newMode);
    try {
      await api.updatePhoneConfig(companyId, { mode: newMode });
      onConfigUpdated();
    } catch (e) {
      console.error('Failed to update phone mode:', e);
    }
  };

  const handleProvisionNewNumber = async () => {
    setIsProvisioning(true);
    try {
      await api.provisionPhoneNumber(companyId, areaCode);
      onConfigUpdated();
    } catch (e) {
      console.error('Failed to provision number:', e);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSaveToggles = async () => {
    try {
      await api.updatePhoneConfig(companyId, {
        forwardingNumber,
        isTransferEnabled,
        afterHoursAiEnabled,
        smsConfirmationEnabled,
      });
      onConfigUpdated();
      alert('Phone configuration saved successfully!');
    } catch (e) {
      console.error('Failed to save phone config:', e);
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(phoneConfig.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Phone Setup & Telephony Routing</h2>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono font-semibold">
              SIP / PSTN Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Choose how callers reach your AI Receptionist. Use a dedicated AI phone number, connect your existing line, or setup conditional call forwarding.
          </p>
        </div>

        <button
          onClick={onOpenTestCall}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs shrink-0"
        >
          <Phone className="w-4 h-4" />
          Test Call AI Phone Line
        </button>
      </div>

      {/* 3 Phone Setup Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode 1: Create AI Number */}
        <div
          onClick={() => handleModeSelect('ai_generated')}
          className={`cursor-pointer p-5 rounded-xl border transition-all space-y-3 relative ${
            mode === 'ai_generated'
              ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            {mode === 'ai_generated' && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Create Dedicated AI Number</h3>
            <p className="text-xs text-slate-500 mt-1">
              Provision a brand-new local or toll-free telephone number dedicated 100% to your AI receptionist.
            </p>
          </div>
        </div>

        {/* Mode 2: Connect Forwarding Number */}
        <div
          onClick={() => handleModeSelect('forwarding')}
          className={`cursor-pointer p-5 rounded-xl border transition-all space-y-3 relative ${
            mode === 'forwarding'
              ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <PhoneForwarded className="w-5 h-5" />
            </div>
            {mode === 'forwarding' && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Connect Call Forwarding</h3>
            <p className="text-xs text-slate-500 mt-1">
              Keep your existing business number. Forward missed, busy, or after-hours calls straight to AI.
            </p>
          </div>
        </div>

        {/* Mode 3: Use Existing Business Number */}
        <div
          onClick={() => handleModeSelect('existing')}
          className={`cursor-pointer p-5 rounded-xl border transition-all space-y-3 relative ${
            mode === 'existing'
              ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Smartphone className="w-5 h-5" />
            </div>
            {mode === 'existing' && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Use Existing Business Number</h3>
            <p className="text-xs text-slate-500 mt-1">
              Port your business line or integrate via Twilio, Telnyx, or VoIP SIP Trunking.
            </p>
          </div>
        </div>
      </div>

      {/* Active Number Display & Provisioning Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Assigned AI Phone Line
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 tracking-tight">
                {phoneConfig.phoneNumber}
              </span>
              <button
                onClick={copyNumber}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg border border-slate-200 transition-colors"
                title="Copy Number"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              maxLength={3}
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
              placeholder="Area code (e.g. 555)"
              className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-center text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
            <button
              onClick={handleProvisionNewNumber}
              disabled={isProvisioning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-xs"
            >
              {isProvisioning ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate New Number
            </button>
          </div>
        </div>

        {/* Telephony Configuration Settings Form */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" />
            AI Receptionist Phone Routing & Feature Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Human Transfer Target Phone #
              </label>
              <input
                type="text"
                value={forwardingNumber}
                onChange={(e) => setForwardingNumber(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Number where emergency calls or supervisor requests will be bridged.
              </span>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-700 font-semibold block">
                Active Telephony Capabilities
              </label>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-800">Human Escalate / Transfer</span>
                </div>
                <input
                  type="checkbox"
                  checked={isTransferEnabled}
                  onChange={(e) => setIsTransferEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-800">After-Hours AI Handling</span>
                </div>
                <input
                  type="checkbox"
                  checked={afterHoursAiEnabled}
                  onChange={(e) => setAfterHoursAiEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-slate-800">SMS Appointment Notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={smsConfirmationEnabled}
                  onChange={(e) => setSmsConfirmationEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-300"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveToggles}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg text-xs sm:text-sm shadow-xs"
            >
              Save Phone Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Carrier Call Forwarding Guide for Existing Number Mode */}
      {mode === 'forwarding' && (
        <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            How to Set Up Carrier Forwarding on Your Existing Line
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <span className="font-bold text-indigo-700 font-mono">Step 1: Dial Code</span>
              <p className="text-slate-700">
                On your business phone desk or cell phone, dial <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono font-bold">*72</code>.
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <span className="font-bold text-indigo-700 font-mono">Step 2: Enter AI Number</span>
              <p className="text-slate-700">
                Enter your dedicated AI number <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-emerald-700 font-mono font-bold">{phoneConfig.phoneNumber}</code>.
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <span className="font-bold text-indigo-700 font-mono">Step 3: Test Forward</span>
              <p className="text-slate-700">
                Place a test call to verify calls forward seamlessly to your grounded AI receptionist!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
