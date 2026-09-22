import express from 'express';
import Stripe from 'stripe';
import pool, { withTenant } from './db';

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not configured');
}

const stripe = new Stripe(stripeSecretKey);

router.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!webhookSecret) {
      return res.status(503).json({
        error: 'Stripe webhook secret is not configured',
      });
    }

    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({
        error: 'Missing Stripe signature',
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);

      return res.status(400).json({
        error: 'Invalid Stripe webhook signature',
      });
    }

    try {
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const companyResult = await pool.query(
          `
          select id
          from frontdeskai.companies
          where stripe_customer_id = $1
          limit 1
          `,
          [customerId]
        );

        const company = companyResult.rows[0];

        if (!company) {
          console.warn(
            'Stripe webhook: no company for customer',
            customerId
          );

          return res.status(200).json({ received: true });
        }

        const plan =
          subscription.metadata?.plan ||
          subscription.items.data[0]?.price?.metadata?.plan ||
          null;

        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null;

        const currentPeriodEnd =
          subscription.items.data[0]?.current_period_end
            ? new Date(
                subscription.items.data[0].current_period_end * 1000
              )
            : null;

        await withTenant(company.id, async (client) => {
          await client.query(
            `
            update frontdeskai.companies
            set
              stripe_subscription_id = $2,
              subscription_status = $3,
              plan = coalesce($4, plan),
              trial_ends_at = $5,
              current_period_end = $6
            where id = $1
            `,
            [
              company.id,
              subscription.id,
              subscription.status,
              plan,
              trialEndsAt,
              currentPeriodEnd,
            ]
          );
        });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Stripe webhook processing failed:', err);

      return res.status(500).json({
        error: 'Webhook processing failed',
      });
    }
  }
);

export default router;
