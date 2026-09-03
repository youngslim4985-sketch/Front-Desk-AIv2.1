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

export default router;
