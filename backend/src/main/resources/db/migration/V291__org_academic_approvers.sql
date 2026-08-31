-- ============================================================
-- V291: org_academic_approvers — người duyệt học vụ của trung tâm (PR-2, GĐ1)
-- ============================================================
-- Spec vận hành lớp trung tâm D13/D14 + §6; plan PR-2, quyết định P01:
-- "giáo viên trưởng" = BẢNG PHÂN CÔNG riêng theo phạm vi trung tâm (ORG) hoặc
-- từng lớp (CLASS) — KHÔNG thêm role mới vào org_members, KHÔNG mặc định cho
-- MANAGER (tách quyền duyệt học vụ khỏi quyền quản trị/tài chính). Giám đốc =
-- OWNER luôn có quyền duyệt (implicit trong OrgGuard, không cần dòng ở đây).
-- Ngoại lệ cuối tuần (D14) vẫn là assertOrgOwner — bảng này không cấp quyền đó.
--
-- Thu hồi là SOFT (revoked_at/revoked_by) để giữ lịch sử ai từng duyệt.
-- Chống trùng bằng 2 partial unique index trên các dòng ĐANG hiệu lực.
-- ============================================================

CREATE TABLE IF NOT EXISTS org_academic_approvers (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    scope VARCHAR(8) NOT NULL,
    class_id BIGINT,
    granted_by BIGINT,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_by BIGINT,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_academic_approvers_org
    ON org_academic_approvers(org_id, user_id);

-- Một người chỉ có MỘT phân công ORG đang hiệu lực trong một trung tâm…
CREATE UNIQUE INDEX IF NOT EXISTS uq_oaa_active_org_scope
    ON org_academic_approvers(org_id, user_id)
    WHERE scope = 'ORG' AND revoked_at IS NULL;

-- …và mỗi lớp tối đa MỘT phân công CLASS đang hiệu lực cho cùng người.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oaa_active_class_scope
    ON org_academic_approvers(org_id, user_id, class_id)
    WHERE scope = 'CLASS' AND revoked_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_oaa_org') THEN
    ALTER TABLE org_academic_approvers
      ADD CONSTRAINT fk_oaa_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_oaa_user') THEN
    ALTER TABLE org_academic_approvers
      ADD CONSTRAINT fk_oaa_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_oaa_class') THEN
    ALTER TABLE org_academic_approvers
      ADD CONSTRAINT fk_oaa_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_oaa_scope') THEN
    ALTER TABLE org_academic_approvers
      ADD CONSTRAINT chk_oaa_scope
      CHECK (scope IN ('ORG', 'CLASS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_oaa_scope_class') THEN
    ALTER TABLE org_academic_approvers
      ADD CONSTRAINT chk_oaa_scope_class
      CHECK ((scope = 'ORG' AND class_id IS NULL) OR (scope = 'CLASS' AND class_id IS NOT NULL));
  END IF;
END $$;
