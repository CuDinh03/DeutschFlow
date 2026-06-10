-- V205__org_p2.sql
-- B2B Phase 2: pool token AI hằng tháng + thời hạn license của org.
-- Cả hai cột đều có default an toàn để org P1 hiện hành không bị ảnh hưởng.

ALTER TABLE organizations ADD COLUMN monthly_token_pool BIGINT NOT NULL DEFAULT 0;  -- 0 = không giới hạn (unlimited)
ALTER TABLE organizations ADD COLUMN valid_until        TIMESTAMPTZ;                 -- hết hạn license; NULL = vĩnh viễn khi status ACTIVE
