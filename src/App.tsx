import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CallSimulatorModal } from './components/CallSimulatorModal';
import { DashboardPage } from './pages/DashboardPage';
import { CallsPage } from './pages/CallsPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { PhonePage } from './pages/PhonePage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { Company, KnowledgeDocument, PhoneConfig, CallLog, Customer, Appointment } from './types';
import { api } from './services/api';
import { INITIAL_COMPANIES, INITIAL_PHONE_CONFIGS } from './data/mockData';

export default function App() {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [activeCompany, setActiveCompany] = useState<Company>(INITIAL_COMPANIES[0]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig>(INITIAL_PHONE_CONFIGS['comp-apex-dental']);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompIndustry, setNewCompIndustry] = useState('');
  const [newCompPersonality, setNewCompPersonality] = useState('warm_friendly');

  // Load state when active company changes
  const loadCompanyData = async (companyId: string) => {
    try {
      const [docsData, phoneData, callsData, custsData, aptsData] = await Promise.all([
        api.getDocuments(companyId),
        api.getPhoneConfig(companyId),
        api.getCalls(companyId),
        api.getCustomers(companyId),
        api.getAppointments(companyId),
      ]);

      setDocuments(docsData);
      setPhoneConfig(phoneData);
      setCalls(callsData);
      setCustomers(custsData);
      setAppointments(aptsData);
    } catch (err) {
      console.error('Error loading company data:', err);
    }
  };

  useEffect(() => {
    // Initial fetch of companies
    api.getCompanies().then((compList) => {
      if (compList && compList.length > 0) {
        setCompanies(compList);
        setActiveCompany(compList[0]);
        loadCompanyData(compList[0].id);
      }
    }).catch(() => {
      loadCompanyData(activeCompany.id);
    });
  }, []);

  const handleSelectCompany = (comp: Company) => {
    setActiveCompany(comp);
    setSelectedCall(null);
    loadCompanyData(comp.id);
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;

    try {
      const created = await api.createCompany({
        name: newCompName,
        industry: newCompIndustry || 'Services & Retail',
        aiPersonality: newCompPersonality,
      });

      setCompanies((prev) => [...prev, created]);
      setActiveCompany(created);
      setIsCreateCompanyOpen(false);
      setNewCompName('');
      setNewCompIndustry('');
      loadCompanyData(created.id);
    } catch (e) {
      console.error('Failed to create company:', e);
    }
  };

  const refreshActiveData = () => {
    loadCompanyData(activeCompany.id);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col lg:flex-row antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Header & Left Sidebar */}
      <Header
        companies={companies}
        activeCompany={activeCompany}
        onSelectCompany={handleSelectCompany}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCallSimulator={() => setIsSimulatorOpen(true)}
        onOpenCreateCompanyModal={() => setIsCreateCompanyOpen(true)}
      />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              company={activeCompany}
              phoneConfig={phoneConfig}
              calls={calls}
              appointments={appointments}
              documents={documents}
              onNavigateTab={setActiveTab}
              onOpenTestCall={() => setIsSimulatorOpen(true)}
              onSelectCall={setSelectedCall}
            />
          )}

          {activeTab === 'calls' && (
            <CallsPage
              calls={calls}
              selectedCall={selectedCall}
              onSelectCall={setSelectedCall}
              onOpenTestCall={() => setIsSimulatorOpen(true)}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeBasePage
              companyId={activeCompany.id}
              documents={documents}
              onDocumentsUpdated={refreshActiveData}
            />
          )}

          {activeTab === 'phone' && (
            <PhonePage
              companyId={activeCompany.id}
              phoneConfig={phoneConfig}
              onConfigUpdated={refreshActiveData}
              onOpenTestCall={() => setIsSimulatorOpen(true)}
            />
          )}

          {activeTab === 'appointments' && (
            <AppointmentsPage
              companyId={activeCompany.id}
              appointments={appointments}
              onAppointmentsUpdated={refreshActiveData}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersPage customers={customers} />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              company={activeCompany}
              onCompanyUpdated={() => {
                api.getSettings(activeCompany.id).then((updated) => {
                  setActiveCompany(updated);
                  setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                });
              }}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitecturePage />
          )}
        </main>
      </div>

      {/* Live Phone Call Simulator Modal */}
      <CallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        company={activeCompany}
        phoneConfig={phoneConfig}
        onCallEnded={refreshActiveData}
      />

      {/* Register New Business Company Modal */}
      {isCreateCompanyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-slate-900">
            <h3 className="text-lg font-bold text-slate-900">Register New Business Account</h3>
            <p className="text-xs text-slate-500">
              Create a new multi-tenant business profile with custom settings, phone line, and knowledge base.
            </p>

            <form onSubmit={handleCreateCompanySubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Skyline Auto Clinic"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Industry / Category</label>
                <input
                  type="text"
                  placeholder="e.g. Automotive & Repair"
                  value={newCompIndustry}
                  onChange={(e) => setNewCompIndustry(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Initial AI Receptionist Persona</label>
                <select
                  value={newCompPersonality}
                  onChange={(e) => setNewCompPersonality(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
                >
                  <option value="warm_friendly">Warm & Friendly</option>
                  <option value="formal_executive">Formal & Executive</option>
                  <option value="concise_direct">Concise & Direct</option>
                  <option value="energetic_welcoming">Energetic & Welcoming</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateCompanyOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-xs"
                >
                  Create Company Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
