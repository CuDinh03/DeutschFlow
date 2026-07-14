-- ============================================================
-- V258: materials_library — thư mục + tags + kind LINK/AUDIO/VIDEO + gắn bài tập (Phase 1)
-- ============================================================
-- Mở rộng thư viện tài liệu (V227) thành "Materials Library":
--   1. material_folders — thư mục 1 cấp để GV sắp xếp tài liệu (mirror owner PERSONAL/ORG như materials,
--      có created_by cho parity "author-or-admin" khi quản lý folder ORG — giống materials).
--   2. materials += folder_id / external_url / duration_seconds / tags[] — hỗ trợ kind LINK (allango),
--      AUDIO/VIDEO (metadata thời lượng) và phân loại tự do bằng tag.
--   3. object_key nới NULL cho kind=LINK (link ngoài không có file S3) + CHECK giữ NOT NULL cho phần còn lại.
--   4. assignment_material — bảng NỐI gắn tài liệu vào bài tập (thay attachmentUrl đơn lẻ).
--
-- TIMESTAMP vs TIMESTAMPTZ: §3.5 của PLAN dùng TIMESTAMPTZ, NHƯNG bảng materials (V227:27-28) và toàn
-- bộ migration gần đây (V249/V251/V254) dùng TIMESTAMP. Chọn TIMESTAMP cho material_folders.created_at
-- để ĐỒNG NHẤT với materials — không trộn hai kiểu timestamp trong cùng một domain.
--
-- chk_folder_owner: mirror ĐẦY ĐỦ chk_material_owner (V227:30-33) — buộc owner_scope khớp với id được set
-- (mạnh hơn XOR đơn thuần ở §3.5, để owner_scope của folder có ý nghĩa và không lệch với materials).
--
-- Additive, backward-compatible, KHÔNG di trú dữ liệu:
--   - Tất cả cột mới NULLABLE (trừ tags có DEFAULT '{}') → tài liệu cũ vẫn hợp lệ.
--   - assignment_material chỉ là DDL bảng NỐI ở Phase 1; attach/detach + API học viên là Phase 3.
--     attachmentUrl cũ GIỮ NGUYÊN (mobile 1.0.x đang đọc) — dual-read là việc Phase 3, không migrate ở đây.
--   - Xoá folder → SET NULL trên materials.folder_id (không xoá tài liệu). Xoá bài tập → CASCADE dòng nối.
--
-- Rollback (manual — Flyway CE không có undo):
--   DROP TABLE IF EXISTS assignment_material;
--   DROP INDEX IF EXISTS idx_materials_tags;
--   ALTER TABLE materials DROP CONSTRAINT IF EXISTS chk_material_object_key;
--   ALTER TABLE materials ALTER COLUMN object_key SET NOT NULL;  -- chỉ khi không còn dòng object_key IS NULL
--   ALTER TABLE materials DROP COLUMN IF EXISTS tags, DROP COLUMN IF EXISTS duration_seconds,
--     DROP COLUMN IF EXISTS external_url, DROP COLUMN IF EXISTS folder_id;
--   DROP TABLE IF EXISTS material_folders;
-- ============================================================

-- 1) Thư mục tài liệu (1 cấp) — owner PERSONAL/ORG như materials.
CREATE TABLE IF NOT EXISTS material_folders (
    id          BIGSERIAL PRIMARY KEY,
    owner_scope VARCHAR(16)  NOT NULL,                 -- 'PERSONAL' | 'ORG'
    teacher_id  BIGINT,                                -- owner khi PERSONAL
    org_id      BIGINT,                                -- owner khi ORG
    created_by  BIGINT       NOT NULL,                 -- tác giả (audit) — parity author-or-admin cho folder ORG
    name        VARCHAR(120) NOT NULL,
    order_index INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_folders_personal
    ON material_folders (teacher_id, order_index) WHERE owner_scope = 'PERSONAL';
CREATE INDEX IF NOT EXISTS idx_material_folders_org
    ON material_folders (org_id, order_index)     WHERE owner_scope = 'ORG';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_folder_owner') THEN
    ALTER TABLE material_folders
      ADD CONSTRAINT chk_folder_owner CHECK (
           (owner_scope = 'PERSONAL' AND teacher_id IS NOT NULL AND org_id IS NULL)
        OR (owner_scope = 'ORG'      AND org_id     IS NOT NULL AND teacher_id IS NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_material_folders_teacher') THEN
    ALTER TABLE material_folders
      ADD CONSTRAINT fk_material_folders_teacher
      FOREIGN KEY (teacher_id) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_material_folders_org') THEN
    ALTER TABLE material_folders
      ADD CONSTRAINT fk_material_folders_org
      FOREIGN KEY (org_id) REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_material_folders_created_by') THEN
    ALTER TABLE material_folders
      ADD CONSTRAINT fk_material_folders_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

-- 2) Mở rộng materials: thư mục, link ngoài, thời lượng, tags.
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS folder_id        BIGINT,
    ADD COLUMN IF NOT EXISTS external_url     VARCHAR(1000),      -- kind=LINK: không có object_key
    ADD COLUMN IF NOT EXISTS duration_seconds INT,                -- audio/video
    ADD COLUMN IF NOT EXISTS tags             TEXT[] NOT NULL DEFAULT '{}';

-- 3) object_key: nới NULL cho kind=LINK, CHECK giữ bắt buộc cho file thật.
--    (kind KHÔNG có CHECK ràng buộc — thêm AUDIO/VIDEO/LINK là thuần app-level, xem V227.)
ALTER TABLE materials
    ALTER COLUMN object_key DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_materials_folder') THEN
    ALTER TABLE materials
      ADD CONSTRAINT fk_materials_folder
      FOREIGN KEY (folder_id) REFERENCES material_folders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_material_object_key') THEN
    ALTER TABLE materials
      ADD CONSTRAINT chk_material_object_key
      CHECK (object_key IS NOT NULL OR kind = 'LINK');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_materials_folder ON materials (folder_id);
CREATE INDEX IF NOT EXISTS idx_materials_tags   ON materials USING GIN (tags);

-- 4) Gắn tài liệu vào bài tập (bảng NỐI). Chỉ DDL ở Phase 1; attach/detach + API học viên là Phase 3.
CREATE TABLE IF NOT EXISTS assignment_material (
    assignment_id BIGINT NOT NULL,
    material_id   BIGINT NOT NULL,
    order_index   INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (assignment_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_material_assignment
    ON assignment_material (assignment_id, order_index);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_material_assignment') THEN
    ALTER TABLE assignment_material
      ADD CONSTRAINT fk_assignment_material_assignment
      FOREIGN KEY (assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_material_material') THEN
    ALTER TABLE assignment_material
      ADD CONSTRAINT fk_assignment_material_material
      FOREIGN KEY (material_id) REFERENCES materials(id);
  END IF;
END $$;
