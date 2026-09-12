import express from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { postgresResearchRouter } from './server/routes/postgresResearch';
import companiesRouter from './server/companies.route';
import customersRouter from './server/customers.route';
import appointmentsRouter from './server/appointments.route';
import callsRouter from './server/calls.route';
import settingsRouter from './server/settings.route';
import knowledgeRouter from './server/knowledge.route';
import { searchKnowledgeChunks } from './server/knowledge.service';
import pool, { withTenant } from './server/db';
import crypto from 'crypto';
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


async function startServer() {
  const app = express();
app.set('trust proxy', 1);
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);
  app.use(companiesRouter);
    app.use(customersRouter);
    app.use(appointmentsRouter);
    app.use(callsRouter);
    app.use(settingsRouter);
    app.use(knowledgeRouter);

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // PostgreSQL Subtransactions, SLRU & Internals Research Router
  app.use('/api/postgres-research', postgresResearchRouter);

  // --- API ENDPOINTS ---

  // 1. Companies & Settings

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

  // 3. Phone Configuration & Provisioning
  app.get('/api/phone', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const authResult = await pool.query(
      'select id from frontdeskai.companies where api_key_hash = $1',
      [keyHash]
    );

    const company = authResult.rows[0];

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `select
           id,
           company_id as "companyId",
           phone_number as "phoneNumber",
           voice_id as "voiceId",
           greeting_script as "greetingScript",
           created_at as "createdAt"
         from frontdeskai.phone_configs
         where company_id = $1
         order by created_at desc
         limit 1`,
        [company.id]
      );
    });

    if (!result.rows[0]) {
      return res.status(404).json({
        error: 'Phone configuration not found'
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/phone failed:', err);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.put('/api/phone/:companyId', async (req, res) => {
  const apiKey = req.header('x-api-key');
  const { companyId } = req.params;
  const { phoneNumber, voiceId, greetingScript } = req.body;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const authResult = await pool.query(
      'select id from frontdeskai.companies where api_key_hash = $1',
      [keyHash]
    );

    const company = authResult.rows[0];

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (company.id !== companyId) {
      return res.status(403).json({
        error: 'API key is not authorized for this company'
      });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `update frontdeskai.phone_configs
         set
           phone_number = coalesce($1, phone_number),
           voice_id = coalesce($2, voice_id),
           greeting_script = coalesce($3, greeting_script)
         where company_id = $4
         returning
           id,
           company_id as "companyId",
           phone_number as "phoneNumber",
           voice_id as "voiceId",
           greeting_script as "greetingScript",
           created_at as "createdAt"`,
        [
          phoneNumber ?? null,
          voiceId ?? null,
          greetingScript ?? null,
          company.id
        ]
      );
    });

    if (!result.rows[0]) {
      return res.status(404).json({
        error: 'Phone configuration not found'
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/phone/:companyId failed:', err);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.post('/api/phone/provision', async (req, res) => {
  const apiKey = req.header('x-api-key');
  const { companyId, areaCode } = req.body;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required' });
  }

  try {
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const authResult = await pool.query(
      'select id from frontdeskai.companies where api_key_hash = $1',
      [keyHash]
    );

    const company = authResult.rows[0];

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (company.id !== companyId) {
      return res.status(403).json({
        error: 'API key is not authorized for this company'
      });
    }

    const ac = areaCode || '555';

    const newNumber =
      `+1 (${ac}) ${Math.floor(200 + Math.random() * 700)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `insert into frontdeskai.phone_configs
           (company_id, phone_number)
         values ($1, $2)
         on conflict (company_id)
         do update set phone_number = excluded.phone_number
         returning
           id,
           company_id as "companyId",
           phone_number as "phoneNumber",
           voice_id as "voiceId",
           greeting_script as "greetingScript",
           created_at as "createdAt"`,
        [company.id, newNumber]
      );
    });

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/phone/provision failed:', err);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// 4. Live Call Simulator (Grounded Gemini Receptionist AI)
  app.post('/api/calls/simulate', async (req, res) => {
    try {
      const { companyId, userMessage, history = [], callerName = 'Caller', callerPhone = '+1 (555) 012-3456' } = req.body;

    if (!companyId || typeof companyId !== 'string') {
      return res.status(400).json({ error: 'companyId is required' });
    }

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const authResult = await pool.query(
      'select id, name from frontdeskai.companies where api_key_hash = $1',
      [keyHash]
    );

    const authenticatedCompany = authResult.rows[0];

    if (!authenticatedCompany) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (authenticatedCompany.id !== companyId) {
      return res.status(403).json({
        error: 'API key is not authorized for this company'
      });
    }

    const companyConfigResult = await pool.query(
      `
      select
        id,
        name,
        industry,
        business_hours as "businessHours",
        services,
        policies,
        ai_personality as "aiPersonality",
        custom_greeting as "customGreeting",
        voice_tone as "voiceTone",
        voice_config as "voiceConfig",
        transfer_phone_number as "transferPhoneNumber",
        after_hours_mode as "afterHoursMode"
      from frontdeskai.companies
      where id = $1
      `,
      [authenticatedCompany.id]
    );

    const company = companyConfigResult.rows[0];

    if (!company) {
      return res.status(404).json({
        error: 'Company configuration not found'
      });
    }

    const phoneConfig = company.voiceConfig || {};

      // RAG Retrieval step
      const ragChunks = await searchKnowledgeChunks(companyId, userMessage, 3);
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



  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const appPromise = startServer().catch((err) => {
  console.error('STARTUP_ERROR:', err);
  throw err;
});

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('HANDLER_ERROR:', err);
    return res.status(500).json({ error: 'Server startup failed' });
  }
}
