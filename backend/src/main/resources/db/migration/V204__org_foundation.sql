-- V204__org_foundation.sql
-- Tầng tổ chức (tenant) cho B2B. Tất cả cột thêm vào bảng cũ đều NULLABLE
-- để dữ liệu B2C/giáo viên độc lập hiện hành không bị ảnh hưởng.

CREATE TABLE organizations (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,            -- dùng cho URL/định danh
    plan_code   VARCHAR(32)  REFERENCES subscription_plans(code),
    seat_limit  INT          NOT NULL DEFAULT 0,         -- 0 = chưa giới hạn; >0 = số ghế HỌC VIÊN tối đa
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | SUSPENDED
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Thành viên org + vai trò TRONG org (không phải role global của User).
-- Một user thuộc tối đa 1 org ở P1 (multi-org hoãn lại).
CREATE TABLE org_members (
    org_id    BIGINT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id   BIGINT      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    role      VARCHAR(20) NOT NULL CHECK (role IN ('OWNER','ADMIN','TEACHER','STUDENT')),
    status    VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',            -- ACTIVE | REMOVED
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_org_members_user      ON org_members(user_id);
CREATE INDEX idx_org_members_org_role  ON org_members(org_id, role) WHERE status = 'ACTIVE';

-- Lời mời (teacher ở P1; tái dùng cho student roster ở P2).
CREATE TABLE org_invitations (
    id          BIGSERIAL PRIMARY KEY,
    org_id      BIGINT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','TEACHER','STUDENT')),
    token       VARCHAR(64) NOT NULL UNIQUE,                     -- UUID, là "secret" của link
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',          -- PENDING | ACCEPTED | REVOKED | EXPIRED
    invited_by  BIGINT      NOT NULL REFERENCES users(id),
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_invitations_token ON org_invitations(token)  WHERE status = 'PENDING';
CREATE INDEX idx_org_invitations_org   ON org_invitations(org_id);

-- Denormalized fast-path: org chính của user (cho login/JWT + lọc isolation + đếm ghế).
-- BẤT BIẾN: users.org_id == org_members.org_id (ACTIVE) của user đó — đồng bộ trong 1 chỗ (OrgMembershipService).
ALTER TABLE users           ADD COLUMN org_id BIGINT REFERENCES organizations(id);
ALTER TABLE teacher_classes ADD COLUMN org_id BIGINT REFERENCES organizations(id);
CREATE INDEX idx_users_org           ON users(org_id)           WHERE org_id IS NOT NULL;
CREATE INDEX idx_teacher_classes_org ON teacher_classes(org_id) WHERE org_id IS NOT NULL;
