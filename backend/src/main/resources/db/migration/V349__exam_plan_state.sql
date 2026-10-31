-- LT3 — lộ trình đếm ngược tới ngày thi. KHÔNG lưu cả kế hoạch: kế hoạch sinh lại lúc đọc từ hồ sơ
-- và kết quả mới nhất. Bảng này chỉ giữ những gì không suy lại được: ngày bắt đầu, phiên bản thuật
-- toán, và trọng tâm các tuần đã chốt để tuần đã qua không nhảy khi có đề full mới.
--
-- Phụ thuộc: số này đứng sau V348 của PR #732 (duyệt đề telc B1 Set 4), PR đó phải lên prod trước.
CREATE TABLE exam_plan_state (
    user_id           BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    provider          VARCHAR(16) NOT NULL,
    level             VARCHAR(4)  NOT NULL,
    target_date       DATE        NOT NULL,
    start_date        DATE        NOT NULL,
    algorithm_version INT         NOT NULL,
    -- {"3": ["HOEREN:1", "LESEN:2"]}: số tuần → các Teil trọng tâm đã chốt
    locked_weeks_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
