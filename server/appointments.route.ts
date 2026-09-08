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

const appointmentSelect = `
  select
    a.id,
    a.company_id as "companyId",
    a.customer_id as "customerId",
    c.name as "customerName",
    c.phone as "customerPhone",
    a.service_name as "serviceName",
    a.scheduled_at as "datetime",
    a.duration_minutes as "durationMinutes",
    a.status,
    a.booked_by as "bookedBy",
    a.notes
  from frontdeskai.appointments a
  left join frontdeskai.customers c
    on c.id = a.customer_id
   and c.company_id = a.company_id
`;

router.get('/api/appointments', async (req, res) => {
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
        `${appointmentSelect}
         where a.company_id = $1
         order by a.scheduled_at asc`,
        [company.id]
      );
    });

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/appointments failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/appointments', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const {
    customerId,
    serviceName,
    datetime,
    durationMinutes,
    status = 'confirmed',
    bookedBy = 'manual',
    notes = null,
  } = req.body;

  if (!customerId || !datetime) {
    return res.status(400).json({
      error: 'customerId and datetime are required',
    });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      const inserted = await client.query(
        `insert into frontdeskai.appointments
          (
            company_id,
            customer_id,
            scheduled_at,
            status,
            service_name,
            duration_minutes,
            booked_by,
            notes
          )
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          company.id,
          customerId,
          datetime,
          status,
          serviceName || null,
          durationMinutes || null,
          bookedBy,
          notes,
        ]
      );

      return client.query(
        `${appointmentSelect}
         where a.id = $1
           and a.company_id = $2`,
        [inserted.rows[0].id, company.id]
      );
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/appointments failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/appointments/:id', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const { id } = req.params;
  const {
    customerId,
    serviceName,
    datetime,
    durationMinutes,
    status,
    bookedBy,
    notes,
  } = req.body;

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      const updated = await client.query(
        `update frontdeskai.appointments
         set
           customer_id = coalesce($1, customer_id),
           service_name = coalesce($2, service_name),
           scheduled_at = coalesce($3, scheduled_at),
           duration_minutes = coalesce($4, duration_minutes),
           status = coalesce($5, status),
           booked_by = coalesce($6, booked_by),
           notes = coalesce($7, notes)
         where id = $8
           and company_id = $9
         returning id`,
        [
          customerId ?? null,
          serviceName ?? null,
          datetime ?? null,
          durationMinutes ?? null,
          status ?? null,
          bookedBy ?? null,
          notes ?? null,
          id,
          company.id,
        ]
      );

      if (updated.rows.length === 0) {
        return null;
      }

      return client.query(
        `${appointmentSelect}
         where a.id = $1
           and a.company_id = $2`,
        [id, company.id]
      );
    });

    if (!result) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/appointments/:id failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
