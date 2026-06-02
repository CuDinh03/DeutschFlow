-- Normalize historical Stripe payments from 'COMPLETED' to 'SUCCESS'.
-- Stripe's webhook handler previously wrote 'COMPLETED' while all other providers
-- (MoMo, Apple) write 'SUCCESS'. The monthly-revenue query filters on status = 'SUCCESS',
-- so Stripe payments were silently excluded from revenue reporting.
-- The webhook handler now writes 'SUCCESS' for all new transactions; this migration
-- aligns the existing rows so reporting is consistent across all providers.
UPDATE payment_transactions
SET status = 'SUCCESS'
WHERE provider = 'STRIPE'
  AND status = 'COMPLETED';
