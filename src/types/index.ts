export type AIPersonality = 'warm_friendly' | 'formal_executive' | 'concise_direct' | 'energetic_welcoming';

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: string;
  description: string;
}

export interface BusinessPolicy {
  id: string;
  title: string;
  content: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  businessHours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
  services: ServiceItem[];
  policies: BusinessPolicy[];
  aiPersonality: AIPersonality;
  customGreeting: string;
  voiceTone: string;
  transferPhoneNumber: string;
  afterHoursMode: 'ai_receptionist' | 'voicemail' | 'forward_call';
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  score?: number;
}

export interface KnowledgeDocument {
  id: string;
  companyId: string;
  filename: string;
  title: string;
  category: 'handbook' | 'faq' | 'services' | 'pricing' | 'procedures' | 'other';
  fileSize: string;
  uploadedAt: string;
  status: 'processing' | 'indexed' | 'error';
  pageCount: number;
  chunkCount: number;
  chunks: DocumentChunk[];
  summary: string;
}

export type PhoneMode = 'existing' | 'forwarding' | 'ai_generated';

export interface PhoneConfig {
  id: string;
  companyId: string;
  mode: PhoneMode;
  phoneNumber: string;
  forwardingNumber?: string;
  isTransferEnabled: boolean;
  afterHoursAiEnabled: boolean;
  smsConfirmationEnabled: boolean;
  areaCode?: string;
  setupStatus: 'configured' | 'pending_verification' | 'unconfigured';
}

export interface CallMessage {
  id: string;
  sender: 'caller' | 'receptionist' | 'system';
  text: string;
  timestamp: string;
  ragSourcesUsed?: { docTitle: string; snippet: string }[];
  toolCallExecuted?: { toolName: string; args: Record<string, any>; result: string };
}

export interface CallLog {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  timestamp: string;
  durationSeconds: number;
  status: 'completed' | 'transferred' | 'missed' | 'failed';
  sentiment: 'positive' | 'neutral' | 'negative';
  intentDetected: string;
  keyTopics: string[];
  appointmentBooked: boolean;
  appointmentDetails?: { service: string; datetime: string };
  transcript: CallMessage[];
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email?: string;
  callCount: number;
  lastCallAt: string;
  overallSentiment: 'positive' | 'neutral' | 'negative';
  notes?: string;
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  datetime: string;
  durationMinutes: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  bookedBy: 'ai_receptionist' | 'manual';
  notes?: string;
}

export interface RAGSearchResult {
  query: string;
  chunks: (DocumentChunk & { docTitle: string; docCategory: string })[];
}

export interface RepoFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  description?: string;
  content?: string;
  children?: RepoFileNode[];
}
