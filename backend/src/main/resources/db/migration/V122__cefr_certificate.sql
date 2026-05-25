-- V122: CEFR Certificate System
-- Generates certificate when student passes a level's Abschlusstest

CREATE TABLE IF NOT EXISTS cefr_certificates (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  cefr_level    VARCHAR(5) NOT NULL,       -- A1, A2, B1...
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  exam_score    INT,                        -- Score that triggered certificate
  attempt_id    BIGINT,                     -- Reference to mock_exam_attempts
  certificate_code VARCHAR(50) UNIQUE,      -- e.g. DF-A1-2026-00001
  is_active     BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, cefr_level)
);

CREATE INDEX idx_cert_user ON cefr_certificates (user_id);

-- Auto-generate certificate code
CREATE OR REPLACE FUNCTION generate_certificate_code(level VARCHAR, user_id BIGINT)
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'DF-' || level || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(user_id::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
