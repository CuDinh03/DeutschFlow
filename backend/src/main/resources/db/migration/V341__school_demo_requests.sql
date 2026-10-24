-- ============================================================
-- V341: Yêu cầu đặt lịch demo từ trang trung tâm (24/10/2026, đợt 3a định hướng A + B + E)
--
-- Form "Đặt lịch demo 20 phút" ở /trung-tam/ và /en/schools/ (khách lạ, không đăng nhập). Tách bảng
-- riêng thay vì nhét vào marketing_leads: bảng đó còn làm bộ đếm rate-limit/trần COGS của lead magnet
-- chấm thử (đếm theo ip_hash + created_at, không phân biệt nguồn) — dồn lead trung tâm vào sẽ ăn mất
-- lượt chấm thử của chính khách đó. Cột cũng khác hẳn (trung tâm, nước, quy mô).
--
-- Không lưu IP thô (ip_hash = SHA-256 như marketing_leads). Không FK tới users: người gửi chưa là user.
--
-- Số V341: V339–V340 thuộc PR K4 (#722, chưa merge). Flyway out-of-order: false ⇒ PR K4 phải lên
-- prod TRƯỚC bản này; nếu không thì đổi số trước khi merge.
-- ============================================================

CREATE TABLE IF NOT EXISTS school_demo_requests (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(160) NOT NULL,
    organization    VARCHAR(200) NOT NULL,
    country         VARCHAR(80)  NOT NULL,
    student_count   VARCHAR(16)  NOT NULL,
    contact_channel VARCHAR(16)  NOT NULL,
    contact         VARCHAR(255) NOT NULL,
    message         VARCHAR(1000),
    locale          VARCHAR(8)   NOT NULL DEFAULT 'vi',
    ip_hash         VARCHAR(64),
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT chk_school_demo_student_count CHECK (student_count IN ('LT20', 'S20_50', 'S50_200', 'GT200')),
    CONSTRAINT chk_school_demo_contact_channel CHECK (contact_channel IN ('EMAIL', 'ZALO', 'WHATSAPP', 'PHONE')),
    CONSTRAINT chk_school_demo_locale CHECK (locale IN ('vi', 'en', 'de'))
);

-- Admin xem mới nhất trước; đếm 24h cho trần chống spam.
CREATE INDEX IF NOT EXISTS idx_school_demo_requests_created_at ON school_demo_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_demo_requests_ip_hash ON school_demo_requests (ip_hash, created_at);
