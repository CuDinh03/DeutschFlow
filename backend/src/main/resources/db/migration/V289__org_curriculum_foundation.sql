-- ============================================================
-- V289: Giáo trình trung tâm (org curriculum) — nền GĐ1 vận hành lớp trung tâm
-- ============================================================
-- Spec: specs/2026-08-31-van-hanh-lop-trung-tam-va-ke-hoach-giang-day.md (D02, §2.1, AC01)
-- Plan: plans/2026-08-31-ke-hoach-nang-cap-van-hanh-lop-trung-tam.md (PR-1, quyết định P03)
--
-- Mô hình: org_curricula (bộ giáo trình của trung tâm) → org_curriculum_versions (phiên bản,
-- DRAFT→PUBLISHED→ARCHIVED; PUBLISHED BẤT BIẾN — sửa = tạo phiên bản mới) → curriculum_lektionen
-- (Lektion có thứ tự) → curriculum_items (mục nội dung BẮT BUỘC) + curriculum_objectives (mục tiêu
-- "Ich kann…"). Lớp gắn đúng MỘT phiên bản qua class_curriculum_links (UNIQUE class_id).
--
-- Net-new, không backfill. Enum skill/content/cefr tái dùng đúng domain của
-- lesson_knowledge_point (V250) và can_do_statement (V255) để sinh bài cho lớp không đổi hợp đồng.
-- ON DELETE: org→curriculum CASCADE; curriculum→version CASCADE; version→lektion→item/objective
-- CASCADE; riêng class_curriculum_links.version_id RESTRICT — còn lớp đang gắn thì không xoá được
-- phiên bản (và nhờ chuỗi cascade, không xoá được cả bộ giáo trình).
-- ============================================================

CREATE TABLE IF NOT EXISTS org_curricula (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL,
    name VARCHAR(300) NOT NULL,
    cefr_level VARCHAR(8),
    description TEXT,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_curricula_org ON org_curricula(org_id);

CREATE TABLE IF NOT EXISTS org_curriculum_versions (
    id BIGSERIAL PRIMARY KEY,
    curriculum_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    source_note TEXT,
    published_by BIGINT,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_lektionen (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_lektionen_version
    ON curriculum_lektionen(version_id, order_index);

CREATE TABLE IF NOT EXISTS curriculum_items (
    id BIGSERIAL PRIMARY KEY,
    lektion_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    text TEXT NOT NULL,
    skill_tag VARCHAR(16),
    content_tag VARCHAR(16),
    estimated_minutes INT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_items_lektion
    ON curriculum_items(lektion_id, order_index);

CREATE TABLE IF NOT EXISTS curriculum_objectives (
    id BIGSERIAL PRIMARY KEY,
    lektion_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    text TEXT NOT NULL,
    cefr_level VARCHAR(8),
    skill_tag VARCHAR(16),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_objectives_lektion
    ON curriculum_objectives(lektion_id, order_index);

CREATE TABLE IF NOT EXISTS class_curriculum_links (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    version_id BIGINT NOT NULL,
    previous_version_id BIGINT,
    assigned_by BIGINT,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_curriculum_links_version
    ON class_curriculum_links(version_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ocur_org') THEN
    ALTER TABLE org_curricula
      ADD CONSTRAINT fk_ocur_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ocur_cefr_level') THEN
    ALTER TABLE org_curricula
      ADD CONSTRAINT chk_ocur_cefr_level
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ocv_curriculum') THEN
    ALTER TABLE org_curriculum_versions
      ADD CONSTRAINT fk_ocv_curriculum
      FOREIGN KEY (curriculum_id) REFERENCES org_curricula(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ocv_curriculum_version') THEN
    ALTER TABLE org_curriculum_versions
      ADD CONSTRAINT uq_ocv_curriculum_version UNIQUE (curriculum_id, version_no);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ocv_status') THEN
    ALTER TABLE org_curriculum_versions
      ADD CONSTRAINT chk_ocv_status
      CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_clek_version') THEN
    ALTER TABLE curriculum_lektionen
      ADD CONSTRAINT fk_clek_version
      FOREIGN KEY (version_id) REFERENCES org_curriculum_versions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_citem_lektion') THEN
    ALTER TABLE curriculum_items
      ADD CONSTRAINT fk_citem_lektion
      FOREIGN KEY (lektion_id) REFERENCES curriculum_lektionen(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_citem_skill_tag') THEN
    ALTER TABLE curriculum_items
      ADD CONSTRAINT chk_citem_skill_tag
      CHECK (skill_tag IS NULL OR skill_tag IN ('HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_citem_content_tag') THEN
    ALTER TABLE curriculum_items
      ADD CONSTRAINT chk_citem_content_tag
      CHECK (content_tag IS NULL OR content_tag IN
        ('WORTSCHATZ', 'GRAMMATIK', 'AUSSPRACHE', 'LANDESKUNDE', 'REDEMITTEL', 'STRATEGIE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_citem_minutes') THEN
    ALTER TABLE curriculum_items
      ADD CONSTRAINT chk_citem_minutes
      CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cobj_lektion') THEN
    ALTER TABLE curriculum_objectives
      ADD CONSTRAINT fk_cobj_lektion
      FOREIGN KEY (lektion_id) REFERENCES curriculum_lektionen(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cobj_cefr_level') THEN
    ALTER TABLE curriculum_objectives
      ADD CONSTRAINT chk_cobj_cefr_level
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cobj_skill_tag') THEN
    ALTER TABLE curriculum_objectives
      ADD CONSTRAINT chk_cobj_skill_tag
      CHECK (skill_tag IS NULL OR skill_tag IN ('HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ccl_class') THEN
    ALTER TABLE class_curriculum_links
      ADD CONSTRAINT fk_ccl_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ccl_version') THEN
    ALTER TABLE class_curriculum_links
      ADD CONSTRAINT fk_ccl_version
      FOREIGN KEY (version_id) REFERENCES org_curriculum_versions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ccl_class') THEN
    ALTER TABLE class_curriculum_links
      ADD CONSTRAINT uq_ccl_class UNIQUE (class_id);
  END IF;
END $$;
