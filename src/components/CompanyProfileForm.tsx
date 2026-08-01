import React, { useState } from 'react';
import {
  Building2,
  Clock,
  Briefcase,
  Shield,
  Bot,
  Sparkles,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Company, AIPersonality, ServiceItem, BusinessPolicy } from '../types';
import { api } from '../services/api';

interface CompanyProfileFormProps {
  company: Company;
  onCompanyUpdated: () => void;
}

export const CompanyProfileForm: React.FC<CompanyProfileFormProps> = ({
  company,
  onCompanyUpdated,
}) => {
  const [formData, setFormData] = useState<Company>({ ...company });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(formData.id, formData);
      onCompanyUpdated();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update company settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddService = () => {
    const newService: ServiceItem = {
      id: `s-${Date.now()}`,
      name: 'New Service Item',
      duration: '30 mins',
      price: '$100',
      description: 'Service description for AI receptionist.',
    };
    setFormData((prev) => ({
      ...prev,
      services: [...prev.services, newService],
    }));
  };

  const handleRemoveService = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s.id !== id),
    }));
  };

  const handleServiceChange = (id: string, field: keyof ServiceItem, value: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  const handleAddPolicy = () => {
    const newPolicy: BusinessPolicy = {
      id: `p-${Date.now()}`,
      title: 'New Policy / FAQ Rule',
      content: 'Detailed policy content for AI grounded memory.',
    };
    setFormData((prev) => ({
      ...prev,
      policies: [...prev.policies, newPolicy],
    }));
  };

  const handleRemovePolicy = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
  };

  const handlePolicyChange = (id: string, field: keyof BusinessPolicy, value: string) => {
    setFormData((prev) => ({
      ...prev,
      policies: prev.policies.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-white">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Company Profile & AI Personality Customization
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Configure your business details, services offered, operational policies, and AI receptionist voice personality.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs shrink-0"
        >
          {isSaving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? 'Saved Changes!' : 'Save Company Profile'}
        </button>
      </div>

      {/* 1. Core Company Metadata */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-4 h-4 text-indigo-600" />
          General Company Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-700 font-semibold block mb-1">Company Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-700 font-semibold block mb-1">Industry / Category</label>
            <input
              type="text"
              required
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Business Hours */}
        <div>
          <label className="text-xs text-slate-700 font-semibold block mb-2">
            <Clock className="w-3.5 h-3.5 inline text-indigo-600 mr-1" />
            Operating Business Hours
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Weekdays (Mon - Fri)</span>
              <input
                type="text"
                value={formData.businessHours?.weekdays || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    businessHours: { ...formData.businessHours, weekdays: e.target.value },
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Saturday</span>
              <input
                type="text"
                value={formData.businessHours?.saturday || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    businessHours: { ...formData.businessHours, saturday: e.target.value },
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Sunday</span>
              <input
                type="text"
                value={formData.businessHours?.sunday || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    businessHours: { ...formData.businessHours, sunday: e.target.value },
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI Personality & Greeting Messages */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Bot className="w-4 h-4 text-purple-600" />
          AI Receptionist Persona & Greeting Setup
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-700 font-semibold block mb-1">
              AI Receptionist Personality Style
            </label>
            <select
              value={formData.aiPersonality}
              onChange={(e) => setFormData({ ...formData, aiPersonality: e.target.value as AIPersonality })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize font-medium"
            >
              <option value="warm_friendly">Warm & Friendly (Empathic, Welcoming)</option>
              <option value="formal_executive">Formal & Executive (Polished, Authoritative)</option>
              <option value="concise_direct">Concise & Direct (Fast, Efficient)</option>
              <option value="energetic_welcoming">Energetic & Welcoming (Upbeat, Enthusiastic)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-700 font-semibold block mb-1">
              Human Transfer Escalation Number
            </label>
            <input
              type="text"
              value={formData.transferPhoneNumber}
              onChange={(e) => setFormData({ ...formData, transferPhoneNumber: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-700 font-semibold block mb-1">
            Custom Telephone Greeting Script
          </label>
          <textarea
            rows={2}
            value={formData.customGreeting}
            onChange={(e) => setFormData({ ...formData, customGreeting: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-[11px] text-slate-500 block mt-1">
            The initial spoken greeting the AI receptionist delivers as soon as a customer's call connects.
          </span>
        </div>

        <div>
          <label className="text-xs text-slate-700 font-semibold block mb-1">
            Voice & Tone Instructions
          </label>
          <input
            type="text"
            value={formData.voiceTone}
            onChange={(e) => setFormData({ ...formData, voiceTone: e.target.value })}
            placeholder="e.g. Speak with calm, clinical confidence and reassure patients experiencing pain."
            className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 3. Services Offered Editor */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            Services Offered & Pricing Catalog
          </h3>
          <button
            type="button"
            onClick={handleAddService}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Service
          </button>
        </div>

        <div className="space-y-3">
          {formData.services.map((serv) => (
            <div key={serv.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={serv.name}
                  onChange={(e) => handleServiceChange(serv.id, 'name', e.target.value)}
                  placeholder="Service Name"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 font-bold"
                />
                <input
                  type="text"
                  value={serv.duration}
                  onChange={(e) => handleServiceChange(serv.id, 'duration', e.target.value)}
                  placeholder="Duration (e.g. 45 mins)"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={serv.price}
                    onChange={(e) => handleServiceChange(serv.id, 'price', e.target.value)}
                    placeholder="Price (e.g. $120)"
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveService(serv.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={serv.description}
                onChange={(e) => handleServiceChange(serv.id, 'description', e.target.value)}
                placeholder="Description of what this service includes..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Business Policies Editor */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            Core Office Policies & Rules
          </h3>
          <button
            type="button"
            onClick={handleAddPolicy}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Policy
          </button>
        </div>

        <div className="space-y-3">
          {formData.policies.map((pol) => (
            <div key={pol.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={pol.title}
                  onChange={(e) => handlePolicyChange(pol.id, 'title', e.target.value)}
                  placeholder="Policy Title (e.g. Cancellation Fee)"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePolicy(pol.id)}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={2}
                value={pol.content}
                onChange={(e) => handlePolicyChange(pol.id, 'content', e.target.value)}
                placeholder="Detailed policy text..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
              />
            </div>
          ))}
        </div>
      </div>
    </form>
  );
};
