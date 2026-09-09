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
    'select id, name from frontdeskai.companies where api_key_hash = $1',
    [keyHash]
  );

  return result.rows[0] || null;
}

const callSelect = `
  select
    calls.id,
    calls.company_id as "companyId",
    calls.customer_id as "customerId",
    customers.name as "customerName",
    customers.phone as "customerPhone",
    calls.created_at as "timestamp",
    calls.duration_seconds as "durationSeconds",
    calls.status,
    calls.sentiment,
    calls.intent_detected as "intentDetected",
    coalesce(calls.key_topics, ARRAY[]::text[]) as "keyTopics",
    calls.appointment_booked as "appointmentBooked",
    calls.appointment_details as "appointmentDetails",
    coalesce(calls.transcript, '[]'::jsonb) as transcript
  from frontdeskai.calls calls
  left join frontdeskai.customers customers
    on customers.id = calls.customer_id
   and customers.company_id = calls.company_id
`;

router.get('/api/calls', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing x-api-key header'
    });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `${callSelect}
         where calls.company_id = $1
         order by calls.created_at desc`,
        [company.id]
      );
    });

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/calls failed:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/api/calls', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing x-api-key header'
    });
  }

  const {
    customerId = null,
    durationSeconds = 0,
    status = 'completed',
    sentiment = 'neutral',
    intentDetected = '',
    keyTopics = [],
    appointmentBooked = false,
    appointmentDetails = null,
    transcript = [],
  } = req.body;

  if (!Array.isArray(keyTopics)) {
    return res.status(400).json({
      error: 'keyTopics must be an array'
    });
  }

  if (!Array.isArray(transcript)) {
    return res.status(400).json({
      error: 'transcript must be an array'
    });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }

    const result = await withTenant(company.id, async (client) => {
      const inserted = await client.query(
        `insert into frontdeskai.calls
          (
            company_id,
            customer_id,
            transcript,
            sentiment,
            duration_seconds,
            status,
            intent_detected,
            key_topics,
            appointment_booked,
            appointment_details
          )
         values (
           $1,
           $2,
           $3::jsonb,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10::jsonb
         )
         returning id`,
        [
          company.id,
          customerId,
          JSON.stringify(transcript),
          sentiment,
          durationSeconds,
          status,
          intentDetected,
          keyTopics,
          appointmentBooked,
          appointmentDetails
            ? JSON.stringify(appointmentDetails)
            : null,
        ]
      );

      return client.query(
        `${callSelect}
         where calls.id = $1
           and calls.company_id = $2`,
        [inserted.rows[0].id, company.id]
      );
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/calls failed:', err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
