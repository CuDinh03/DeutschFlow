-- Báo cáo chấm CHIA SẺ ĐƯỢC (checklist D6 — vòng lặp PLG): mỗi lần chấm thử thành công sinh
-- một report công khai (có watermark "Chấm bởi DeutschFlow") để giáo viên/HV chia sẻ qua Zalo.
-- KHÔNG lưu thông tin liên hệ (PII ở bảng marketing_leads); report công khai chỉ có điểm + nhận xét.
CREATE TABLE shared_grade_reports (
    id           BIGSERIAL PRIMARY KEY,
    share_token  VARCHAR(40)  NOT NULL UNIQUE,   -- token ngẫu nhiên, là "bí mật" để xem report
    topic        VARCHAR(255),
    score        INT          NOT NULL,
    feedback     TEXT         NOT NULL,
    source       VARCHAR(64)  NOT NULL DEFAULT 'FREE_GRADE_B1',
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);
-- UNIQUE(share_token) đã tạo index; không cần index thêm.
