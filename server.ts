import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { postgresResearchRouter } from './server/routes/postgresResearch';
import companiesRouter from './server/companies.route';
import {
  INITIAL_COMPANIES,
  INITIAL_DOCUMENTS,
  INITIAL_PHONE_CONFIGS,
  INITIAL_CALL_LOGS,
  INITIAL_CUSTOMERS,
  INITIAL_APPOINTMENTS,
  DEFAULT_VOICE_CONFIG,
} from './src/data/mockData';
import {
  Company,
  KnowledgeDocument,
  DocumentChunk,
  PhoneConfig,
  CallLog,
  Customer,
  Appointment,
} from './src/types';
import {
  listElevenLabsVoices,
  synthesizeElevenLabsSpeech,
  FALLBACK_VOICES,
} from './server/services/elevenLabs';

// In-Memory Database State for Multi-Tenant Front-Desk-AI
let companies: Company[] = [...INITIAL_COMPANIES];
let documents: KnowledgeDocument[] = [...INITIAL_DOCUMENTS];
let phoneConfigs: Record<string, PhoneConfig> = { ...INITIAL_PHONE_CONFIGS };
let callLogs: CallLog[] = [...INITIAL_CALL_LOGS];
let customers: Customer[] = [...INITIAL_CUSTOMERS];
let appointments: Appointment[] = [...INITIAL_APPOINTMENTS];

// Lazy Gemini AI Client Initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Gemini features will run in fallback simulation mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key-for-development',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Simple text chunker for RAG pipeline
function chunkText(text: string, title: string, docId: string): DocumentChunk[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    currentChunk += sentences[i] + ' ';
    if (currentChunk.length > 400 || i === sentences.length - 1) {
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: `chunk-${docId}-${chunkIndex}`,
          documentId: docId,
          chunkIndex,
          pageNumber: Math.floor(chunkIndex / 2) + 1,
          content: currentChunk.trim(),
        });
        chunkIndex++;
        currentChunk = '';
      }
    }
  }

  return chunks;
}

