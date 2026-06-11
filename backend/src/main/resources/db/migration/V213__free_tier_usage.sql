-- Đếm lượt dùng tính năng AI ĐẮT theo ngày cho GV gói-miễn-phí (non-org) — checklist D6.
-- "Unlimited chấm core" (chấm text) KHÔNG đếm ở đây; chỉ cap tính năng đắt (PPTX, OCR ảnh).
-- GV thuộc org đã được org token-pool quản → không dùng bảng này.
CREATE TABLE free_tier_usage (
    user_id    BIGINT      NOT NULL,
    usage_date DATE        NOT NULL,
    feature    VARCHAR(48) NOT NULL,   -- PPTX | OCR_GRADE
    count      INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date, feature)
);
