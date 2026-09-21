import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import pool, { withTenant } from './db';

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is not configured');
}

const stripe = new Stripe(stripeSecretKey || 'sk_placeholder');

function hashApiKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function resolveCompany(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const result = await pool.query(
    `
      select
        id,
        name,
        stripe_customer_id
      from frontdeskai.companies
      where api_key_hash = $1
    `,
    [keyHash]
  );

  return result.rows[0] || null;
}

const PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  business: process.env.STRIPE_PRICE_BUSINESS,
  pro: process.env.STRIPE_PRICE_PRO,
};

router.post('/api/billing/checkout', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing x-api-key header',
    });
  }

  try {
    if (!stripeSecretKey) {
      return res.status(503).json({
        error: 'Billing is not configured',
      });
    }

    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({
        error: 'Invalid API key',
      });
    }

    const plan = String(req.body?.plan || '').toLowerCase();
    const priceId = PRICE_MAP[plan];

    if (!priceId) {
      return res.status(400).json({
        error: 'Invalid plan. Use starter, business, or pro.',
      });
    }

    let stripeCustomerId = company.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: {
          companyId: company.id,
        },
      });

      stripeCustomerId = customer.id;

      await withTenant(company.id, async (client) => {
        await client.query(
          `
            update frontdeskai.companies
            set stripe_customer_id = $2
            where id = $1
          `,
          [company.id, stripeCustomerId]
        );
      });
    }

    const appUrl =
      process.env.APP_URL ||
      'https://front-desk-a-iv2-1.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',

      customer: stripeCustomerId,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      subscription_data: {
        trial_period_days: 14,
        metadata: {
          companyId: company.id,
          plan,
        },
      },

      metadata: {
        companyId: company.id,
        plan,
      },

      success_url:
        `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${appUrl}/?billing=cancelled`,
    });

    return res.status(200).json({
      checkoutUrl: session.url,
    });
  } catch (err) {
    console.error('POST /api/billing/checkout failed:', err);

    return res.status(500).json({
      error: 'Unable to create checkout session',
    });
  }
});

export default router;
