-- V182: Add stripe_session_id column to payment_transactions for Stripe Checkout integration
ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
