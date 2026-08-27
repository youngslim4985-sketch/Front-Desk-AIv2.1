import React, { useState, useEffect, useCallback } from 'react';
import { Company, PhoneConfig, KnowledgeDocument, CallLog, Customer, Appointment } from './types';
import { InvestigationModuleId } from './types/postgres';
import { api } from './services/api';
import { INITIAL_COMPANIES, INITIAL_PHONE_CONFIGS, INITIAL_DOCUMENTS, INITIAL_CALL_LOGS, INITIAL_CUSTOMERS, INITIAL_APPOINTMENTS } from './data/mockData';

// Front-Desk-AI UI Components & Pages
import { FrontDeskHeader } from './components/FrontDeskHeader';
import { FrontDeskNavigation, FrontDeskTab } from './components/FrontDeskNavigation';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { PhonePage } from './pages/PhonePage';
import { SettingsPage } from './pages/SettingsPage';
import { CallsPage } from './pages/CallsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CustomersPage } from './pages/CustomersPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { CallSimulatorModal } from './components/CallSimulatorModal';

// Developer Mode (Postgres Engine Lab) Components & Modules
import { Header as DevHeader } from './components/Header';
import { Navigation as DevNavigation } from './components/Navigation';
import { ArchitectureOverviewModule } from './components/modules/ArchitectureOverviewModule';
import { SubtransactionExceptionModule } from './components/modules/SubtransactionExceptionModule';
import { PgProcOverflowModule } from './components/modules/PgProcOverflowModule';
import { PgSubtransSlruModule } from './components/modules/PgSubtransSlruModule';
import { MultiXactModule } from './components/modules/MultiXactModule';
import { Pg17SlruSizingModule } from './components/modules/Pg17SlruSizingModule';
import { ConcurrencyContentionModule } from './components/modules/ConcurrencyContentionModule';
import { RunningXactsModule } from './components/modules/RunningXactsModule';
import { HotStandbyModule } from './components/modules/HotStandbyModule';
import { PsqlTerminalModule } from './components/modules/PsqlTerminalModule';
import { EncodingSqlstateModule } from './components/modules/EncodingSqlstateModule';
import { BenchmarkHubModule } from './components/modules/BenchmarkHubModule';
import { UnreleasedManifestModule } from './components/modules/UnreleasedManifestModule';
import { SourceVerificationModule } from './components/modules/SourceVerificationModule';
import { DiagnosticSqlModule } from './components/modules/DiagnosticSqlModule';
import { ExperimentalHarnessModule } from './components/modules/ExperimentalHarnessModule';
import { Bot, Sparkles, ArrowLeft, Terminal } from 'lucide-react';

