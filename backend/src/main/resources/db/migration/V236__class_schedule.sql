-- Pha 2: lịch buổi lớp. Pattern (lịch cố định, định kỳ) + sessions (buổi cụ thể).
-- Buổi sinh ra từ pattern nhưng sửa từng buổi được; cờ is_overridden giữ buổi đã
-- chỉnh tay khỏi bị regenerate ghi đè (quyết định PO #1: override sticky).
-- TIMESTAMP (không tz) khớp entity LocalDateTime + cột teacher_sessions.scheduled_at.

CREATE TABLE IF NOT EXISTS class_schedule_patterns (
    id               BIGSERIAL PRIMARY KEY,
    class_id         BIGINT      NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    day_of_week      SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon … 6=Sun
    start_time       TIME        NOT NULL,
    duration_minutes INT         NOT NULL CHECK (duration_minutes > 0),
    default_mode     VARCHAR(16) NOT NULL DEFAULT 'OFFLINE',                   -- ONLINE | OFFLINE
    default_room     VARCHAR(64),
    effective_from   DATE        NOT NULL,
    effective_to     DATE,                                                     -- null = vô thời hạn
    created_at       TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT chk_csp_mode CHECK (default_mode IN ('ONLINE', 'OFFLINE')),
    CONSTRAINT chk_csp_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_csp_class ON class_schedule_patterns(class_id);

CREATE TABLE IF NOT EXISTS class_sessions (
    id               BIGSERIAL PRIMARY KEY,
    class_id         BIGINT      NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    pattern_id       BIGINT      REFERENCES class_schedule_patterns(id) ON DELETE SET NULL,
    start_at         TIMESTAMP   NOT NULL,
    duration_minutes INT         NOT NULL CHECK (duration_minutes > 0),
    mode             VARCHAR(16) NOT NULL DEFAULT 'OFFLINE',
    room             VARCHAR(64),
    status           VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',                 -- SCHEDULED | CANCELLED | MOVED
    is_overridden    BOOLEAN     NOT NULL DEFAULT FALSE,                       -- true = đã chỉnh tay, pattern không ghi đè
    created_at       TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT chk_cs_mode   CHECK (mode IN ('ONLINE', 'OFFLINE')),
    CONSTRAINT chk_cs_status CHECK (status IN ('SCHEDULED', 'CANCELLED', 'MOVED'))
);
CREATE INDEX IF NOT EXISTS idx_cs_class_start ON class_sessions(class_id, start_at);
CREATE INDEX IF NOT EXISTS idx_cs_start ON class_sessions(start_at);
-- phục vụ cảnh báo trùng phòng (room + thời gian)
CREATE INDEX IF NOT EXISTS idx_cs_room_start ON class_sessions(room, start_at) WHERE room IS NOT NULL;
