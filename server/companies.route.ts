import express from 'express';
import crypto from 'crypto';
import pool, { withTenant } from './db';

const router = express.Router();

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

router.get('/api/companies', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const keyHash = hashApiKey(apiKey);

    const lookup = await pool.query(
      'select id, name from frontdeskai.companies where api_key_hash = $1',
      [keyHash]
    );

    if (lookup.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const company = lookup.rows[0];

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        'select id, name, created_at from frontdeskai.companies where id = $1',
        [company.id]
      );
    });

    res.json({ companies: result.rows });
  } catch (err) {
    console.error('GET /api/companies failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/api/companies', async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  const rawApiKey = `fdai_${crypto.randomBytes(32).toString('hex')}`;
  const apiKeyHash = hashApiKey(rawApiKey);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const companyResult = await client.query(
      `insert into frontdeskai.companies (name, api_key_hash)
       values ($1, $2)
       returning id, name, created_at`,
      [name.trim(), apiKeyHash]
    );

    const company = companyResult.rows[0];

    await client.query(
      `select set_config('app.current_company_id', $1, true)`,
      [company.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      company,
      apiKey: rawApiKey,
      warning: 'Save this API key securely. It will not be shown again.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/companies failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
