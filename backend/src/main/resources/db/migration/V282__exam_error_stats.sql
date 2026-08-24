-- Đợt 5a Luyện thi Nói: thống kê lỗi theo dạng bài (user × hệ × cấp × Teil × mã lỗi)
-- cho màn "Ôn yếu điểm" (/api/speaking/exam/weakness). Upsert tại thời điểm ingest
-- (chấm mock + chấm nhanh drill) — tránh quét JSON score_sheet khi đọc.

CREATE TABLE speaking_exam_error_stats (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL,
    provider      VARCHAR(16)  NOT NULL,
    level         VARCHAR(8)   NOT NULL,
    teil_no       INT          NOT NULL,
    archetype     VARCHAR(32)  NOT NULL,
    error_code    VARCHAR(80)  NOT NULL,
    seen_count    INT          NOT NULL DEFAULT 0,
    last_seen_at  TIMESTAMP    NOT NULL,
    last_original TEXT,
    last_correction TEXT,
    CONSTRAINT uq_exam_error_stats UNIQUE (user_id, provider, level, teil_no, error_code)
);

CREATE INDEX idx_exam_error_stats_user_seen ON speaking_exam_error_stats (user_id, last_seen_at DESC);

COMMENT ON TABLE speaking_exam_error_stats IS 'Loi phat hien trong luyen thi noi, gom theo dang bai — nguon cho man On yeu diem';
