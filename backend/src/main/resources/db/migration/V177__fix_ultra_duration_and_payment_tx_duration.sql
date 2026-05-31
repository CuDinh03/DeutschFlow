-- Fix ULTRA plan: 2 months, not 1
UPDATE subscription_plans SET duration_months = 2 WHERE code = 'ULTRA';

-- Store duration per transaction so fulfillment doesn't rely on a hardcoded constant
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS duration_months INT;
