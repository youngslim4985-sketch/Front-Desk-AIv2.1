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

router.get('/api/customers', async (req, res) => {
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
        `select id, company_id, name, phone, email, created_at
         from frontdeskai.customers
         where company_id = $1
         order by created_at desc`,
        [company.id]
      );
    });

    res.json({ customers: result.rows });
  } catch (err) {
    console.error('GET /api/customers failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/customers', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const { name, phone, email } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `insert into frontdeskai.customers
           (company_id, name, phone, email)
         values ($1, $2, $3, $4)
         returning id, company_id, name, phone, email, created_at`,
        [company.id, name.trim(), phone || null, email || null]
      );
    });

    res.status(201).json({ customer: result.rows[0] });
  } catch (err) {
    console.error('POST /api/customers failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
