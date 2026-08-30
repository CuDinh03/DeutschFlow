-- V287 — Tiến độ onboarding phía SERVER của người đã có tài khoản.
--
-- Vì sao cần (spec docs/onboarding-flow-spec.md, bất biến I-2):
-- Mọi trạng thái từ bước AUTH trở đi phải có bản ghi server-side. Hôm nay tiến độ
-- chỉ sống trên thiết bị (cờ SecureStore/localStorage), nên đổi máy giữa chừng là
-- mất sạch, và không có cách nào đo funnel thật — chỉ đo được sự kiện rời rạc.
--
-- `activated_at` là cột quan trọng nhất bảng này: ACTIVATION của sản phẩm được
-- định nghĩa là HOÀN THÀNH BÀI HỌC ĐẦU TIÊN, không phải "đã lưu hồ sơ". Sự kiện
-- `onboarding_completed` đang chạy hôm nay bắn ngay sau khi lưu hồ sơ ở CẢ web lẫn
-- mobile, tức mọi funnel dựng trên nó đang đo sai thứ mình tưởng (spec §1).

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    user_id              BIGINT       PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    flow_version         VARCHAR(16)  NOT NULL,
    last_step            VARCHAR(32)  NOT NULL,
    completed_activities JSONB        NOT NULL DEFAULT '[]'::jsonb,
    activated_at         TIMESTAMPTZ,
    core_completed_at    TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_onboarding_progress IS
    'Tiến độ onboarding server-side, một dòng mỗi user. Cho phép resume trên thiết bị khác (GET /api/onboarding/progress).';
COMMENT ON COLUMN user_onboarding_progress.flow_version IS
    'Phiên bản luồng đã dẫn user này qua onboarding (onb_v3). Giữ nguyên kể cả khi rollout đổi — dùng để so cohort.';
COMMENT ON COLUMN user_onboarding_progress.last_step IS 'State cuối đã đạt, theo state machine ở spec §2.1.';
COMMENT ON COLUMN user_onboarding_progress.completed_activities IS
    'Mảng hoạt động đã xong: ["a0_lesson"] | ["placement"] | ["ai_convo"] …';
COMMENT ON COLUMN user_onboarding_progress.activated_at IS
    'ACTIVATION = hoàn thành bài học ĐẦU TIÊN. KHÔNG phải lúc lưu hồ sơ, KHÔNG phải onboarding_completed (spec §1).';
COMMENT ON COLUMN user_onboarding_progress.core_completed_at IS
    'Đi hết luồng onboarding kể cả bước đặt nhắc học. Khác activated_at: xong luồng không có nghĩa đã học gì.';
