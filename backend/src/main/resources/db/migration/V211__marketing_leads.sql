-- Lead magnet "AI chấm thử 1 bài Schreiben B1 miễn phí" (checklist C8).
-- Mỗi dòng = 1 lượt chấm thử public + thông tin liên hệ founder dùng để follow-up.
-- Không có FK tới users (lead chưa phải user); dùng cho cả thu lead lẫn đo COGS free-grade.
CREATE TABLE marketing_leads (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(160),
    contact       VARCHAR(255) NOT NULL,              -- email / số Zalo / điện thoại
    contact_type  VARCHAR(16)  NOT NULL DEFAULT 'EMAIL', -- EMAIL | ZALO | PHONE
    source        VARCHAR(64)  NOT NULL DEFAULT 'FREE_GRADE_B1',
    topic         VARCHAR(255),
    essay_chars   INT          NOT NULL DEFAULT 0,     -- độ dài bài (không lưu nguyên văn — privacy)
    score         INT,                                 -- điểm AI chấm (NULL nếu chấm lỗi)
    ip_hash       VARCHAR(64),                         -- SHA-256 IP (rate-limit/abuse audit, không lưu IP thô)
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

-- Truy vấn chính: lead mới nhất (founder follow-up) + đếm 24h cho global daily cap.
CREATE INDEX idx_marketing_leads_created_at ON marketing_leads (created_at DESC);
