import {
  Company,
  KnowledgeDocument,
  PhoneConfig,
  CallLog,
  Customer,
  Appointment,
  RAGSearchResult,
} from '../types';

export const api = {
  // Companies & Settings
  getCompanies: async (): Promise<Company[]> => {
    const res = await fetch('/api/companies');
    if (!res.ok) throw new Error('Failed to fetch companies');
    return res.json();
  },

  createCompany: async (data: { name: string; industry: string; aiPersonality: string; customGreeting?: string }): Promise<Company> => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create company');
    return res.json();
  },

  getSettings: async (companyId: string): Promise<Company> => {
    const res = await fetch(`/api/settings?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (companyId: string, data: Partial<Company>): Promise<Company> => {
    const res = await fetch(`/api/settings/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Knowledge Base & PDF RAG Ingestion
  getDocuments: async (companyId: string): Promise<KnowledgeDocument[]> => {
    const res = await fetch(`/api/knowledge/documents?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch knowledge documents');
    return res.json();
  },

  uploadKnowledgeDocument: async (data: {
    companyId: string;
    title: string;
    category: string;
    rawText?: string;
    filename?: string;
    fileSize?: string;
  }): Promise<KnowledgeDocument> => {
    const res = await fetch('/api/knowledge/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to upload knowledge document');
    return res.json();
  },

  searchKnowledge: async (companyId: string, query: string): Promise<RAGSearchResult> => {
    const res = await fetch('/api/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, query }),
    });
    if (!res.ok) throw new Error('Failed to search knowledge base');
    return res.json();
  },

  deleteDocument: async (docId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/knowledge/documents/${docId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
    return res.json();
  },

  // Phone Configuration
  getPhoneConfig: async (companyId: string): Promise<PhoneConfig> => {
    const res = await fetch(`/api/phone?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch phone config');
    return res.json();
  },

  updatePhoneConfig: async (companyId: string, data: Partial<PhoneConfig>): Promise<PhoneConfig> => {
    const res = await fetch(`/api/phone/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update phone config');
    return res.json();
  },

  provisionPhoneNumber: async (companyId: string, areaCode?: string): Promise<PhoneConfig> => {
    const res = await fetch('/api/phone/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, areaCode }),
    });
    if (!res.ok) throw new Error('Failed to provision phone number');
    return res.json();
  },

  // Call Simulator & AI Conversation
  simulateCallTurn: async (data: {
    companyId: string;
    userMessage: string;
    history?: { sender: string; text: string }[];
    callerName?: string;
    callerPhone?: string;
  }): Promise<{
    responseText: string;
    ragSources: { docTitle: string; snippet: string }[];
    toolCallExecuted?: { toolName: string; args: Record<string, any>; result: string };
  }> => {
    const res = await fetch('/api/calls/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to simulate call turn');
    return res.json();
  },

  // Calls, Customers, & Appointments
  getCalls: async (companyId: string): Promise<CallLog[]> => {
    const res = await fetch(`/api/calls?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch calls');
    return res.json();
  },

  saveCallLog: async (data: Partial<CallLog>): Promise<CallLog> => {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save call log');
    return res.json();
  },

  getCustomers: async (companyId: string): Promise<Customer[]> => {
    const res = await fetch(`/api/customers?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  getAppointments: async (companyId: string): Promise<Appointment[]> => {
    const res = await fetch(`/api/appointments?companyId=${companyId}`);
    if (!res.ok) throw new Error('Failed to fetch appointments');
    return res.json();
  },

  createAppointment: async (data: Partial<Appointment>): Promise<Appointment> => {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create appointment');
    return res.json();
  },

  updateAppointmentStatus: async (id: string, status: string): Promise<Appointment> => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update appointment');
    return res.json();
  },
};
