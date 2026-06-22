-- V229 — Hoàn tất B2B model §1 (rename org-role ADMIN → MANAGER).
-- V225 đã ĐỔI DỮ LIỆU (org_members/org_invitations: ADMIN → MANAGER) nhưng QUÊN sửa
-- CHECK constraint DDL của V204 — constraint vẫn chỉ cho phép 'ADMIN'. Hệ quả: mọi INSERT/UPDATE
-- gán role='MANAGER' (OrgMembershipService.ASSIGNABLE_ROLES = {MANAGER, TEACHER}) sẽ vi phạm
-- constraint và FAIL trên DB thật. Migration này thay constraint cho khớp tập role sau V225.
--
-- An toàn: V225 đã chuyển hết row ADMIN → MANAGER (0 row ADMIN còn lại), nên thắt constraint
-- bỏ 'ADMIN' không làm hỏng dữ liệu hiện có. Idempotent (DROP IF EXISTS + ADD).
--
-- Rollback (thủ công — Flyway CE không có undo):
--   ALTER TABLE org_members     DROP CONSTRAINT IF EXISTS org_members_role_check;
--   ALTER TABLE org_members     ADD  CONSTRAINT org_members_role_check
--        CHECK (role IN ('OWNER','ADMIN','TEACHER','STUDENT'));
--   ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check;
--   ALTER TABLE org_invitations ADD  CONSTRAINT org_invitations_role_check
--        CHECK (role IN ('ADMIN','TEACHER','STUDENT'));

-- Phòng vệ: nếu còn sót row ADMIN (V225 chưa chạy / dữ liệu lệch) thì DỪNG để không mất quyền âm thầm.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM org_members     WHERE role = 'ADMIN')
  OR EXISTS (SELECT 1 FROM org_invitations WHERE role = 'ADMIN') THEN
    RAISE EXCEPTION 'V229: còn row org-role=ADMIN — chạy V225 (ADMIN→MANAGER) trước khi thắt constraint.';
  END IF;
END $$;

-- org_members.role: OWNER | MANAGER | TEACHER | STUDENT (bỏ ADMIN).
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE org_members ADD  CONSTRAINT org_members_role_check
    CHECK (role IN ('OWNER','MANAGER','TEACHER','STUDENT'));

-- org_invitations.role: MANAGER | TEACHER | STUDENT (OWNER không mời — tạo qua AdminOrgService).
ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check;
ALTER TABLE org_invitations ADD  CONSTRAINT org_invitations_role_check
    CHECK (role IN ('MANAGER','TEACHER','STUDENT'));
