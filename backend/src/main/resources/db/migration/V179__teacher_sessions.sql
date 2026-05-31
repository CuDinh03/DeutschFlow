-- V179: Teacher Sessions — paid 1:1 booking for teacher marketplace

-- Add rate info to teacher_profiles
ALTER TABLE teacher_profiles
    ADD COLUMN IF NOT EXISTS hourly_rate_vnd BIGINT DEFAULT 200000,
    ADD COLUMN IF NOT EXISTS max_students_per_week INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS available_slots_json JSONB DEFAULT '[]'::jsonb;

-- Core booking table
CREATE TABLE IF NOT EXISTS teacher_sessions (
    id                  BIGSERIAL PRIMARY KEY,
    student_id          BIGINT NOT NULL REFERENCES users(id),
    teacher_profile_id  BIGINT NOT NULL REFERENCES teacher_profiles(id),
    title               VARCHAR(255) NOT NULL,
    notes               TEXT,
    scheduled_at        TIMESTAMP(6) NOT NULL,
    duration_minutes    INT NOT NULL DEFAULT 60,
    price_vnd           BIGINT NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    -- PENDING → CONFIRMED → COMPLETED | CANCELLED
    payment_order_id    VARCHAR(128),
    payment_status      VARCHAR(32) DEFAULT 'UNPAID',
    -- UNPAID | PAID | REFUNDED
    teacher_rating      SMALLINT CHECK (teacher_rating BETWEEN 1 AND 5),
    student_review_text TEXT,
    teacher_notes       TEXT,
    payout_status       VARCHAR(32) DEFAULT 'PENDING',
    -- PENDING | PROCESSED | SKIPPED
    payout_processed_at TIMESTAMP(6),
    created_at          TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_sessions_student   ON teacher_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_teacher   ON teacher_sessions(teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_status    ON teacher_sessions(status);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_scheduled ON teacher_sessions(scheduled_at);