export default function App() {
  // Front-Desk-AI State
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(INITIAL_COMPANIES[0].id);
  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(INITIAL_PHONE_CONFIGS['comp-apex-dental'] || null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(INITIAL_DOCUMENTS);
  const [calls, setCalls] = useState<CallLog[]>(INITIAL_CALL_LOGS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [activeTab, setActiveTab] = useState<FrontDeskTab>('dashboard');
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  // Developer Mode (PostgreSQL Engine Lab) State - Hidden from regular users, accessible via ?dev=true or Ctrl+Shift+D
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.search.includes('dev=true');
    }
    return false;
  });
  const [activeDevModule, setActiveDevModule] = useState<InvestigationModuleId>('overview');
  const [selectedPgVersion, setSelectedPgVersion] = useState<number>(16);
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState<boolean>(false);
  const [isScriptsModalOpen, setIsScriptsModalOpen] = useState<boolean>(false);

  // Keyboard shortcut listener: Ctrl+Shift+D or Cmd+Shift+D to toggle hidden developer mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDevMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // Refresh data for selected company
  const refreshCompanyData = useCallback(async (compId: string) => {
    try {
      const [fetchedDocs, fetchedPhone, fetchedCalls, fetchedCusts, fetchedApts] = await Promise.allSettled([
        api.getDocuments(compId),
        api.getPhoneConfig(compId),
        api.getCalls(compId),
        api.getCustomers(compId),
        api.getAppointments(compId),
      ]);

      if (fetchedDocs.status === 'fulfilled' && fetchedDocs.value) {
        setDocuments(fetchedDocs.value);
      }
      if (fetchedPhone.status === 'fulfilled' && fetchedPhone.value) {
        setPhoneConfig(fetchedPhone.value);
      }
      if (fetchedCalls.status === 'fulfilled' && fetchedCalls.value) {
        setCalls(fetchedCalls.value);
      }
      if (fetchedCusts.status === 'fulfilled' && fetchedCusts.value) {
        setCustomers(fetchedCusts.value);
      }
      if (fetchedApts.status === 'fulfilled' && fetchedApts.value) {
        setAppointments(fetchedApts.value);
      }
    } catch (e) {
      console.warn('Using client-side fallback state:', e);
    }
  }, []);

  // Initial load: Fetch companies list
  useEffect(() => {
    async function loadInitial() {
      try {
        const fetchedCompanies = await api.getCompanies();
        if (fetchedCompanies && fetchedCompanies.length > 0) {
          setCompanies(fetchedCompanies);
          setSelectedCompanyId(fetchedCompanies[0].id);
          refreshCompanyData(fetchedCompanies[0].id);
        }
      } catch (e) {
        console.warn('Using initial mock company data:', e);
        refreshCompanyData(INITIAL_COMPANIES[0].id);
      }
    }
    loadInitial();
  }, [refreshCompanyData]);

  // When selected company changes
  const handleSelectCompany = (company: Company) => {
    setSelectedCompanyId(company.id);
    refreshCompanyData(company.id);
  };

  // Add a new company tenant
  const handleAddCompany = async (data: { name: string; industry: string; aiPersonality: string }) => {
    try {
      const newComp = await api.createCompany(data);
      setCompanies((prev) => [...prev, newComp]);
      setSelectedCompanyId(newComp.id);
      refreshCompanyData(newComp.id);
    } catch (e) {
      console.error('Failed to create company:', e);
    }
  };

  // When tab is clicked from navigation or dashboard
  const handleNavigateTab = (tab: string) => {
    setActiveTab(tab as FrontDeskTab);
  };

  const handleToggleDevMode = (enabled: boolean) => {
    setIsDevMode(enabled);
  };

  // DEVELOPER MODE (PostgreSQL SubXacts & Engine Lab) - Accessible only when isDevMode is explicitly active
  if (isDevMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-sky-500 selection:text-white">
        
        {/* Top Dev Banner with Return Button */}
        <div className="bg-sky-950/80 border-b border-sky-800/80 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-sky-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono">
              Dev Mode
            </span>
            <span className="font-mono text-sky-200">
              PostgreSQL Subtransactions & Engine Internals Research Workbench
            </span>
          </div>

          <button
            id="btn-return-frontdesk"
            onClick={() => handleToggleDevMode(false)}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Front-Desk-AI</span>
          </button>
        </div>

        {/* Engine Lab Header */}
        <DevHeader
          activeModule={activeDevModule}
          onSelectModule={setActiveDevModule}
          selectedPgVersion={selectedPgVersion}
          onSelectPgVersion={setSelectedPgVersion}
          onOpenTerminalModal={() => setIsTerminalModalOpen(true)}
          onOpenScriptsModal={() => setIsScriptsModalOpen(true)}
        />

        {/* Dev Mode Layout */}
        <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
          {/* Dev Sidebar Navigation */}
          <DevNavigation
            activeModuleId={activeDevModule}
            onSelectModule={setActiveDevModule}
          />

          {/* Dynamic Main Research Canvas */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
            {activeDevModule === 'overview' && (
              <ArchitectureOverviewModule
                onSelectModule={setActiveDevModule}
                selectedPgVersion={selectedPgVersion}
              />
            )}

            {activeDevModule === 'unreleased_scaffold' && (
              <UnreleasedManifestModule
                onSelectModule={setActiveDevModule}
                selectedPgVersion={selectedPgVersion}
              />
            )}

            {activeDevModule === 'source_verification' && (
              <SourceVerificationModule />
            )}

            {activeDevModule === 'diagnostic_sql' && (
              <DiagnosticSqlModule />
            )}

            {activeDevModule === 'experimental_harness' && (
              <ExperimentalHarnessModule />
            )}

            {(activeDevModule === 'plpgsql_exceptions' || activeDevModule === 'xid_subtransactions') && (
              <SubtransactionExceptionModule />
            )}

            {activeDevModule === 'pgproc_overflow' && (
              <PgProcOverflowModule />
            )}

            {activeDevModule === 'pg_subtrans_slru' && (
              <PgSubtransSlruModule />
            )}

            {activeDevModule === 'multixact_pressure' && (
              <MultiXactModule />
            )}

            {activeDevModule === 'pg17_slru_sizing' && (
              <Pg17SlruSizingModule />
            )}

            {activeDevModule === 'concurrency_contention' && (
              <ConcurrencyContentionModule
                selectedPgVersion={selectedPgVersion}
              />
            )}

            {activeDevModule === 'running_xacts_wal' && (
              <RunningXactsModule />
            )}

            {activeDevModule === 'hot_standby_lag' && (
              <HotStandbyModule />
            )}

            {activeDevModule === 'psql_width_alignment' && (
              <PsqlTerminalModule />
            )}

            {activeDevModule === 'encoding_sqlstate_22p05' && (
              <EncodingSqlstateModule />
            )}

            {activeDevModule === 'reproducible_scripts' && (
              <BenchmarkHubModule />
            )}
          </main>
        </div>

        {/* Floating Modal for psql Terminal Shell */}
        {isTerminalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
                <span className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  Interactive PostgreSQL psql Shell (Diagnostic Terminal)
                </span>
                <button
                  onClick={() => setIsTerminalModalOpen(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                >
                  Close (ESC)
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
                <PsqlTerminalModule />
              </div>
            </div>
          </div>
        )}

        {/* Floating Modal for Reproducible Scripts */}
        {isScriptsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
                <span className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  Reproducible Benchmark Scripts (pgbench / SQL / Bash)
                </span>
                <button
                  onClick={() => setIsScriptsModalOpen(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                >
                  Close (ESC)
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
                <BenchmarkHubModule />
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // PRIMARY FRONT-DESK-AI APPLICATION INTERFACE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Front-Desk-AI Navigation Header */}
      <FrontDeskHeader
        companies={companies}
        selectedCompany={selectedCompany}
        phoneConfig={phoneConfig}
        onSelectCompany={handleSelectCompany}
        onOpenCallModal={() => setIsCallModalOpen(true)}
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
        onAddCompany={handleAddCompany}
      />

      {/* Main Front-Desk Container */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        
        {/* Left Operations Navigation Bar */}
        <FrontDeskNavigation
          activeTab={activeTab}
          onSelectTab={handleNavigateTab}
          documentCount={documents.length}
          callCount={calls.length}
          appointmentCount={appointments.length}
        />

        {/* Dynamic Front-Desk Operational Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardPage
              company={selectedCompany}
              phoneConfig={phoneConfig || INITIAL_PHONE_CONFIGS['comp-apex-dental']}
              calls={calls}
              appointments={appointments}
              documents={documents}
              onNavigateTab={handleNavigateTab}
              onOpenTestCall={() => setIsCallModalOpen(true)}
              onSelectCall={(call) => {
                setSelectedCall(call);
                setActiveTab('calls');
              }}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeBasePage
              companyId={selectedCompany.id}
              documents={documents}
              onDocumentsUpdated={() => refreshCompanyData(selectedCompany.id)}
            />
          )}

          {activeTab === 'phone' && (
            <PhonePage
              companyId={selectedCompany.id}
              phoneConfig={phoneConfig || INITIAL_PHONE_CONFIGS['comp-apex-dental']}
              onConfigUpdated={() => refreshCompanyData(selectedCompany.id)}
              onOpenTestCall={() => setIsCallModalOpen(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              company={selectedCompany}
              onCompanyUpdated={() => refreshCompanyData(selectedCompany.id)}
            />
          )}

          {activeTab === 'calls' && (
            <CallsPage
              calls={calls}
              selectedCall={selectedCall}
              onSelectCall={setSelectedCall}
              onOpenTestCall={() => setIsCallModalOpen(true)}
            />
          )}

          {activeTab === 'appointments' && (
            <AppointmentsPage
              companyId={selectedCompany.id}
              appointments={appointments}
              onAppointmentsUpdated={() => refreshCompanyData(selectedCompany.id)}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersPage
              customers={customers}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitecturePage />
          )}
        </main>
      </div>

      {/* Live AI Call Simulator Modal */}
      {isCallModalOpen && (
        <CallSimulatorModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          company={selectedCompany}
          phoneConfig={phoneConfig || INITIAL_PHONE_CONFIGS['comp-apex-dental']}
          onCallEnded={() => refreshCompanyData(selectedCompany.id)}
        />
      )}

    </div>
  );
}
