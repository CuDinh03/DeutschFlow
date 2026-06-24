-- TF-1 prod patch: enable pool_unlimited for org ATB (org_id = 6)
-- Root cause: V237 P-14 fail-safe blocks AI calls when pool=0 & pool_unlimited=false.
-- ATB is a legitimate org → grant unlimited pool so AI features work.
-- Run AFTER deploying the code fixes (OrgAnalyticsDto+poolUnlimited FE fix).

BEGIN;

-- Verify before update
SELECT id, name, pool_unlimited, monthly_token_pool
FROM organizations
WHERE id = 6;

-- Enable unlimited pool for ATB
UPDATE organizations
SET pool_unlimited = true,
    updated_at    = CURRENT_TIMESTAMP
WHERE id = 6;

-- Confirm
SELECT id, name, pool_unlimited, monthly_token_pool
FROM organizations
WHERE id = 6;

COMMIT;