// Simple semantic keyword search over company chunks
function searchKnowledgeChunks(companyId: string, query: string, topK = 4) {
  const companyDocs = documents.filter((d) => d.companyId === companyId && d.status === 'indexed');
  const allChunks: (DocumentChunk & { docTitle: string; docCategory: string })[] = [];

  for (const doc of companyDocs) {
    for (const chunk of doc.chunks) {
      allChunks.push({
        ...chunk,
        docTitle: doc.title,
        docCategory: doc.category,
      });
    }
  }

  if (allChunks.length === 0) return [];

  const queryTerms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  
  const scoredChunks = allChunks.map((chunk) => {
    let score = 0;
    const contentLower = chunk.content.toLowerCase();
    const titleLower = chunk.docTitle.toLowerCase();

    for (const term of queryTerms) {
      if (contentLower.includes(term)) score += 3;
      if (titleLower.includes(term)) score += 5;
    }

    return { ...chunk, score };
  });

  scoredChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scoredChunks.slice(0, topK);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(companiesRouter);

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // PostgreSQL Subtransactions, SLRU & Internals Research Router
  app.use('/api/postgres-research', postgresResearchRouter);

  // --- API ENDPOINTS ---

  // 1. Companies & Settings
  app.get('/api/companies', (req, res) => {
    res.json(companies);
  });

  app.post('/api/companies', (req, res) => {
    const { name, industry, aiPersonality, customGreeting } = req.body;
    const newCompany: Company = {
      id: `comp-${Date.now()}`,
      name: name || 'New Business',
      industry: industry || 'General Business',
      businessHours: {
        weekdays: '9:00 AM - 5:00 PM EST',
        saturday: '10:00 AM - 2:00 PM EST',
        sunday: 'Closed',
      },
      services: [
        { id: 's1', name: 'General Consultation', duration: '30 mins', price: '$100', description: 'Standard introductory appointment.' },
      ],
      policies: [
        { id: 'p1', title: 'Cancellation Policy', content: '24 hours notice required for cancellations.' },
      ],
      aiPersonality: aiPersonality || 'warm_friendly',
      customGreeting: customGreeting || `Thank you for calling ${name || 'our business'}! I am your AI receptionist. How may I assist you today?`,
      voiceTone: 'Professional, friendly, and helpful.',
      voiceConfig: { ...DEFAULT_VOICE_CONFIG },
      transferPhoneNumber: '+1 (555) 000-1234',
      afterHoursMode: 'ai_receptionist',
    };

    companies.push(newCompany);

    // Default Phone Config
    phoneConfigs[newCompany.id] = {
      id: `phone-${Date.now()}`,
      companyId: newCompany.id,
      mode: 'ai_generated',
      phoneNumber: `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
      forwardingNumber: '+1 (555) 000-1234',
      isTransferEnabled: true,
      afterHoursAiEnabled: true,
      smsConfirmationEnabled: true,
      setupStatus: 'configured',
    };

    res.status(201).json(newCompany);
  });

  // ElevenLabs Voice Management Endpoints
  app.get('/api/voice/voices', async (_req, res) => {
    try {
      const voices = await listElevenLabsVoices();
      res.json({
        provider: 'elevenlabs',
        voices,
        configured: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim()),
      });
    } catch (_err) {
      res.json({
        provider: 'elevenlabs',
        voices: FALLBACK_VOICES,
        configured: false,
      });
    }
  });

  app.post('/api/voice/synthesize', async (req, res) => {
    try {
      const {
        voiceId,
        text,
        modelId = 'eleven_multilingual_v2',
        languageCode = 'en',
        settings,
      } = req.body;

      if (!voiceId || !text) {
        return res.status(400).json({
          error: 'voiceId and text are required',
        });
      }

      const audio = await synthesizeElevenLabsSpeech({
        voiceId,
        text,
        modelId,
        languageCode,
        settings,
      });

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audio.length.toString(),
        'Cache-Control': 'no-store',
      });

      res.send(audio);
    } catch (err: any) {
      res.status(502).json({
        error: err?.message || 'Failed to synthesize speech',
      });
    }
  });

  app.get('/api/settings', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const company = companies.find((c) => c.id === companyId) || companies[0];
    res.json(company);
  });

  app.put('/api/settings/:companyId', (req, res) => {
    const { companyId } = req.params;
    const index = companies.findIndex((c) => c.id === companyId);
    if (index === -1) {
      return res.status(404).json({ error: 'Company not found' });
    }

    companies[index] = { ...companies[index], ...req.body };
    res.json(companies[index]);
  });

  // 2. Knowledge Base & PDF RAG Ingestion
  app.get('/api/knowledge/documents', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const docs = documents.filter((d) => d.companyId === companyId);
    res.json(docs);
  });

  app.post('/api/knowledge/upload', async (req, res) => {
    try {
      const { companyId, title, category, rawText, filename, fileSize } = req.body;
      if (!companyId || !title || (!rawText && !filename)) {
        return res.status(400).json({ error: 'Missing required parameters (companyId, title, rawText or file)' });
      }

      const textContent = rawText || `Document Title: ${title}\nCategory: ${category}\n\nContents:\nProvided company operational guidelines, procedures, service list, and staff directory for ${title}.`;
      const docId = `doc-${Date.now()}`;

      // Generate Chunks
      const chunks = chunkText(textContent, title, docId);

      // Summarize with Gemini if key exists
      let summary = `Operational knowledge document "${title}" containing ${chunks.length} structured text chunks covering company procedures and guidelines.`;
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getGeminiClient();
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Briefly summarize this document for an AI Receptionist knowledge base in 2-3 sentences:\n\nTitle: ${title}\nCategory: ${category}\nText:\n${textContent.slice(0, 1500)}`,
          });
          if (response.text) {
            summary = response.text.trim();
          }
        } catch (e) {
          console.error("Error summarizing document with Gemini:", e);
        }
      }

      const newDoc: KnowledgeDocument = {
        id: docId,
        companyId,
        filename: filename || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        title,
        category: category || 'other',
        fileSize: fileSize || '1.2 MB',
        uploadedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'indexed',
        pageCount: Math.ceil(chunks.length / 2) || 1,
        chunkCount: chunks.length,
        chunks,
        summary,
      };

      documents.push(newDoc);
      res.status(201).json(newDoc);
    } catch (err: any) {
      console.error("Error processing document upload:", err);
      res.status(500).json({ error: 'Failed to ingest knowledge document' });
    }
  });

  app.post('/api/knowledge/search', (req, res) => {
    const { companyId, query } = req.body;
    if (!companyId || !query) {
      return res.status(400).json({ error: 'Missing companyId or query' });
    }
    const results = searchKnowledgeChunks(companyId, query, 5);
    res.json({ query, chunks: results });
  });

  app.delete('/api/knowledge/documents/:id', (req, res) => {
    const { id } = req.params;
    documents = documents.filter((d) => d.id !== id);
    res.json({ success: true });
  });

  // 3. Phone Configuration & Provisioning
  app.get('/api/phone', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const config = phoneConfigs[companyId] || {
      id: `phone-${Date.now()}`,
      companyId,
      mode: 'ai_generated',
      phoneNumber: '+1 (555) 381-8920',
      isTransferEnabled: true,
      afterHoursAiEnabled: true,
      smsConfirmationEnabled: true,
      setupStatus: 'configured',
    };
    res.json(config);
  });

  app.put('/api/phone/:companyId', (req, res) => {
    const { companyId } = req.params;
    phoneConfigs[companyId] = {
      ...(phoneConfigs[companyId] || { id: `phone-${Date.now()}`, companyId }),
      ...req.body,
    };
    res.json(phoneConfigs[companyId]);
  });

  app.post('/api/phone/provision', (req, res) => {
    const { companyId, areaCode } = req.body;
    const ac = areaCode || '555';
    const newNumber = `+1 (${ac}) ${Math.floor(200 + Math.random() * 700)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updatedConfig: PhoneConfig = {
      ...(phoneConfigs[companyId] || { id: `phone-${Date.now()}`, companyId }),
      companyId,
      mode: 'ai_generated',
      phoneNumber: newNumber,
      areaCode: ac,
      setupStatus: 'configured',
      isTransferEnabled: true,
      afterHoursAiEnabled: true,
      smsConfirmationEnabled: true,
    };

    phoneConfigs[companyId] = updatedConfig;
    res.json(updatedConfig);
  });

  // 4. Live Call Simulator (Grounded Gemini Receptionist AI)
  app.post('/api/calls/simulate', async (req, res) => {
    try {
      const { companyId, userMessage, history = [], callerName = 'Caller', callerPhone = '+1 (555) 012-3456' } = req.body;
      const company = companies.find((c) => c.id === companyId) || companies[0];
      const phoneConfig = phoneConfigs[companyId] || INITIAL_PHONE_CONFIGS['comp-apex-dental'];

      // RAG Retrieval step
      const ragChunks = searchKnowledgeChunks(companyId, userMessage, 3);
      const ragContextText = ragChunks.length > 0
        ? ragChunks.map((c, i) => `[Source ${i+1}: ${c.docTitle}] "${c.content}"`).join('\n\n')
        : 'No specific PDF documents matched this query. Refer to core company services and policies.';

      // Construct Grounded System Prompt
      const systemInstruction = `You are ${company.name}'s AI Front Desk Receptionist.
Personality: ${company.aiPersonality}
Greeting Style: ${company.customGreeting}
Voice/Tone Instructions: ${company.voiceTone}

Company Details:
- Business Hours: Weekdays (${company.businessHours.weekdays}), Sat (${company.businessHours.saturday}), Sun (${company.businessHours.sunday})
- Services Offered:
${company.services.map((s) => `  * ${s.name} (${s.duration}, ${s.price}): ${s.description}`).join('\n')}
- Core Policies:
${company.policies.map((p) => `  * ${p.title}: ${p.content}`).join('\n')}
- Transfer Phone Number: ${company.transferPhoneNumber} (Human transfer enabled: ${phoneConfig.isTransferEnabled})

Grounding Knowledge Base (RAG Context retrieved for caller's query):
${ragContextText}

Your Responsibilities:
1. Speak as a courteous, concise, human-like telephone receptionist.
2. Answer questions accurately using ONLY the business details and RAG context provided.
3. If the user wants to book an appointment, check availability or collect their preferred date/time and service, then execute the schedule_appointment tool call.
4. If the user is reporting a severe emergency or explicitly requests a human supervisor, call the transfer_to_human tool call.
5. Keep responses concise and formatted for spoken audio dialog (avoid markdown formatting like bold asterisks or bullet lists in spoken dialogue).`;

      // Define Tools
      const tools = [
        {
          functionDeclarations: [
            {
              name: 'schedule_appointment',
              description: 'Schedules a new appointment for the caller.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  callerName: { type: Type.STRING, description: 'Full name of caller' },
                  serviceName: { type: Type.STRING, description: 'Name of service requested' },
                  datetime: { type: Type.STRING, description: 'Preferred date and time' },
                },
                required: ['callerName', 'serviceName', 'datetime'],
              },
            },
            {
              name: 'transfer_to_human',
              description: 'Transfers the call to a human supervisor or specialist.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  reason: { type: Type.STRING, description: 'Reason for human transfer' },
                  targetPhone: { type: Type.STRING, description: 'Transfer phone number' },
                },
                required: ['reason'],
              },
            },
          ],
        },
      ];

      // Format conversation history for Gemini chat
      const contents: any[] = [];
      for (const msg of history) {
        contents.push({
          role: msg.sender === 'caller' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      let responseText = '';
      let toolCallExecuted: any = null;

      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents,
          config: {
            systemInstruction,
            tools,
            temperature: 0.7,
          },
        });

        if (geminiRes.functionCalls && geminiRes.functionCalls.length > 0) {
          const fc = geminiRes.functionCalls[0];
          if (fc.name === 'schedule_appointment') {
            const args = fc.args as any;
            const newApt: Appointment = {
              id: `apt-${Date.now()}`,
              companyId,
              customerId: `cust-${Date.now()}`,
              customerName: args.callerName || callerName,
              customerPhone: callerPhone,
              serviceName: args.serviceName || 'General Service',
              datetime: args.datetime || 'Tomorrow 10:00 AM',
              durationMinutes: 45,
              status: 'confirmed',
              bookedBy: 'ai_receptionist',
              notes: 'Booked via AI Receptionist Live Call.',
            };
            appointments.push(newApt);
            toolCallExecuted = {
              toolName: 'schedule_appointment',
              args,
              result: `Appointment confirmed for ${newApt.customerName} on ${newApt.datetime}`,
            };
            responseText = `Wonderful, ${newApt.customerName}! I have scheduled your ${newApt.serviceName} for ${newApt.datetime}. You will receive an SMS confirmation on ${callerPhone}. Is there anything else I can help you with today?`;
          } else if (fc.name === 'transfer_to_human') {
            const args = fc.args as any;
            toolCallExecuted = {
              toolName: 'transfer_to_human',
              args,
              result: `Transfer initiated to ${company.transferPhoneNumber}`,
            };
            responseText = `I understand completely. I am connecting you right now with our front desk team at ${company.transferPhoneNumber}. Please hold for one moment.`;
          }
        } else if (geminiRes.text) {
          responseText = geminiRes.text;
        }
      } else {
        // Fallback simulation mode if process.env.GEMINI_API_KEY is not set
        const lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.includes('book') || lowerMsg.includes('schedule') || lowerMsg.includes('appointment')) {
          const matchedService = company.services[0]?.name || 'Consultation';
          const newApt: Appointment = {
            id: `apt-${Date.now()}`,
            companyId,
            customerId: `cust-${Date.now()}`,
            customerName: callerName,
            customerPhone: callerPhone,
            serviceName: matchedService,
            datetime: 'Next Tuesday at 10:00 AM',
            durationMinutes: 45,
            status: 'confirmed',
            bookedBy: 'ai_receptionist',
            notes: 'Booked via AI Receptionist Simulation.',
          };
          appointments.push(newApt);
          toolCallExecuted = {
            toolName: 'schedule_appointment',
            args: { callerName, serviceName: matchedService, datetime: newApt.datetime },
            result: `Appointment confirmed for ${callerName} on ${newApt.datetime}`,
          };
          responseText = `I would be happy to book that for you! I have confirmed your appointment for ${matchedService} on ${newApt.datetime}. An SMS notification has been sent.`;
        } else if (lowerMsg.includes('human') || lowerMsg.includes('speak to someone') || lowerMsg.includes('emergency')) {
          toolCallExecuted = {
            toolName: 'transfer_to_human',
            args: { reason: 'Caller requested human assistant', targetPhone: company.transferPhoneNumber },
            result: `Call transferred to ${company.transferPhoneNumber}`,
          };
          responseText = `I am transferring you immediately to our lead receptionist at ${company.transferPhoneNumber}. Please hold while I bridge the line.`;
        } else {
          responseText = `Thank you for asking! According to ${company.name}'s guidelines, we are open ${company.businessHours.weekdays}. ${ragChunks.length > 0 ? ragChunks[0].content : company.policies[0]?.content || 'How else can I assist you today?'}`;
        }
      }

      res.json({
        responseText,
        ragSources: ragChunks.map((c) => ({ docTitle: c.docTitle, snippet: c.content })),
        toolCallExecuted,
      });
    } catch (err: any) {
      console.error('Error in AI Call Simulation:', err);
      res.status(500).json({ error: 'AI Receptionist server error' });
    }
  });

  // 5. Calls, Customers, & Appointments
  app.get('/api/calls', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const logs = callLogs.filter((c) => c.companyId === companyId);
    res.json(logs);
  });

  app.post('/api/calls', (req, res) => {
    const newCall: CallLog = {
      id: `call-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      ...req.body,
    };
    callLogs.unshift(newCall);
    res.status(201).json(newCall);
  });

  app.get('/api/customers', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const custs = customers.filter((c) => c.companyId === companyId);
    res.json(custs);
  });

  app.get('/api/appointments', (req, res) => {
    const companyId = req.query.companyId as string || companies[0].id;
    const apts = appointments.filter((a) => a.companyId === companyId);
    res.json(apts);
  });

  app.post('/api/appointments', (req, res) => {
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      status: 'confirmed',
      bookedBy: 'manual',
      ...req.body,
    };
    appointments.unshift(newApt);
    res.status(201).json(newApt);
  });

  app.put('/api/appointments/:id', (req, res) => {
    const { id } = req.params;
    const idx = appointments.findIndex((a) => a.id === id);
    if (idx !== -1) {
      appointments[idx] = { ...appointments[idx], ...req.body };
      return res.json(appointments[idx]);
    }
    res.status(404).json({ error: 'Appointment not found' });
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const appPromise = startServer();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
