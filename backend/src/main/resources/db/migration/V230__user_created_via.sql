-- V230 — Provenance `created_via` trên users (B2B model §2.2).
-- ADDITIVE + nullable: ghi NGUỒN TẠO tài khoản, KHÔNG ảnh hưởng quyền/sở hữu.
-- Mở self-signup tương lai = thêm endpoint set created_via=SELF, không migrate mô hình.
--
-- Rollback (thủ công — Flyway CE không undo):
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_created_via;
--   ALTER TABLE users DROP COLUMN IF EXISTS created_via;

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_via VARCHAR(16);

-- CHECK cho phép 5 nguồn HOẶC NULL (NULL IN (...) = NULL → CHECK chỉ fail khi FALSE).
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_created_via;
ALTER TABLE users ADD CONSTRAINT chk_users_created_via
    CHECK (created_via IN ('ADMIN','OWNER','MANAGER','SELF','CSV'));

-- Backfill best-effort cho data cũ (provenance lịch sử không lưu; created_via KHÔNG quyết định quyền,
-- nên giá trị backfill chỉ mang tính mô tả). Heuristic:
--   1) platform-admin → ADMIN
--   2) học viên đang là thành viên org ACTIVE → CSV (đường roster phổ biến nhất)
--   3) còn lại (B2C cũ, giáo viên, owner/manager không suy được) → SELF
UPDATE users SET created_via = 'ADMIN'
 WHERE created_via IS NULL AND role = 'ADMIN';

UPDATE users u SET created_via = 'CSV'
 WHERE u.created_via IS NULL
   AND u.role = 'STUDENT'
   AND EXISTS (SELECT 1 FROM org_members m
                WHERE m.user_id = u.id AND m.role = 'STUDENT' AND m.status = 'ACTIVE');

UPDATE users SET created_via = 'SELF'
 WHERE created_via IS NULL;
