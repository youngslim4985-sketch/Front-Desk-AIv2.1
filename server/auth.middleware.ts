import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import pool from './db';

export type AuthenticatedCompany = {
  id: string;
  name: string;
  subscription_status: string | null;
  plan: string | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
};

export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
}

export async function resolveCompany(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const result = await pool.query(
    `SELECT
       id,
       name,
       subscription_status,
       plan,
       trial_ends_at,
       current_period_end
     FROM frontdeskai.companies
     WHERE api_key_hash = $1
     LIMIT 1`,
    [keyHash]
  );

  return (result.rows[0] as AuthenticatedCompany | undefined) ?? null;
}

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
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

    const allowedStatuses = new Set(['trialing', 'active']);

    if (!company.subscription_status ||
        !allowedStatuses.has(company.subscription_status)) {
      return res.status(403).json({
        error: 'Subscription required',
        subscriptionStatus: company.subscription_status
      });
    }

    res.locals.company = company;

    next();
  } catch (error) {
    console.error('Subscription authentication failed:', error);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}