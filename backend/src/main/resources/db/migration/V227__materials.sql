-- V227 — B2B model §5: persisted teaching materials with explicit PERSONAL/ORG ownership,
-- plus a separate class-attachment join table (class is NOT shoved into materials).
-- One table + owner_scope + CHECK forcing exactly one owner kind (no polymorphic owner_id).
--
-- NOTE: the doc's DDL references `classes(id)`; the real class table is `teacher_classes(id)`
-- (there is no `classes` table). class_materials.class_id therefore FKs teacher_classes.
--
-- Rollback (manual — Flyway CE has no undo):
--   DROP TABLE IF EXISTS class_materials;
--   DROP TABLE IF EXISTS materials;

CREATE TABLE materials (
  id           BIGSERIAL PRIMARY KEY,
  owner_scope  VARCHAR(16) NOT NULL,                  -- 'PERSONAL' | 'ORG'
  teacher_id   BIGINT REFERENCES users(id),           -- owner when PERSONAL
  org_id       BIGINT REFERENCES organizations(id),   -- owner when ORG
  created_by   BIGINT NOT NULL REFERENCES users(id),  -- author (audit; survives leaving the org)

  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  kind         VARCHAR(16)  NOT NULL,                  -- PPTX | PDF | DOCX | IMAGE | OTHER
  object_key   VARCHAR(512) NOT NULL,                  -- S3 key (no blob in DB)
  mime_type    VARCHAR(120),
  size_bytes   BIGINT,
  visibility   VARCHAR(16)  NOT NULL DEFAULT 'ORG_ALL',-- ORG: ORG_ALL | OWNER_ONLY
  status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | ARCHIVED | DELETED (soft)
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT chk_material_owner CHECK (
       (owner_scope = 'PERSONAL' AND teacher_id IS NOT NULL AND org_id IS NULL)
    OR (owner_scope = 'ORG'      AND org_id     IS NOT NULL AND teacher_id IS NULL)
  )
);

CREATE INDEX idx_mat_personal ON materials (teacher_id, status, created_at DESC) WHERE owner_scope='PERSONAL';
CREATE INDEX idx_mat_org      ON materials (org_id,     status, created_at DESC) WHERE owner_scope='ORG';
CREATE INDEX idx_mat_author   ON materials (created_by);

CREATE TABLE class_materials (
  class_id    BIGINT NOT NULL REFERENCES teacher_classes(id),
  material_id BIGINT NOT NULL REFERENCES materials(id),
  attached_by BIGINT NOT NULL REFERENCES users(id),
  attached_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, material_id)
);
