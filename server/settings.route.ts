import express from 'express';
import crypto from 'crypto';
import pool, { withTenant } from './db';

const router = express.Router();

function hashApiKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function resolveCompany(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const result = await pool.query(
    'select id from frontdeskai.companies where api_key_hash = $1',
    [keyHash]
  );

  return result.rows[0] || null;
}

const settingsSelect = `
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
    after_hours_mode as "afterHoursMode",
    created_at as "createdAt"
  from frontdeskai.companies
`;

router.get('/api/settings', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `${settingsSelect} where id = $1`,
        [company.id]
      );
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/settings failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.put('/api/settings/:companyId', async (req, res) => {
  const apiKey = req.header('x-api-key');
  const { companyId } = req.params;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (company.id !== companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      name,
      industry,
      businessHours,
      services,
      policies,
      aiPersonality,
      customGreeting,
      voiceTone,
      voiceConfig,
      transferPhoneNumber,
      afterHoursMode,
    } = req.body;

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `update frontdeskai.companies
         set
           name = coalesce($2, name),
           industry = $3,
           business_hours = $4::jsonb,
           services = $5::jsonb,
           policies = $6::jsonb,
           ai_personality = $7,
           custom_greeting = $8,
           voice_tone = $9,
           voice_config = $10::jsonb,
           transfer_phone_number = $11,
           after_hours_mode = $12
         where id = $1
         returning
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
           after_hours_mode as "afterHoursMode",
           created_at as "createdAt"`,
        [
          company.id,
          name || null,
          industry || null,
          JSON.stringify(businessHours || {}),
          JSON.stringify(services || []),
          JSON.stringify(policies || []),
          aiPersonality || null,
          customGreeting || null,
          voiceTone || null,
          voiceConfig ? JSON.stringify(voiceConfig) : null,
          transferPhoneNumber || null,
          afterHoursMode || null,
        ]
      );
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/settings/:companyId failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
