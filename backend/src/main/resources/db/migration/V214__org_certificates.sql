-- V214: Co-branded readiness/completion certificates (checklist D5 — "cert-lite co-brand").
-- A center (org) issues a lightweight, co-branded certificate to one of its students — a B2B
-- sales/retention artifact ("HV của trung tâm bạn nhận chứng nhận mang thương hiệu của bạn").
--
-- Distinct from cefr_certificates (V122), which a student AUTO-EARNS by passing a mock exam.
-- This one is TEACHER-ISSUED and CO-BRANDED with the center's name/logo.
--
-- Snapshots the center + student + issuer names so the certificate stays immutable even if those
-- records later change. Verified publicly by verify_token (no live PII join); the student name is
-- intentionally printed on the certificate, mirroring shared_grade_reports (V212).

-- Co-brand logo for the center (optional; certificate falls back to the center NAME when unset).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url VARCHAR(512);

CREATE TABLE org_certificates (
    id                      BIGSERIAL PRIMARY KEY,
    verify_token            VARCHAR(40)  NOT NULL UNIQUE,   -- secret in the public verify URL
    certificate_code        VARCHAR(64)  NOT NULL,          -- human-readable, e.g. DF-B1-2026-AB12CD34
    class_id                BIGINT,                         -- the class the cert was issued from (for listing)
    org_id                  BIGINT,                         -- null = no co-brand (DeutschFlow default branding)
    org_name_snapshot       VARCHAR(255),
    org_logo_url_snapshot   VARCHAR(512),
    student_user_id         BIGINT       NOT NULL,
    student_name_snapshot   VARCHAR(255) NOT NULL,
    cefr_level              VARCHAR(5)   NOT NULL,          -- A1..C2
    score                   INT,                            -- optional final/readiness score 0..100
    note                    TEXT,                           -- optional teacher remark on the certificate
    issued_by_user_id       BIGINT       NOT NULL,
    issued_by_name_snapshot VARCHAR(255),
    active                  BOOLEAN      NOT NULL DEFAULT TRUE,  -- false = revoked
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_cert_class   ON org_certificates (class_id, created_at DESC);
CREATE INDEX idx_org_cert_issuer  ON org_certificates (issued_by_user_id, created_at DESC);
CREATE INDEX idx_org_cert_student ON org_certificates (student_user_id);
